import { describe, it, expect } from 'vitest';
import { STRINGS, translate } from './i18n';

describe('STRINGS dictionary', () => {
  it('es and en have identical key sets (no drift)', () => {
    const en = Object.keys(STRINGS.en).sort();
    const es = Object.keys(STRINGS.es).sort();
    expect(es).toEqual(en);
  });
  it('no value is blank in either language', () => {
    for (const lang of ['en', 'es'] as const) {
      for (const [k, v] of Object.entries(STRINGS[lang])) {
        expect(v, `${lang}.${k}`).toBeTruthy();
      }
    }
  });
});

describe('translate', () => {
  it('returns the string for the language', () => {
    expect(translate('en', 'nav.login')).toBe('Log in');
    expect(translate('es', 'nav.login')).toBe('Iniciar sesión');
  });
  it('interpolates {vars}', () => {
    expect(translate('en', 'home.welcome', { name: 'Sam' })).toContain('Sam');
    expect(translate('es', 'home.welcome', { name: 'Sam' })).toContain('Sam');
  });
  it('falls back to English then the raw key, never blank', () => {
    // @ts-expect-error — unknown key at runtime exercises the fallback
    expect(translate('es', 'totally.unknown.key')).toBe('totally.unknown.key');
  });
});
