import { describe, it, expect } from 'vitest';
import { matchupProb } from '@/lib/matchup-prob';
import type { BookLine } from '@/lib/book-odds';

const lines: BookLine[] = [{ codeA: 'FRA', codeB: 'MAR', probA: 0.7, probB: 0.3 }];

describe('matchupProb', () => {
  it('uses a book line when present, oriented to the queried team', () => {
    expect(matchupProb('FRA', 'MAR', lines)).toEqual({ p: 0.7, hasLine: true });
    expect(matchupProb('MAR', 'FRA', lines)).toEqual({ p: 0.3, hasLine: true }); // reversed
  });
  it('falls back to Elo when no line exists', () => {
    const r = matchupProb('ARG', 'BRA', []);
    expect(r.hasLine).toBe(false);
    expect(r.p).toBeGreaterThan(0.5); // ARG rated above BRA
    expect(r.p).toBeLessThan(1);
  });
  it('handles null teams via the Elo default (0.5)', () => {
    expect(matchupProb(null, null, [])).toEqual({ p: 0.5, hasLine: false });
  });
});
