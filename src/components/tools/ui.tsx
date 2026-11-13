'use client';
/**
 * Briques communes des outils gratuits : console de visée, formulaire d'URL, états (chargement, erreur, exemple),
 * jauge, contrôles dépliables, copie, partage, capture d'e-mail facultative, pont vers l'audit.
 */
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/Button';
import {
  STATUS_LABEL,
  hostOf,
  localError,
  normalizeUrl,
  readShareParams,
  replaceShareParams,
  scoreBand,
  sortChecks,
  type CheckStatus,
  type Outcome,
  type ToolError,
} from './api';

/* ------------------------------------------------------------------ */
/* État d'un outil                                                     */
/* ------------------------------------------------------------------ */

export type RunState<T> =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; error: ToolError }
  | { phase: 'done'; data: T; example: boolean };

/** Exécute une analyse, annule la précédente, garde l'état. */
export function useToolRun<T>() {
  const [state, setState] = useState<RunState<T>>({ phase: 'idle' });
  const ctrl = useRef<AbortController | null>(null);
  const run = useCallback(async (task: (signal: AbortSignal) => Promise<Outcome<T>>) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState({ phase: 'loading' });
    try {
      const out = await task(c.signal);
      if (c.signal.aborted) return;
      setState(out.ok ? { phase: 'done', data: out.data, example: false } : { phase: 'error', error: out.error });
    } catch {
      if (!c.signal.aborted) setState({ phase: 'error', error: localError('L’analyse n’a pas abouti.', 'unknown') });
    }
  }, []);
  const showExample = useCallback((data: T) => {
    ctrl.current?.abort();
    setState({ phase: 'done', data, example: true });
  }, []);
  const fail = useCallback((error: ToolError) => setState({ phase: 'error', error }), []);
  const reset = useCallback(() => {
    ctrl.current?.abort();
    setState({ phase: 'idle' });
  }, []);
  useEffect(() => () => ctrl.current?.abort(), []);
  return { state, run, showExample, fail, reset };
}

