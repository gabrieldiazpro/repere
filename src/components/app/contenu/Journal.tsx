'use client';
// Journal immuable de l'agent de contenu (comptes réels) ; en démo, les étapes simulées des brouillons.
import Link from 'next/link';
import { CONTENT_ACTION_LABEL } from '@/lib/content/journal-labels';
import { STATUS_VIEW } from './model';
import { useContent } from './state';

const fmt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

export function ContentJournal() {
  const c = useContent();
  const titles = new Map(c.drafts.map((d) => [d.id, d.title]));
  if (c.demo) {
    return (
      <ul className="ct-journal">
        {c.drafts.map((d) => (
          <li key={d.id}>
            <time dateTime={d.updatedAt}>{fmt(d.updatedAt)}</time>
            <span>
              <b>{STATUS_VIEW[d.status].label}</b> — <Link className="underline underline-offset-2" href={`/app/contenu/${d.id}`}>{d.title}</Link> <span className="ct-fic">Exemple fictif</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (!c.journal.length) return <p className="text-[14px] text-[var(--muted)]">Rien pour l’instant : la première entrée apparaîtra quand l’agent rédigera un brouillon.</p>;
  return (
    <ul className="ct-journal">
      {c.journal.map((e) => (
        <li key={e.id}>
          <time dateTime={e.at}>{fmt(e.at)}</time>
          <span>
            <b>{CONTENT_ACTION_LABEL[e.action]}</b>
            {titles.get(e.subject) ? (
              <>
                {' — '}
                <Link className="underline underline-offset-2" href={`/app/contenu/${e.subject}`}>
                  {titles.get(e.subject)}
                </Link>
              </>
            ) : null}
            {e.detail ? <span className="block text-[13px] text-[var(--muted)]">{e.detail}</span> : null}
            <span className="block text-[12px] text-[var(--muted)]">{e.actor.email ?? (e.actor.id === 'system' ? 'Repéré (automatique)' : e.actor.id)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
