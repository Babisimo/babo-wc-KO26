import { describe, it, expect } from 'vitest';
import { eliminations, eliminatorBadge } from './eliminations';
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

describe('eliminatorBadge', () => {
  const map = { GER: 'PAR', PAR: 'BRA' };

  it('shows the eliminator when the player picked a team that lost this slot', () => {
    // Picked GER, GER did not win -> busted pick: name who knocked GER out.
    expect(eliminatorBadge(map, 'GER', true, 'wrong')).toBe('PAR');
  });

  it('shows the eliminator on a ghost pick still awaiting its (impossible) result', () => {
    // Player carried GER into a later, not-yet-decided slot -> still a doomed pick.
    expect(eliminatorBadge(map, 'GER', true, 'pending')).toBe('PAR');
  });

  it('suppresses the badge when the player correctly advanced a team (guessed right)', () => {
    // PAR was picked and won this slot; PAR is struck only because it lost LATER -> no badge here.
    expect(eliminatorBadge(map, 'PAR', true, 'correct')).toBeNull();
  });

  it('suppresses the badge on the losing side that the player did not pick (official view)', () => {
    // GER is the struck loser but not the highlighted side -> strikethrough only, no badge.
    expect(eliminatorBadge(map, 'GER', false, 'wrong')).toBeNull();
  });

  it('returns null for a team that was never eliminated', () => {
    expect(eliminatorBadge(map, 'ARG', true, 'wrong')).toBeNull();
  });

  it('returns null when there is no elimination map (e.g. the interactive fill page)', () => {
    expect(eliminatorBadge(undefined, 'GER', true, 'wrong')).toBeNull();
  });

  it('returns null for an empty side', () => {
    expect(eliminatorBadge(map, null, true, 'wrong')).toBeNull();
  });
});
