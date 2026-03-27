import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoEdits, projects, users } from '@/lib/db/schema';
import { verifyToken, deductCredits } from '@/lib/db/auth';
import { eq, and } from 'drizzle-orm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const runtime = 'nodejs';

const AUTO_EDIT_QUEUE_NAME = 'propframe:auto-edit-render';

const VALID_MUSIC_KEYS = ['upbeat-1', 'warm-1', 'modern-1', 'cinematic-1', 'acoustic-1'] as const;
type MusicKey = typeof VALID_MUSIC_KEYS[number];

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get('auth-token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

async function getAutoEditWithAuth(req: NextRequest, id: string) {
  const userId = getUserId(req);
  if (!userId) return { error: 'Unauthorized', status: 401 };

  const [autoEdit] = await db
    .select()
    .from(autoEdits)
    .where(eq(autoEdits.id, id))
    .limit(1);

  if (!autoEdit) {
    return { error: 'Not found', status: 404 };
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, autoEdit.projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return { error: 'Not found', status: 404 };
  }

  return { userId, autoEdit, project };
}

function createRedisInstance(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await getAutoEditWithAuth(req, params.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { userId, autoEdit, project } = result;

  // Check status is 'draft'
  if (autoEdit.status !== 'draft') {
    return NextResponse.json(
      { error: 'Auto-edit is already rendering or done' },
      { status: 409 }
    );
  }

  const body = await req.json();
  const { titleText, musicKey } = body;

  // Validate titleText
  if (!titleText || typeof titleText !== 'string' || titleText.trim().length === 0) {
    return NextResponse.json({ error: 'titleText is required' }, { status: 400 });
  }

  // Validate musicKey
  if (!musicKey || !VALID_MUSIC_KEYS.includes(musicKey as MusicKey)) {
    return NextResponse.json(
      { error: `Invalid musicKey. Must be one of: ${VALID_MUSIC_KEYS.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate at least 2 clips selected
  const clipIds = autoEdit.clipIds ?? [];
  if (clipIds.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 clips must be selected' },
      { status: 400 }
    );
  }

  // Check user credits
  const [user] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.credits < 1) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  // Deduct 1 credit
  await deductCredits(userId, 1, 'auto_edit', autoEdit.id);

  // Enqueue render job
  const connection = createRedisInstance();
  const queue = new Queue(AUTO_EDIT_QUEUE_NAME, { connection });

  await queue.add('render', {
    autoEditId: autoEdit.id,
    projectId: project.id,
    userId,
    clipIds,
    titleText: titleText.trim(),
    musicKey,
  });

  // Update auto-edit status to 'rendering'
  const [updated] = await db
    .update(autoEdits)
    .set({ status: 'rendering', titleText: titleText.trim(), musicKey })
    .where(eq(autoEdits.id, params.id))
    .returning();

  console.log('Auto-edit render queued:', {
    autoEditId: autoEdit.id,
    userId,
    clipCount: clipIds.length,
  });

  // Estimated duration: ~5 seconds per clip
  const estimatedDuration = clipIds.length * 5;

  return NextResponse.json(
    {
      autoEdit: {
        id: updated.id,
        status: updated.status,
        estimatedDuration,
      },
    },
    { status: 202 }
  );
}
