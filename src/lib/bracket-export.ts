/** Slugify a bracket name into a safe PNG filename. Falls back to `bracket.png`. */
export function bracketImageFilename(name: string): string {
  const slug = (name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // non-alphanumeric runs -> single hyphen
    .replace(/^-+|-+$/g, '')         // trim leading/trailing hyphens
    .slice(0, 60);
  return `${slug || 'bracket'}.png`;
}

/** True when the platform can share this file via the Web Share API. SSR- and throw-safe. */
export function canShareFiles(
  nav: { canShare?: (data?: ShareData) => boolean } | undefined,
  file: File,
): boolean {
  if (!nav || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}
