'use client';
// Calendrier de posts Google : idées datées, texte prêt à coller, rappel le jour J, statut (GET/POST/PATCH /api/local/posts).
import { useEffect, useMemo, useState } from 'react';
import { CopyButton } from '@/components/app/CopyButton';
import type { LocalPost } from '@/lib/local/types';
import { api, DEMO_SAVED, Notice, useLocalState } from './client';
import { nextPost, POST_STATUS_LABEL, POST_TYPE_LABEL } from './logic';

const day = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'Europe/Paris' }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));
const clip = (p: Pick<LocalPost, 'title' | 'text'>) => `${p.title}\n\n${p.text}`;

export function PostsCalendar({ businessId, demo, initial, focus }: { businessId: string; demo: boolean; initial: LocalPost[]; focus?: string | null }) {
  const [posts, setPosts] = useState<LocalPost[]>(initial);
  const [demoStatus, setDemoStatus] = useLocalState<Record<string, LocalPost['status']>>(`posts:${businessId}`, {});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'demo'; text: string } | null>(null);
  const view = useMemo(() => (demo ? posts.map((p) => (demoStatus[p.id] ? { ...p, status: demoStatus[p.id] } : p)) : posts), [posts, demo, demoStatus]);
  const next = nextPost(view);

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`post-${focus}`)?.scrollIntoView({ block: 'center' });
  }, [focus]);

  async function plan() {
    setBusy('plan');
    setMsg(null);
    const r = await api<{ posts: LocalPost[]; saved: boolean }>('/api/local/posts', { body: { businessId, count: 4 } });
    setBusy(null);
    if (!r.ok || !r.data) return setMsg({ tone: 'error', text: r.error ?? 'La planification a échoué.' });
    setPosts(r.data.posts);
    setMsg(r.data.saved ? { tone: 'success', text: 'Quatre semaines de posts planifiées, avec un rappel le jour de chaque post.' } : { tone: 'demo', text: 'Démo : calendrier d’exemple, aucun rappel ne sera envoyé.' });
  }

  async function setStatus(p: LocalPost, status: LocalPost['status']) {
    if (demo) {
      setDemoStatus({ ...demoStatus, [p.id]: status });
      setMsg({ tone: 'demo', text: DEMO_SAVED });
      return;
    }
    setBusy(p.id);
    setMsg(null);
    const r = await api<{ post: LocalPost }>('/api/local/posts', { method: 'PATCH', body: { businessId, postId: p.id, status } });
    setBusy(null);
    if (!r.ok || !r.data) return setMsg({ tone: 'error', text: r.error ?? 'Mise à jour impossible.' });
    setPosts(posts.map((x) => (x.id === p.id ? r.data!.post : x)));
  }

  return (
    <div className="flex flex-col gap-4">
      {view.length === 0 ? (
        <p className="text-[14px] text-[var(--muted)]">Aucun post prévu. Une actualité par semaine montre aux IA et aux clients que vous êtes en activité : planifiez-en quatre, nous vous rappelons le jour venu.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {view.map((p) => {
            const isNext = next?.id === p.id;
            const isFocus = focus === p.id;
            return (
              <li
                key={p.id}
                id={`post-${p.id}`}
                className={`rounded-xl border p-4 ${isNext || isFocus ? 'border-[var(--primary)]' : 'border-[var(--line)]'} ${p.status !== 'planned' ? 'opacity-70' : ''}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] text-[var(--muted)]">
                    <time dateTime={p.date} className="font-semibold capitalize text-[var(--ink)]">
                      {day(p.date)}
                    </time>{' '}
                    · {POST_TYPE_LABEL[p.type]}
                    {isNext && <span className="rp-chip rp-chip-primary ml-2">prochain</span>}
                  </p>
                  <span className={`rp-chip ${p.status === 'published' ? 'rp-chip-success' : ''}`}>{POST_STATUS_LABEL[p.status]}</span>
                </div>
                <p className="mt-1 font-semibold">{p.title}</p>
                <p className="mt-1 whitespace-pre-line text-[14px]">{p.text}</p>
                <dl className="mt-2 grid gap-1 text-[13px] text-[var(--muted)] sm:grid-cols-3">
                  <div>
                    <dt className="inline">Photo à prendre : </dt>
                    <dd className="inline">{p.photoIdea}</dd>
                  </div>
                  <div>
                    <dt className="inline">Bouton : </dt>
                    <dd className="inline">{p.cta}</dd>
                  </div>
                  <div>
                    <dt className="inline">Rappel : </dt>
                    <dd className="inline">{p.reminded ? 'envoyé' : day(p.remindAt, { day: 'numeric', month: 'long' })}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyButton text={clip(p)} label="Copier le texte" />
                  <a href="https://business.google.com/" target="_blank" rel="noopener noreferrer" className="rp-btn rp-btn-sm">
                    Ouvrir ma fiche Google
                  </a>
                  {p.status === 'planned' ? (
                    <>
                      <button type="button" className="rp-btn rp-btn-sm rp-btn-primary" disabled={busy === p.id} onClick={() => setStatus(p, 'published')}>
                        Marquer comme publié
                      </button>
                      <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" disabled={busy === p.id} onClick={() => setStatus(p, 'skipped')}>
                        Ignorer
                      </button>
                    </>
                  ) : (
                    <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" disabled={busy === p.id} onClick={() => setStatus(p, 'planned')}>
                      Remettre au calendrier
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-col gap-2">
        <div>
          <button type="button" className="rp-btn" onClick={plan} disabled={busy === 'plan'} aria-busy={busy === 'plan'}>
            {busy === 'plan' ? 'Planification…' : view.length ? 'Planifier les 4 semaines suivantes' : 'Planifier 4 posts'}
          </button>
        </div>
        <p className="text-[12px] text-[var(--muted)]">Publication manuelle : Google ne permet pas de publier à votre place sans accès à votre compte. Le rappel arrive dans l’app et par e-mail le jour prévu.</p>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </div>
  );
}
