// src/lib/bracket-odds.test.ts
import { describe, it, expect } from 'vitest';
import { simulateOdds } from '@/lib/bracket-odds';
import type { BookLine } from '@/lib/book-odds';

// Decide slots 1..30; leave the FINAL (slot 31) the only undecided game, between
// the two semifinal winners ARG and FRA. Two brackets agree on everything decided
// (each banks 64 pts) and differ only on the champion — so the pool winner is decided
// solely by slot 31, which makes the math exact under a stubbed rng.
function fixture() {
  const winners: Record<number, string | null> = {};
  for (let s = 1; s <= 28; s++) winners[s] = `T${s}`;
  winners[29] = 'ARG';
  winners[30] = 'FRA';
  // both brackets pick the decided winners exactly, differ on 31
  const base: Record<number, string> = {};
  for (let s = 1; s <= 30; s++) base[s] = winners[s] as string;
  const brackets = [
    { key: 'X', name: 'X', picks: { ...base, 31: 'ARG' } },
    { key: 'Y', name: 'Y', picks: { ...base, 31: 'FRA' } },
  ];
  const bookLines: BookLine[] = [{ codeA: 'ARG', codeB: 'FRA', probA: 0.6, probB: 0.4 }];
  return { officialR32: {}, winners, brackets, bookLines };
}

describe('simulateOdds', () => {
  it('computes exact win% / sole% / exp under a deterministic rng', () => {
    const f = fixture();
    // sims=2: first run ARG champion (r<0.6), second run FRA champion (r>=0.6)
    const seq = [0.1, 0.9];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const r = simulateOdds({ ...f, locked: true, updatedAt: 'now' }, { sims: 2, rng });

    expect(r.total).toBe(31);
    expect(r.decided).toBe(30);
    expect(r.remaining).toBe(1);
    expect(r.oddsCoverage).toBe(1); // slot 31 had a real line

    const x = r.brackets.find((b) => b.key === 'X')!;
    const y = r.brackets.find((b) => b.key === 'Y')!;
    expect(x.now).toBe(64);
    expect(y.now).toBe(64);
    expect(x.winPct).toBeCloseTo(50, 6);
    expect(y.winPct).toBeCloseTo(50, 6);
    expect(x.solePct).toBeCloseTo(50, 6);
    expect(x.exp).toBeCloseTo(72, 6); // (80 + 64) / 2
  });

  it('produces team title odds that sum to ~100 and leak no picks when unlocked', () => {
    const f = fixture();
    const seq = [0.1, 0.9];
    let i = 0;
    const r = simulateOdds(
      { ...f, brackets: [], locked: false, updatedAt: 'now' },
      { sims: 2, rng: () => seq[i++ % seq.length] },
    );
    expect(r.brackets).toEqual([]);
    const total = r.teams.reduce((s, t) => s + t.titlePct, 0);
    expect(total).toBeCloseTo(100, 6);
    expect(r.teams.find((t) => t.code === 'ARG')!.titlePct).toBeCloseTo(50, 6);
  });

  it('lists the bracket\'s undecided needs by impact', () => {
    const f = fixture();
    const r = simulateOdds({ ...f, locked: true, updatedAt: 'now' }, { sims: 1, rng: () => 0.1 });
    const x = r.brackets.find((b) => b.key === 'X')!;
    expect(x.needs[0]).toMatchObject({ slot: 31, team: 'ARG', opponent: 'FRA', points: 16 });
    expect(x.needs[0].prob).toBeCloseTo(0.6, 6);
  });
});
