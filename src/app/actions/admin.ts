'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { canRemoveUser, canSetAdmin } from '@/lib/admin-guard';

export async function requireAdmin(): Promise<AppSession> {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) throw new Error('Not authorized');
  return session;
}

async function adminIds(): Promise<string[]> {
  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

export async function approveUser(targetUserId: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  await db.user.update({
    where: { id: targetUserId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: session.user.id, credits: 1 },
  });
  revalidatePath('/admin');
  return {};
}

export async function grantCredits(targetUserId: string, delta: number): Promise<{ error?: string }> {
  await requireAdmin();
  const user = await db.user.findUnique({ where: { id: targetUserId }, select: { credits: true } });
  if (!user) return { error: 'User not found.' };
  const next = Math.max(0, user.credits + delta);
  await db.user.update({ where: { id: targetUserId }, data: { credits: next } });
  revalidatePath('/admin');
  return {};
}

export async function rejectUser(targetUserId: string): Promise<{ error?: string }> {
  await requireAdmin();
  await db.user.update({ where: { id: targetUserId }, data: { status: 'REJECTED' } });
  revalidatePath('/admin');
  return {};
}

export async function setAdmin(targetUserId: string, makeAdmin: boolean): Promise<{ error?: string }> {
  const session = await requireAdmin();
  const guard = canSetAdmin(session.user.id, targetUserId, makeAdmin, await adminIds());
  if (!guard.ok) return { error: guard.error };
  await db.user.update({ where: { id: targetUserId }, data: { isAdmin: makeAdmin } });
  revalidatePath('/admin');
  return {};
}

export async function removeUser(targetUserId: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  const guard = canRemoveUser(session.user.id, targetUserId, await adminIds());
  if (!guard.ok) return { error: guard.error };
  await db.user.delete({ where: { id: targetUserId } });
  revalidatePath('/admin');
  return {};
}
