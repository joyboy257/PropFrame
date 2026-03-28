import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations, organizationInvitations, organizationMembers } from '@/lib/db/schema';
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

// DELETE /api/organizations/[id]/invitations/[invitationId] — Cancel/revoke an invitation (director only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: orgId, invitationId } = await params;

  // Verify org exists
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  // Auth required — director only
  try {
    await requireOrgDirector(orgId, userId);
  } catch (e) {
    if (e instanceof NextResponse) return e;
    throw e;
  }

  // Find invitation by id and orgId
  const [invitation] = await db
    .select()
    .from(organizationInvitations)
    .where(and(eq(organizationInvitations.id, invitationId), eq(organizationInvitations.orgId, orgId)))
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  // If already accepted/expired, cannot cancel
  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: 'Can only cancel pending invitations' }, { status: 400 });
  }

  // Delete the invitation record
  await db
    .delete(organizationInvitations)
    .where(and(eq(organizationInvitations.id, invitationId), eq(organizationInvitations.orgId, orgId)));

  return NextResponse.json({ success: true });
}
