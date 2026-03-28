import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations, organizationMembers, users, organizationCredits, organizationInvitations, projects, clips, creditTransactions } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, and, sql, inArray } from 'drizzle-orm';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = getSessionToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// GET /api/organizations/[id]/usage — Director dashboard
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: orgId } = await params;

  // Verify org exists
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  // Verify the requester is a director of this org
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.role, 'director')
      )
    )
    .limit(1);

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch all members with user details
  const membersWithUsers = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      email: users.email,
      name: users.name,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.orgId, orgId));

  const memberIds = membersWithUsers.map((m) => m.userId);

  // Fetch pool credits (sum of all organization_credits rows for this org)
  const [creditRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${organizationCredits.amount}), 0)` })
    .from(organizationCredits)
    .where(eq(organizationCredits.orgId, orgId))
    .limit(1);

  // Fetch pending invitations (include token for invite link generation)
  const invitations = await db
    .select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      status: organizationInvitations.status,
      expiresAt: organizationInvitations.expiresAt,
      token: organizationInvitations.token,
    })
    .from(organizationInvitations)
    .where(eq(organizationInvitations.orgId, orgId));

  // Batch-fetch all stats in 3 queries (no N+1)
  const [projectsRows, clipsRows, creditsRows] = await Promise.all([
    // projectsCreated per member
    memberIds.length > 0
      ? db
          .select({
            userId: projects.userId,
            count: sql<number>`COUNT(*)`,
          })
          .from(projects)
          .where(and(eq(projects.organizationId, orgId), inArray(projects.userId, memberIds)))
          .groupBy(projects.userId)
      : ([] as { userId: string; count: number }[]),

    // clipsGenerated per member (via projects)
    memberIds.length > 0
      ? db
          .select({
            userId: projects.userId,
            count: sql<number>`COUNT(${clips.id})`,
          })
          .from(clips)
          .innerJoin(projects, eq(clips.projectId, projects.id))
          .where(and(eq(projects.organizationId, orgId), inArray(projects.userId, memberIds)))
          .groupBy(projects.userId)
      : ([] as { userId: string; count: number }[]),

    // creditsUsed per member (SUM of absolute value of debits)
    memberIds.length > 0
      ? db
          .select({
            userId: creditTransactions.userId,
            total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
          })
          .from(creditTransactions)
          .where(
            and(
              eq(creditTransactions.organizationId, orgId),
              inArray(creditTransactions.userId, memberIds),
              sql`${creditTransactions.amount} < 0`
            )
          )
          .groupBy(creditTransactions.userId)
      : ([] as { userId: string; total: number }[]),
  ]);

  // Build lookup maps
  const projectsMap = Object.fromEntries(projectsRows.map((r) => [r.userId, r.count]));
  const clipsMap = Object.fromEntries(clipsRows.map((r) => [r.userId, r.count]));
  const creditsMap = Object.fromEntries(creditsRows.map((r) => [r.userId, r.total]));

  const members = membersWithUsers.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    email: m.email,
    name: m.name ?? null,
    joinedAt: m.joinedAt.toISOString(),
    stats: {
      projectsCreated: projectsMap[m.userId] ?? 0,
      clipsGenerated: clipsMap[m.userId] ?? 0,
      creditsUsed: creditsMap[m.userId] ?? 0,
    },
  }));

  return NextResponse.json({
    org: {
      id: org.id,
      name: org.name,
      plan: org.plan,
      poolCredits: creditRow.total,
    },
    members,
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      token: inv.token,
    })),
  });
}
