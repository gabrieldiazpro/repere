'use client';
// Sélecteur de commerce (multi-commerces) : POST /api/account/businesses { businessId } pose le cookie côté serveur.
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from './client';
import type { BusinessOption } from './server';

export function BusinessSwitcher({ current, options }: { current: string; options: BusinessOption[] }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  if (options.length < 2) return null;
  return (
    <label className="mt-2 block">
      <span className="sr-only">Changer de commerce</span>
      <select
        value={value}
        disabled={pending}
        aria-busy={pending}
        onChange={async (e) => {
          const id = e.target.value;
          const prev = value;
          setValue(id);
          try {
            const r = await fetch('/api/account/businesses', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ businessId: id }),
            });
            if (!r.ok) throw new Error();
            start(() => router.refresh());
          } catch {
            setValue(prev);
            toast({ text: 'Le changement de commerce a échoué. Réessayez.', tone: 'error' });
          }
        }}
        className="rp-biz-select"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
