'use client';
// Relance de la carte (POST /api/local/map) : plafonds de l'offre affichés avant, refus expliqués.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, Notice } from './client';

export function MapRelaunch({ businessId, canRun, reason, calls, upgrade }: { businessId: string; canRun: boolean; reason: string | null; calls: number; upgrade: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string; upgrade?: boolean } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const r = await api<{ map: unknown; saved: boolean }>('/api/local/map', { body: { businessId } });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: 'error', text: r.error ?? 'La carte n’a pas pu être lancée.', upgrade: r.code === 'upgrade_required' || r.status === 402 });
    setMsg({ tone: 'success', text: 'Nouvelle carte prête.' });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="rp-btn rp-btn-primary" onClick={run} disabled={!canRun || busy} aria-busy={busy} aria-describedby="map-run-note">
          {busy ? 'Questions en cours… (1 à 3 minutes)' : 'Relancer la carte'}
        </button>
        <span id="map-run-note" className="text-[13px] text-[var(--muted)]">
          {reason ?? `${calls} questions posées aux IA pour cette carte.`}
        </span>
      </div>
      {upgrade && !canRun && (
        <p className="text-[13px]">
          <Link className="rp-link" href="/tarifs">
            Voir les offres qui incluent plus de cartes
          </Link>
        </p>
      )}
      {msg && (
        <Notice tone={msg.tone}>
          {msg.text}{' '}
          {msg.upgrade && (
            <Link className="rp-link" href="/tarifs">
              Voir les offres
            </Link>
          )}
        </Notice>
      )}
    </div>
  );
}
