import Link from 'next/link';
import { adaptTasks } from '@/components/app/adapters';
import { copilotHref, loadActionContext } from '@/components/app/action/context';
import { cellKey, errorHistory, truthGrid, type Cell } from '@/components/app/action/truth';
import { Icon } from '@/components/app/icons';
import { PageHeader, Panel } from '@/components/app/PageHeader';
import { FixTaskButton, TruthEditor } from '@/components/app/TruthEditor';
import { FACT_LABEL, fmtDate, PROVIDER_LABEL, PROVIDER_ORDER } from '@/components/app/tokens';
import { auditDate } from '@/components/app/workspace';
import type { FactCheckItem } from '@/lib/engine/types-v2';
import { Verdict } from '@/components/app/v4/Verdict';
import { InView } from '@/components/app/v4/motion';

export const metadata = { title: 'Vérité' };

const VERDICT: Record<FactCheckItem['verdict'], { label: string; cls: string }> = {
  faux: { label: 'Faux', cls: 'rp-chip-danger' },
  incomplet: { label: 'Incomplet', cls: 'rp-chip-warning' },
  non_verifiable: { label: 'Non vérifiable', cls: '' },
  correct: { label: 'Juste', cls: 'rp-chip-success' },
};
const SEVERITY = { haute: 'Critique', moyenne: 'À surveiller', basse: 'Mineur' } as const;
const CELL_UI: Record<Cell, { sign: string; label: string; cls: string }> = {
  ok: { sign: '✓', label: 'juste', cls: 'text-[var(--success-ink)] bg-[var(--success-bg)]' },
  faux: { sign: '✗', label: 'faux', cls: 'text-[var(--danger-ink)] bg-[var(--danger-bg)]' },
  partiel: { sign: '~', label: 'incomplet', cls: 'text-[var(--warning-ink)] bg-[var(--warning-bg)]' },
  inconnu: { sign: '?', label: 'non vérifiable', cls: 'text-[var(--muted)]' },
};
const short = (d: string) => fmtDate(d, { day: 'numeric', month: 'short' });

