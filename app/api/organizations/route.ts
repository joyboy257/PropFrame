import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations, organizationMembers, users } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = getSessionToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// POST /api/organizations — create a new organization
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Organization name must be at least 2 characters' }, { status: 400 });
  }

  // Insert the organization with the current user as owner
  const [org] = await db
    .insert(organizations)
    .values({ name: name.trim(), ownerUserId: userId })
    .returning();

  // Add the creating user as a director (owner-level role)
  await db
    .insert(organizationMembers)
    .values({ orgId: org.id, userId, role: 'director' })
    .returning();

  return NextResponse.json({ organization: org }, { status: 201 });
}

// GET /api/organizations — list orgs the user is a member of
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      plan: organizations.plan,
      ownerUserId: organizations.ownerUserId,
      createdAt: organizations.createdAt,
      role: organizationMembers.role,
    })
    .from(organizations)
    .innerJoin(organizationMembers, eq(organizationMembers.orgId, organizations.id))
    .where(eq(organizationMembers.userId, userId));

  return NextResponse.json({ organizations: result });
}
