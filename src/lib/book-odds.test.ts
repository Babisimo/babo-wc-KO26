import { describe, it, expect } from 'vitest';
import { americanToImplied, mapEspnEvent, type BookLine } from '@/lib/book-odds';

describe('americanToImplied', () => {
  it('converts a favourite (negative) line', () => {
    expect(americanToImplied(-200)).toBeCloseTo(2 / 3, 6); // 200/300
  });
  it('converts an underdog (positive) line', () => {
    expect(americanToImplied(150)).toBeCloseTo(100 / 250, 6);
  });
  it('returns 0 for missing/zero', () => {
    expect(americanToImplied(null)).toBe(0);
    expect(americanToImplied(0)).toBe(0);
  });
});

// Minimal ESPN-shaped event: France (home) vs Morocco (away), moneyline w/ draw.
function event(home: string, away: string, ml: { home: number; draw: number; away: number }) {
  return {
    competitions: [{
      odds: [{ moneyline: {
        home: { close: { odds: ml.home } },
        draw: { close: { odds: ml.draw } },
        away: { close: { odds: ml.away } },
      } }],
      competitors: [
        { homeAway: 'home', team: { displayName: home } },
        { homeAway: 'away', team: { displayName: away } },
      ],
    }],
  };
}

describe('mapEspnEvent', () => {
  it('removes vig and folds the draw into advancement (sums to 1)', () => {
    const o = mapEspnEvent(event('France', 'Morocco', { home: -120, draw: 230, away: 320 })) as BookLine;
    expect(o).not.toBeNull();
    expect(o.codeA).toBe('FRA');
    expect(o.codeB).toBe('MAR');
    expect(o.probA + o.probB).toBeCloseTo(1, 10);
    expect(o.probA).toBeGreaterThan(o.probB); // France favoured
  });
  it('returns null when there is no usable moneyline', () => {
    expect(mapEspnEvent({ competitions: [{ odds: [], competitors: [] }] })).toBeNull();
  });
  it('returns null when a team code cannot be resolved', () => {
    expect(mapEspnEvent(event('France', 'Atlantis', { home: -120, draw: 230, away: 320 }))).toBeNull();
  });
});
