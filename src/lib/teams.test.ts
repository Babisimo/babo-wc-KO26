import { describe, it, expect } from 'vitest';
import { TEAMS } from './teams';

describe('TEAMS', () => {
  it('has exactly 48 teams', () => {
    expect(TEAMS).toHaveLength(48);
  });

  it('has unique codes', () => {
    const codes = TEAMS.map((t) => t.code);
    expect(new Set(codes).size).toBe(48);
  });

  it('every team has a name and a hex color', () => {
    for (const t of TEAMS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('uses 3-letter uppercase FIFA codes', () => {
    for (const t of TEAMS) {
      expect(t.code).toMatch(/^[A-Z]{3}$/);
    }
  });
});
