import { TEAMS } from '@/lib/teams';

const BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

export function teamName(code: string | null): string {
  if (!code) return '—';
  return BY_CODE.get(code)?.name ?? code;
}

export function teamColor(code: string | null): string {
  if (!code) return '#888888';
  return BY_CODE.get(code)?.color ?? '#888888';
}
