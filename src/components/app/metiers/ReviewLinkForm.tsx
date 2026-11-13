'use client';
// Enregistre le lien d'avis Google (ou le Place ID) pour générer lien, QR et modèles : POST /api/exec/settings.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, Notice } from './client';

/** Lien https (g.page/r/…/review, search.google.com…) ou Place ID brut ou contenu dans un lien Google Maps. */
export function parseReviewInput(raw: string): { reviewUrl: string } | { placeId: string } | null {
  const s = raw.trim();
  if (!s) return null;
  const inUrl = /(?:place_id[:=]|query_place_id=|placeid=)([A-Za-z0-9_-]{10,300})/i.exec(s);
  if (inUrl) return { placeId: inUrl[1] };
  if (/^https:\/\/\S{8,290}$/i.test(s)) return { reviewUrl: s };
  if (/^[A-Za-z0-9_-]{10,300}$/.test(s) && !/^\d+$/.test(s)) return { placeId: s };
  return null;
}

export function ReviewLinkForm({ businessId, demo }: { businessId: string; demo: boolean }) {
  const router = useRouter();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'demo' | 'success'; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseReviewInput(v);
    if (!parsed) return setMsg({ tone: 'error', text: 'Collez un lien qui commence par https:// ou un Place ID (souvent « ChIJ… »).' });
    if (demo) return setMsg({ tone: 'demo', text: 'Démo : le lien n’est pas enregistré. Sur votre espace, le QR code et les modèles se mettent à jour aussitôt.' });
    setBusy(true);
    setMsg(null);
    const r = await api('/api/exec/settings', { body: { businessId, settings: parsed } });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: 'error', text: r.error ?? 'Enregistrement impossible.' });
    setMsg({ tone: 'success', text: 'Lien enregistré.' });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">Votre lien d’avis Google ou votre Place ID</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="rp-input flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder="https://g.page/r/…/review" autoComplete="off" spellCheck={false} />
          <button type="submit" className="rp-btn rp-btn-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer le lien'}
          </button>
        </div>
      </label>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  );
}
