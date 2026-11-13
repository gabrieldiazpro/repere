'use client';
// Catalogue suivi : ajout par URL, import (sitemap, /products.json, Shopify), audit de fiche à la demande.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SiteAuditRun } from '@/lib/siteaudit/runs';
import { api, DEMO_SAVED, Notice, useLocalState } from './client';
import { scoreTone } from './logic';

type ImportKind = 'urls' | 'sitemap' | 'products_json' | 'shopify';

/** Lignes de texte → URL http(s) uniques (30 au plus). */
export function parseUrls(raw: string, max = 30): string[] {
  const out: string[] = [];
  for (const line of raw.split(/[\s,;]+/)) {
    const s = line.trim();
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(s)) continue;
    if (!out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function CatalogAdd({ businessId, demo, shopifyConnected, site }: { businessId: string; demo: boolean; shopifyConnected: boolean; site?: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<ImportKind | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'demo'; text: string } | null>(null);
  const [demoUrls, setDemoUrls] = useLocalState<string[]>(`catalog:${businessId}`, []);

  async function run(kind: ImportKind) {
    setMsg(null);
    const urls = kind === 'urls' ? parseUrls(text) : [];
    if (kind === 'urls' && !urls.length) return setMsg({ tone: 'error', text: 'Collez au moins une adresse de fiche produit qui commence par https://.' });
    if (demo) {
      if (kind === 'urls') setDemoUrls([...new Set([...demoUrls, ...urls])].slice(0, 30));
      return setMsg({ tone: 'demo', text: kind === 'urls' ? `${DEMO_SAVED} Sur votre espace, chaque fiche est lue et auditée à l’ajout.` : 'Démo : import non disponible (catalogue fictif en lecture seule).' });
    }
    setBusy(kind);
    const r = await api<{ added: number; updated: number; skipped: number; errors: { url?: string; error: string }[] }>('/api/ecommerce/catalog', { body: { businessId, import: kind, ...(kind === 'urls' ? { urls } : { site }) } });
    setBusy(null);
    if (!r.ok || !r.data) return setMsg({ tone: 'error', text: r.error ?? 'Import impossible.' });
    const d = r.data;
    const errs = d.errors?.length ? ` ${d.errors.length} page${d.errors.length > 1 ? 's' : ''} illisible${d.errors.length > 1 ? 's' : ''}.` : '';
    setMsg({ tone: d.added + d.updated ? 'success' : 'error', text: `${d.added} produit${d.added > 1 ? 's' : ''} ajouté${d.added > 1 ? 's' : ''}, ${d.updated} mis à jour.${errs}` });
    if (kind === 'urls') setText('');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">Ajouter par adresse de fiche produit</span>
        <textarea className="rp-input min-h-[72px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://votre-boutique.fr/products/…  (une par ligne, 30 au plus)" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rp-btn rp-btn-primary" disabled={busy !== null} aria-busy={busy === 'urls'} onClick={() => run('urls')}>
          {busy === 'urls' ? 'Lecture des fiches…' : 'Ajouter ces produits'}
        </button>
        <button type="button" className="rp-btn" disabled={busy !== null || !site} aria-busy={busy === 'sitemap'} onClick={() => run('sitemap')}>
          {busy === 'sitemap' ? 'Lecture du plan du site…' : 'Importer depuis le plan du site'}
        </button>
        <button type="button" className="rp-btn" disabled={busy !== null || !site} aria-busy={busy === 'products_json'} onClick={() => run('products_json')}>
          {busy === 'products_json' ? 'Import…' : 'Importer le catalogue Shopify public'}
        </button>
        {shopifyConnected && (
          <button type="button" className="rp-btn" disabled={busy !== null} aria-busy={busy === 'shopify'} onClick={() => run('shopify')}>
            {busy === 'shopify' ? 'Import…' : 'Importer depuis ma boutique connectée'}
          </button>
        )}
      </div>
      {!site && <p className="text-[12px] text-[var(--muted)]">Renseignez l’adresse de votre site dans les réglages pour importer tout le catalogue d’un coup.</p>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {demo && demoUrls.length > 0 && (
        <div className="text-[13px]">
          <p className="font-semibold">Ajoutés sur cet appareil (démo, non audités)</p>
          <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
            {demoUrls.map((u) => (
              <li key={u} className="break-all">
                {u}
              </li>
            ))}
          </ul>
          <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost mt-1" onClick={() => setDemoUrls([])}>
            Effacer
          </button>
        </div>
      )}
    </div>
  );
}

/** Lance l'audit de fiche (POST /api/siteaudit kind=product) et affiche le score. */
export function AuditFicheButton({ businessId, url, demo, label = 'Analyser la fiche' }: { businessId: string; url: string; demo: boolean; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ score: number } | { error: string } | null>(null);
  async function run() {
    setBusy(true);
    setRes(null);
    const r = await api<SiteAuditRun>('/api/siteaudit', { body: { businessId, url, kind: 'product' } });
    setBusy(false);
    if (!r.ok || !r.data) return setRes({ error: r.error ?? 'Analyse impossible.' });
    if (r.data.error || !r.data.product) return setRes({ error: r.data.error ?? 'Aucune fiche produit lisible sur cette page.' });
    setRes({ score: r.data.product.score });
    if (!demo) router.refresh();
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2" aria-live="polite">
      <button type="button" className="rp-btn rp-btn-sm" onClick={run} disabled={busy} aria-busy={busy}>
        {busy ? 'Analyse…' : label}
      </button>
      {res && 'score' in res && <span className={`rp-chip rp-chip-${scoreTone(res.score)} rp-num`}>{res.score}/100</span>}
      {res && 'error' in res && <span className="text-[12px] text-[var(--danger-ink)]">{res.error}</span>}
    </span>
  );
}

