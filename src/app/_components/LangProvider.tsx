'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { translate, type Lang, type StringKey } from '@/lib/i18n';

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {} });

export default function LangProvider({ children }: { children: ReactNode }) {
  // Default 'en' on the server and the first client paint (hydration-safe);
  // a saved preference is applied after mount.
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('lang') : null;
    if (saved === 'es' || saved === 'en') setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== 'undefined') window.localStorage.setItem('lang', l);
  }

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang(): Ctx {
  return useContext(LangCtx);
}

export function useT(): (key: StringKey, vars?: Record<string, string | number>) => string {
  const { lang } = useContext(LangCtx);
  return (key, vars) => translate(lang, key, vars);
}
