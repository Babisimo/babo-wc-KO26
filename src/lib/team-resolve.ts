import { TEAMS } from '@/lib/teams';

/** Lowercase, strip accents/punctuation, collapse + dedupe words. */
export function normalizeTeam(raw: string): string {
  const noAccent = (raw ?? '').normalize('NFKD').replace(/\p{Diacritic}/gu, '');
  const cleaned = noAccent
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean);
  return Array.from(new Set(words)).join(' ');
}

// Common feed (ESPN/TheSportsDB) spellings that differ from our TEAMS names.
const ALIASES: Record<string, string> = {
  'south korea': 'KOR',
  'korea republic': 'KOR',
  'republic of korea': 'KOR',
  'united states': 'USA',
  'cote divoire': 'CIV',
  'ivory coast': 'CIV',
  'dr congo': 'COD',
  'congo dr': 'COD',
  'czech republic': 'CZE',
  'ir iran': 'IRN',
  'cabo verde': 'CPV',
};

const CODE_BY_NORM = new Map<string, string>();
for (const t of TEAMS) {
  CODE_BY_NORM.set(normalizeTeam(t.name), t.code);
  CODE_BY_NORM.set(normalizeTeam(t.code), t.code);
}
for (const [name, code] of Object.entries(ALIASES)) {
  CODE_BY_NORM.set(normalizeTeam(name), code);
}

export function resolveCode(name: string): string | null {
  if (!name || !name.trim()) return null;
  return CODE_BY_NORM.get(normalizeTeam(name)) ?? null;
}
