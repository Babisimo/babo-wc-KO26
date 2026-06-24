import { describe, it, expect } from 'vitest';
import { formatRemaining } from './format-remaining';

describe('formatRemaining', () => {
  it('breaks ms into d/h/m/s', () => {
    const ms = (((2 * 24 + 3) * 60 + 4) * 60 + 5) * 1000; // 2d 3h 4m 5s
    expect(formatRemaining(ms)).toBe('2d 3h 4m 5s');
  });
  it('clamps negatives to zero', () => {
    expect(formatRemaining(-5000)).toBe('0d 0h 0m 0s');
  });
  it('handles exact zero', () => {
    expect(formatRemaining(0)).toBe('0d 0h 0m 0s');
  });
  it('formats sub-minute correctly', () => {
    expect(formatRemaining(45 * 1000)).toBe('0d 0h 0m 45s');
  });
});
