'use client';
import { useT } from '@/app/_components/LangProvider';

export function NotOpen() {
  const t = useT();
  return (
    <main className="shell">
      <p className="eyebrow">{t('bracket.eyebrow')}</p>
      <h1>{t('bracket.title')}</h1>
      <div className="panel" style={{ marginTop: 16 }}>
        <p className="muted">{t('bracket.notOpen')}</p>
      </div>
    </main>
  );
}

export function ListHeader({ locked }: { locked: boolean }) {
  const t = useT();
  return (
    <header className="reveal" style={{ marginBottom: 18 }}>
      <p className="eyebrow">{t('bracket.eyebrow')}</p>
      <h1>{t('bracket.title')}</h1>
      <p className="lead">{t('bracket.lead')}{locked ? ` ${t('common.locked')}` : ''}</p>
    </header>
  );
}

export function EditHeader({ name, locked }: { name: string; locked: boolean }) {
  const t = useT();
  return (
    <header className="reveal" style={{ marginBottom: 18 }}>
      <p className="eyebrow">{t('bracket.eyebrow')} · {name}</p>
      <h1>{name}</h1>
      <p className="lead">{t('bracket.editLead')}{locked ? ` ${t('common.locked')}` : ''}</p>
    </header>
  );
}
