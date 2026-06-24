'use client';

import { useState } from 'react';
import type { SlotView } from '@/lib/bracket-view';
import MarchMadnessBracket from '@/app/_components/MarchMadnessBracket';

export default function OfficialBracketView({
  asItStands,
  confirmed,
}: {
  asItStands: SlotView[];
  confirmed: SlotView[];
}) {
  const [mode, setMode] = useState<'live' | 'confirmed'>('live');
  const slots = mode === 'live' ? asItStands : confirmed;
  return (
    <>
      <div className="fm-toggle" role="tablist" aria-label="Bracket view">
        <button type="button" role="tab" aria-selected={mode === 'live'}
          className={`seg${mode === 'live' ? ' active' : ''}`} onClick={() => setMode('live')}>
          As it stands
        </button>
        <button type="button" role="tab" aria-selected={mode === 'confirmed'}
          className={`seg${mode === 'confirmed' ? ' active' : ''}`} onClick={() => setMode('confirmed')}>
          Confirmed
        </button>
      </div>
      <MarchMadnessBracket slots={slots} />
    </>
  );
}
