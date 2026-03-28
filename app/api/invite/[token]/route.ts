import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizationInvitations, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionToken } from '@/lib/auth/cookies';
import { verifyToken } from '@/lib/db/auth';

export const runtime = 'nodejs';

// GET /api/invite/[token] — Public invitation lookup (no auth required)
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [invitation] = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.token, token))
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  // Fetch org name
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, invitation.orgId))
    .limit(1);

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      orgId: invitation.orgId,
      orgName: org?.name ?? 'Unknown Organization',
    },
  });
}

// POST /api/invite/[token] — Accept invitation and create organization membership
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Authenticate user
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const payload = verifyToken(sessionToken);
  if (!payload) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { userId } = payload;

  // Fetch invitation
  const [invitation] = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.token, token))
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  // Check invitation status
  if (invitation.status === 'accepted') {
    return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 });
  }

  // Check if expired
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invitation expired' }, { status: 400 });
  }

  // Check if user is already a member
  const [existing] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, invitation.orgId)
      )
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: 'Already a member' }, { status: 400 });
  }

  // Create membership and update invitation in a transaction
  const [membership] = await db.transaction(async (tx) => {
    // Insert membership
    const [newMembership] = await tx
      .insert(organizationMembers)
      .values({
        userId,
        organizationId: invitation.orgId,
        role: invitation.role,
      })
      .returning();

    // Update invitation status
    await tx
      .update(organizationInvitations)
      .set({ status: 'accepted' })
      .where(eq(organizationInvitations.id, invitation.id));

    return [newMembership];
  });

  return NextResponse.json(
    {
      membership: {
        id: membership.id,
        orgId: membership.organizationId,
        role: membership.role,
      },
    },
    { status: 201 }
  );
}
