import { describe, it, expect } from 'vitest';
import { championAnnouncement, joinNames } from './champion';
import type { Stage } from './tournament-stage';

const complete: Stage = { rounds: [], current: null, champion: 'ARG', started: true };
const inProgress: Stage = { rounds: [], current: 'SF', champion: null, started: true };

describe('championAnnouncement', () => {
  it('returns null before the tournament is complete', () => {
    expect(championAnnouncement(inProgress, ['alice (Ana)'], 5000)).toBeNull();
  });

  it('returns null when complete but there are no winners', () => {
    expect(championAnnouncement(complete, [], 5000)).toBeNull();
  });

  it('announces a single champion with their share', () => {
    expect(championAnnouncement(complete, ['alice (Ana)'], 85000)).toEqual({
      names: ['alice (Ana)'],
      shareCents: 85000,
    });
  });

  it('dedupes a player who owns more than one winning bracket', () => {
    expect(championAnnouncement(complete, ['alice (Ana)', 'alice (Ana)'], 85000)).toEqual({
      names: ['alice (Ana)'],
      shareCents: 85000,
    });
  });

  it('lists multiple co-champions, sorted', () => {
    expect(championAnnouncement(complete, ['carlos (C)', 'alice (Ana)', 'bob (B)'], 42500)).toEqual({
      names: ['alice (Ana)', 'bob (B)', 'carlos (C)'],
      shareCents: 42500,
    });
  });
});

describe('joinNames', () => {
  it('joins zero, one, two, and three names with the given conjunction', () => {
    expect(joinNames([], 'y')).toBe('');
    expect(joinNames(['A'], 'y')).toBe('A');
    expect(joinNames(['A', 'B'], 'y')).toBe('A y B');
    expect(joinNames(['A', 'B', 'C'], 'y')).toBe('A, B y C');
  });
});
