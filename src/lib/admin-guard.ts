export type GuardResult = { ok: true } | { ok: false; error: string };

/** Whether `actingUserId` may remove `targetUserId`. `adminIds` = current admin user ids. */
export function canRemoveUser(
  actingUserId: string,
  targetUserId: string,
  adminIds: string[],
): GuardResult {
  if (actingUserId === targetUserId) {
    return { ok: false, error: "You can't remove your own account." };
  }
  const targetIsAdmin = adminIds.includes(targetUserId);
  if (targetIsAdmin && adminIds.length <= 1) {
    return { ok: false, error: "Can't remove the last admin." };
  }
  return { ok: true };
}

/** Whether `actingUserId` may set `targetUserId`'s admin flag to `makeAdmin`. */
export function canSetAdmin(
  actingUserId: string,
  targetUserId: string,
  makeAdmin: boolean,
  adminIds: string[],
): GuardResult {
  if (actingUserId === targetUserId) {
    return { ok: false, error: "You can't change your own admin status." };
  }
  const targetIsAdmin = adminIds.includes(targetUserId);
  if (!makeAdmin && targetIsAdmin && adminIds.length <= 1) {
    return { ok: false, error: "Can't demote the last admin." };
  }
  return { ok: true };
}
