import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { photos, projects } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId, storageKey, filename, contentType, width, height, order = 0 } = await req.json();

  if (!projectId || !storageKey || !filename) {
    return NextResponse.json({ error: 'projectId, storageKey, filename required' }, { status: 400 });
  }

  // Validate file type: extension check (primary) + contentType check (secondary for extensionless keys)
  const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp']);
  const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/webp']);

  const rawExt = storageKey.split('/').pop()?.split('?')[0] ?? '';
  const ext = rawExt.startsWith('.') ? rawExt.toLowerCase() : `.${rawExt.toLowerCase()}`;
  const extValid = ALLOWED_EXTENSIONS.has(ext);

  let contentTypeValid = false;
  if (contentType) {
    const normalizedCt = contentType.split(';')[0].trim().toLowerCase();
    contentTypeValid = ALLOWED_CONTENT_TYPES.has(normalizedCt);
  }

  // Reject if contentType is present but invalid (must be a valid image MIME type)
  if (contentType && !contentTypeValid) {
    return NextResponse.json({ error: 'Invalid file type. Only image files (jpg, png, heic, webp) are allowed.' }, { status: 400 });
  }

  // Reject if extension is invalid AND there is no valid contentType to fall back on
  if (!extValid && !contentTypeValid) {
    return NextResponse.json({ error: 'Invalid file type. Only image files (jpg, png, heic, webp) are allowed.' }, { status: 400 });
  }

  // Verify project ownership
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.userId !== payload.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [photo] = await db.insert(photos).values({
    projectId,
    storageKey,
    filename,
    width: width || null,
    height: height || null,
    order,
    publicUrl: `/api/files/${encodeURIComponent(storageKey)}`,
  }).returning();

  // Set thumbnailUrl if this is the first photo in the project
  const existingPhotos = await db
    .select({ id: photos.id })
    .from(photos)
    .where(eq(photos.projectId, projectId));

  if (existingPhotos.length === 1) {
    // First photo — set as thumbnail
    const photoPublicUrl = photo.publicUrl || `/api/files/${encodeURIComponent(storageKey)}`;
    await db
      .update(projects)
      .set({ thumbnailUrl: photoPublicUrl, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  return NextResponse.json({ photo }, { status: 201 });
}
