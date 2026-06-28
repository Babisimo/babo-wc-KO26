import { describe, it, expect } from 'vitest';
import {
  mapEspnSchedule,
  reconcileSeedWithFixtures,
  fixtureMismatches,
  type FixturePair,
} from './r32-fixtures';
import type { OfficialR32 } from './bracket-picks';

// The real WC2026 third-place teams (rank 3 of their groups that qualified).
const THIRDS = new Set(['BIH', 'PAR', 'SWE', 'ECU', 'COD', 'SEN', 'ALG', 'GHA']);
const isThird = (c: string) => THIRDS.has(c);

// The heuristic seedR32 output for the slots that exercise the logic:
//  - slot 1: runner vs runner (no third)
//  - slots 2/5/9: winner vs a (mis-slotted) third  <-- the real 2026 bug
//  - slot 7: winner vs a correctly-slotted third
const projected: OfficialR32 = {
  1: { teamA: 'RSA', teamB: 'CAN' },
  2: { teamA: 'GER', teamB: 'BIH' }, // real fixture: GER v PAR
  5: { teamA: 'FRA', teamB: 'PAR' }, // real fixture: FRA v SWE
  7: { teamA: 'MEX', teamB: 'ECU' }, // real fixture: MEX v ECU (already right)
  9: { teamA: 'USA', teamB: 'SWE' }, // real fixture: USA v BIH
};

// Real fixtures as published by ESPN's schedule (unordered pairs).
const realFixtures: FixturePair[] = [
  { teamA: 'RSA', teamB: 'CAN' },
  { teamA: 'GER', teamB: 'PAR' },
  { teamA: 'FRA', teamB: 'SWE' },
  { teamA: 'MEX', teamB: 'ECU' },
  { teamA: 'USA', teamB: 'BIH' },
];

describe('mapEspnSchedule', () => {
  const resolve = (abbr?: string) => {
    const known = new Set(['RSA', 'CAN', 'GER', 'PAR']);
    return abbr && known.has(abbr) ? abbr : null;
  };

  it('extracts resolved team pairs from scoreboard events', () => {
    const json = {
      events: [
        { competitions: [{ competitors: [{ team: { abbreviation: 'RSA' } }, { team: { abbreviation: 'CAN' } }] }] },
        { competitions: [{ competitors: [{ team: { abbreviation: 'GER' } }, { team: { abbreviation: 'PAR' } }] }] },
      ],
    };
    expect(mapEspnSchedule(json, resolve)).toEqual([
      { teamA: 'RSA', teamB: 'CAN' },
      { teamA: 'GER', teamB: 'PAR' },
    ]);
  });

  it('skips events with an unresolved (placeholder) competitor', () => {
    const json = {
      events: [
        { competitions: [{ competitors: [{ team: { abbreviation: 'RSA' } }, { team: { abbreviation: 'CAN' } }] }] },
        // R16 placeholder: "Round of 32 1 Winner" — resolver returns null
        { competitions: [{ competitors: [{ team: { abbreviation: 'RD32', displayName: 'Round of 32 1 Winner' } }, { team: { abbreviation: 'GER' } }] }] },
      ],
    };
    expect(mapEspnSchedule(json, resolve)).toEqual([{ teamA: 'RSA', teamB: 'CAN' }]);
  });

  it('dedupes a fixture that appears more than once', () => {
    const json = {
      events: [
        { competitions: [{ competitors: [{ team: { abbreviation: 'RSA' } }, { team: { abbreviation: 'CAN' } }] }] },
        { competitions: [{ competitors: [{ team: { abbreviation: 'CAN' } }, { team: { abbreviation: 'RSA' } }] }] },
      ],
    };
    expect(mapEspnSchedule(json, resolve)).toEqual([{ teamA: 'RSA', teamB: 'CAN' }]);
  });
});

describe('reconcileSeedWithFixtures', () => {
  it('overrides the mis-slotted third-place teams with the real fixtures (WC2026 slots 2/5/9)', () => {
    const { projected: out } = reconcileSeedWithFixtures(
      { projected, confirmed: projected },
      realFixtures,
      isThird,
    );
    expect(out[2]).toEqual({ teamA: 'GER', teamB: 'PAR' });
    expect(out[5]).toEqual({ teamA: 'FRA', teamB: 'SWE' });
    expect(out[9]).toEqual({ teamA: 'USA', teamB: 'BIH' });
    // unchanged slots stay put
    expect(out[1]).toEqual({ teamA: 'RSA', teamB: 'CAN' });
    expect(out[7]).toEqual({ teamA: 'MEX', teamB: 'ECU' });
  });

  it('reconciles the confirmed view the same way', () => {
    const { confirmed } = reconcileSeedWithFixtures(
      { projected, confirmed: projected },
      realFixtures,
      isThird,
    );
    expect(confirmed[9]).toEqual({ teamA: 'USA', teamB: 'BIH' });
  });

  it('leaves the projection unchanged when no fixtures are available', () => {
    const { projected: out } = reconcileSeedWithFixtures({ projected, confirmed: projected }, [], isThird);
    expect(out).toEqual(projected);
  });

  it('matches regardless of fixture team order', () => {
    const swapped: FixturePair[] = [{ teamA: 'PAR', teamB: 'GER' }];
    const { projected: out } = reconcileSeedWithFixtures({ projected, confirmed: projected }, swapped, isThird);
    expect(new Set([out[2].teamA, out[2].teamB])).toEqual(new Set(['GER', 'PAR']));
  });

  it('only overrides slots with a matching fixture (partial schedule)', () => {
    const partial: FixturePair[] = [{ teamA: 'GER', teamB: 'PAR' }];
    const { projected: out } = reconcileSeedWithFixtures({ projected, confirmed: projected }, partial, isThird);
    expect(out[2]).toEqual({ teamA: 'GER', teamB: 'PAR' }); // corrected
    expect(out[5]).toEqual({ teamA: 'FRA', teamB: 'PAR' }); // untouched (still heuristic)
  });
});

describe('fixtureMismatches', () => {
  it('reports the slots where the heuristic disagrees with the real fixtures', () => {
    expect(fixtureMismatches(projected, realFixtures, isThird)).toEqual([
      { slot: 2, projected: { teamA: 'GER', teamB: 'BIH' }, actual: { teamA: 'GER', teamB: 'PAR' } },
      { slot: 5, projected: { teamA: 'FRA', teamB: 'PAR' }, actual: { teamA: 'FRA', teamB: 'SWE' } },
      { slot: 9, projected: { teamA: 'USA', teamB: 'SWE' }, actual: { teamA: 'USA', teamB: 'BIH' } },
    ]);
  });

  it('returns nothing when the projection already matches the fixtures', () => {
    const matching: FixturePair[] = [
      { teamA: 'RSA', teamB: 'CAN' },
      { teamA: 'MEX', teamB: 'ECU' },
    ];
    expect(fixtureMismatches(projected, matching, isThird)).toEqual([]);
  });
});
