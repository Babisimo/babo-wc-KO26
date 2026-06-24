import { flagClass } from '@/lib/team-flag';

export default function TeamFlag({ code }: { code: string | null }) {
  const fc = flagClass(code);
  if (!fc) return <span className="fm-chip" aria-hidden />;
  return <span className={`fi ${fc} fm-flag`} role="img" aria-label={code ?? undefined} />;
}
