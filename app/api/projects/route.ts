import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, photos, clips } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = getSessionToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// GET /api/projects — list user's projects
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));

  return NextResponse.json({ projects: allProjects });
}

// POST /api/projects — create a new project
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
  }

  const [project] = await db
    .insert(projects)
    .values({ userId, name: name.trim() })
    .returning();

  return NextResponse.json({ project }, { status: 201 });
}
