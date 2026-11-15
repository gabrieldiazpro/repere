'use client';
/**
 * Briques communes des outils V6 : verdict (vert / ambre / rouge avec icône), gabarit d'outil « une adresse »,
 * petits tableaux. S'appuie sur les primitives de ../ui.tsx (formulaire, chargement, erreur, contrôles, pont).
 */
import { useState, type ReactNode } from 'react';
import { callTool, hostOf, type EndpointPath, type Endpoints } from '../api';
import { AuditBridge, CheckList, EmailCapture, ErrorBox, ExampleNote, Loading, ResultHeader, Scope, ShareLink, UrlForm, useShareParams, useToolRun } from '../ui';
import type { CheckStatus, V6Check, Verdict } from './types';
import type { AccessInfo } from '../v7/types';

const TONE: Record<CheckStatus, { box: string; dot: string; label: string }> = {
  ok: { box: 'bg-success-bg text-success-ink', dot: 'bg-success text-white', label: 'Bon' },
  warn: { box: 'bg-warning-bg text-warning-ink', dot: 'bg-warning text-white', label: 'À améliorer' },
  fail: { box: 'bg-danger-bg text-danger-ink', dot: 'bg-danger text-white', label: 'À corriger' },
};

export function ToneIcon({ tone, size = 18 }: { tone: CheckStatus; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden className="shrink-0">
      {tone === 'ok' && <path className="rt-tick" d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {tone === 'warn' && <path d="M8 3.5v5.5M8 12v.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
      {tone === 'fail' && <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

/** Verdict en une phrase : couleur ET icône ET libellé (jamais la couleur seule). */
export function VerdictBanner({ verdict }: { verdict: Verdict }) {
  const t = TONE[verdict.tone];
  return (
    <div className={`rt-fade mb-5 flex items-start gap-3 rounded-xl p-4 ${t.box}`} role="note" data-tone={verdict.tone}>
      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${t.dot}`}>
        <ToneIcon tone={verdict.tone} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{t.label}</p>
        <p className="text-lg font-semibold leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
          {verdict.title}
        </p>
        {verdict.text && <p className="mt-1 break-words text-[0.95rem]">{verdict.text}</p>}
      </div>
    </div>
  );
}

/**
 * Page illisible (pare-feu, robots.txt, erreur, délai…) ou lue partiellement (JavaScript) : état et marche à suivre,
 * tirés du moteur de l'analyse complète (src/lib/analysis/access.ts).
 */
export function AccessNote({ access }: { access: AccessInfo }) {
  const tone: CheckStatus = access.blocked ? 'fail' : 'warn';
  return (
    <section className={`mb-5 rounded-xl border p-4 ${access.blocked ? 'border-danger/30 bg-white' : 'border-warning/40 bg-white'}`} aria-label="Accès à la page" data-access={access.state}>
      <p className="flex items-start gap-2 font-semibold text-ink">
        <span className={TONE[tone].box + ' mt-0.5 grid size-6 shrink-0 place-items-center rounded-full'}>
          <ToneIcon tone={tone} size={14} />
        </span>
        <span className="min-w-0">{access.blocked ? 'Ce que nous avons constaté' : access.title}</span>
      </p>
      <p className="mt-2 break-words text-[0.95rem] text-ink/80">{access.message}</p>
      {access.howTo.length > 0 && (
        <>
          <p className="mt-3 text-sm font-semibold text-ink">Marche à suivre{access.platform ? ` (${access.platform})` : ''}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-[0.95rem] text-ink/80">
            {access.howTo.map((h, i) => (
              <li key={i} className="break-words">
                {h}
              </li>
            ))}
          </ol>
        </>
      )}
      {access.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {access.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Petite statistique (chiffre grand, libellé petit). */
export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: CheckStatus }) {
  const c = tone === 'fail' ? 'text-danger-ink' : tone === 'warn' ? 'text-warning-ink' : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2.5">
      <p className={`text-2xl font-bold tabular-nums ${c}`} style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

/** Pastille de code HTTP colorée (2xx vert, 3xx ambre, 4xx/5xx/0 rouge) avec libellé. */
export function HttpCode({ status }: { status: number }) {
  const tone: CheckStatus = status >= 200 && status < 300 ? 'ok' : status >= 300 && status < 400 ? 'warn' : 'fail';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${TONE[tone].box}`}>
      <ToneIcon tone={tone} size={12} />
      {status || 'échec'}
    </span>
  );
}

type Report = { url: string; verdict: Verdict; checks: V6Check[]; finalUrl?: string; access?: AccessInfo };

/**
 * Gabarit d'un outil V6 qui analyse une adresse : formulaire, exemple fictif, chargement, erreur utile, verdict,
 * visuel propre à l'outil (`render`), contrôles, e-mail facultatif, pont vers l'analyse complète.
 */
export function UrlTool<P extends EndpointPath>({
  endpoint,
  example,
  exampleWhat,
  label,
  submitLabel,
  steps,
  toolName,
  bridgeText,
  render,
  titleOf,
  placeholder,
}: {
  endpoint: P;
  example: Endpoints[P]['data'] & Report;
  exampleWhat: string;
  label: string;
  submitLabel: string;
  steps: string[];
  toolName: string;
  bridgeText: string;
  render?: (r: Endpoints[P]['data'], example: boolean) => ReactNode;
  titleOf?: (r: Endpoints[P]['data']) => string;
  placeholder?: string;
}) {
  type D = Endpoints[P]['data'] & Report;
  const [url, setUrl] = useState('');
  const { state, run, showExample } = useToolRun<D>();
  const go = (u: string) => {
    setUrl(u);
    run((signal) => callTool(endpoint, { url: u } as Endpoints[P]['body'], { signal }) as Promise<{ ok: true; data: D } | { ok: false; error: import('../api').ToolError }>);
  };
  useShareParams((p) => p.url && go(p.url));
  const busy = state.phase === 'loading';
  const done = state.phase === 'done' ? state : null;
  return (
    <>
      <Scope busy={busy}>
        <UrlForm label={label} submitLabel={submitLabel} busy={busy} value={url} onChange={setUrl} onUrl={go} onExample={() => showExample(example as D)} placeholder={placeholder} />
        {busy && <Loading steps={steps} />}
        {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => url && go(url)} />}
        {done && (
          <div className="mt-6 rt-fade">
            {done.example && <ExampleNote what={exampleWhat} />}
            <ResultHeader
              title={titleOf ? titleOf(done.data) : `Résultat pour ${hostOf(done.data.finalUrl ?? done.data.url)}`}
              sub={<span className="break-all">{done.data.finalUrl ?? done.data.url}</span>}
              actions={!done.example ? <ShareLink params={{ url: done.data.url }} /> : undefined}
            />
            <VerdictBanner verdict={done.data.verdict} />
            {done.data.access && <AccessNote access={done.data.access} />}
            {!done.data.access?.blocked && (
              <>
                {render?.(done.data, done.example)}
                <h3 className="mb-3 mt-6 font-semibold text-ink">Le détail des contrôles</h3>
                <CheckList checks={done.data.checks} />
              </>
            )}
          </div>
        )}
      </Scope>
      {done && !done.example && <EmailCapture tool={toolName} url={done.data.finalUrl ?? done.data.url} />}
      <AuditBridge to="analyse" done={!!done} url={done && !done.example ? (done.data.finalUrl ?? done.data.url) : null} text={bridgeText} />
    </>
  );
}

/** Tableau responsive (cartes empilées sous 640 px). */
export function MiniTable({ head, rows, label }: { head: string[]; rows: ReactNode[][]; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <table className="w-full text-left text-sm" aria-label={label}>
        <thead className="hidden bg-canvas text-xs font-semibold text-muted sm:table-header-group">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="grid gap-1 px-3 py-2.5 sm:table-row sm:p-0">
              {r.map((c, j) => (
                <td key={j} className="min-w-0 break-words sm:px-3 sm:py-2.5 sm:align-top">
                  <span className="mr-1 text-xs font-semibold text-muted sm:hidden">{head[j]} :</span>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
