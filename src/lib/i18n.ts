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
  'home.eyebrow': 'World Cup 2026 · Knockout Pool',
  'home.title': 'Knockout Bracket',
  'home.intro': 'Predict every knockout game from the Round of 32 to the Final. Request an account to join the pool.',
  'home.leaderboard': 'Leaderboard',
  'home.pot': 'Pot {amount}',
  'home.leaderTakes': 'leader takes {amount}',
  'home.split': '{n}-way split {amount}',
  'home.empty': 'No brackets submitted yet — be the first.',
  'home.rank': 'Rank',
  'home.player': 'Player',
  'home.points': 'Points',
  'home.leaderBadge': '🏆 leader',
  // official
  'official.eyebrowReal': 'The real thing',
  'official.eyebrowRoad': 'The road to the final',
  'official.title': 'Official Bracket',
  'official.leadReal': 'The actual Round-of-32 draw and results as they come in. Teams that advance are marked in gold.',
  'official.leadProjected': 'Projected from the live group standings. Switch to Confirmed to see only matchups that are mathematically locked.',
  'official.tree': 'Knockout tree',
  'official.decided': '{n} / {total} decided',
  'official.notReady': 'The bracket isn\'t set yet — check back once the Round-of-32 matchups are in.',
  'official.notAvailable': 'The bracket isn\'t available yet — check back once group-stage results are in.',
  'official.asItStands': 'As it stands',
  'official.confirmed': 'Confirmed',
  // round labels
  'round.r32': 'Round of 32',
  'round.r16': 'Round of 16',
  'round.qf': 'Quarter-finals',
  'round.sf': 'Semi-finals',
  'round.final': 'Final',
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
  'home.eyebrow': 'Mundial 2026 · Quiniela de eliminación',
  'home.title': 'Bracket de eliminación',
  'home.intro': 'Adivina todos los partidos de eliminación, del Dieciseisavos a la Final. Pide una cuenta para entrarle a la quiniela.',
  'home.leaderboard': 'Tabla',
  'home.pot': 'Bolsa {amount}',
  'home.leaderTakes': 'el líder se lleva {amount}',
  'home.split': 'repartido entre {n}: {amount}',
  'home.empty': 'Todavía nadie llena su bracket — sé el primero.',
  'home.rank': 'Lugar',
  'home.player': 'Jugador',
  'home.points': 'Puntos',
  'home.leaderBadge': '🏆 líder',
  // official
  'official.eyebrowReal': 'Esto va en serio',
  'official.eyebrowRoad': 'El camino a la final',
  'official.title': 'Bracket oficial',
  'official.leadReal': 'El sorteo real de Dieciseisavos y los resultados conforme van cayendo. Los que avanzan salen en dorado.',
  'official.leadProjected': 'Proyectado según cómo van los grupos ahorita. Cámbiale a Confirmado para ver nomás los cruces que ya están amarrados.',
  'official.tree': 'Árbol de eliminación',
  'official.decided': '{n} / {total} definidos',
  'official.notReady': 'El bracket todavía no está armado — vuelve cuando salgan los cruces de Dieciseisavos.',
  'official.notAvailable': 'El bracket todavía no está listo — vuelve cuando haya resultados de la fase de grupos.',
  'official.asItStands': 'Como va',
  'official.confirmed': 'Confirmado',
  // round labels
  'round.r32': 'Dieciseisavos',
  'round.r16': 'Octavos',
  'round.qf': 'Cuartos',
  'round.sf': 'Semifinales',
  'round.final': 'Final',
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