export default async function VeritePage() {
  const { ws } = await loadActionContext();
  const a = ws.latest;
  const tasks = await adaptTasks(ws.business.id, ws.fb);
  const fc = a?.factCheck;
  const items = fc?.items ?? [];
  const order = { faux: 0, incomplet: 1, non_verifiable: 2, correct: 3 } as const;
  const problems = items.filter((i) => i.verdict !== 'correct').sort((x, y) => order[x.verdict] - order[y.verdict]);
  const ok = items.filter((i) => i.verdict === 'correct');
  const wrongFields = items.filter((i) => i.verdict === 'faux').map((i) => i.field);
  const grid = truthGrid(items, PROVIDER_ORDER);
  const history = errorHistory(ws.audits, tasks);
  const resolved = history.filter((h) => h.resolvedAt);
  const openHist = new Map(history.filter((h) => !h.resolvedAt).map((h) => [cellKey(h.field, h.provider), h]));
  // V1 : en démo, la date de vérification est celle de la mesure (pas « maintenant »).
  const checkedAt = fc ? (a?.demo && a ? auditDate(a) : fc.checkedAt) : null;
  const firstWrong = problems.find((p) => p.verdict === 'faux') ?? null;
  const wrongN = items.filter((i) => i.verdict === 'faux').length;
  const lower = (f: FactCheckItem['field']) => FACT_LABEL[f].charAt(0).toLowerCase() + FACT_LABEL[f].slice(1);
  const verdictTitle = !fc
    ? 'Remplissez votre fiche : la vérification démarre lundi'
    : firstWrong
      ? `${PROVIDER_LABEL[firstWrong.provider]} se trompe sur vos ${lower(firstWrong.field)}${wrongN > 1 ? `, et ${wrongN - 1} autre erreur${wrongN > 2 ? 's' : ''}` : ''}`
      : problems.length
        ? `Aucune erreur, mais ${problems.length} information${problems.length > 1 ? 's' : ''} incomplète${problems.length > 1 ? 's' : ''}`
        : 'Les IA donnent des informations justes sur vous';

  return (
    <>
      <PageHeader
        title="Vérité"
        meta={fc && checkedAt ? <>Vérifié le {fmtDate(checkedAt, { day: 'numeric', month: 'long' })} · détection sur échantillon{a?.demo ? ' · démo' : ''}</> : undefined}
        dataDate={a ? auditDate(a) : null}
      />
      <div className="rp-page">
        <Verdict
          tone={!fc ? 'neutral' : firstWrong ? 'bad' : problems.length ? 'warn' : 'good'}
          title={verdictTitle}
          lead={firstWrong ? <>L’IA affirme « {firstWrong.stated} », votre fiche indique « {firstWrong.expected || 'non renseigné'} ».</> : fc ? `${grid.correct} réponse${grid.correct > 1 ? 's' : ''} juste${grid.correct > 1 ? 's' : ''} sur ${grid.checked} information${grid.checked > 1 ? 's' : ''} vérifiée${grid.checked > 1 ? 's' : ''}.` : undefined}
          figure={fc ? { value: wrongN, label: `information${wrongN > 1 ? 's' : ''} fausse${wrongN > 1 ? 's' : ''} sur ${grid.providers.length} IA` } : null}
          action={!fc ? { href: '#facts-h', label: 'Remplir ma fiche de vérité', icon: 'file' } : problems.length ? { href: '#errors-h', label: firstWrong ? 'Corriger cette erreur' : 'Compléter ces informations', icon: 'shield' } : undefined}
          secondary={
            <Link href={copilotHref('verite', 'Quelles informations fausses les IA donnent-elles sur moi ?')} className="rp-btn">
              <Icon name="spark" size={15} /> Demander au copilote
            </Link>
          }
          details={
            <p>
              Votre fiche de vérité sert de référence. Chaque semaine, Repéré pose des questions factuelles aux IA et compare leurs réponses à ces informations. Détection sur échantillon : une IA peut répondre juste une fois et faux la suivante.
            </p>
          }
        />
        {grid.checked > 0 && (
          <section className="rp-panel" aria-labelledby="grid-h">
            <div className="rp-panel-head">
              <h2 id="grid-h" className="rp-h2">
                {grid.checked} information{grid.checked > 1 ? 's' : ''} vérifiée{grid.checked > 1 ? 's' : ''} sur {grid.providers.length} IA : {grid.correct} réponse{grid.correct > 1 ? 's' : ''} juste{grid.correct > 1 ? 's' : ''}, {grid.wrong} fausse{grid.wrong > 1 ? 's' : ''}
              </h2>
            </div>
            <InView className="rp-scroll v4-light px-2 pb-2 lg:px-3">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th scope="col">Information</th>
                    {grid.providers.map((p) => (
                      <th key={p} scope="col" className="text-center">
                        {PROVIDER_LABEL[p]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.fields.map((f, fi) => (
                    <tr key={f}>
                      <th scope="row" className="font-medium">
                        {FACT_LABEL[f]}
                      </th>
                      {grid.providers.map((p, pi) => {
                        const c = grid.cells[cellKey(f, p)];
                        const h = openHist.get(cellKey(f, p));
                        return (
                          <td key={p} className="text-center">
                            {c ? (
                              <span style={{ ['--k' as string]: fi + pi }} className={`v4-light-cell inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[14px] font-bold ${CELL_UI[c].cls}`} title={h ? `Faux depuis le ${short(h.firstSeen)}` : CELL_UI[c].label}>
                                {CELL_UI[c].sign}
                                <span className="sr-only"> {CELL_UI[c].label}</span>
                              </span>
                            ) : (
                              <span className="text-[var(--muted)]">
                                –<span className="sr-only"> pas de réponse</span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </InView>
            <p className="px-4 pb-3 text-[12px] text-[var(--muted)] lg:px-5">✓ juste · ✗ faux · ~ incomplet · ? non vérifiable · – l’IA n’en parle pas.</p>
          </section>
        )}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
          <Panel
            className="scroll-mt-20"
            id="errors-h"
            title={
              <span className="flex items-center gap-2">
                Erreurs détectées
                {fc && fc.errors > 0 && <span className="rp-chip rp-chip-danger rp-num">{fc.errors}</span>}
              </span>
            }
          >
            {!fc ? (
              <p className="text-[14px] text-[var(--muted)]">La première vérification aura lieu lundi, une fois votre fiche remplie.</p>
            ) : problems.length === 0 ? (
              <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--success-ink)]">
                <Icon name="shield" size={18} /> Toutes vos informations vérifiées sont justes.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {problems.map((it, i) => (
                  <li key={i} className={`rounded-xl border p-4 ${it.verdict === 'faux' ? 'border-[var(--danger-line)] bg-[var(--danger-bg)]' : 'border-[var(--hair)]'}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rp-chip ${VERDICT[it.verdict].cls}`}>{VERDICT[it.verdict].label}</span>
                      <span className="text-[14px] font-semibold">{FACT_LABEL[it.field]}</span>
                      <span className="text-[13px] text-[var(--muted)]">· {PROVIDER_LABEL[it.provider]} · {SEVERITY[it.severity]}</span>
                    </div>
                    <blockquote className="m-0 mt-2 border-l-2 border-[var(--line)] pl-3 text-[14px] leading-relaxed">« {it.quote} »</blockquote>
                    <dl className="mt-3 grid gap-1 text-[13px] sm:grid-cols-2 sm:gap-3">
                      <div>
                        <dt className="text-[var(--muted)]">L’IA affirme</dt>
                        <dd className="font-medium text-[var(--danger-ink)]">{it.stated}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Votre fiche indique</dt>
                        <dd className="font-medium text-[var(--success-ink)]">{it.expected || 'Non renseigné'}</dd>
                      </div>
                    </dl>
                    {(() => {
                      const h = openHist.get(cellKey(it.field, it.provider));
                      if (!h) return null;
                      return (
                        <p className="mt-2 text-[12px] text-[var(--muted)]">
                          Détectée le {short(h.firstSeen)}
                          {h.lastSeen !== h.firstSeen ? ` · toujours présente le ${short(h.lastSeen)}` : ''}
                          {h.taskDoneAt ? ` · correction faite le ${short(h.taskDoneAt)}, en attente de la prochaine mesure` : ''}
                        </p>
                      );
                    })()}
                    {(it.verdict === 'faux' || it.verdict === 'incomplet') && (
                      <div className="mt-3">
                        <FixTaskButton businessId={ws.business.id} item={it} demo={ws.demo} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {ok.length > 0 && (
              <details className="mt-4 border-t border-[var(--hair)] pt-3">
                <summary className="flex min-h-[32px] items-center gap-1.5 text-[13px] font-medium text-[var(--muted)]">
                  <Icon name="chevron" size={14} className="rp-chevron" /> {ok.length} information{ok.length > 1 ? 's' : ''} juste{ok.length > 1 ? 's' : ''}
                </summary>
                <ul className="mt-2 flex flex-col gap-2 text-[13px]">
                  {ok.map((it, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="rp-chip rp-chip-success">Juste</span>
                      <span>
                        <strong className="font-semibold">{FACT_LABEL[it.field]}</strong> selon {PROVIDER_LABEL[it.provider]} : {it.stated}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {resolved.length > 0 && (
              <div className="mt-4 border-t border-[var(--hair)] pt-3">
                <p className="text-[13px] font-semibold">Erreurs corrigées</p>
                <ul className="mt-2 flex flex-col gap-2 text-[13px]">
                  {resolved.map((h) => (
                    <li key={`${h.field}-${h.provider}-${h.firstSeen}`} className="flex items-start gap-2">
                      <Icon name="check" size={15} className="mt-0.5 flex-none text-[var(--success)]" />
                      <span>
                        <strong className="font-semibold">{FACT_LABEL[h.field]}</strong> chez {PROVIDER_LABEL[h.provider]} (« {h.stated} ») : détectée le {short(h.firstSeen)}
                        {h.taskDoneAt ? `, correction faite le ${short(h.taskDoneAt)}` : ''}, juste depuis la mesure du {short(h.resolvedAt!)}.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-[12px] text-[var(--muted)]">Repéré ne peut pas garantir qu’une IA corrigera une information, ni dans quel délai. Les corrections publiées partout augmentent les chances qu’elle soit reprise.</p>
          </Panel>

          <Panel id="facts-h" title="Votre fiche de vérité" className="scroll-mt-20">
            <TruthEditor businessId={ws.business.id} segment={ws.segment} initial={ws.facts.facts} updatedAt={ws.facts.updatedAt} demo={ws.demo} wrong={wrongFields} />
          </Panel>
        </div>
      </div>
    </>
  );
}
