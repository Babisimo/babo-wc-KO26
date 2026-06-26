import { describe, it, expect } from 'vitest';
import { bracketImageFilename, canShareFiles } from './bracket-export';

describe('bracketImageFilename', () => {
  it('slugifies a normal name', () => {
    expect(bracketImageFilename("Babo's Bracket")).toBe('babo-s-bracket.png');
  });
  it('collapses punctuation and spaces to single hyphens', () => {
    expect(bracketImageFilename('My  Cool -- Bracket!!')).toBe('my-cool-bracket.png');
  });
  it('strips diacritics', () => {
    expect(bracketImageFilename('Peña Ñoño')).toBe('pena-nono.png');
  });
  it('falls back to bracket.png when empty/blank/punctuation-only', () => {
    expect(bracketImageFilename('')).toBe('bracket.png');
    expect(bracketImageFilename('   ')).toBe('bracket.png');
    expect(bracketImageFilename('!!!')).toBe('bracket.png');
  });
  it('caps the slug length at 60 chars', () => {
    const out = bracketImageFilename('x'.repeat(100));
    expect(out).toBe(`${'x'.repeat(60)}.png`);
  });
});

describe('canShareFiles', () => {
  const file = {} as File;
  it('false when navigator is undefined', () => {
    expect(canShareFiles(undefined, file)).toBe(false);
  });
  it('false when canShare is absent', () => {
    expect(canShareFiles({}, file)).toBe(false);
  });
  it('delegates to navigator.canShare', () => {
    expect(canShareFiles({ canShare: () => true }, file)).toBe(true);
    expect(canShareFiles({ canShare: () => false }, file)).toBe(false);
  });
  it('false when canShare throws', () => {
    expect(canShareFiles({ canShare: () => { throw new Error('x'); } }, file)).toBe(false);
  });
});
