import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations, organizationInvitations, organizationMembers, users } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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

// POST /api/organizations/[id]/invitations — Create invitation (director only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: orgId } = await params;

  // Verify org exists
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  // Director check
  try {
    await requireOrgDirector(orgId, userId);
  } catch (e) {
    if (e instanceof NextResponse) return e;
    throw e;
  }

  const { email, role } = await req.json();

  // Email required
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Valid email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // Role defaults to 'agent'
  const invitedRole = role === 'director' ? 'director' : 'agent';

  // Check email isn't already a member of this org
  const existingMember = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(and(eq(organizationMembers.orgId, orgId), eq(users.email, email.trim().toLowerCase())))
    .limit(1);

  if (existingMember.length > 0) {
    return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 400 });
  }

  // Generate token
  const token = nanoid(32);

  // Expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [invitation] = await db
    .insert(organizationInvitations)
    .values({
      orgId,
      email: email.trim().toLowerCase(),
      token,
      role: invitedRole,
      status: 'pending',
      expiresAt,
    })
    .returning();

  return NextResponse.json({ invitation }, { status: 201 });
}
