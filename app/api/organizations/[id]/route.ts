import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations, organizationMembers, users } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = getSessionToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

async function requireOrgMember(orgId: string, userId: string): Promise<boolean> {
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)))
    .limit(1);
  return membership.length > 0;
}

async function requireOrgDirector(orgId: string, userId: string): Promise<boolean> {
  const membership = await db
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
  return membership.length > 0;
}

// GET /api/organizations/[id] — get org details
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const isMember = await requireOrgMember(id, userId);
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const membersWithUsers = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
      },
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.orgId, id));

  return NextResponse.json({ organization: { ...org, members: membersWithUsers } });
}

// PATCH /api/organizations/[id] — update org
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const isDirector = await requireOrgDirector(id, userId);
  if (!isDirector) return NextResponse.json({ error: 'Forbidden — director role required' }, { status: 403 });

  const { name } = await req.json();
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Organization name must be at least 2 characters' }, { status: 400 });
  }

  const [updated] = await db
    .update(organizations)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();

  return NextResponse.json({ organization: updated });
}
