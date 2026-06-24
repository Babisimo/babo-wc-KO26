import { describe, it, expect } from 'vitest';
import { mapEspnStandings } from './standings-feed';
import fixture from './standings-feed.fixture.json';

describe('mapEspnStandings', () => {
  it('maps ESPN children into GroupStanding[] with parsed letters and stats', () => {
    const groups = mapEspnStandings(fixture);
    const a = groups.find((g) => g.group === 'A')!;
    expect(a.complete).toBe(true);
    expect(a.teams[0]).toMatchObject({ code: 'MEX', rank: 1, points: 7, gd: 4, gf: 5 });
    expect(a.teams.map((t) => t.rank)).toEqual([1, 2, 3, 4]); // ordered by rank
  });
  it('marks a group incomplete when any team has gamesPlayed < 3', () => {
    const groups = mapEspnStandings(fixture);
    expect(groups.find((g) => g.group === 'B')!.complete).toBe(false);
  });
  it('returns [] for a malformed payload', () => {
    expect(mapEspnStandings(null)).toEqual([]);
    expect(mapEspnStandings({})).toEqual([]);
  });
});
