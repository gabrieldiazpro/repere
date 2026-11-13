'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CopilotAction, Deliverable, SourceRef } from '@/lib/copilot/types';
import type { CopilotMessage } from '@/lib/engine/types-v2';
import { createTask } from './action/createTask';
import { CopyButton } from './CopyButton';
import { Icon } from './icons';
import { sessionHeaders } from './localDemo';
import { Markdown } from './Markdown';

/** Réponse qui s'écrit (mot à mot, ~1,2 s au plus), aussi en mouvement réduit (ce n'est pas un déplacement). */
function TypedAnswer({ text, onDone }: { text: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  const done = n >= text.length;
  useEffect(() => {
    const step = Math.max(3, Math.ceil(text.length / 70));
    let i = 0;
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + step);
      // coupe au mot suivant pour ne pas afficher de demi-mot
      const sp = text.indexOf(' ', i);
      setN(sp === -1 || sp - i > 12 ? i : sp);
      if (i >= text.length) window.clearInterval(id);
    }, 17);
    return () => window.clearInterval(id);
  }, [text]);
  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);
  return (
    <>
      <span className="sr-only">{done ? '' : text}</span>
      <div aria-hidden={!done} className={done ? '' : 'v4-caret-host'}>
        <Markdown text={done ? text : text.slice(0, n)} />
      </div>
    </>
  );
}

export interface CopilotContext {
  name: string;
  dataDate: string;
  benchmark: string;
  score: number;
  scoreDelta: number | null;
  share: number;
  topCompetitor: string | null;
  gaps: { competitor: string; reasons: string[]; presentOn: string[] }[];
  opportunities: { label: string; action: string; effort: string; impact: number; why: string }[];
  questions: string[];
  priceQuotes: { provider: string; text: string }[];
  priceFact: string | null;
  facts: { label: string; value: string }[];
  jsonLd: string | null;
  errors: number;
  tasksDone: number;
  /** questions proposées, adaptées au parcours (src/lib/copilot/prompt.ts) */
  suggestions: string[];
}

/**
 * Repli hors ligne (démo, API injoignable) : uniquement des chiffres affichés à l'écran, aucune phrase inventée.
 * Les vraies réponses (routées, chiffrées) viennent de /api/copilot.
 */
function localAnswer(q: string, c: CopilotContext): string {
  const date = `d’après l’audit du ${c.dataDate}`;
  const lines = [`Je n’ai pas pu joindre le copilote (connexion). Voici ce que je sais ${date} :`, ''];
  lines.push(`- **Rang** : ${c.benchmark}.`);
  lines.push(`- **Score** : ${c.score}/100${c.scoreDelta !== null ? ` (${c.scoreDelta >= 0 ? '+' : '−'}${Math.abs(c.scoreDelta)} sur un mois)` : ''}.`);
  lines.push(`- **Part de voix** : ${Math.round(c.share * 100)} % des citations.`);
  if (c.errors) lines.push(`- **Exactitude** : ${c.errors} information${c.errors > 1 ? 's' : ''} fausse${c.errors > 1 ? 's' : ''} détectée${c.errors > 1 ? 's' : ''} (écran Vérité).`);
  if (c.gaps[0]) lines.push(`- **${c.gaps[0].competitor}** passe devant vous${c.gaps[0].presentOn.length ? ` ; il est présent sur ${c.gaps[0].presentOn.slice(0, 3).join(', ')}` : ''}.`);
  if (c.opportunities[0]) lines.push(`- **Source à viser** : ${c.opportunities[0].label} (${c.opportunities[0].action}).`);
  lines.push('', `Renvoyez la question « ${q.slice(0, 80)} » quand la connexion est rétablie.`);
  return lines.join('\n');
}

type Msg = CopilotMessage & { typing?: boolean; local?: boolean; sources?: SourceRef[]; actions?: CopilotAction[]; deliverables?: Deliverable[]; mode?: string };
interface ThreadRow {
  id: string;
  title: string;
  updatedAt: string;
  messages: number;
}

const MIME: Record<Deliverable['type'], { mime: string; ext: string }> = {
  csv: { mime: 'text/csv;charset=utf-8', ext: 'csv' },
  html: { mime: 'text/html;charset=utf-8', ext: 'html' },
  jsonld: { mime: 'application/ld+json;charset=utf-8', ext: 'json' },
  text: { mime: 'text/plain;charset=utf-8', ext: 'txt' },
};

function slug(s: string) {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'livrable'
  );
}

