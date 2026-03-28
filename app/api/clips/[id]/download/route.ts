import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { db } from '@/lib/db';
import { clips, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.NEXT_PUBLIC_R2_BUCKET || 'vugru-media';

export const runtime = 'nodejs';

async function getR2Client(): Promise<S3Client> {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.dev`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Auth check
  const token = getSessionToken(req);
  const payload = verifyToken(token ?? '');
  const userId = payload?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch clip with project ownership check
  const [clip] = await db
    .select({
      id: clips.id,
      storageKey: clips.storageKey,
      projectUserId: projects.userId,
    })
    .from(clips)
    .innerJoin(projects, eq(clips.projectId, projects.id))
    .where(eq(clips.id, params.id))
    .limit(1);

  if (!clip) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
  }

  if (clip.projectUserId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Generate presigned R2 URL (3600s expiry)
  const expiresIn = 3600;
  const client = await getR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: clip.storageKey ?? `clips/${params.id}.mp4`,
  });
  const signedUrl = await getSignedUrl(client, command, { expiresIn });

  return NextResponse.json({ url: signedUrl, expiresIn });
}
