import { describe, it, expect } from 'vitest';
import { computePoolStats, countFilledBrackets } from './pool-stats';

const picks = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 'TEAM']));

describe('computePoolStats', () => {
  it('is empty when no brackets are in', () => {
    expect(computePoolStats(0, 5000)).toEqual({ bracketsIn: 0, potCents: 0 });
  });

  it('prices the pot as brackets-in times the entry price', () => {
    expect(computePoolStats(3, 5000)).toEqual({ bracketsIn: 3, potCents: 15000 });
  });

  it('uses the configured entry price', () => {
    expect(computePoolStats(2, 2500)).toEqual({ bracketsIn: 2, potCents: 5000 });
  });
});

describe('countFilledBrackets', () => {
  it('is zero with no brackets', () => {
    expect(countFilledBrackets([])).toBe(0);
  });

  it('counts a bracket only once all 31 games are picked', () => {
    expect(countFilledBrackets([{ picks: picks(31) }])).toBe(1);
    expect(countFilledBrackets([{ picks: picks(30) }])).toBe(0);
  });

  it('counts only the filled ones in a mix', () => {
    expect(countFilledBrackets([{ picks: picks(31) }, { picks: picks(10) }, { picks: picks(31) }])).toBe(2);
  });

  it('ignores blank picks toward completeness', () => {
    expect(countFilledBrackets([{ picks: { ...picks(30), 31: '' } }])).toBe(0);
  });
});
