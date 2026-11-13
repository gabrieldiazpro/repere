// Carte d'une réponse brute d'IA : en-tête (IA, date, statut), texte surligné, sources numérotées, actions.
import Link from 'next/link';
import { fmtDate, PROVIDER_LABEL } from '../tokens';
import type { AnswerItem } from './derive';
import { HighlightedAnswer } from './ui';
import { CopyText, TaskButton } from './TaskButton';

export function AnswerStatus({ a }: { a: Pick<AnswerItem, 'brand' | 'cited' | 'rank' | 'error'> }) {
  if (a.error) return <span className="rp-chip">Pas de réponse exploitable</span>;
  if (a.brand) return <span className="rp-chip rp-chip-primary">Question sur votre marque</span>;
  return a.cited ? (
    <span className="rp-chip rp-chip-success">Vous êtes cité{a.rank ? `, rang ${a.rank}` : ''}</span>
  ) : (
    <span className="rp-chip rp-chip-danger">Vous n’êtes pas cité</span>
  );
}

export function AnswerCard({
  a,
  businessId,
  demo,
  historyHref,
  showQuestion = true,
  actions = true,
  visite,
}: {
  a: AnswerItem;
  businessId: string;
  demo: boolean;
  historyHref?: string | null;
  showQuestion?: boolean;
  actions?: boolean;
  visite?: string;
}) {
  return (
    <article className="flex flex-col gap-2" data-visite={visite} aria-label={`Réponse de ${PROVIDER_LABEL[a.provider]}`}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">{PROVIDER_LABEL[a.provider]}</span>
        <span className="text-[12px] text-[var(--muted)]">
          {fmtDate(a.date, { day: 'numeric', month: 'short', year: 'numeric' })} · passage {a.run}
          {a.model && !/mock/i.test(a.model) ? ` · ${a.model}` : ''}
          {a.demo ? ' · démo' : ''}
        </span>
        <AnswerStatus a={a} />
      </header>
      {showQuestion && (
        <p className="text-[13px] text-[var(--muted)]">
          Question :{' '}
          {historyHref ? (
            <Link href={historyHref} className="rp-link">
              {a.question}
            </Link>
          ) : (
            <span className="text-[var(--ink)]">{a.question}</span>
          )}
        </p>
      )}
      {a.error ? <p className="text-[14px] text-[var(--muted)]">L’IA n’a pas renvoyé de réponse exploitable pour cette question ({a.error}). Elle n’est pas comptée dans le score.</p> : <HighlightedAnswer item={a} />}
      {a.sources.length > 0 && (
        <ol className="flex flex-col gap-0.5 pl-5 text-[12px] text-[var(--muted)] [list-style:decimal]">
          {a.sources.slice(0, 8).map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">
                {s.title ?? s.domain}
              </a>{' '}
              ({s.domain})
            </li>
          ))}
          {a.sources.length > 8 && <li className="list-none">et {a.sources.length - 8} autres sources</li>}
        </ol>
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <CopyText text={a.text} />
          {!a.cited && !a.brand && !a.error && (
            <TaskButton
              businessId={businessId}
              demo={demo}
              draft={{
                id: `ans-${a.queryId}-${a.provider}`,
                title: `Être cité par ${PROVIDER_LABEL[a.provider]} sur « ${a.question.slice(0, 80)} »`,
                why: `${PROVIDER_LABEL[a.provider]} ne vous cite pas${a.competitors.length ? ` et recommande ${a.competitors.slice(0, 3).join(', ')}` : ''}.${a.sources.length ? ` Sources citées : ${[...new Set(a.sources.map((s) => s.domain))].slice(0, 3).join(', ')}.` : ''}`,
                minutes: 120,
                impact: 2,
                steps: ['Lire la réponse et ses sources', 'Publier une réponse claire à cette question sur votre site', 'Être présent sur une des sources citées'],
              }}
            />
          )}
        </div>
      )}
    </article>
  );
}
