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
    { key: 'X', owner: 'X', bracketName: 'X', picks: { ...base, 31: 'ARG' } },
    { key: 'Y', owner: 'Y', bracketName: 'Y', picks: { ...base, 31: 'FRA' } },
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

  // ── (a) Tie test ────────────────────────────────────────────────────────────
  // Two brackets with IDENTICAL picks (same champion pick). Every simulation
  // ends with leaders===2, so first place always splits and nobody wins outright.
  //
  // Fixture: slots 1..30 decided (ARG wins SF29, FRA wins SF30), slot 31 undecided.
  // Both brackets pick ARG as champion (picks[31]='ARG').
  //
  // sims=2, rng=[0.1, 0.9], bookLine ARG/FRA probA=0.6:
  //   sim1: 0.1 < 0.6 → ARG wins → both score 80 → leaders=2 → anyFirst+=0.5 each
  //   sim2: 0.9 ≥ 0.6 → FRA wins → both score 64 → leaders=2 → anyFirst+=0.5 each
  //
  // winPct = 100 × (0.5+0.5)/2 = 50.00
  // solePct = 0.00 (sole never incremented)
  it('winPct 50 / solePct 0 when two brackets have identical picks (every sim is a tie)', () => {
    const f = fixture();
    const base: Record<number, string> = {};
    for (let s = 1; s <= 30; s++) base[s] = f.winners[s] as string;
    const identical = [
      { key: 'A', owner: 'A', bracketName: 'A', picks: { ...base, 31: 'ARG' } },
      { key: 'B', owner: 'B', bracketName: 'B', picks: { ...base, 31: 'ARG' } },
    ];
    const seq = [0.1, 0.9];
    let idx = 0;
    const r = simulateOdds(
      { ...f, brackets: identical, locked: true, updatedAt: 'now' },
      { sims: 2, rng: () => seq[idx++ % seq.length] },
    );
    const bktA = r.brackets.find((b) => b.key === 'A')!;
    const bktB = r.brackets.find((b) => b.key === 'B')!;
    expect(bktA.winPct).toBeCloseTo(50, 6);
    expect(bktB.winPct).toBeCloseTo(50, 6);
    expect(bktA.solePct).toBe(0);
    expect(bktB.solePct).toBe(0);
  });

  // ── (b) Multi-hop chain test ─────────────────────────────────────────────────
  // Slots 1..28 decided; slots 29 (SF), 30 (SF), and 31 (FINAL) are all undecided.
  // Feeders: slot29←[25,26], slot30←[27,28], slot31←[29,30].
  //
  // winners: {1..24}=T1..T24, 25=ARG, 26=BRA, 27=FRA, 28=ENG; 29/30/31 absent.
  // No book lines → probabilities from Elo (ARG=2140,BRA=2060,FRA=2100,ENG=2040):
  //   P(ARG>BRA) = 1/(1+10^((2060−2140)/400)) ≈ 0.6131
  //   P(FRA>ENG) = 1/(1+10^((2040−2100)/400)) ≈ 0.5855
  //   P(ARG>FRA) = 1/(1+10^((2100−2140)/400)) ≈ 0.5573
  //
  // sims=1, rng=[0.1, 0.2, 0.3]:
  //   slot29: 0.1 < 0.6131 → ARG wins (resolved from winners[25] and winners[26])
  //   slot30: 0.2 < 0.5855 → FRA wins (resolved from winners[27] and winners[28])
  //   slot31: 0.3 < 0.5573 → ARG wins (resolved from simulated slot29 and slot30 winners)
  //
  // Bracket Z picks ARG(29), FRA(30), ARG(31):
  //   now  = R32(16×1) + R16(8×2) + QF(4×4) = 48 (slots 29–31 had no decided winners)
  //   exp  = 48 + 8(SF29) + 8(SF30) + 16(FINAL) = 80
  //   champion = ARG (titlePct=100%)
  it('resolves multi-hop undecided chain across rounds (SF→FINAL)', () => {
    const winners: Record<number, string | null> = {};
    for (let s = 1; s <= 24; s++) winners[s] = `T${s}`;
    winners[25] = 'ARG'; winners[26] = 'BRA'; winners[27] = 'FRA'; winners[28] = 'ENG';
    // slots 29, 30, 31 intentionally absent — the three undecided slots
    const base: Record<number, string> = {};
    for (let s = 1; s <= 28; s++) base[s] = winners[s] as string;
    const brackets = [
      { key: 'Z', owner: 'Z', bracketName: 'Z', picks: { ...base, 29: 'ARG', 30: 'FRA', 31: 'ARG' } },
    ];
    const seq = [0.1, 0.2, 0.3];
    let idx = 0;
    const r = simulateOdds(
      { officialR32: {}, winners, brackets, bookLines: [], locked: true, updatedAt: 'now' },
      { sims: 1, rng: () => seq[idx++] },
    );
    // Champion resolved through the full cross-round chain: ARG(29)→ARG(31)
    expect(r.teams).toHaveLength(1);
    expect(r.teams[0].code).toBe('ARG');
    expect(r.teams[0].titlePct).toBe(100);
    const z = r.brackets[0];
    // now: R32(16×1=16) + R16(8×2=16) + QF(4×4=16) = 48; slots 29–31 had no winners yet
    expect(z.now).toBe(48);
    // exp: sim total = 48 + SF(8+8) + FINAL(16) = 80
    expect(z.exp).toBe(80);
  });
});