/** Lit une fois les paramètres de partage (?url=…) au chargement. */
export function useShareParams(onParams: (p: Record<string, string>) => void) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const p = readShareParams(window.location.search);
    if (Object.keys(p).length) onParams(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ------------------------------------------------------------------ */
/* Console de visée (signature du logo)                                */
/* ------------------------------------------------------------------ */

export function Scope({ busy = false, children, className = '' }: { busy?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`rt-scope p-4 sm:p-6 ${className}`} data-busy={busy ? 'true' : 'false'}>
      <span className="rt-corner" data-c="tl" aria-hidden />
      <span className="rt-corner" data-c="tr" aria-hidden />
      <span className="rt-corner" data-c="bl" aria-hidden />
      <span className="rt-corner" data-c="br" aria-hidden />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulaire d'URL                                                    */
/* ------------------------------------------------------------------ */

export function UrlField({
  id,
  label,
  value,
  onChange,
  invalid,
  placeholder = 'votre-commerce.fr',
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
  describedBy?: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
        className="rt-field"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
      />
    </div>
  );
}

/** Formulaire d'une seule adresse : valide côté navigateur puis appelle `onUrl`. */
export function UrlForm({
  label,
  submitLabel,
  busy,
  value,
  onChange,
  onUrl,
  onExample,
  exampleLabel = 'Voir un exemple',
  placeholder,
  children,
}: {
  label: string;
  submitLabel: string;
  busy: boolean;
  value: string;
  onChange: (v: string) => void;
  onUrl: (url: string) => void;
  onExample?: () => void;
  exampleLabel?: string;
  placeholder?: string;
  children?: ReactNode;
}) {
  const id = useId();
  const [msg, setMsg] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = normalizeUrl(value);
    if (!n.ok) return setMsg(n.message);
    setMsg('');
    onUrl(n.url);
  };
  return (
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlField
          id={`${id}-url`}
          label={label}
          value={value}
          onChange={(v) => {
            onChange(v);
            if (msg) setMsg('');
          }}
          invalid={!!msg}
          placeholder={placeholder}
          describedBy={msg ? `${id}-err` : undefined}
        />
        <button type="submit" className={buttonClasses({ size: 'md', className: 'sm:min-w-44' })} disabled={busy}>
          {busy ? 'Analyse en cours…' : submitLabel}
        </button>
      </div>
      {children}
      {msg && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm font-medium text-danger-ink">
          {msg}
        </p>
      )}
      {onExample && (
        <p className="mt-3 text-sm text-muted">
          Pas de site sous la main ?{' '}
          <button type="button" onClick={onExample} className="font-semibold text-primary underline underline-offset-2 hover:no-underline" disabled={busy}>
            {exampleLabel}
          </button>{' '}
          (données fictives, sans analyse).
        </p>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* États                                                               */
/* ------------------------------------------------------------------ */

/** Chargement vivant : les étapes s'allument une à une (coche qui se trace), sous un balayage. */
export function Loading({ steps }: { steps: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (steps.length < 2) return;
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 1600);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="mt-6" role="status" aria-live="polite">
      <div className="rt-sweep" aria-hidden />
      {steps.length > 1 ? (
        <ol className="rt-steps mt-4">
          {steps.map((st, k) => {
            const state = k < i ? 'done' : k === i ? 'active' : 'pending';
            return (
              <li key={st} data-state={state}>
                <span className="rt-step-dot" aria-hidden>
                  {state === 'done' ? (
                    <svg viewBox="0 0 16 16" width="12" height="12"><path className="rt-tick" d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : null}
                </span>
                <span>{st}</span>
                <span className="sr-only">{state === 'done' ? ' : fait' : state === 'active' ? ' : en cours' : ''}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">{steps[0]}</p>
      )}
    </div>
  );
}

const ERROR_TITLE: Record<ToolError['kind'], string> = {
  invalid: 'Adresse refusée',
  unreachable: 'Site injoignable',
  limit: 'Limite atteinte',
  blocked: 'Accès refusé par le site',
  network: 'Connexion interrompue',
  unknown: 'Analyse interrompue',
};

export function ErrorBox({ error, onRetry }: { error: ToolError; onRetry?: () => void }) {
  return (
    <div role="alert" className="rt-fade mt-6 rounded-xl border border-danger/30 bg-danger-bg p-4 text-danger-ink">
      <p className="font-semibold">{ERROR_TITLE[error.kind]}</p>
      <p className="mt-1">{error.message}</p>
      <p className="mt-1 text-sm">{error.hint}</p>
      {onRetry && error.kind !== 'limit' && error.kind !== 'invalid' && (
        <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold underline underline-offset-2">
          Relancer l’analyse
        </button>
      )}
    </div>
  );
}

export function ExampleNote({ what }: { what: string }) {
  return (
    <p className="mb-4 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-ink">
      <strong>Exemple fictif :</strong> {what} Lancez l’analyse avec votre adresse pour obtenir votre propre résultat.
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Statuts, jauge, contrôles                                           */
/* ------------------------------------------------------------------ */

const PILL: Record<CheckStatus, string> = {
  ok: 'bg-success-bg text-success-ink',
  warn: 'bg-warning-bg text-warning-ink',
  fail: 'bg-danger-bg text-danger-ink',
};

function StatusIcon({ status }: { status: CheckStatus }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="shrink-0">
      {status === 'ok' && <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {status === 'warn' && <path d="M8 3.5v5.5M8 12v.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      {status === 'fail' && <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

export function StatusPill({ status, label }: { status: CheckStatus; label?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[status]}`}>
      <StatusIcon status={status} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

const TONE_COLOR = { ok: 'var(--color-success)', warn: 'var(--color-warning)', fail: 'var(--color-danger)' } as const;

/** Jauge demi-cercle animée (arc tracé en CSS ; immobile si mouvement réduit). */
export function Gauge({ score, caption, size = 200 }: { score: number; caption?: string; size?: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const band = scoreBand(s);
  const shown = useCountUp(s, 1100);
  return (
    <figure className="m-0 flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 200 112" width={size} height={(size * 112) / 200} role="img" aria-label={`Score : ${s} sur 100, ${band.label.toLowerCase()}`}>
        <path d="M16 100 A84 84 0 0 1 184 100" fill="none" stroke="var(--color-line)" strokeWidth="14" strokeLinecap="round" />
        <path
          key={s}
          className="rt-gauge-arc"
          d="M16 100 A84 84 0 0 1 184 100"
          fill="none"
          stroke={TONE_COLOR[band.tone]}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - s}
        />
        <text x="100" y="88" textAnchor="middle" fontSize="44" fontWeight="700" fill="var(--color-ink)" style={{ fontFamily: 'var(--font-display)' }}>
          {shown}
        </text>
        <text x="100" y="106" textAnchor="middle" fontSize="12" fill="var(--color-muted)">
          sur 100
        </text>
      </svg>
      <figcaption className="mt-1 text-center">
        <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${PILL[band.tone]}`}>{band.label}</span>
        {caption && <span className="mt-1 block text-xs text-muted">{caption}</span>}
      </figcaption>
    </figure>
  );
}

/** Compteur qui monte jusqu'à la valeur (autorisé en mouvement réduit : aucun déplacement). */
function useCountUp(target: number, duration = 900): number {
  const [v, setV] = useState(target);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

export interface CheckLike {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix: string;
  points?: number;
  maxPoints?: number;
  informational?: boolean;
}

/** Contrôles dépliables : à corriger d'abord, chacun avec constat et correctif. */
export function CheckList({ checks, openFirst = true }: { checks: CheckLike[]; openFirst?: boolean }) {
  const sorted = sortChecks(checks);
  // Clarté : ce qui est à corriger d'abord ; les contrôles réussis sont regroupés dans un dépliable.
  const todo = sorted.filter((c) => c.status !== 'ok' || c.informational);
  const passed = sorted.filter((c) => c.status === 'ok' && !c.informational);
  const grouped = todo.length > 0 && passed.length > 2;
  const head = grouped ? todo : sorted;
  return (
    <div className="space-y-3">
      <ul className="rt-cascade divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        {head.map((c, i) => (
          <CheckRow key={c.id} c={c} i={i} open={openFirst && i === 0 && c.status !== 'ok'} />
        ))}
      </ul>
      {grouped && (
        <details className="rt-details overflow-hidden rounded-xl border border-line bg-white">
          <summary className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-3 font-medium text-success-ink hover:bg-canvas focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary">
            <StatusPill status="ok" label={`${passed.length} réussis`} />
            <span className="min-w-0 flex-1 text-ink">Voir les contrôles réussis</span>
            <svg className="rt-chevron shrink-0 text-muted" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <ul className="rt-details-body divide-y divide-line border-t border-line">
            {passed.map((c, i) => (
              <CheckRow key={c.id} c={c} i={i} open={false} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CheckRow({ c, i, open }: { c: CheckLike; i: number; open: boolean }) {
  return (
    <li style={{ ['--i' as string]: Math.min(i, 12) }}>
      <details className="rt-details group" open={open}>
        <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-canvas focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary">
          <StatusPill status={c.status} label={c.informational ? 'Information' : undefined} />
          <span className="min-w-0 flex-1 font-medium text-ink">{c.label}</span>
          {typeof c.maxPoints === 'number' && !c.informational && (
            <span className="hidden text-xs tabular-nums text-muted sm:inline">
              {c.points ?? 0}/{c.maxPoints} pts
            </span>
          )}
          <svg className="rt-chevron shrink-0 text-muted" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="rt-details-body space-y-2 px-4 pb-4 pl-4 text-[0.95rem] leading-relaxed sm:pl-[7.25rem]">
          {c.detail && <p className="text-ink">{c.detail}</p>}
          {c.fix && (
            <p className="rounded-lg bg-primary-bg px-3 py-2 text-primary-deep">
              <strong>Correctif : </strong>
              {c.fix}
            </p>
          )}
        </div>
      </details>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Copie, code, partage                                                */
/* ------------------------------------------------------------------ */

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label = 'Copier', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState<'' | 'ok' | 'ko'>('');
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(''), 2200);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      onClick={async () => setDone((await copyText(text)) ? 'ok' : 'ko')}
      className={buttonClasses({ variant: 'secondary', size: 'sm', className })}
    >
      <span aria-live="polite">{done === 'ok' ? 'Copié' : done === 'ko' ? 'Copie impossible : sélectionnez le texte' : label}</span>
    </button>
  );
}

export function CodeBlock({ code, label, actions }: { code: string; label: string; actions?: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={code} label="Copier le code" />
          {actions}
        </div>
      </div>
      <pre className="rt-code" tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Lien partageable du résultat (?url=…). L'adresse de la page est mise à jour à chaque analyse. */
export function ShareLink({ params }: { params: Record<string, string | undefined> }) {
  const [href, setHref] = useState('');
  const key = JSON.stringify(params);
  useEffect(() => {
    replaceShareParams(params);
    setHref(window.location.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!href) return null;
  return <CopyButton text={href} label="Copier le lien du résultat" />;
}

/* ------------------------------------------------------------------ */
/* Pont vers l'audit et capture d'e-mail facultative                   */
/* ------------------------------------------------------------------ */

/**
 * Pont vers l'audit. Avant le résultat : une ligne discrète (le bouton principal reste celui de l'outil).
 * Après le résultat : « Étape suivante », le parcours en 3 temps et LE bouton, adresse du site pré-remplie.
 */
export function AuditBridge({ text, done = false, url }: { text: string; done?: boolean; url?: string | null }) {
  const href = url ? `/audit?site=${encodeURIComponent(url)}` : '/audit';
  if (!done) {
    return (
      <p className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted">
        <span>Ce test regarde votre site. L’audit gratuit regarde ce que les IA disent de vous.</span>
        <Link href={href} className="font-semibold text-primary underline underline-offset-2">
          Lancer l’audit gratuit
        </Link>
      </p>
    );
  }
  return (
    <aside className="rt-fade rt-next mt-8 rounded-2xl bg-primary-deep p-5 text-white sm:p-6" aria-label="Étape suivante">
      <p className="text-sm font-semibold text-on-deep">Étape suivante</p>
      <p className="mt-1 text-xl font-semibold leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
        Ce test regarde votre site. L’audit regarde ce que les IA disent de vous.
      </p>
      <p className="mt-2 max-w-2xl text-on-deep">{text}</p>
      <ol className="rt-path mt-4" aria-label="Votre parcours">
        <li data-state="done">Ce test</li>
        <li data-state="next">Audit gratuit, quelques minutes</li>
        <li>Espace gratuit, suivi mensuel</li>
      </ol>
      <Link href={href} className={buttonClasses({ variant: 'light', className: 'mt-5' })}>
        Lancer l’audit gratuit
      </Link>
    </aside>
  );
}

const leadField =
  'mt-1 block w-full min-h-11 rounded-lg border border-line bg-white px-3 text-base text-ink focus:border-primary focus:outline-none focus-visible:outline-3 focus-visible:outline-primary';

/**
 * Recevoir le résultat par e-mail (facultatif). POST /api/leads, source « tool » : seul l'e-mail est obligatoire
 * (commerce, métier et ville facultatifs).
 */
export function EmailCapture({ tool, url }: { tool: string; url?: string | null }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const host = hostOf(url ?? '');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email') ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState('error');
      setMsg('Cette adresse e-mail semble incomplète. Exemple : vous@exemple.fr.');
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          businessName: String(f.get('businessName') ?? ''),
          trade: String(f.get('trade') ?? ''),
          city: String(f.get('city') ?? ''),
          consent: f.get('consent') === 'on',
          source: 'tool',
          hp: String(f.get('website') ?? ''),
        }),
      });
      if (res.ok) {
        setState('sent');
        return;
      }
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setState('error');
      setMsg(j?.error ?? 'Envoi impossible. Réessayez dans un instant.');
    } catch {
      setState('error');
      setMsg('La connexion a été interrompue. Réessayez.');
    }
  };
  if (state === 'sent') {
    return (
      <p role="status" className="rt-fade mt-6 rounded-xl bg-success-bg p-4 text-success-ink">
        C’est noté. Nous vous écrivons pour lancer l’audit de ce que les IA disent de votre entreprise. Aucune autre utilisation de votre adresse.
      </p>
    );
  }
  return (
    <div className="mt-6 rounded-xl border border-line bg-canvas p-4">
      {!open ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">Garder ce résultat et recevoir l’audit de vos citations par e-mail ? C’est facultatif.</p>
          <button type="button" onClick={() => setOpen(true)} className={buttonClasses({ variant: 'secondary', size: 'sm' })} aria-expanded={false}>
            Recevoir par e-mail
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="rt-fade" aria-label={`Recevoir le résultat de l’outil ${tool} par e-mail`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={`${id}-email`} className="text-sm font-semibold text-ink">
                Votre e-mail
              </label>
              <input id={`${id}-email`} name="email" type="email" autoComplete="email" required className={leadField} placeholder="vous@exemple.fr" />
            </div>
            <div>
              <label htmlFor={`${id}-name`} className="text-sm font-semibold text-ink">
                Nom de l’entreprise <span className="font-normal text-muted">(facultatif)</span>
              </label>
              <input id={`${id}-name`} name="businessName" className={leadField} defaultValue={host} autoComplete="organization" />
            </div>
            <div>
              <label htmlFor={`${id}-trade`} className="text-sm font-semibold text-ink">
                Métier <span className="font-normal text-muted">(facultatif)</span>
              </label>
              <input id={`${id}-trade`} name="trade" className={leadField} placeholder="ex. plombier, boutique de thé" />
            </div>
            <div>
              <label htmlFor={`${id}-city`} className="text-sm font-semibold text-ink">
                Ville <span className="font-normal text-muted">(facultatif)</span>
              </label>
              <input id={`${id}-city`} name="city" className={leadField} autoComplete="address-level2" />
            </div>
            <div className="hidden" aria-hidden>
              <label htmlFor={`${id}-hp`}>Ne pas remplir</label>
              <input id={`${id}-hp`} name="website" tabIndex={-1} autoComplete="off" />
            </div>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="consent" className="mt-1 size-4 accent-[var(--color-primary)]" />
            <span>
              J’accepte de recevoir des conseils de Repéré par e-mail (désinscription en un clic). Voir la{' '}
              <Link href="/confidentialite" className="underline underline-offset-2">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>
          {state === 'error' && (
            <p role="alert" className="mt-2 text-sm font-medium text-danger-ink">
              {msg}
            </p>
          )}
          <button type="submit" className={buttonClasses({ size: 'sm', className: 'mt-3' })} disabled={state === 'sending'}>
            {state === 'sending' ? 'Envoi…' : 'Recevoir par e-mail'}
          </button>
        </form>
      )}
    </div>
  );
}

/** Bloc résultat : titre, actions (partage), contenu ; focus déplacé à l'arrivée pour les lecteurs d'écran. */
export function ResultHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 ref={ref} tabIndex={-1} className="text-xl font-semibold text-ink outline-none" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h2>
        {sub && <p className="mt-1 break-words text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
