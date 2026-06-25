// Typed EN/ES string dictionary. `es` is typed Record<StringKey,string> so the two
// languages can never drift — a missing/extra key is a compile error.
// Dialect: casual northern-Mexican (Sonoran) Spanish (tú/ustedes; "ocupar" = need; keep "picks").

const en = {
  // common
  'common.loading': 'Loading…',
  'common.locked': 'Brackets are locked.',
  // nav
  'nav.leaderboard': 'Leaderboard',
  'nav.official': 'Official',
  'nav.myBracket': 'My brackets',
  'nav.brackets': 'Brackets',
  'nav.admin': 'Admin',
  'nav.logout': 'Log out',
  'nav.login': 'Log in',
  'nav.requestAccount': 'Request account',
  'nav.langEn': 'EN',
  'nav.langEs': 'ES',
  // home
  'home.welcome': 'Welcome back, {name}. Fill your bracket before lock and climb the board.',
} as const;

export type StringKey = keyof typeof en;
export type Lang = 'en' | 'es';

const es: Record<StringKey, string> = {
  'common.loading': 'Cargando…',
  'common.locked': 'Las brackets ya están cerradas.',
  'nav.leaderboard': 'Tabla',
  'nav.official': 'Oficial',
  'nav.myBracket': 'Tus brackets',
  'nav.brackets': 'Brackets',
  'nav.admin': 'Admin',
  'nav.logout': 'Salir',
  'nav.login': 'Iniciar sesión',
  'nav.requestAccount': 'Pedir cuenta',
  'nav.langEn': 'EN',
  'nav.langEs': 'ES',
  'home.welcome': 'Qué onda, {name}. Llena tu bracket antes del cierre y trépate en la tabla.',
};

export const STRINGS = { en, es } as const;

export function translate(
  lang: Lang,
  key: StringKey,
  vars?: Record<string, string | number>,
): string {
  const table = STRINGS[lang] as Record<string, string>;
  let out = table[key] ?? STRINGS.en[key] ?? (key as string);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}