/** Télécharge un livrable du copilote (CSV avec BOM pour Excel). */
function download(d: Deliverable) {
  const m = MIME[d.type] ?? MIME.text;
  const blob = new Blob([d.type === 'csv' ? `﻿${d.content}` : d.content], { type: m.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `repere-${slug(d.label)}.${m.ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ActionButton({ action, businessId, demo, deliverables }: { action: CopilotAction; businessId: string; demo: boolean; deliverables: Deliverable[] }) {
  const [state, setState] = useState<'idle' | 'confirm' | 'busy' | 'done' | 'err'>('idle');
  const [note, setNote] = useState('');
  const p = action.payload ?? {};
  if (action.type === 'open' && typeof p.href === 'string' && p.href.startsWith('/')) {
    return (
      <Link href={p.href} className="rp-btn rp-btn-sm">
        {action.label}
      </Link>
    );
  }
  if (action.type === 'download') {
    const d = deliverables[typeof p.index === 'number' ? p.index : 0];
    return d ? (
      <button type="button" className="rp-btn rp-btn-sm" onClick={() => download(d)}>
        <Icon name="download" size={14} /> {action.label}
      </button>
    ) : null;
  }
  if (state === 'done') return <span className="text-[12px] text-[var(--success-ink)]" role="status">{note}</span>;
  async function run() {
    setState('busy');
    try {
      if (action.type === 'track_question') {
        const res = await fetch('/api/prompts', { method: 'POST', headers: sessionHeaders(), credentials: 'same-origin', body: JSON.stringify({ businessId, text: String(p.text ?? ''), origin: 'copilot' }) });
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(demo || res.status === 403 ? 'Démo : la question n’est pas ajoutée. Sur votre compte, elle rejoint vos questions suivies.' : (j?.error ?? 'Ajout impossible.'));
        setNote('Question ajoutée à votre suivi.');
      } else {
        const r = await createTask(businessId, demo, { title: String(p.title ?? action.label), why: typeof p.why === 'string' ? p.why : undefined, minutes: typeof p.minutes === 'number' ? p.minutes : undefined });
        if (!r.ok) throw new Error(r.error);
        setNote(r.demo ? 'Tâche créée sur cet appareil (démo).' : 'Tâche ajoutée à vos actions.');
      }
      setState('done');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Échec.');
      setState('err');
    }
  }
  if (state === 'confirm') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-[12px]">
        Confirmer : {action.label} ?
        <button type="button" className="rp-btn rp-btn-sm rp-btn-primary" onClick={() => void run()}>
          Oui
        </button>
        <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" onClick={() => setState('idle')}>
          Non
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className="rp-btn rp-btn-sm" disabled={state === 'busy'} onClick={() => setState('confirm')}>
        <Icon name="plus" size={14} /> {action.label}
      </button>
      {state === 'err' && <span className="text-[12px] text-[var(--danger-ink)]">{note}</span>}
    </span>
  );
}

function AnswerExtras({ m, businessId, demo }: { m: Msg; businessId: string; demo: boolean }) {
  const deliv = m.deliverables ?? [];
  return (
    <>
      {m.sources && m.sources.length > 0 && (
        <ol className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--hair)] pt-2 text-[12px] text-[var(--muted)]" aria-label="Sources des chiffres">
          {m.sources.map((s, i) => (
            <li key={i}>
              [{i + 1}]{' '}
              <Link href={s.href} className="rp-link">
                {s.label}
              </Link>
              {s.date && !/\d{4}/.test(s.label) ? ` · ${/^\d{4}-\d\d-\d\dT/.test(s.date) ? new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : s.date}` : ''}
            </li>
          ))}
        </ol>
      )}
      {deliv.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-[var(--hair)] pt-2">
          {deliv.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
              <Icon name="file" size={15} className="text-[var(--primary)]" />
              <span className="min-w-0 flex-1 font-medium">{d.label}</span>
              {d.type === 'csv' || d.type === 'html' ? (
                <button type="button" className="rp-btn rp-btn-sm" onClick={() => download(d)}>
                  <Icon name="download" size={14} /> Télécharger ({d.type.toUpperCase()})
                </button>
              ) : null}
              <CopyButton text={d.content} />
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(m.actions ?? []).map((a, i) => (
          <ActionButton key={i} action={a} businessId={businessId} demo={demo} deliverables={deliv} />
        ))}
        <CopyButton text={m.content} label="Copier la réponse" />
      </div>
    </>
  );
}

export function Copilot({
  businessId,
  context,
  demo,
  screen,
  initialQuestion,
  dailyLimit,
}: {
  businessId: string;
  context: CopilotContext;
  demo: boolean;
  /** écran d'origine (?context=) : adapte les suggestions */
  screen?: string;
  /** question pré-remplie (?q=), jamais envoyée sans action de la personne */
  initialQuestion?: string;
  dailyLimit?: number;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialQuestion ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [sugg, setSugg] = useState<string[]>(context.suggestions);
  const [mode, setMode] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadMeta = useCallback(async () => {
    try {
      const q = new URLSearchParams({ businessId });
      if (screen && /^[a-z-]{1,30}$/.test(screen)) q.set('context', screen);
      const res = await fetch(`/api/copilot?${q.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { threads?: ThreadRow[]; suggestions?: string[]; mode?: string };
      if (Array.isArray(j.suggestions) && j.suggestions.length) setSugg(j.suggestions);
      setThreads(Array.isArray(j.threads) ? j.threads : []);
      if (j.mode) setMode(j.mode);
    } catch {
      setThreads([]);
    }
  }, [businessId, screen]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (initialQuestion) inputRef.current?.focus();
  }, [initialQuestion]);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  async function openThread(id: string) {
    setErr(null);
    try {
      const res = await fetch(`/api/copilot?businessId=${encodeURIComponent(businessId)}&threadId=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { thread?: { id: string; messages: CopilotMessage[] } };
      if (!j.thread) throw new Error('vide');
      setThreadId(j.thread.id);
      setMessages(j.thread.messages);
    } catch {
      setErr('Cette conversation n’a pas pu être ouverte. Réessayez.');
    }
  }

  function newThread() {
    setThreadId(undefined);
    setMessages([]);
    setErr(null);
    inputRef.current?.focus();
  }

  const stopTyping = useCallback((i: number) => setMessages((list) => (list[i]?.typing ? list.map((x, k) => (k === i ? { ...x, typing: false } : x)) : list)), []);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    const user: Msg = { role: 'user', content: text, at: new Date().toISOString() };
    const history = [...messages, user];
    setMessages(history);
    setInput('');
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: sessionHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ businessId, threadId, context: screen && /^[a-z-]{1,30}$/.test(screen) ? screen : undefined, messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (res.status === 429) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw Object.assign(new Error(j?.error ?? 'Trop de questions pour aujourd’hui.'), { quota: true });
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        answer?: { content?: string; at?: string; sources?: SourceRef[]; actions?: CopilotAction[]; deliverables?: Deliverable[]; mode?: string } | string;
        threadId?: string;
      };
      const ans = typeof data.answer === 'string' ? { content: data.answer } : data.answer;
      const content = ans?.content;
      if (!content) throw new Error('vide');
      if (data.threadId) setThreadId(data.threadId);
      const extra = (typeof ans === 'object' && ans ? ans : {}) as { at?: string; sources?: SourceRef[]; actions?: CopilotAction[]; deliverables?: Deliverable[]; mode?: string };
      setMessages((m) => [
        ...m,
        { role: 'assistant', content, typing: true, at: extra.at || new Date().toISOString(), sources: extra.sources, actions: extra.actions, deliverables: extra.deliverables, mode: extra.mode },
      ]);
      if (!demo && !threadId) void loadMeta();
    } catch (e) {
      if ((e as { quota?: boolean }).quota) {
        setErr(`${(e as Error).message} Votre offre comprend ${dailyLimit ?? '—'} questions par jour ; l’offre supérieure en ajoute.`);
        setMessages((m) => m.slice(0, -1));
        setInput(text);
      } else if (demo) {
        setMessages((m) => [...m, { role: 'assistant', content: localAnswer(text, context), at: new Date().toISOString(), local: true, typing: true }]);
      } else {
        setErr('Le copilote n’a pas répondu. Vérifiez votre connexion puis renvoyez la question.');
        setMessages((m) => m.slice(0, -1));
        setInput(text);
      }
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
      <aside className="order-2 lg:order-1" aria-labelledby="conv-h">
        <div className="flex items-center justify-between gap-2">
          <h2 id="conv-h" className="text-[13px] font-semibold">
            Conversations
          </h2>
          <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" onClick={newThread}>
            <Icon name="plus" size={14} /> Nouvelle
          </button>
        </div>
        {threads === null ? (
          <div className="mt-2 h-16 animate-pulse rounded-lg bg-[var(--bg)]" aria-label="Chargement des conversations" />
        ) : demo ? (
          <p className="mt-2 text-[12px] text-[var(--muted)]">En démo, les conversations ne sont pas conservées.</p>
        ) : threads.length === 0 ? (
          <p className="mt-2 text-[12px] text-[var(--muted)]">Vos conversations apparaîtront ici.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void openThread(t.id)}
                  aria-current={t.id === threadId ? 'true' : undefined}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-[var(--surface-2)] ${t.id === threadId ? 'bg-[var(--primary-bg)] text-[var(--primary)]' : ''}`}
                >
                  <span className="line-clamp-2 font-medium">{t.title}</span>
                  <span className="block text-[11px] text-[var(--muted)]">
                    {new Date(t.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {t.messages} message{t.messages > 1 ? 's' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[11px] text-[var(--muted)]">
          {mode === 'llm' ? 'Réponses rédigées par une IA à partir de vos données.' : 'Réponses calculées sur vos données, sans IA générative.'}
          {dailyLimit ? ` ${dailyLimit} questions par jour avec votre offre.` : ''}
        </p>
      </aside>

      <div className="order-1 flex min-h-[60dvh] flex-col lg:order-2 lg:min-h-[calc(100dvh-180px)]">
        <div className="flex-1" aria-live="polite" aria-busy={busy}>
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl py-4 lg:py-10">
              <p className="rp-display text-[22px] lg:text-[26px]">Que voulez-vous savoir sur {context.name} ?</p>
              <p className="mt-1 text-[14px] text-[var(--muted)]">
                Je réponds uniquement à partir de vos données : mesure du {context.dataDate}, sources citées, concurrents, fiche de vérité et actions. Chaque chiffre renvoie à l’écran d’où il vient. Je ne promets aucun résultat.
              </p>
              <p className="mt-6 text-[13px] font-semibold">Questions fréquentes sur vos données</p>
              <ul className="v4-chips mt-2" aria-label="Questions suggérées">
                {sugg.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => ask(s)} className="v4-chip font-medium">
                      <Icon name="spark" size={15} className="flex-none text-[var(--primary)]" />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="mx-auto flex max-w-3xl flex-col gap-4 py-2">
              {messages.map((m, i) => (
                <li key={i} className={`v4-swap ${m.role === 'user' ? 'flex justify-end' : ''}`}>
                  {m.role === 'user' ? (
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--primary)] px-4 py-2.5 text-[14px] text-[var(--on-primary)]">{m.content}</p>
                  ) : (
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[var(--deep)] text-[var(--accent)]" aria-hidden="true">
                        <Icon name="spark" size={16} />
                      </span>
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[14px] leading-relaxed">
                        <span className="sr-only">Copilote : </span>
                        {m.typing ? <TypedAnswer text={m.content} onDone={() => stopTyping(i)} /> : <Markdown text={m.content} />}
                        {m.typing ? null : m.local ? (
                          <p className="mt-2 border-t border-[var(--hair)] pt-2 text-[12px] text-[var(--muted)]">Réponse démo, calculée sur cet appareil à partir des données affichées.</p>
                        ) : (
                          <AnswerExtras m={m} businessId={businessId} demo={demo} />
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {busy && (
                <li className="v4-swap flex items-center gap-3 text-[13px] text-[var(--muted)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--deep)] text-[var(--accent)]" aria-hidden="true">
                    <Icon name="spark" size={16} />
                  </span>
                  <span className="v4-dots" aria-hidden="true"><i /><i /><i /></span>
                  Le copilote lit vos données…
                </li>
              )}
            </ol>
          )}
          <div ref={endRef} />
        </div>
        {messages.length > 0 && !busy && !messages[messages.length - 1]?.typing && (
          <div className="v4-chips v4-swap mx-auto mb-3 w-full max-w-3xl" role="group" aria-label="Questions de relance">
            {sugg.slice(0, 4).map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="v4-chip" title={s}>
                {s.length > 48 ? `${s.slice(0, 46)}…` : s}
              </button>
            ))}
          </div>
        )}
        {err && (
          <p role="alert" className="mx-auto mb-2 w-full max-w-3xl text-[13px] text-[var(--danger-ink)]">
            {err}
          </p>
        )}
        <form
          data-visite="copilote"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+8px)] mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow)] focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)] lg:bottom-5"
        >
          <label htmlFor="copilot-q" className="sr-only">
            Votre question
          </label>
          <textarea
            id="copilot-q"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            placeholder="Posez votre question…"
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[16px] outline-none lg:text-[14px]"
          />
          <button type="submit" className="rp-btn rp-btn-primary" disabled={busy || !input.trim()} aria-label="Envoyer la question">
            <Icon name="send" size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
