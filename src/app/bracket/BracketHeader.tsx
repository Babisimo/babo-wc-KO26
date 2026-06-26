'use client';
import { useT } from '@/app/_components/LangProvider';
import RenameControl from './RenameControl';

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

export function EditHeader({ id, name, locked }: { id: string; name: string; locked: boolean }) {
  const t = useT();
  return (
    <header className="reveal" style={{ marginBottom: 18 }}>
      <p className="eyebrow">{t('bracket.eyebrow')} · {name}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <RenameControl id={id} name={name} locked={locked}>
          <h1 style={{ display: 'inline', margin: 0 }}>{name}</h1>
        </RenameControl>
      </div>
      <p className="lead">{t('bracket.editLead')}{locked ? ` ${t('common.locked')}` : ''}</p>
    </header>
  );
}
