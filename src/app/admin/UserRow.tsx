'use client';

import { useTransition } from 'react';

export function ActionButton({
  label,
  action,
}: {
  label: string;
  action: () => Promise<{ error?: string }>;
}) {
  const [pending, start] = useTransition();
  return (
    <button
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
