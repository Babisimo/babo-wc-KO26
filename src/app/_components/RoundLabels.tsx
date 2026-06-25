'use client';
import { useT } from '@/app/_components/LangProvider';
const KEYS = ['round.r32', 'round.r16', 'round.qf', 'round.sf', 'round.final'] as const;
export default function RoundLabels() {
  const t = useT();
  return (
    <div className="fm-labels">
      {KEYS.map((k) => (<span key={k}>{t(k)}</span>))}
    </div>
  );
}
