const MAX_LEN = 32;

/** Clean a user-supplied bracket label; blank/invalid → "Bracket {fallbackIndex}". */
export function normalizeBracketName(raw: string | null | undefined, fallbackIndex: number): string {
  const cleaned = (raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '') // strip control chars
    .replace(/\s+/g, ' ')                  // collapse whitespace runs
    .trim()
    .slice(0, MAX_LEN);
  return cleaned.length > 0 ? cleaned : `Bracket ${fallbackIndex}`;
}
