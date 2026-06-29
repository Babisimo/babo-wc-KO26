// src/lib/bracket-odds.ts
import type { Round } from '@prisma/client';
import {
  TOTAL_SLOTS, ROUND_POINTS, slotsForRound, participantsForSlot, roundForSlot,
  type SlotResult,
} from '@/lib/bracket-structure';
import type { Picks, OfficialR32 } from '@/lib/bracket-picks';
import { scoreBracket, type OfficialWinners } from '@/lib/scoring';
import { matchupProb } from '@/lib/matchup-prob';
import type { BookLine } from '@/lib/book-odds';

export interface OddsBracket { key: string; owner: string; bracketName: string; picks: Picks }
export interface NeedGame {
  slot: number; round: Round; team: string; opponent: string | null; prob: number; points: number;
}
export interface BracketOdds {
  key: string; owner: string; bracketName: string;
  now: number; exp: number; winPct: number; solePct: number;
  champion: string | null; // the team this bracket backed to win it all (slot 31 pick)
  needs: NeedGame[];
}
export interface TeamOdds { code: string; titlePct: number }
export interface OddsReport {
  locked: boolean;
  brackets: BracketOdds[];
  teams: TeamOdds[];
  books: BookLine[];
  sims: number; decided: number; total: number; remaining: number; oddsCoverage: number;
  updatedAt: string;
}

const ROUND_ORDER: Round[] = ['R32', 'R16', 'QF', 'SF', 'FINAL'];

export interface SimInput {
  officialR32: OfficialR32;
  winners: OfficialWinners;
  brackets: OddsBracket[];
  bookLines: BookLine[];
  locked: boolean;
  updatedAt: string;
}
export interface SimOpts { sims?: number; rng?: () => number; needN?: number }

export function simulateOdds(input: SimInput, opts: SimOpts = {}): OddsReport {
  const { officialR32, winners, brackets, bookLines, locked, updatedAt } = input;
  const { sims = 100_000, rng = Math.random, needN = 6 } = opts;

  // Build the static base map: official R32 teams + decided winners (fixed every run).
  const base: Record<number, SlotResult> = {};
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const o = officialR32[slot];
    base[slot] = { teamA: o?.teamA ?? null, teamB: o?.teamB ?? null, winner: winners[slot] ?? null };
  }
  const undecided = ROUND_ORDER.flatMap((r) => slotsForRound(r)).filter((s) => winners[s] == null);

  // Coverage: how many undecided slots can be priced from a real line *right now*
  // (contestants known from already-decided feeders). Informational only.
  let oddsCoverage = 0;
  for (const slot of undecided) {
    const { teamA, teamB } = participantsForSlot(slot, base);
    if (teamA && teamB && matchupProb(teamA, teamB, bookLines).hasLine) oddsCoverage++;
  }

  const nP = brackets.length;
  const now = brackets.map((b) => scoreBracket(b.picks, winners));
  const anyFirst = new Float64Array(nP);
  const sole = new Float64Array(nP);
  const ptsSum = new Float64Array(nP);
  const championCount = new Map<string, number>();
  const totals = new Int32Array(nP);

  for (let s = 0; s < sims; s++) {
    const map: Record<number, SlotResult> = {};
    for (let slot = 1; slot <= TOTAL_SLOTS; slot++) map[slot] = { ...base[slot] };
    // Forward pass: feeders always have lower slot numbers, so one pass resolves the tree.
    for (const slot of undecided) {
      const { teamA, teamB } = participantsForSlot(slot, map);
      const { p } = matchupProb(teamA, teamB, bookLines);
      map[slot].teamA = teamA; map[slot].teamB = teamB;
      map[slot].winner = rng() < p ? teamA : teamB;
    }
    const champ = map[TOTAL_SLOTS].winner;
    if (champ) championCount.set(champ, (championCount.get(champ) ?? 0) + 1);

    if (nP > 0) {
      const simWinners: OfficialWinners = {};
      for (let slot = 1; slot <= TOTAL_SLOTS; slot++) simWinners[slot] = map[slot].winner;
      let max = -1, leaders = 0;
      for (let i = 0; i < nP; i++) {
        totals[i] = scoreBracket(brackets[i].picks, simWinners);
        ptsSum[i] += totals[i];
        if (totals[i] > max) { max = totals[i]; leaders = 1; }
        else if (totals[i] === max) leaders++;
      }
      for (let i = 0; i < nP; i++) if (totals[i] === max) { anyFirst[i] += 1 / leaders; if (leaders === 1) sole[i]++; }
    }
  }

  const round1 = (n: number) => +n.toFixed(1);
  const round2 = (n: number) => +n.toFixed(2);

  const bracketOdds: BracketOdds[] = brackets.map((b, i) => {
    const needs: NeedGame[] = [];
    for (const slot of undecided) {
      const team = b.picks[slot];
      if (!team) continue;
      const { teamA, teamB } = participantsForSlot(slot, base);
      // Only a need we can name now (both contestants known and the pick is one of them).
      if (team !== teamA && team !== teamB) continue;
      const opponent = team === teamA ? teamB : teamA;
      const { p } = matchupProb(team, opponent, bookLines);
      needs.push({ slot, round: roundForSlot(slot), team, opponent, prob: p, points: ROUND_POINTS[roundForSlot(slot)] });
    }
    needs.sort((x, y) => y.points * y.prob - x.points * x.prob);
    return {
      key: b.key, owner: b.owner, bracketName: b.bracketName, now: now[i],
      exp: round1(ptsSum[i] / sims),
      winPct: round2(100 * anyFirst[i] / sims),
      solePct: round2(100 * sole[i] / sims),
      champion: b.picks[TOTAL_SLOTS] ?? null,
      needs: needs.slice(0, needN),
    };
  }).sort((a, b) => b.winPct - a.winPct || b.exp - a.exp);

  const teams: TeamOdds[] = [...championCount.entries()]
    .map(([code, c]) => ({ code, titlePct: round2(100 * c / sims) }))
    .sort((a, b) => b.titlePct - a.titlePct);

  const decided = Object.values(winners).filter((w) => w != null).length;

  return {
    locked, brackets: bracketOdds, teams, books: bookLines,
    sims, decided, total: TOTAL_SLOTS, remaining: undecided.length, oddsCoverage, updatedAt,
  };
}
