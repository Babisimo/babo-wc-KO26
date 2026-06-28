import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { runResultsRefresh } from '@/lib/results-refresh';

// Unattended results refresh. Vercel Cron (see vercel.json) hits this on a schedule
// with `Authorization: Bearer ${CRON_SECRET}`, so winners + points post automatically
// instead of depending on an admin clicking "Refresh results".
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runResultsRefresh();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refresh failed' },
      { status: 500 },
    );
  }
}
