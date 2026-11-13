'use client';
import { useId, useState, type FormEvent } from 'react';
import type { CompareReport, CompareRow } from '@/lib/siteaudit/types';
import { buttonClasses } from '@/components/ui/Button';
import { callTool, hostOf, normalizeUrl } from './api';
import { AuditBridge, EmailCapture, ErrorBox, ExampleNote, Loading, ResultHeader, Scope, ShareLink, StatusPill, UrlField, useShareParams, useToolRun } from './ui';

function Cell({ c }: { c: CompareRow['mine'] }) {
  return (
    <div className="min-w-0">
      {c.status === 'n/a' ? <span className="text-sm text-muted">Non analysé</span> : <StatusPill status={c.status} />}
      <p className="mt-1 text-sm text-muted">{c.detail}</p>
    </div>
  );
}

function ScoreBar({ label, value, tone }: { label: string; value: number | null; tone: 'mine' | 'theirs' }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{value === null ? 'n.d.' : `${value}/100`}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line/60">
        {value !== null && <div className="rt-bar h-full rounded-full" style={{ width: `${value}%`, background: tone === 'mine' ? 'var(--color-primary)' : 'var(--color-muted)' }} />}
      </div>
    </div>
  );
}

function Side({ title, s, tone }: { title: string; s: CompareReport['mine']; tone: 'mine' | 'theirs' }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white p-4">
      <p className="text-sm text-muted">{title}</p>
      <p className="truncate font-semibold text-ink">{hostOf(s.url)}</p>
      {s.error ? (
        <p className="mt-2 text-sm text-danger-ink">{s.error}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <ScoreBar label="Prêt pour les IA" value={s.readiness} tone={tone} />
          <ScoreBar label="Citabilité" value={s.citability} tone={tone} />
        </div>
      )}
    </div>
  );
}

const EDGE = { mine: 'Avantage : vous', theirs: 'Avantage : concurrent', equal: 'Égalité' } as const;

function CompareResult({ r, example }: { r: CompareReport; example: boolean }) {
  return (
    <div className="mt-6 rt-fade">
      {example && <ExampleNote what="deux plomberies imaginaires à Lyon." />}
      <ResultHeader title={`${hostOf(r.mine.url)} face à ${hostOf(r.theirs.url)}`} actions={!example ? <ShareLink params={{ url: r.mine.url, concurrent: r.theirs.url }} /> : undefined} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Side title="Votre site" s={r.mine} tone="mine" />
        <Side title="Concurrent" s={r.theirs} tone="theirs" />
      </div>

      {r.gaps.length > 0 && (
        <section className="mt-6 rounded-xl bg-warning-bg p-4 text-warning-ink" aria-labelledby="rt-gaps">
          <h3 id="rt-gaps" className="font-semibold">
            {r.gaps.length === 1 ? 'L’écart à combler en premier' : `Les ${Math.min(r.gaps.length, 3)} écarts à combler en premier`}
          </h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {r.gaps.slice(0, 3).map((g) => (
              <li key={g.id}>
                <strong>{g.label}.</strong> {g.fix}
              </li>
            ))}
          </ol>
        </section>
      )}

      {r.mine.error && r.theirs.error ? (
        <p className="mt-6 rounded-xl bg-danger-bg p-4 text-danger-ink">
          Aucun des deux sites n&apos;a pu être lu : il n&apos;y a rien à comparer. Vérifiez les deux adresses dans votre navigateur, puis relancez.
        </p>
      ) : (
      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
        <div className="hidden grid-cols-[1fr_1.3fr_1.3fr] gap-4 border-b border-line bg-canvas px-4 py-2 text-xs font-semibold text-muted md:grid" aria-hidden>
          <span>Signal</span>
          <span>Votre site</span>
          <span>Concurrent</span>
        </div>
        <ul className="divide-y divide-line">
          {r.rows.map((row) => (
            <li key={row.id} className="grid gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[1fr_1.3fr_1.3fr]">
              <div>
                <p className="font-medium text-ink">{row.label}</p>
                {row.mine.status === 'n/a' || row.theirs.status === 'n/a' ? null : (
                  <p className={`text-xs font-semibold ${row.edge === 'theirs' ? 'text-danger-ink' : row.edge === 'mine' ? 'text-success-ink' : 'text-muted'}`}>{EDGE[row.edge]}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted md:hidden">Votre site</p>
                <Cell c={row.mine} />
              </div>
              <div>
                <p className="text-xs text-muted md:hidden">Concurrent</p>
                <Cell c={row.theirs} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      )}
      <p className="mt-3 text-sm text-muted">{r.disclaimer}</p>
    </div>
  );
}

export function CompareTool({ example }: { example: CompareReport }) {
  const id = useId();
  const [mine, setMine] = useState('');
  const [theirs, setTheirs] = useState('');
  const [msg, setMsg] = useState('');
  const { state, run, showExample } = useToolRun<CompareReport>();
  const busy = state.phase === 'loading';
  const go = (a: string, b: string) => {
    setMine(a);
    setTheirs(b);
    run((signal) => callTool('/api/tools/compare', { url: a, competitorUrl: b }, { signal }));
  };
  useShareParams((p) => p.url && p.concurrent && go(p.url, p.concurrent));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = normalizeUrl(mine);
    if (!a.ok) return setMsg(`Votre site : ${a.message}`);
    const b = normalizeUrl(theirs);
    if (!b.ok) return setMsg(`Concurrent : ${b.message}`);
    if (hostOf(a.url) === hostOf(b.url) && new URL(a.url).pathname === new URL(b.url).pathname) return setMsg('Indiquez deux pages différentes.');
    setMsg('');
    go(a.url, b.url);
  };
  return (
    <>
      <Scope busy={busy}>
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <div className="grid gap-3 sm:grid-cols-2">
            <UrlField id={`${id}-a`} label="Votre site" value={mine} onChange={setMine} invalid={msg.startsWith('Votre')} />
            <UrlField id={`${id}-b`} label="Le site d’un concurrent" value={theirs} onChange={setTheirs} invalid={msg.startsWith('Concurrent')} placeholder="concurrent.fr" />
          </div>
          {msg && (
            <p role="alert" className="mt-2 text-sm font-medium text-danger-ink">
              {msg}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClasses()} disabled={busy}>
              {busy ? 'Comparaison en cours…' : 'Comparer'}
            </button>
            <button type="button" onClick={() => showExample(example)} className="text-sm font-semibold text-primary underline underline-offset-2 hover:no-underline" disabled={busy}>
              Voir un exemple (données fictives)
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">5 comparaisons par heure. Une page publique par site, lue par notre robot déclaré.</p>
        </form>
        {busy && <Loading steps={['Lecture des deux pages en parallèle…', 'Contrôle des robots, du rendu et des données structurées…', 'Comparaison signal par signal…']} />}
        {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => mine && theirs && go(mine, theirs)} />}
        {state.phase === 'done' && <CompareResult r={state.data} example={state.example} />}
      </Scope>
      {state.phase === 'done' && !state.example && <EmailCapture tool="Comparateur" url={state.data.mine.url} />}
      <AuditBridge done={state.phase === 'done'} url={state.phase === 'done' && !state.example ? state.data.mine.url : null} text="Ce tableau compare deux sites. L’audit compare ce que ChatGPT, Perplexity et Gemini répondent sur vous et sur ce concurrent." />
    </>
  );
}
