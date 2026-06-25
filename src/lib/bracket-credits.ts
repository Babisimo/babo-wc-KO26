/** A user may create another bracket only while they hold fewer than their credit cap. */
export function canCreateBracket(used: number, credits: number): boolean {
  return used < credits;
}
