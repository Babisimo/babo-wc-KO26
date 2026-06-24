import { describe, it, expect } from 'vitest';
import { coercePicks } from './picks-json';

describe('coercePicks', () => {
  it('keeps integer-key string-value entries', () => {
    expect(coercePicks({ 1: 'ARG', 17: 'FRA' })).toEqual({ 1: 'ARG', 17: 'FRA' });
  });
  it('rejects arrays, non-strings, and non-integer keys', () => {
    expect(coercePicks(['ARG'])).toEqual({});
    expect(coercePicks({ 1: 5, x: 'ARG' })).toEqual({});
    expect(coercePicks(null)).toEqual({});
  });
});
