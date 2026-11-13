'use client';
import { useState } from 'react';
import type { ReadinessReport } from '@/lib/siteaudit/types';
import { callTool, hostOf } from './api';
import { AuditBridge, CheckList, EmailCapture, ErrorBox, ExampleNote, Gauge, Loading, ResultHeader, Scope, ShareLink, UrlForm, useShareParams, useToolRun } from './ui';

const STEPS = ['Lecture de la page, sans JavaScript…', 'Lecture du robots.txt, robot par robot…', 'Recherche du sitemap et du llms.txt…', 'Calcul des contrôles…'];

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-canvas px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

export function ReadinessResult({ r, example }: { r: ReadinessReport; example: boolean }) {
  const ok = r.checks.filter((c) => c.status === 'ok' && !c.informational).length;
  const scored = r.checks.filter((c) => !c.informational).length;
  return (
    <div className="mt-6 rt-fade">
      {example && <ExampleNote what="site d’une plomberie imaginaire, analysé par le même moteur que votre site." />}
      <ResultHeader title={`Résultat pour ${hostOf(r.finalUrl)}`} sub={`${ok} contrôles réussis sur ${scored}, page lue en ${r.elapsedMs} ms.`} actions={!example ? <ShareLink params={{ url: r.url }} /> : undefined} />
      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
        <div className="flex flex-col items-center gap-3">
          <Gauge score={r.score} caption="Conditions techniques, pas présence dans les IA" />
          {r.cap && (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-center text-sm text-danger-ink" role="note">
              <strong>Score plafonné.</strong> {r.cap} Un défaut bloquant n’est pas compensé par les autres points.
            </p>
          )}
        </div>
        <div className="min-w-0">
          <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Mots lus sans JavaScript" value={String(r.words)} />
            <Fact label="Poids du HTML" value={`${Math.max(1, Math.round(r.htmlBytes / 1024))} Ko`} />
            <Fact label="Sitemap" value={r.sitemap.found ? 'Trouvé' : 'Absent'} />
            <Fact label="Données structurées" value={r.jsonLdTypes.length ? r.jsonLdTypes.slice(0, 2).join(', ') : 'Aucune'} />
          </dl>
          <CheckList checks={r.checks} />
          <p className="mt-3 text-sm text-muted">{r.llmsTxt.note}</p>
        </div>
      </div>
      {r.limits.length > 0 && (
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-muted">
          {r.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReadinessTool({ example }: { example: ReadinessReport }) {
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
        <UrlForm label="Adresse de la page à tester" submitLabel="Tester ma page" busy={busy} value={url} onChange={setUrl} onUrl={go} onExample={() => showExample(example)} />
        {busy && <Loading steps={STEPS} />}
        {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => url && go(url)} />}
        {state.phase === 'done' && <ReadinessResult r={state.data} example={state.example} />}
      </Scope>
      {state.phase === 'done' && !state.example && <EmailCapture tool="Site prêt pour les IA" url={state.data.finalUrl} />}
      <AuditBridge done={state.phase === 'done'} url={state.phase === 'done' && !state.example ? state.data.finalUrl : null} text="ChatGPT, Perplexity et Gemini vous citent-ils quand un client cherche votre métier ? L’audit pose les questions de vos clients et vous montre les réponses." />
    </>
  );
}
