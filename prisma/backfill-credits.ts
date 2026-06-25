import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Give every APPROVED user credits = max(their current bracket count, 1), so no
// existing bracket exceeds the new cap and approved users get at least their first.
async function main() {
  const users = await db.user.findMany({ where: { status: 'APPROVED' }, select: { id: true } });
  for (const u of users) {
    const count = await db.bracket.count({ where: { userId: u.id } });
    await db.user.update({ where: { id: u.id }, data: { credits: Math.max(count, 1) } });
  }
  console.log(`backfilled credits for ${users.length} approved users`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
