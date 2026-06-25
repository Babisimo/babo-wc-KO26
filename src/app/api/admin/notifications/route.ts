import { NextResponse } from 'next/server';
import { auth, type AppSession } from '@/lib/auth';
import { getAdminNotificationCount } from '@/lib/notifications';

// Never cache: the nav badge polls this for a live pending-approvals count.
export const dynamic = 'force-dynamic';

/** Live admin notification count, polled by the nav badge. Non-admins get 0. */
export async function GET() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ count: 0 }, { status: 403 });
  }
  const count = await getAdminNotificationCount();
  return NextResponse.json({ count });
}
