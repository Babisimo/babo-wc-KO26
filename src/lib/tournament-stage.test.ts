import { describe, it, expect } from 'vitest';
import { computeStage } from './tournament-stage';
import type { OfficialWinners } from './scoring';

// Slots 1..16 = R32, 17..24 = R16, 25..28 = QF, 29..30 = SF, 31 = Final.
const winnersFor = (slots: number[]): OfficialWinners => {
  const w: OfficialWinners = {};
  for (const s of slots) w[s] = 'ARG';
  return w;
};
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('computeStage', () => {
  it('reports not started with R32 live when nothing is decided', () => {
    const s = computeStage({});
    expect(s.started).toBe(false);
    expect(s.current).toBe('R32');
    expect(s.champion).toBeNull();
    expect(s.rounds.find((r) => r.round === 'R32')?.status).toBe('live');
    expect(s.rounds.find((r) => r.round === 'R16')?.status).toBe('upcoming');
  });

  it('marks R32 done and R16 live mid-tournament', () => {
    const s = computeStage(winnersFor([...range(1, 16), 17, 18])); // all R32 + 2 of R16
    expect(s.started).toBe(true);
    expect(s.current).toBe('R16');
    expect(s.rounds.find((r) => r.round === 'R32')?.status).toBe('done');
    const r16 = s.rounds.find((r) => r.round === 'R16');
    expect(r16?.status).toBe('live');
    expect(r16).toMatchObject({ decided: 2, total: 8 });
    expect(s.champion).toBeNull();
  });

  it('crowns the champion once the Final is decided', () => {
    const s = computeStage(winnersFor(range(1, 31))); // every slot decided
    expect(s.current).toBeNull();
    expect(s.champion).toBe('ARG');
    expect(s.rounds.every((r) => r.status === 'done')).toBe(true);
  });
});
