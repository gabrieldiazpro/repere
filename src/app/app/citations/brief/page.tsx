import { Verdict } from '@/components/app/v4/Verdict';
import '@/components/app/mesure/mesure.css';
import Link from 'next/link';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { buildContentBrief, queryGaps, themeOf, type BriefTarget, type ContentBrief, type QueryGap } from '@/lib/engine';
import { loadMesure } from '@/components/app/mesure/server';
import { crossLink, str, type RawSearch } from '@/components/app/mesure/params';
import { CopyText, TaskButton } from '@/components/app/mesure/TaskButton';
import { AskCopilot } from '@/components/app/mesure/ui';

export const metadata = { title: 'Brief de contenu' };

const FORMAT: Record<ContentBrief['format'], string> = {
  comparatif: 'Comparatif',
  guide: 'Guide pratique',
  page_service: 'Page de service',
  faq: 'Page questions-réponses',
  article_invite: 'Article sur un site tiers',
  fiche: 'Fiche sur une plateforme',
};

function asText(b: ContentBrief): string {
  return [
    `# ${b.title}`,
    `Format : ${FORMAT[b.format]} · ${b.length.minWords}–${b.length.maxWords} mots · ${b.publishOn}`,
    '',
    `Angle : ${b.angle}`,
    `Lecteur : ${b.audience}`,
    '',
    '## Questions à traiter',
    ...b.questions.map((q) => `- ${q}`),
    '',
    '## Plan',
    ...b.outline.flatMap((o) => [`### ${o.heading}`, ...o.points.map((p) => `- ${p}`)]),
    '',
    '## Sources à citer ou à viser',
    ...b.sources.map((s) => `- ${s.label} (${s.url ?? s.domain}) : ${s.why}`),
    '',
    '## Avant de publier',
    ...b.checklist.map((c) => `- [ ] ${c}`),
    '',
    b.note,
  ].join('\n');
}

export default async function BriefPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const m = await loadMesure(searchParams);
  const { ws, business, period, sp } = m;
  const latest = period.current;
  const url = str(sp, 'url', 1000);
  const qid = str(sp, 'q', 60);
  const back = crossLink(qid && !url ? '/app/questions' : '/app/citations', sp);

  let target: BriefTarget | null = null;
  let origin = '';
  if (latest) {
    const gaps = queryGaps(latest, 100);
    if (qid) {
      const q = latest.queries.find((x) => x.id === qid);
      target = gaps.find((g) => g.queryId === qid) ?? (q ? ({ queryId: q.id, text: q.text, theme: themeOf(q), competitors: [] } satisfies QueryGap) : null);
      origin = q ? `la question « ${q.text} »` : '';
    } else if (url) {
      const u = latest.sources?.urls?.find((x) => x.url === url);
      if (u) {
        const gap = gaps.find((g) => u.queries.includes(g.queryId));
        const opp = latest.sources?.opportunities.find((o) => o.domain === u.domain);
        const q = latest.queries.find((x) => u.queries.includes(x.id) && x.kind !== 'brand');
        target = gap ?? opp ?? (q ? { queryId: q.id, text: q.text, theme: themeOf(q), competitors: u.competitorsPresent.slice(0, 5) } : null);
        origin = `la page « ${u.title ?? u.domain} »`;
      }
    }
  }
  const brief = target && latest ? buildContentBrief(target, latest.input, latest) : null;

  return (
    <>
      <PageHeader title="Brief de contenu" back={{ href: back, label: qid && !url ? 'Questions' : 'Pages citées' }} meta={<>Préparé à partir de vos mesures{latest?.demo ? ' · démo' : ''}</>} />
      <div className="rp-page">
        {!brief ? (
          <Empty
            title="Brief impossible à préparer"
            action={
              <Link href={back} className="rp-btn rp-btn-primary">
                Revenir à la liste
              </Link>
            }
          >
            Cette page ou cette question ne figure pas dans la dernière mesure. Choisissez-en une autre dans la liste.
          </Empty>
        ) : (
          <>
            <Verdict
              id="br-h"
              tone="brand"
              title={brief.title}
              lead={
                <>
                  <span className="block text-[var(--ink)]">{brief.angle}</span>
                  <span className="mt-1 block">
                    {FORMAT[brief.format]}, {brief.length.minWords} à {brief.length.maxWords} mots. Pour : {brief.audience}. Où publier : {brief.publishOn}.
                  </span>
                </>
              }
              action={
                <TaskButton
                  businessId={business.id}
                  demo={ws.demo}
                  primary
                  label="Créer la tâche"
                  draft={{ id: `brief-${brief.id}`, title: `Rédiger : ${brief.title.slice(0, 120)}`, why: brief.angle, minutes: brief.length.maxWords > 1200 ? 240 : 120, impact: 2, steps: brief.checklist.slice(0, 12), kind: 'content' }}
                />
              }
              secondary={
                <>
                  <CopyText text={asText(brief)} label="Copier le brief" />
                  <AskCopilot context="sources" question={`Rédige un premier jet pour : ${brief.title}`} label="Faire rédiger par le copilote" />
                </>
              }
              details={origin ? <p>Brief préparé à partir de {origin}, d’après votre dernière mesure.</p> : undefined}
              detailsLabel="D’où vient ce brief"
            />
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
              <Panel id="bq-h" title="Questions à traiter">
                <ul className="flex flex-col gap-1.5 text-[14px]">
                  {brief.questions.map((q) => (
                    <li key={q} className="flex gap-2">
                      <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[var(--primary)]" aria-hidden="true" />
                      {q}
                    </li>
                  ))}
                </ul>
                {brief.competitors.length > 0 && <p className="mt-3 border-t border-[var(--hair)] pt-3 text-[13px] text-[var(--muted)]">Cités à votre place : {brief.competitors.join(', ')}</p>}
              </Panel>
              <Panel id="bs-h" title="Sources à citer ou à viser">
                {brief.sources.length ? (
                  <ul className="flex flex-col gap-2 text-[14px]">
                    {brief.sources.map((s) => (
                      <li key={s.domain + (s.url ?? '')}>
                        <span className="font-semibold">{s.label}</span> <span className="text-[12px] text-[var(--muted)]">{s.domain}</span>
                        <span className="block text-[13px] text-[var(--muted)]">{s.why}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-[var(--muted)]">Pas de source relevée pour ce sujet.</p>
                )}
              </Panel>
            </div>
            <Panel id="bo-h" title="Plan proposé">
              <ol className="flex flex-col gap-3 pl-5 text-[14px] [list-style:decimal]">
                {brief.outline.map((o) => (
                  <li key={o.heading}>
                    <p className="font-semibold">{o.heading}</p>
                    <ul className="mt-1 flex flex-col gap-0.5 text-[var(--muted)]">
                      {o.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel id="bc-h" title="Avant de publier">
              <ul className="flex flex-col gap-1.5 text-[14px]">
                {brief.checklist.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span aria-hidden="true" className="text-[var(--muted)]">☐</span>
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-[var(--hair)] pt-3 text-[13px] text-[var(--muted)]">{brief.note}</p>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
