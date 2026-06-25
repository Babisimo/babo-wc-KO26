import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { getProjectedBracket } from '@/app/actions/projection';
import { officialR32FromSlots, officialR32IsSet } from '@/lib/official-r32';
import MarchMadnessBracket from '@/app/_components/MarchMadnessBracket';
import OfficialBracketView from './OfficialBracketView';
import OfficialHeader from './OfficialHeader';
import { OfficialPanelHead, OfficialNotAvailable } from './OfficialPanelHead';
import type { SlotView } from '@/lib/bracket-view';

export const dynamic = 'force-dynamic';

export default async function OfficialPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const official = await getOfficialBracket();
  const officialR32 = officialR32FromSlots(official.slots);

  // Once the real R32 is set, show it with live results (existing behavior).
  if (officialR32IsSet(officialR32)) {
    const decided = official.slots.filter((s) => s.winner).length;
    const view: SlotView[] = official.slots.map((s) => ({
      slot: s.slot, round: s.round, teamA: s.teamA, teamB: s.teamB,
      pick: null, officialWinner: s.winner, status: s.winner ? 'correct' : 'pending',
    }));
    return (
      <main className="shell">
        <OfficialHeader variant="real" />
        <section className="panel reveal reveal-2">
          <OfficialPanelHead decided={decided} total={official.slots.length} />
          <MarchMadnessBracket slots={view} />
        </section>
      </main>
    );
  }

  // Group stage still in progress -> live projection with the toggle.
  const projection = await getProjectedBracket();
  return (
    <main className="shell">
      <OfficialHeader variant="projected" />
      <section className="panel reveal reveal-2">
        {projection.available ? (
          <OfficialBracketView asItStands={projection.asItStands} confirmed={projection.confirmed} />
        ) : (
          <OfficialNotAvailable />
        )}
      </section>
    </main>
  );
}
