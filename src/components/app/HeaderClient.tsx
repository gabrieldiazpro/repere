'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDate } from './tokens';

export function OfflineBanner({ dataDate }: { dataDate: string | null }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="bg-[var(--ink)] px-4 py-2 text-center text-[13px] text-white">
      Hors ligne{dataDate ? ` · données du ${fmtDate(dataDate)}` : ''}. Vos coches seront envoyées au retour du réseau.
    </div>
  );
}

export function BusinessSwitcher({ current, options }: { current: string; options: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="block">
      <span className="sr-only">Changer de commerce</span>
      <select
        defaultValue={current}
        onChange={(e) => {
          document.cookie = `rp_business=${encodeURIComponent(e.target.value)}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className="max-w-full truncate bg-transparent text-[13px] font-medium text-[var(--muted)]"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}
