// One-time migration for the drafts + designate-official feature.
//
// Before this change every bracket was an immediate paid entry. To keep the existing pot and
// leaderboard unchanged, mark every pre-existing bracket as official.
//
// Run AFTER `prisma db push` (which adds the Bracket.official column):
//   npx tsx --env-file=.env prisma/backfill-official.ts
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const res = await db.bracket.updateMany({ where: { official: false }, data: { official: true } });
  console.log(`Marked ${res.count} existing bracket(s) as official.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
