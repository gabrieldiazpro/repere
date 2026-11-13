'use client';
import { useId, useState, type FormEvent } from 'react';
import type { CitabilityReport } from '@/lib/siteaudit/types';
import { buttonClasses } from '@/components/ui/Button';
import { callTool, highlight, hostOf, htmlToText, normalizeUrl, textToHtml } from './api';
import { AuditBridge, CheckList, EmailCapture, ErrorBox, ExampleNote, Gauge, Loading, ResultHeader, Scope, ShareLink, UrlField, useShareParams, useToolRun } from './ui';

type Mode = 'url' | 'text';
interface Result {
  report: CitabilityReport;
  /** Texte analysé (mode texte) pour le surlignage en contexte. */
  text: string | null;
}

function CitabilityResult({ res, example, question }: { res: Result; example: boolean; question: string }) {
  const r = res.report;
  const segments = res.text ? highlight(res.text, r.extracts.map((e) => e.text)) : null;
  return (
    <div className="mt-6 rt-fade">
      {example && <ExampleNote what="texte d’un éditeur de logiciel de paie imaginaire." />}
      <ResultHeader
        title={r.url ? `Citabilité de ${hostOf(r.url)}` : 'Citabilité du texte collé'}
        sub={`${r.title ? `« ${r.title} », ` : ''}${r.words} mots analysés.`}
        actions={!example && r.url ? <ShareLink params={{ url: r.url, ...(question ? { q: question } : {}) }} /> : undefined}
      />
      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
        <div className="flex flex-col items-center gap-2">
          <Gauge score={r.score} />
          <p className="text-center text-lg font-semibold text-ink">
            {r.passed} règles réussies sur {r.total}
          </p>
        </div>
        <div className="min-w-0">
          <p className="mb-4 rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary-deep" role="note">
            {r.disclaimer}
          </p>
          <CheckList checks={r.checks} />
        </div>
      </div>

      <section className="mt-8" aria-labelledby="rt-extracts">
        <h3 id="rt-extracts" className="font-semibold text-ink">
          Passages faciles à citer {r.extracts.length > 0 && <span className="font-normal text-muted">({r.extracts.length})</span>}
        </h3>
        {r.extracts.length === 0 ? (
          <p className="mt-2 text-muted">Aucune phrase autonome et précise repérée. Commencez par écrire, en haut de la page, la réponse à la question principale en une phrase, avec un chiffre ou un lieu.</p>
        ) : segments ? (
          <div className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-line rounded-xl border border-line bg-white p-4 leading-relaxed text-ink" tabIndex={0}>
            {segments.map((s, i) =>
              s.mark ? (
                <mark key={i} className="rt-mark">
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </div>
        ) : null}
        {r.extracts.length > 0 && (
          <ul className={`mt-3 space-y-3 ${segments ? 'sr-only' : ''}`}>
            {r.extracts.map((e, i) => (
              <li key={i} className="rounded-xl border border-line bg-white p-3">
                <blockquote className="leading-relaxed text-ink">
                  <mark className="rt-mark">{e.text}</mark>
                </blockquote>
                <p className="mt-1 text-sm text-muted">{e.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.suggestions.length > 0 && (
        <section className="mt-8" aria-labelledby="rt-sugg">
          <h3 id="rt-sugg" className="font-semibold text-ink">
            Réécritures proposées
          </h3>
          <ul className="mt-3 space-y-3">
            {r.suggestions.map((s, i) => (
              <li key={i} className="rounded-xl border border-line bg-white p-4 text-[0.95rem]">
                <p className="text-sm text-muted">{s.why}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="rounded-lg bg-danger-bg/60 p-2 text-ink">
                    <span className="block text-xs font-semibold text-danger-ink">Avant</span>
                    {s.before}
                  </p>
                  <p className="rounded-lg bg-success-bg p-2 text-ink">
                    <span className="block text-xs font-semibold text-success-ink">Après (à adapter)</span>
                    {s.after}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function CitabilityTool({ example, sampleHtml }: { example: CitabilityReport; sampleHtml: string }) {
  const id = useId();
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [question, setQuestion] = useState('');
  const [msg, setMsg] = useState('');
  const { state, run, showExample } = useToolRun<Result>();
  const busy = state.phase === 'loading';

  const analyzeUrl = (u: string, q: string) =>
    run(async (signal) => {
      const out = await callTool('/api/tools/citability', { url: u, ...(q ? { question: q } : {}) }, { signal });
      return out.ok ? { ok: true, data: { report: out.data, text: null } } : out;
    });
  const analyzeText = (t: string, q: string) => {
    const html = textToHtml(t);
    return run(async (signal) => {
      const out = await callTool('/api/tools/citability', { html, ...(q ? { question: q } : {}) }, { signal });
      return out.ok ? { ok: true, data: { report: out.data, text: htmlToText(html) } } : out;
    });
  };

  useShareParams((p) => {
    if (!p.url) return;
    const q = new URLSearchParams(window.location.search).get('q') ?? '';
    setUrl(p.url);
    setQuestion(q.slice(0, 200));
    analyzeUrl(p.url, q.slice(0, 200));
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (mode === 'url') {
      const n = normalizeUrl(url);
      if (!n.ok) return setMsg(n.message);
      setMsg('');
      analyzeUrl(n.url, q);
    } else {
      const t = text.trim();
      if (t.split(/\s+/).length < 30) return setMsg('Collez au moins une trentaine de mots : un paragraphe ou une page entière.');
      if (t.length > 400_000) return setMsg('Ce texte est trop long. Collez une seule page.');
      setMsg('');
      analyzeText(t, q);
    }
  };

  const loadExample = () => {
    setMode('text');
    setText(htmlToText(sampleHtml));
    setMsg('');
    showExample({ report: example, text: htmlToText(sampleHtml) });
  };

  return (
    <>
      <Scope busy={busy}>
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <div role="group" aria-label="Que voulez-vous analyser ?" className="mb-4 inline-flex rounded-xl bg-canvas p-1 ring-1 ring-line">
            {(
              [
                ['url', 'Une adresse'],
                ['text', 'Coller un texte'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={mode === k}
                onClick={() => {
                  setMode(k);
                  setMsg('');
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === k ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'url' ? (
            <UrlField id={`${id}-url`} label="Adresse de la page" value={url} onChange={setUrl} invalid={!!msg} describedBy={msg ? `${id}-err` : undefined} />
          ) : (
            <div>
              <label htmlFor={`${id}-text`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
                Texte de la page (texte brut ou HTML)
              </label>
              <textarea
                id={`${id}-text`}
                className="rt-field"
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Collez ici le contenu de votre page. Une ligne courte seule devient un titre ; une ligne commençant par « - » devient une liste."
                aria-invalid={msg ? 'true' : undefined}
                aria-describedby={msg ? `${id}-err` : undefined}
              />
            </div>
          )}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${id}-q`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
                Question visée <span className="font-normal text-muted">(facultatif)</span>
              </label>
              <input id={`${id}-q`} className="rt-field" maxLength={200} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="ex. plombier chauffagiste Lyon 3" />
            </div>
            <button type="submit" className={buttonClasses({ className: 'sm:min-w-44' })} disabled={busy}>
              {busy ? 'Analyse en cours…' : 'Analyser'}
            </button>
          </div>
          {msg && (
            <p id={`${id}-err`} role="alert" className="mt-2 text-sm font-medium text-danger-ink">
              {msg}
            </p>
          )}
          <p className="mt-3 text-sm text-muted">
            Pas de page sous la main ?{' '}
            <button type="button" onClick={loadExample} className="font-semibold text-primary underline underline-offset-2 hover:no-underline" disabled={busy}>
              Voir un exemple
            </button>{' '}
            (texte fictif, déjà analysé). Le texte collé n’est ni publié ni conservé.
          </p>
        </form>
        {busy && <Loading steps={['Lecture du texte…', 'Application des 20 règles…', 'Repérage des passages citables…']} />}
        {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => submit({ preventDefault() {} } as FormEvent)} />}
        {state.phase === 'done' && <CitabilityResult res={state.data} example={state.example} question={question.trim()} />}
      </Scope>
      {state.phase === 'done' && !state.example && <EmailCapture tool="Citabilité" url={state.data.report.url} />}
      <AuditBridge done={state.phase === 'done'} url={state.phase === 'done' && !state.example ? state.data.report.url : null} text="Une page bien construite peut être citée. Seule une mesure dit si elle l’est vraiment : l’audit pose les questions de vos clients aux IA." />
    </>
  );
}

