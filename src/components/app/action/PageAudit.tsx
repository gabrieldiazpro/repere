'use client';

import { useState } from 'react';
import type { SiteAuditRun } from '@/lib/siteaudit/runs';
import type { CitabilityReport } from '@/lib/siteaudit/types';
import { CopyButton } from '../CopyButton';
import { Icon } from '../icons';
import { fmtDate } from '../tokens';
import { CheckList, ScoreBlock } from './Checks';

function pathOf(url: string | null) {
  if (!url) return 'Page';
  try {
    const u = new URL(url);
    return u.pathname === '/' ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

export function CitabilityResult({ report, businessId, demo, sample }: { report: CitabilityReport; businessId: string; demo: boolean; sample?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rp-panel p-4 lg:p-5" aria-label="Score de citabilité">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ScoreBlock
            score={report.score}
            label="Citabilité de la page"
            sub={
              <>
                {report.passed}/{report.total} règles respectées · {report.words} mots{sample ? ' · page d’exemple (démo)' : ''}
              </>
            }
          />
          <div className="min-w-0 max-w-md text-[13px]">
            <p className="font-semibold">{report.title || pathOf(report.url)}</p>
            {report.url && (
              <a href={report.url} target="_blank" rel="noopener noreferrer" className="rp-link break-all">
                {report.url}
              </a>
            )}
          </div>
        </div>
        <p className="mt-3 text-[12px] text-[var(--muted)]">{report.disclaimer}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <section className="rp-panel" aria-labelledby="regles-h">
          <div className="rp-panel-head">
            <h2 id="regles-h" className="rp-h2">
              Corrections
            </h2>
          </div>
          <div className="rp-panel-body pt-0">
            <CheckList checks={report.checks} businessId={businessId} demo={demo} taskPrefix={`Page ${pathOf(report.url)}`} />
          </div>
        </section>
        <div className="flex flex-col gap-4">
          <section className="rp-panel" aria-labelledby="extraits-h">
            <div className="rp-panel-head">
              <h2 id="extraits-h" className="rp-h2">
                Extraits citables
              </h2>
            </div>
            <div className="rp-panel-body pt-0">
              {report.extracts.length === 0 ? (
                <p className="text-[13px] text-[var(--muted)]">Aucun passage n’est assez court, factuel et autonome pour être repris tel quel par une IA. Les corrections ci-contre en créent.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {report.extracts.map((e, i) => (
                    <li key={i} className="rounded-lg border border-[var(--hair)] p-3">
                      <p className="text-[14px]">« {e.text} »</p>
                      <p className="mt-1 text-[12px] text-[var(--muted)]">{e.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          {(report.suggestions.length > 0 || report.aiRewrite || report.aiNote) && (
            <section className="rp-panel" aria-labelledby="reecr-h">
              <div className="rp-panel-head">
                <h2 id="reecr-h" className="rp-h2">
                  Suggestion de réécriture
                </h2>
              </div>
              <div className="rp-panel-body flex flex-col gap-3 pt-0">
                {report.aiRewrite && (
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold">Premier paragraphe réécrit (IA)</p>
                      <CopyButton text={report.aiRewrite.text} />
                    </div>
                    <div className="rp-deliv-text">{report.aiRewrite.text}</div>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">Relisez avant de publier : vérifiez chaque chiffre et chaque fait.</p>
                  </div>
                )}
                {report.aiNote && <p className="text-[12px] text-[var(--muted)]">{report.aiNote}</p>}
                {report.suggestions.map((s, i) => (
                  <div key={i} className="rounded-lg border border-[var(--hair)] p-3 text-[13px]">
                    <p className="font-semibold">{s.rule}</p>
                    <p className="mt-1 text-[var(--muted)]">
                      <span className="font-medium">Avant : </span>
                      {s.before}
                    </p>
                    <div className="mt-1 flex items-start gap-2">
                      <p className="min-w-0 flex-1">
                        <span className="font-medium">Après : </span>
                        {s.after}
                      </p>
                      <CopyButton text={s.after} />
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">{s.why}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageAudit({
  businessId,
  demo,
  website,
  initialUrl,
  runs,
  sampleHtml,
}: {
  businessId: string;
  demo: boolean;
  website: string;
  initialUrl?: string;
  runs: SiteAuditRun[];
  sampleHtml: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? website ?? '');
  const [question, setQuestion] = useState('');
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<{ r: CitabilityReport; sample?: boolean } | null>(() => {
    const first = initialUrl ? runs.find((x) => x.url === initialUrl && x.citability) : null;
    return first?.citability ? { r: first.citability } : null;
  });
  const [history, setHistory] = useState(runs);

  async function run(sample = false) {
    setBusy(true);
    setErr(null);
    try {
      const res = sample
        ? await fetch('/api/tools/citability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: sampleHtml, question: question || undefined }) })
        : await fetch('/api/siteaudit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ businessId, url: url.trim(), kind: 'citability', question: question.trim() || undefined, ai }),
          });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; data?: SiteAuditRun | CitabilityReport; error?: string } | null;
      if (!res.ok || !j?.ok || !j.data) throw new Error(j?.error ?? (res.status === 429 ? 'Trop d’analyses : réessayez dans une heure.' : 'L’analyse a échoué.'));
      if (sample) setReport({ r: j.data as CitabilityReport, sample: true });
      else {
        const r = j.data as SiteAuditRun;
        if (!r.citability) throw new Error(r.error ?? 'La page n’a pas pu être lue.');
        setReport({ r: r.citability });
        if (!r.demo) setHistory((h) => [r, ...h]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'L’analyse a échoué.');
    } finally {
      setBusy(false);
    }
  }

  // Pages suivies : dernière analyse par URL + historique des scores.
  const pages = new Map<string, SiteAuditRun[]>();
  for (const r of history) if (r.citability) pages.set(r.url, [...(pages.get(r.url) ?? []), r]);

  return (
    <div className="flex flex-col gap-4" data-visite="pages">
      <form
        className="rp-panel p-4 lg:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) void run(false);
        }}
      >
        <label htmlFor="pa-url" className="text-[14px] font-semibold">
          Adresse de la page à analyser
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="pa-url" type="url" inputMode="url" required className="rp-input min-w-0 flex-1" placeholder="https://www.exemple.fr/services" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="submit" className="rp-btn rp-btn-primary" disabled={busy || !url.trim()}>
            <Icon name="search" size={16} /> {busy ? 'Analyse en cours…' : 'Analyser la page'}
          </button>
        </div>
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer text-[var(--muted)]">Options</summary>
          <div className="mt-2 flex flex-col gap-2">
            <label htmlFor="pa-q" className="font-medium">
              Question à laquelle cette page doit répondre (facultatif)
            </label>
            <input id="pa-q" className="rp-input" maxLength={200} placeholder="Ex. combien coûte un débouchage à Paris ?" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <label className={`mt-1 flex items-center gap-2 ${demo ? 'opacity-60' : ''}`}>
              <input type="checkbox" className="rp-check" checked={ai && !demo} disabled={demo} onChange={(e) => setAi(e.target.checked)} />
              Proposer une réécriture du premier paragraphe par IA {demo ? '(indisponible en démo)' : '(si le service est configuré)'}
            </label>
          </div>
        </details>
        {demo && (
          <p className="mt-3 text-[13px] text-[var(--muted)]">
            Démo : l’analyse d’une vraie adresse fonctionne, mais n’est pas enregistrée.{' '}
            <button type="button" className="rp-link" onClick={() => void run(true)} disabled={busy}>
              Analyser une page d’exemple
            </button>
          </p>
        )}
        {busy && <p className="mt-3 text-[13px] text-[var(--muted)]" role="status">Lecture de la page et application des 20 règles, 5 à 15 secondes…</p>}
        {err && (
          <p role="alert" className="mt-3 text-[13px] text-[var(--danger-ink)]">
            {err} Vérifiez l’adresse (page publique, sans connexion) puis relancez.
          </p>
        )}
      </form>

      {busy && !report && <div className="rp-panel h-48 animate-pulse" aria-hidden="true" />}
      {report && <CitabilityResult report={report.r} businessId={businessId} demo={demo} sample={report.sample} />}
      {!report && !busy && (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-[14px] text-[var(--muted)]">
          Commencez par la page qui devrait répondre à la question la plus importante pour vous : une page service, tarifs ou FAQ. Repéré vérifie 20 règles (réponse en tête, questions-réponses, chiffres sourcés, auteur, date…) et propose les corrections.
        </div>
      )}

      <section className="rp-panel" aria-labelledby="suivies-h">
        <div className="rp-panel-head">
          <h2 id="suivies-h" className="rp-h2">
            Pages suivies
          </h2>
          <span className="rp-num">{pages.size}</span>
        </div>
        {pages.size === 0 ? (
          <p className="rp-panel-body pt-0 text-[13px] text-[var(--muted)]">
            {demo ? 'En démo, les analyses ne sont pas conservées.' : 'Chaque page analysée apparaît ici, avec l’évolution de son score.'}
          </p>
        ) : (
          <ul className="border-t border-[var(--hair)]">
            {[...pages.entries()].map(([u, rs]) => {
              const last = rs[0];
              const scores = [...rs].reverse().map((r) => Math.round(r.citability!.score));
              return (
                <li key={u} className="flex flex-wrap items-center gap-3 border-b border-[var(--hair)] px-4 py-3 last:border-b-0 lg:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{last.citability!.title || pathOf(u)}</p>
                    <p className="truncate text-[12px] text-[var(--muted)]">
                      {u} · {rs.length} analyse{rs.length > 1 ? 's' : ''}, dernière le {fmtDate(last.createdAt, { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="rp-num text-[13px] text-[var(--muted)]" title="Historique des scores">
                    {scores.join(' → ')}
                  </span>
                  <span className="rp-display rp-num text-[20px]">{scores.at(-1)}</span>
                  <button
                    type="button"
                    className="rp-btn rp-btn-sm"
                    onClick={() => {
                      setUrl(u);
                      setReport({ r: last.citability! });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Voir
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
