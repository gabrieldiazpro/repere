'use client';
import { useState } from 'react';
import type { ProductReport } from '@/lib/siteaudit/types';
import { callTool, hostOf } from './api';
import { formatPrice, frenchPrices } from './format';
import { AuditBridge, CheckList, CodeBlock, EmailCapture, ErrorBox, ExampleNote, Gauge, Loading, ResultHeader, Scope, ShareLink, UrlForm, useShareParams, useToolRun } from './ui';

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right font-medium ${value ? 'text-ink' : 'text-danger-ink'}`}>{value || 'Absent'}</dd>
    </div>
  );
}

function ProductResult({ r, example }: { r: ProductReport; example: boolean }) {
  const p = r.product;
  const sources = [p.sources.jsonld && 'JSON-LD', p.sources.microdata && 'microdonnées', p.sources.opengraph && 'Open Graph'].filter(Boolean).join(', ');
  return (
    <div className="mt-6 rt-fade">
      {example && <ExampleNote what="fiche du shampoing solide « Onde » de Maison Sora, la marque imaginaire du compte démo e-commerce." />}
      <ResultHeader title={p.name ? `« ${p.name} »` : `Fiche de ${hostOf(r.url)}`} sub={`${hostOf(r.url)}, données lues : ${sources || 'aucune donnée structurée'}.`} actions={!example && r.url ? <ShareLink params={{ url: r.url }} /> : undefined} />
      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
        <div className="space-y-4">
          <div className="flex justify-center">
            <Gauge score={r.score} />
          </div>
          <dl className="divide-y divide-line rounded-xl border border-line bg-white px-3">
            <Row label="Marque" value={p.brand} />
            <Row label="Prix" value={p.price ? formatPrice(p.price, p.priceCurrency) : null} />
            <Row label="Disponibilité" value={p.availability?.replace(/^https?:\/\/schema\.org\//, '')} />
            <Row label="Identifiant" value={p.gtin ?? p.mpn ?? p.sku} />
            <Row label="Avis" value={p.reviewCount ? `${p.reviewCount} (note ${p.ratingValue ?? '?'})` : null} />
            <Row label="Images" value={p.images.length ? String(p.images.length) : null} />
          </dl>
        </div>
        <div className="min-w-0">
          {p.conflicts.length > 0 && (
            <div className="mb-4 rounded-xl bg-danger-bg p-3 text-sm text-danger-ink" role="note">
              <strong>Valeurs contradictoires :</strong>
              <ul className="mt-1 list-disc pl-5">
                {p.conflicts.map((c) => (
                  <li key={c}>{frenchPrices(c)}</li>
                ))}
              </ul>
            </div>
          )}
          <CheckList checks={r.checks.map((c) => ({ ...c, detail: frenchPrices(c.detail), fix: c.fix ? frenchPrices(c.fix) : c.fix }))} />
        </div>
      </div>
      {r.suggestedJsonLd && (
        <div className="mt-6">
          <CodeBlock code={`<script type="application/ld+json">\n${JSON.stringify(r.suggestedJsonLd, null, 2)}\n</script>`} label="Balisage Product à compléter (valeurs trouvées sur la page uniquement)" />
          <p className="mt-2 text-sm text-muted">Les champs « à compléter » doivent être remplis avec vos vraies valeurs avant publication.</p>
        </div>
      )}
    </div>
  );
}

export function ProductTool({ example }: { example: ProductReport }) {
  const [url, setUrl] = useState('');
  const { state, run, showExample } = useToolRun<ProductReport>();
  const go = (u: string) => {
    setUrl(u);
    run((signal) => callTool('/api/tools/product', { url: u }, { signal }));
  };
  useShareParams((p) => p.url && go(p.url));
  const busy = state.phase === 'loading';
  return (
    <>
      <Scope busy={busy}>
        <UrlForm label="Adresse d’une fiche produit" placeholder="votre-boutique.fr/produit/…" submitLabel="Auditer la fiche" busy={busy} value={url} onChange={setUrl} onUrl={go} onExample={() => showExample(example)} />
        {busy && <Loading steps={['Lecture de la fiche, sans JavaScript…', 'Extraction des données Product et Offer…', 'Contrôle des attributs et des avis…']} />}
        {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => url && go(url)} />}
        {state.phase === 'done' && <ProductResult r={state.data} example={state.example} />}
      </Scope>
      {state.phase === 'done' && !state.example && <EmailCapture tool="Audit de fiche produit" url={state.data.url} />}
      <AuditBridge done={state.phase === 'done'} url={state.phase === 'done' && !state.example ? state.data.url : null} text="Une fiche complète peut être recommandée. L’audit dit si les IA citent votre marque, vos produits, ou un revendeur à votre place." />
    </>
  );
}
