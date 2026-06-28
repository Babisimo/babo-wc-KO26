// Static pre-tournament strength baseline. Values are approximate World Football
// Elo ratings (eloratings.net), captured before the 2026 knockout stage. This is a
// v1 baseline only — `matchup-prob` overrides it with a real bookmaker line whenever
// one exists, so exact values matter only for matchups with no market line yet.
export const DEFAULT_ELO = 1500;

export const TEAM_ELO: Record<string, number> = {
  ARG: 2140, FRA: 2100, ESP: 2085, BRA: 2060, ENG: 2040, POR: 2010, NED: 1990,
  GER: 1985, BEL: 1945, CRO: 1900, URU: 1895, COL: 1875, MAR: 1860, SEN: 1840,
  NOR: 1820, JPN: 1810, USA: 1810, TUR: 1800, MEX: 1790, SUI: 1790, AUT: 1780,
  ECU: 1780, KOR: 1770, IRN: 1760, SWE: 1760, CAN: 1750, PAR: 1740, SCO: 1740,
  CZE: 1730, AUS: 1720, ALG: 1700, CIV: 1700, EGY: 1700, BIH: 1690, TUN: 1690,
  GHA: 1680, RSA: 1650, QAT: 1650, KSA: 1630, COD: 1620, IRQ: 1600, PAN: 1600,
  JOR: 1580, UZB: 1560, NZL: 1500, CPV: 1500, HAI: 1450, CUW: 1430,
};

export function teamElo(code: string | null): number {
  if (!code) return DEFAULT_ELO;
  return TEAM_ELO[code] ?? DEFAULT_ELO;
}

/** Standard Elo expectation: P(A beats B), used as a 2-way (advancement) probability. */
export function eloWinProb(eloA: number, eloB: number): number {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}
