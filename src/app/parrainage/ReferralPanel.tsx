'use client';

import { useEffect, useState } from 'react';

interface Data {
  code: string;
  link: string;
  invited: number;
  pending: number;
  rewarded: number;
  monthsGranted: number;
  reward: { referrerMonths: number; refereeMonths: number; annualCapMonths: number };
}

/** Panneau « mon code » : appelle GET /api/growth/referral (cookies de session ; jeton Bearer optionnel). */
export function ReferralPanel({ businessId, token }: { businessId: string; token?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let off = false;
    fetch(`/api/growth/referral?businessId=${encodeURIComponent(businessId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (r) => {
        const j = await r.json();
        if (off) return;
        if (!r.ok) setErr(j.error ?? 'Indisponible.');
        else setData(j.referral);
      })
      .catch(() => !off && setErr('Indisponible.'));
    return () => {
      off = true;
    };
  }, [businessId, token]);
  if (err) return <p role="alert">{err}</p>;
  if (!data) return <p>Chargement…</p>;
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: '#fff' }}>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Votre code
      </p>
      <p className="text-2xl font-bold tabular-nums">{data.code}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input readOnly aria-label="Votre lien de parrainage" value={data.link} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--line)' }} />
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white"
          style={{ background: 'var(--primary)' }}
          onClick={() => navigator.clipboard?.writeText(data.link).then(() => setCopied(true)).catch(() => setCopied(false))}
        >
          {copied ? 'Lien copié' : 'Copier le lien'}
        </button>
      </div>
      <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
        {data.invited} invité{data.invited > 1 ? 's' : ''} · {data.pending} en attente du premier paiement · {data.rewarded} récompensé{data.rewarded > 1 ? 's' : ''} · {data.monthsGranted} mois offert{data.monthsGranted > 1 ? 's' : ''} sur 12 mois (plafond {data.reward.annualCapMonths}).
      </p>
    </div>
  );
}
