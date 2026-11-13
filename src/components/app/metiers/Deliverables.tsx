'use client';
// Livrables e-commerce : FAQ produit (+ FAQPage JSON-LD), guide d'achat de catégorie, JSON-LD Product.
// POST /api/ecommerce/deliverables. Gabarits sans clé ; rédaction par IA réservée aux offres avec exécution.
import { useState } from 'react';
import { CopyButton } from '@/components/app/CopyButton';
import type { BuyingGuide, ProductFaq } from '@/lib/ecommerce/deliverables';
import { api, Notice } from './client';

type Kind = 'faq' | 'guide' | 'jsonld';
type Result = { kind: 'faq'; faq: ProductFaq } | { kind: 'guide'; guide: BuyingGuide } | { kind: 'jsonld'; jsonld: Record<string, unknown>; warnings: string[] };

const script = (o: unknown) => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`;

export function Deliverables({
  businessId,
  products,
  categories,
  llmAllowed,
  llmLock,
  initialProduct,
}: {
  businessId: string;
  products: { id: string; name: string }[];
  categories: string[];
  llmAllowed: boolean;
  llmLock?: React.ReactNode;
  initialProduct?: string | null;
}) {
  const [kind, setKind] = useState<Kind>('faq');
  const [productId, setProductId] = useState(initialProduct && products.some((p) => p.id === initialProduct) ? initialProduct : (products[0]?.id ?? ''));
  const [category, setCategory] = useState(categories[0] ?? '');
  const [llm, setLlm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await api<Record<string, unknown>>('/api/ecommerce/deliverables', { body: { businessId, kind, ...(kind === 'guide' ? { category } : { productId }), llm: llm && llmAllowed } });
    setBusy(false);
    if (!r.ok || !r.data) return setErr(r.error ?? 'Génération impossible.');
    const d = r.data;
    if (kind === 'faq') setRes({ kind, faq: d.faq as ProductFaq });
    else if (kind === 'guide') setRes({ kind, guide: d.guide as BuyingGuide });
    else setRes({ kind, jsonld: d.jsonld as Record<string, unknown>, warnings: (d.warnings as string[]) ?? [] });
  }

  if (!products.length) return <p className="text-[14px] text-[var(--muted)]">Ajoutez d’abord des produits à votre catalogue suivi : les livrables partent de vos fiches.</p>;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={run} className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Livrable" className="rp-seg w-fit">
          {(
            [
              ['faq', 'FAQ produit'],
              ['guide', 'Guide d’achat'],
              ['jsonld', 'Balisage produit'],
            ] as [Kind, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className="rp-seg-btn" onClick={() => setKind(k)}>
              {l}
            </button>
          ))}
        </div>
        {kind === 'guide' ? (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold">Catégorie</span>
            {categories.length ? (
              <select className="rp-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input className="rp-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex. shampoing solide" />
            )}
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold">Produit</span>
            <select className="rp-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind !== 'jsonld' &&
          (llmAllowed ? (
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={llm} onChange={(e) => setLlm(e.target.checked)} /> Reformuler par IA (relecture obligatoire)
            </label>
          ) : (
            llmLock
          ))}
        <div>
          <button type="submit" className="rp-btn rp-btn-primary" disabled={busy || (kind === 'guide' && !category.trim())} aria-busy={busy}>
            {busy ? 'Génération…' : 'Générer'}
          </button>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
      </form>

      {res?.kind === 'faq' && (
        <div className="flex flex-col gap-3" aria-live="polite">
          {res.faq.fromQueries.length > 0 && <p className="text-[13px] text-[var(--muted)]">Construite pour répondre à : {res.faq.fromQueries.map((q) => `« ${q} »`).join(', ')}.</p>}
          <dl className="flex flex-col gap-3">
            {res.faq.items.map((it) => (
              <div key={it.q} className={`rounded-lg border p-3 ${it.toComplete ? 'border-[var(--warning)]' : 'border-[var(--hair)]'}`}>
                <dt className="font-semibold">{it.q}</dt>
                <dd className="mt-1 text-[14px]">{it.a}</dd>
                {it.toComplete && <dd className="mt-1 text-[12px] text-[var(--warning-ink)]">À compléter avant publication : nous n’inventons pas cette information.</dd>}
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={res.faq.items.map((i) => `${i.q}\n${i.a}`).join('\n\n')} label="Copier la FAQ" />
            <CopyButton text={script(res.faq.jsonLd)} label="Copier le balisage FAQ" />
          </div>
        </div>
      )}
      {res?.kind === 'guide' && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{res.guide.title}</p>
            <CopyButton text={res.guide.markdown} label="Copier le guide" />
          </div>
          <pre className="rp-code max-h-[420px] overflow-auto whitespace-pre-wrap">{res.guide.markdown}</pre>
        </div>
      )}
      {res?.kind === 'jsonld' && (
        <div className="flex flex-col gap-2" aria-live="polite">
          {res.warnings.length > 0 && (
            <ul className="list-disc pl-5 text-[13px] text-[var(--warning-ink)]">
              {res.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <CopyButton text={script(res.jsonld)} label="Copier le balisage" />
          </div>
          <pre className="rp-code max-h-[420px] overflow-auto">{script(res.jsonld)}</pre>
        </div>
      )}
    </div>
  );
}
