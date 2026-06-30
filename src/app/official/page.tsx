import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { getProjectedBracket } from '@/app/actions/projection';
import { officialR32FromSlots, officialR32IsSet } from '@/lib/official-r32';
import MarchMadnessBracket from '@/app/_components/MarchMadnessBracket';
import StageTracker from '@/app/_components/StageTracker';
import OfficialBracketView from './OfficialBracketView';
import OfficialHeader from './OfficialHeader';
import { OfficialPanelHead, OfficialNotAvailable } from './OfficialPanelHead';
import { computeStage } from '@/lib/tournament-stage';
import { eliminations } from '@/lib/eliminations';
import type { OfficialWinners } from '@/lib/scoring';
import type { SlotView } from '@/lib/bracket-view';

export const dynamic = 'force-dynamic';

export default async function OfficialPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const official = await getOfficialBracket();
  const officialR32 = officialR32FromSlots(official.slots);
  const dates: Record<number, string | null> = {};
  const winners: OfficialWinners = {};
  for (const s of official.slots) {
    dates[s.slot] = s.kickoff;
    if (s.winner) winners[s.slot] = s.winner;
  }
  const stage = computeStage(winners);

  // Once the real R32 is set, show it with live results (existing behavior).
  if (officialR32IsSet(officialR32)) {
    const decided = official.slots.filter((s) => s.winner).length;
    const view: SlotView[] = official.slots.map((s) => ({
      slot: s.slot, round: s.round, teamA: s.teamA, teamB: s.teamB,
      pick: null, officialWinner: s.winner, status: s.winner ? 'correct' : 'pending',
    }));
    const eliminatedBy = eliminations(officialR32, winners);
    return (
      <main className="shell">
        <OfficialHeader variant="real" />
        <StageTracker stage={stage} />
        <section className="panel reveal reveal-2">
          <OfficialPanelHead decided={decided} total={official.slots.length} />
          <MarchMadnessBracket slots={view} dates={dates} eliminatedBy={eliminatedBy} />
        </section>
      </main>
    );
  }

  // Group stage still in progress -> live projection with the toggle.
  const projection = await getProjectedBracket();
  return (
    <main className="shell">
      <OfficialHeader variant="projected" />
      <StageTracker stage={stage} />
      <section className="panel reveal reveal-2">
        {projection.available ? (
          <OfficialBracketView asItStands={projection.asItStands} confirmed={projection.confirmed} dates={dates} />
        ) : (
          <OfficialNotAvailable />
        )}
      </section>
    </main>
  );
}
