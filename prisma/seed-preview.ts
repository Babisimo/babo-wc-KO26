// PREVIEW seed: populates a sample Round-of-32 with real WC26 teams so the
// bracket can be viewed/tested before the official field is finalized.
// NOT the official draw. Re-run safely; overwrite via the admin bracket page.
import { PrismaClient } from '@prisma/client';
import { roundForSlot } from '../src/lib/bracket-structure';

const db = new PrismaClient();

// 16 sample R32 games (teamA vs teamB), real WC26 FIFA codes.
const TOP = ['ARG', 'BRA', 'FRA', 'ENG', 'ESP', 'GER', 'POR', 'NED', 'BEL', 'CRO', 'URU', 'COL', 'MEX', 'USA', 'CAN', 'JPN'];
const BOT = ['KOR', 'MAR', 'SEN', 'AUS', 'ECU', 'SUI', 'SWE', 'NOR', 'EGY', 'GHA', 'IRN', 'CIV', 'TUR', 'PAR', 'RSA', 'SCO'];

async function main() {
  const base = Date.parse('2026-06-28T16:00:00Z'); // earliest R32 kickoff
  for (let i = 0; i < 16; i++) {
    const slot = i + 1;
    const kickoff = new Date(base + i * 3 * 3600_000);
    await db.match.upsert({
      where: { slot },
      update: { round: 'R32', teamA: TOP[i], teamB: BOT[i], kickoff, actualWinner: null, winnerSource: null },
      create: { slot, round: 'R32', teamA: TOP[i], teamB: BOT[i], kickoff },
    });
  }
  for (let slot = 17; slot <= 31; slot++) {
    const round = roundForSlot(slot);
    await db.match.upsert({ where: { slot }, update: { round }, create: { slot, round } });
  }
  console.log('Seeded preview Round-of-32 (16 games) and ensured slots 17–31.');
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
