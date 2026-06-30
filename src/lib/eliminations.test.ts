import { describe, it, expect } from 'vitest';
import { eliminations } from './eliminations';
import type { OfficialR32 } from './bracket-picks';
import type { OfficialWinners } from './scoring';

// Same routing the bracket-view test relies on: slot 17 is fed by slots 2 and 5.
const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
  5: { teamA: 'GER', teamB: 'POR' },
};

describe('eliminations', () => {
  it('returns an empty map when no winners are recorded', () => {
    expect(eliminations(OFFICIAL, {})).toEqual({});
  });

  it('maps the loser of a single R32 result to its winner', () => {
    expect(eliminations(OFFICIAL, { 1: 'ARG' })).toEqual({ BRA: 'ARG' });
  });

  it('maps every non-champion loser across a multi-round chain', () => {
    const winners: OfficialWinners = { 2: 'FRA', 5: 'GER', 17: 'FRA' };
    // slot 2: FRA beats ESP · slot 5: GER beats POR · slot 17 (feeders 2,5): FRA beats GER
    expect(eliminations(OFFICIAL, winners)).toEqual({ ESP: 'FRA', POR: 'GER', GER: 'FRA' });
  });

  it('ignores a later-round winner whose feeders have no recorded winner yet', () => {
    // slot 17 has a winner but slots 2 and 5 do not -> no current contestants -> contributes nothing
    expect(eliminations(OFFICIAL, { 17: 'FRA' })).toEqual({});
  });
});
