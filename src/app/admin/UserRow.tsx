'use client';

import { useTransition } from 'react';

export function ActionButton({
  label,
  action,
  variant = 'ghost',
}: {
  label: string;
  action: () => Promise<{ error?: string }>;
  variant?: 'primary' | 'ghost';
}) {
  const [pending, start] = useTransition();
  const cls = variant === 'primary' ? 'btn btn-sm' : 'btn-ghost btn-sm';
  return (
    <button
      className={cls}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await action();
          if (res?.error) alert(res.error);
        })
      }
    >
      {pending ? '…' : label}
    </button>
  );
}
