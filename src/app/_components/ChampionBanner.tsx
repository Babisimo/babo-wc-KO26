'use client';

import { useT } from '@/app/_components/LangProvider';
import { joinNames } from '@/lib/champion';

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Celebratory banner naming the pool champion(s). Renders nothing until the pool is decided. */
export default function ChampionBanner({
  champions,
}: {
  champions: { names: string[]; shareCents: number } | null;
}) {
  const t = useT();
  if (!champions) return null;

  const { names, shareCents } = champions;
  const amount = dollars(shareCents);
  const message =
    names.length === 1
      ? t('home.champOne', { name: names[0], amount })
      : t('home.champMany', { names: joinNames(names, t('common.and')), amount });

  return (
    <section className="champ reveal" role="status" aria-live="polite">
      {message}
    </section>
  );
}
