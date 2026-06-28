import { describe, it, expect } from 'vitest';
import { membersMissingEntry } from './admin-stats';

const full = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 1, 'T']));
const half = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 'T']));

describe('membersMissingEntry', () => {
  it('flags a member with no official brackets', () => {
    expect(membersMissingEntry([{ id: 'a' }], []).map((m) => m.id)).toEqual(['a']);
  });

  it('clears a member whose official bracket is fully filled', () => {
    expect(membersMissingEntry([{ id: 'a' }], [{ userId: 'a', picks: full }])).toEqual([]);
  });

  it('flags a member whose only official bracket is half-filled', () => {
    expect(membersMissingEntry([{ id: 'a' }], [{ userId: 'a', picks: half }]).map((m) => m.id)).toEqual(['a']);
  });

  it('clears a member with one half and one full official bracket', () => {
    const official = [{ userId: 'a', picks: half }, { userId: 'a', picks: full }];
    expect(membersMissingEntry([{ id: 'a' }], official)).toEqual([]);
  });

  it('returns the same member objects (preserves username/email for rendering)', () => {
    const m = { id: 'a', username: 'ann' };
    expect(membersMissingEntry([m], [])[0]).toBe(m);
  });
});
