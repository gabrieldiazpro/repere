'use client';
// Connexion Shopify (état réel) : POST /api/ecommerce/shopify/start → écran d'autorisation Shopify ; DELETE pour déconnecter.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, Notice } from './client';

/** « ma-boutique », « ma-boutique.myshopify.com », « https://ma-boutique.myshopify.com/admin » → domaine myshopify. */
export function normalizeShopInput(raw: string): string | null {
  let s = raw.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0];
  if (!s) return null;
  if (!s.includes('.')) s = `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

export function ShopifyConnect({ businessId, demo, connected, shop, connectedAt }: { businessId: string; demo: boolean; connected: boolean; shop: string | null; connectedAt: string | null }) {
  const router = useRouter();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'demo' | 'success'; text: string } | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    const s = normalizeShopInput(v);
    if (!s) return setMsg({ tone: 'error', text: 'Indiquez l’adresse de votre boutique, par exemple ma-boutique.myshopify.com.' });
    if (demo) return setMsg({ tone: 'demo', text: 'Démo : la connexion n’est pas possible sur un compte de démonstration.' });
    setBusy(true);
    setMsg(null);
    const r = await api<{ url: string }>('/api/ecommerce/shopify/start', { body: { businessId, shop: s } });
    if (!r.ok || !r.data?.url) {
      setBusy(false);
      return setMsg({ tone: 'error', text: r.error ?? 'Connexion impossible.' });
    }
    window.location.assign(r.data.url);
  }

  async function disconnect() {
    if (!window.confirm('Déconnecter la boutique ? Les ventes ne seront plus attribuées depuis Shopify. Pensez à désinstaller aussi l’application côté Shopify.')) return;
    setBusy(true);
    const r = await api(`/api/ecommerce/shopify?businessId=${encodeURIComponent(businessId)}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: 'error', text: r.error ?? 'Déconnexion impossible.' });
    setMsg({ tone: 'success', text: 'Boutique déconnectée.' });
    router.refresh();
  }

  if (connected)
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[14px]">
          <span className="rp-chip rp-chip-success mr-2">Connectée</span>
          <strong>{shop}</strong>
          {connectedAt && <span className="text-[var(--muted)]"> depuis le {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(connectedAt))}</span>}
        </p>
        <p className="text-[13px] text-[var(--muted)]">Accès en lecture seule aux produits et aux commandes (montant, page d’arrivée, référent). Aucune donnée client n’est lue.</p>
        <div>
          <button type="button" className="rp-btn rp-btn-sm" onClick={disconnect} disabled={busy}>
            Déconnecter
          </button>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    );

  return (
    <form onSubmit={connect} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">Adresse de votre boutique Shopify</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="rp-input flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder="ma-boutique.myshopify.com" autoComplete="off" spellCheck={false} />
          <button type="submit" className="rp-btn rp-btn-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Redirection vers Shopify…' : 'Connecter Shopify'}
          </button>
        </div>
      </label>
      <p className="text-[12px] text-[var(--muted)]">Vous validez l’accès sur Shopify (lecture des produits et des commandes), puis revenez ici.</p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  );
}
