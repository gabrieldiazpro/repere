'use client';
// Journal immuable : qui, quoi, quand. Groupé par jour, du plus récent au plus ancien.
import Link from 'next/link';
import { fmtDate } from '../tokens';
import { actorName, cleanTitle, JOURNAL_LABEL, KIND_NAME, type ChangeSet, type JournalEntry } from './model';

function short(v: string | null | undefined, n = 90): string {
  if (v === null || v === undefined || v === '') return '(vide)';
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function JournalList({ entries, changeSets, meId, withTitles = true }: { entries: JournalEntry[]; changeSets: ChangeSet[]; meId: string | null; withTitles?: boolean }) {
  const byId = new Map(changeSets.map((c) => [c.id, c]));
  const days = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const d = e.at.slice(0, 10);
    days.set(d, [...(days.get(d) ?? []), e]);
  }
  return (
    <div className="ag-log">
      {[...days.entries()].map(([day, list]) => (
        <section key={day} aria-label={fmtDate(`${day}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}>
          <p className="ag-log-day">{fmtDate(`${day}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <ol className="m-0 list-none p-0">
            {list.map((e) => {
              const lab = JOURNAL_LABEL[e.action] ?? { label: e.action, tone: 'neutral' as const };
              const cs = byId.get(e.subject);
              const ch = e.changeId ? cs?.changes.find((c) => c.id === e.changeId) : undefined;
              const sim = e.hash === 'simulation';
              return (
                <li key={e.id} className="ag-log-i">
                  <span className="ag-log-time">{new Date(e.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}</span>
                  <span className="ag-log-dot" data-tone={lab.tone} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="ag-log-t m-0">
                      <b className="font-semibold">{lab.label}</b>
                      {ch ? ` · ${KIND_NAME[ch.kind]}` : ''} <span className="text-[var(--muted)]">par {actorName(e.actor, meId)}</span>
                      {sim && <span className="ag-simtag ml-2">Simulé</span>}
                    </p>
                    {withTitles && cs && (
                      <p className="ag-log-s m-0">
                        <Link href={`/app/agent/${cs.id}`} className="underline-offset-2 hover:underline">
                          {cleanTitle(cs.title)}
                        </Link>
                      </p>
                    )}
                    {(e.before !== undefined || e.after !== undefined) && (
                      <p className="ag-log-s m-0">
                        Avant : « {short(e.before)} » · Après : « {short(e.after)} »
                      </p>
                    )}
                    {e.detail && <p className="ag-log-s m-0">{e.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
