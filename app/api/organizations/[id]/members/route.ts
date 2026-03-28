import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations, organizationMembers } from '@/lib/db/schema';
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

async function requireOrgDirector(orgId: string, userId: string) {
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
  if (membership.length === 0) {
    throw NextResponse.json({ error: 'Forbidden — director role required' }, { status: 403 });
  }
}

// DELETE /api/organizations/[id]/members/[userId] — Remove member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: orgId, userId: targetUserId } = await params;

  // Verify org exists
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  // Auth required — must be director of the org
  try {
    await requireOrgDirector(orgId, userId);
  } catch (e) {
    if (e instanceof NextResponse) return e;
    throw e;
  }

  // Find the member in this org
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, targetUserId)))
    .limit(1);

  if (!member) {
    return NextResponse.json({ error: 'Member not found in this organization' }, { status: 404 });
  }

  // Cannot remove the last director (and they cannot remove themselves without transferring ownership)
  if (member.role === 'director') {
    // Count directors in this org
    const directors = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.role, 'director')));

    if (directors.length === 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last director. Transfer ownership to another director first.' },
        { status: 400 }
      );
    }
  }

  // Remove from organization_members
  await db
    .delete(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, targetUserId)));

  return NextResponse.json({ success: true });
}
