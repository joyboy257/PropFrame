import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/db/auth';
import { db } from '@/lib/db';
import { projects, photos, clips, autoEdits } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import ProjectEditorClient, { type AutoEdit } from './ProjectEditorClient';

export const dynamic = 'force-dynamic';

export default async function ProjectEditorPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value || cookieStore.get('dev_token')?.value;
  if (!token) redirect('/auth/login');

  const payload = verifyToken(token);
  if (!payload) redirect('/auth/login');

  const user = await getUserById(payload.userId);
  if (!user) redirect('/auth/login');

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id))
    .limit(1);

  if (!project || project.userId !== payload.userId) {
    redirect('/ai/dashboard');
  }

  const projectPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.projectId, params.id))
    .orderBy(photos.order);

  const projectClips = await db
    .select()
    .from(clips)
    .where(eq(clips.projectId, params.id))
    .orderBy(desc(clips.createdAt));

  const projectAutoEdits = await db
    .select()
    .from(autoEdits)
    .where(eq(autoEdits.projectId, params.id))
    .orderBy(desc(autoEdits.createdAt));

  return (
    <ProjectEditorClient
      project={project}
      photos={projectPhotos}
      clips={projectClips}
      autoEdits={projectAutoEdits as unknown as AutoEdit[]}
    />
  );
}
