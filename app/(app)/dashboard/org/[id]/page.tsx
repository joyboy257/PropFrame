import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/db/auth';
import { db } from '@/lib/db';
import { organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { OrgSettingsClient } from '@/components/org/OrgSettingsClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrgSettingsPage({ params }: PageProps) {
  const { id: orgId } = await params;

  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value || cookieStore.get('dev_token')?.value;
  if (!token) redirect('/auth/login');

  const payload = verifyToken(token);
  if (!payload) redirect('/auth/login');

  const user = await getUserById(payload.userId);
  if (!user) redirect('/auth/login');

  // Verify user is a director of this org
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.userId, payload.userId),
        eq(organizationMembers.role, 'director')
      )
    )
    .limit(1);

  if (!membership) {
    redirect('/dashboard');
  }

  // Fetch org usage data server-side
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const usageRes = await fetch(`${baseUrl}/api/organizations/${orgId}/usage`, {
    credentials: 'include',
  });

  if (!usageRes.ok) {
    redirect('/dashboard');
  }

  const { org, members, invitations } = await usageRes.json();

  return (
    <OrgSettingsClient
      org={org}
      currentUserId={payload.userId}
    />
  );
}
