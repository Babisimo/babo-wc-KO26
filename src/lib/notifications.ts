import { db } from '@/lib/db';

// Admin notification count. Each source returns a number of admin-actionable
// items; the total is their sum. To add a new notification type later, add a
// source to the array below — the nav badge picks it up automatically.

/** Users who have signed up and are waiting for an admin to approve them. */
function pendingApprovalsCount(): Promise<number> {
  return db.user.count({ where: { status: 'PENDING' } });
}

const sources: Array<() => Promise<number>> = [pendingApprovalsCount];

/** Total number of items needing an admin's attention. */
export async function getAdminNotificationCount(): Promise<number> {
  const counts = await Promise.all(sources.map((s) => s()));
  return counts.reduce((sum, n) => sum + n, 0);
}
