import { NextResponse } from 'next/server';
import { getNextGames } from '@/app/actions/next-games';
import { runResultsRefresh } from '@/lib/results-refresh';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Free-plan (Hobby) results automation: Vercel Cron is limited to one run per day,
// which is far too slow to score live games. Every home client already polls this
// endpoint every 30s, so we piggyback a results refresh here — throttled to at most
// once per minute per warm instance so we don't hammer the feed/DB on every poll.
// Net effect: points post within ~a minute of a game finishing whenever anyone is on
// the site. The daily /api/cron/refresh remains as an unattended backstop.
const AUTO_REFRESH_MS = 60_000;
let lastAutoRefresh = 0;

export async function GET() {
  const now = Date.now();
  if (now - lastAutoRefresh > AUTO_REFRESH_MS) {
    lastAutoRefresh = now;
    try {
      await runResultsRefresh(); // persists any newly-decided winners before we read them
    } catch {
      /* feed/DB hiccup: never block the live strip */
    }
  }
  return NextResponse.json(await getNextGames());
}
