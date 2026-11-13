'use client';
import { useState } from 'react';
import type { ReadinessReport, RenderReport } from '@/lib/siteaudit/types';
import { callTool, hostOf } from './api';
import { AuditBridge, EmailCapture, ErrorBox, ExampleNote, Loading, ResultHeader, Scope, ShareLink, StatusPill, UrlForm, useShareParams, useToolRun } from './ui';

const VERDICT: Record<RenderReport['verdict'], { label: string; status: 'ok' | 'warn' | 'fail'; text: string }> = {
  lisible: { label: 'Lisible', status: 'ok', text: 'Le contenu principal est présent dans le HTML : un robot d’IA peut le lire sans exécuter de JavaScript.' },
  partiel: { label: 'Partiellement lisible', status: 'warn', text: 'Une partie du contenu n’arrive qu’après exécution du JavaScript : les robots d’IA en voient une version incomplète.' },
  quasi_vide: { label: 'Quasi vide', status: 'fail', text: 'Le HTML reçu ne contient presque pas de texte : un robot d’IA ne voit pratiquement rien de cette page.' },
};

const yes = (b: boolean) => (b ? 'ok' : 'fail') as 'ok' | 'fail';

function RenderResult({ r, example }: { r: ReadinessReport; example: boolean }) {
  const v = r.render;
  const meta = VERDICT[v.verdict];
  const signals: { label: string; status: 'ok' | 'warn' | 'fail'; value: string }[] = [
    { label: 'Balise title', status: yes(v.hasTitle), value: v.hasTitle ? 'Présente' : 'Absente' },
    { label: 'Meta description', status: v.hasMetaDescription ? 'ok' : 'warn', value: v.hasMetaDescription ? 'Présente' : 'Absente' },
    { label: 'Titre H1', status: yes(v.hasH1), value: v.hasH1 ? 'Présent' : 'Absent' },
    { label: 'Zone <main>', status: v.hasMain ? 'ok' : 'warn', value: v.hasMain ? 'Présente' : 'Absente' },
    { label: 'Données structurées', status: v.hasJsonLd ? 'ok' : 'warn', value: v.hasJsonLd ? 'Présentes' : 'Absentes' },
    { label: 'Racine d’application vide', status: v.emptyRoot ? 'fail' : 'ok', value: v.emptyRoot ? `Détectée (${v.emptyRoot})` : 'Non détectée' },
    { label: 'Texte dans <noscript>', status: 'ok', value: `${v.noscriptWords} mots` },
    { label: 'Part de texte dans le HTML', status: v.textRatio >= 0.1 ? 'ok' : 'warn', value: `${Math.round(v.textRatio * 100)} %` },
  ];
  return (
    <div className="mt-6 rt-fade">
      {example && <ExampleNote what="page d’une plomberie imaginaire, dont les avis sont chargés par un script." />}
      <ResultHeader title={`Ce que voit un robot d’IA sur ${hostOf(r.finalUrl)}`} actions={!example ? <ShareLink params={{ url: r.url }} /> : undefined} />
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-canvas p-4">
        <StatusPill status={meta.status} label={meta.label} />
        <p className="min-w-0 flex-1 text-ink">{meta.text}</p>
        <p className="text-2xl font-bold tabular-nums text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          {v.words} <span className="text-sm font-normal text-muted">mots lus</span>
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="rt-raw" className="min-w-0">
          <h3 id="rt-raw" className="mb-2 font-semibold text-ink">
            Le texte du HTML brut
          </h3>
          <div className="max-h-96 overflow-auto rounded-xl border border-line bg-white p-4 text-[0.95rem] leading-relaxed" tabIndex={0}>
            {v.headings.length > 0 && (
              <ul className="mb-3 space-y-1 border-b border-line pb-3">
                {v.headings.slice(0, 12).map((h, i) => (
                  <li key={i} className="text-ink" style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}>
                    <span className="mr-2 rounded bg-primary-bg px-1.5 text-xs font-semibold text-primary">H{h.level}</span>
                    {h.text}
                  </li>
                ))}
              </ul>
            )}
            {v.preview ? <p className="whitespace-pre-line text-ink">{v.preview}</p> : <p className="text-muted">Aucun texte lisible dans le HTML reçu.</p>}
          </div>
          <p className="mt-2 text-sm text-muted">Comparez avec votre page ouverte dans le navigateur : ce qui manque ici est invisible pour la plupart des robots d’IA.</p>
        </section>
        <section aria-labelledby="rt-signals">
          <h3 id="rt-signals" className="mb-2 font-semibold text-ink">
            Indicateurs
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {signals.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-ink">{s.label}</span>
                <StatusPill status={s.status} label={s.value} />
              </li>
            ))}
          </ul>
          {v.frameworks.length > 0 && <p className="mt-2 text-sm text-muted">Technologies repérées : {v.frameworks.join(', ')}.</p>}
        </section>
      </div>
      <p className="mt-4 text-sm text-muted">{v.limit}</p>
    </div>
  );
}

export function RenderTool({ example }: { example: ReadinessReport }) {
  const [url, setUrl] = useState('');
  const { state, run, showExample } = useToolRun<ReadinessReport>();
  const go = (u: string) => {
    setUrl(u);
    run((signal) => callTool('/api/tools/readiness', { url: u }, { signal }));
  };
  useShareParams((p) => p.url && go(p.url));
  const busy = state.phase === 'loading';
  return (
    <>
      <Scope busy={busy}>
        <UrlForm label="Adresse de la page" submitLabel="Voir comme un robot" busy={busy} value={url} onChange={setUrl} onUrl={go} onExample={() => showExample(example)} />
        {busy && <Loading steps={['Récupération du HTML brut, sans navigateur…', 'Extraction du texte et des titres…', 'Recherche de coquilles vides…']} />}
        {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => url && go(url)} />}
        {state.phase === 'done' && <RenderResult r={state.data} example={state.example} />}
      </Scope>
      {state.phase === 'done' && !state.example && <EmailCapture tool="Rendu sans JavaScript" url={state.data.finalUrl} />}
      <AuditBridge done={state.phase === 'done'} url={state.phase === 'done' && !state.example ? state.data.finalUrl : null} text="Même un contenu invisible n’empêche pas les IA de parler de vous, à partir d’autres sources. L’audit montre ce qu’elles disent, et d’où elles le tirent." />
    </>
  );
}
