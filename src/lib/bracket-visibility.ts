/** A viewer may see a bracket if it's their own, or once brackets are locked. */
export function canViewUserBracket(opts: { isOwner: boolean; locked: boolean }): boolean {
  return opts.isOwner || opts.locked;
}
