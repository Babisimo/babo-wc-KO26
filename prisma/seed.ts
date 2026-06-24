import { PrismaClient } from '@prisma/client';
import { TEAMS } from '../src/lib/teams';

const db = new PrismaClient();

async function main() {
  for (const t of TEAMS) {
    await db.team.upsert({
      where: { code: t.code },
      update: { name: t.name, color: t.color },
      create: { code: t.code, name: t.name, color: t.color },
    });
  }
  console.log(`Seeded ${TEAMS.length} teams.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
