/** A user may create another bracket only while they hold fewer than their credit cap. */
export function canCreateBracket(used: number, credits: number): boolean {
  return used < credits;
}

/**
 * A user may mark another bracket as official (a paid entry) only while the number they
 * already have marked is below their credit cap. Credits are the allowance; each official
 * bracket consumes one. Unmarking frees the slot, so this is checked only when turning ON.
 */
export function canMarkOfficial(officialCount: number, credits: number): boolean {
  return officialCount < credits;
}
