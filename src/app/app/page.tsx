import Link from 'next/link';
import { adaptDigest, adaptTasks, adaptWeekly } from '@/components/app/adapters';
import { Icon } from '@/components/app/icons';
import { Empty, PageHeader } from '@/components/app/PageHeader';
import { Cascade } from '@/components/motion/Cascade';
import { Delta } from '@/components/ui/Delta';
import { Disclosure } from '@/components/ui/Disclosure';
import { EmptyState } from '@/components/ui/EmptyState';
import { KeyFigure } from '@/components/ui/KeyFigure';
import { ProgressBar } from '@/components/ui/Progress';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Surface } from '@/components/ui/Surface';
import { QuoteCard } from '@/components/app/Quote';
import { WeeklyTasks } from '@/components/app/TaskBoard';
import { FACT_LABEL, fmtDate, minutes, ordinal, pct, PROVIDER_LABEL } from '@/components/app/tokens';
import { auditDate, loadWorkspace, myShare, rankOf, ranking, taskMinutes } from '@/components/app/workspace';
import { auditStats, digestRhythm, newEntrants, rankMove } from '@/lib/digest/stats';
import { factErrorHeadline } from '@/lib/digest';
import { fixFollowUp, frequencyOfAudits } from '@/lib/digest/fixes';
import { fr } from '@/components/ui/typo';
import { computeMargins, explainChange } from '@/lib/engine';
import { listAnnotations } from '@/lib/annotations';
import { StartList } from '@/components/app/shell/StartList';
import { loadEntitlements, loadSignaux } from '@/components/app/shell/server';

export const metadata = { title: 'Le lundi' };

type Alert = { tone: 'danger' | 'warning' | 'success' | 'info'; title: string; body: string; href: string };

export default async function LundiPage() {
  const ws = await loadWorkspace();
  const { business, latest, previous } = ws;
  const signaux = await loadSignaux();

  if (!latest) {
    // Compte réel sans mesure : la liste de démarrage guide vers la première valeur (moins de 5 minutes).
    return (
      <>
        <PageHeader title="Bienvenue" meta={business.name} />
        <div className="rp-page">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-5">
            <Empty
              title="Votre première mesure arrive"
              action={
                <Link href="/app/bienvenue" className="rp-btn rp-btn-primary">
                  Préparer ma première mesure
                </Link>
              }
            >
              Vérifiez votre site et vos questions, puis lancez la mesure : Repéré pose vos questions aux IA et vous montre ici ce
              qu’elles disent de vous, votre rang et vos premières actions.
            </Empty>
            <StartList businessId={business.id} signaux={signaux} demo={ws.demo} />
          </div>
        </div>
      </>
    );
  }

  const [all, digest] = await Promise.all([adaptTasks(business.id, ws.fb), adaptDigest(business.id, ws.fb)]);
  const weekly = await adaptWeekly(business.id, all, ws.fb);
  const rank = rankOf(latest);
  const stats = auditStats(latest);
  const move = rankMove(ws.audits, 'month');
  const places = move?.places ?? 0;
  const scoreDelta = previous ? Math.round(latest.score - previous.score) : null;
  const mentioned = stats.citations;
  // La fiche enregistrée fait foi (correction faite dans Vérité → l'erreur disparaît) ; sinon l'audit.
  // Les erreurs de prix e-commerce se comparent au catalogue (pas à la fiche) : elles restent jusqu'à la prochaine mesure.
  const errors = (latest.factCheck?.items ?? []).filter((i) => i.verdict === 'faux' && (i.source === 'catalogue' || (ws.facts.facts[i.field] ?? i.expected) === i.expected));
  const quotes = latest.perception?.quotes ?? [];
  const best = digest?.bestQuote ?? quotes.find((q) => q.sentiment === 'positif');
  const toFix = digest?.quoteToFix ?? quotes.find((q) => q.sentiment === 'negatif');
  const rows = ranking(latest);
  const myIdx = rows.findIndex((r) => r.isMe);
  const around = rows.slice(Math.max(0, myIdx - 3), Math.max(5, myIdx + 2));
  const ahead = stats.ahead;
  const entrants = newEntrants(ws.audits, 2);
  const firstError = errors[0] ?? null;
  const fixTask = firstError
    ? (all.find((t) => t.kind === 'fact_fix' && t.status !== 'done' && t.title.toLowerCase().includes(FACT_LABEL[firstError.field].toLowerCase())) ??
      all.find((t) => t.kind === 'fact_fix' && t.status !== 'done') ??
      null)
    : null;
  // Après « C'est fait » : la phrase dit « correction faite le…, revérification à la prochaine mesure » (lib/digest/fixes).
  const follow = firstError ? fixFollowUp(firstError, all, { lastMeasure: auditDate(latest), frequency: frequencyOfAudits(ws.audits) }) : null;
  const fixed = follow?.state === 'fixed';

  const alerts: Alert[] = [];
  for (const e of errors.slice(1, 3))
    alerts.push({
      tone: 'danger',
      title: `${PROVIDER_LABEL[e.provider]} donne une information fausse : ${FACT_LABEL[e.field].toLowerCase()}`,
      body: `« ${e.stated} » au lieu de « ${e.expected} ».`,
      href: '/app/verite',
    });
  // « Nouveau » seulement s'il était absent des 2 audits précédents (pas un changement de casting).
  for (const c of entrants)
    alerts.push({ tone: 'warning', title: `Nouveau concurrent : ${c}`, body: 'Absent des deux mesures précédentes, il apparaît ce mois-ci.', href: '/app/concurrents' });
  if (places > 0) alerts.push({ tone: 'success', title: `Vous gagnez ${places} place${places > 1 ? 's' : ''} sur un mois`, body: `${rank.label}.`, href: '/app/concurrents' });
  if (places < 0) alerts.push({ tone: 'warning', title: `Vous perdez ${-places} place${places < -1 ? 's' : ''} sur un mois`, body: move?.explanation ?? `${rank.label}.`, href: '/app/concurrents' });

  const today = new Date();
  const dayTitle = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  // Phrase de la semaine (doc 06 § 2.1) : l'erreur d'une IA passe en premier ; la citation descend en 2ᵉ ligne.
  // Le vocabulaire suit le rythme de l'offre : « ce mois-ci » (mensuelle), jamais « cette semaine » sans nouvelle mesure.
  const ent = await loadEntitlements().catch(() => null);
  const rhythm = digestRhythm({ frequency: ws.demo || !ent ? frequencyOfAudits(ws.audits) : ent.frequency, measuredAt: auditDate(latest) });
  const calmWord = rhythm.calm.split(' : ')[0];
  const fallbackLine = `${rhythm.noNewMeasure ? `${rhythm.noNewMeasure} ` : ''}${rhythm.lead}les IA vous citent dans ${mentioned} réponses sur ${stats.answers}.`;
  const dv = digest as (typeof digest & { secondLine?: string }) | null;
  const citedLine = dv?.secondLine ?? dv?.headline ?? fallbackLine;
  const headline = firstError ? `${factErrorHeadline(firstError.provider, firstError.field, business.name)}.` : citedLine;
  const headlineSub = firstError ? `${PROVIDER_LABEL[firstError.provider]} dit « ${firstError.stated.replace(/^[A-Za-zÀ-ÿ’' ]{2,20}\s?:\s*/, '').replace(/\.$/, '')} ». La bonne information : « ${firstError.expected} ».` : null;
  const weekMin = taskMinutes(weekly);
  // Marge d'erreur (bootstrap du moteur) et explication du changement : calculs uniques du moteur, jamais refaits ici.
  const margins = latest.margins ?? computeMargins(latest);
  const scoreMargin = Math.round(margins.score.margin);
  const explain = previous ? explainChange(previous, latest) : null;
  const notes = (await listAnnotations(business.id).catch(() => []))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const history = ws.audits.map((a) => Math.round(a.score));

  const pmargin = scoreMargin > 0 ? `± ${scoreMargin} point${scoreMargin > 1 ? 's' : ''} (marge d’erreur)` : undefined;
  const nextTask = weekly.find((t) => t.status !== 'done' && t.status !== 'skipped') ?? null;
  const tone = fixed ? 'up' : firstError ? 'down' : 'neutral';
  const measured = fmtDate(auditDate(latest), { day: 'numeric', month: 'long' });
  // LA chose à faire maintenant : corriger l'erreur d'une IA ; sinon la première tâche ouverte ; sinon vérifier.
  const doNow = fixed && follow
    ? { href: `/app/reponses?ia=${follow.provider}`, label: `Voir ce que dit ${PROVIDER_LABEL[follow.provider]} aujourd’hui`, meta: null as string | null }
    : firstError
      ? { href: fixTask ? `/app/actions?t=${encodeURIComponent(fixTask.id)}` : '/app/verite', label: fixTask ? `Corriger en ${minutes(fixTask.minutes)}` : 'Corriger', meta: 'Texte prêt à coller, revérifié à la prochaine mesure.' }
      : nextTask
        ? { href: `/app/actions?t=${encodeURIComponent(nextTask.id)}`, label: `Commencer : ${minutes(nextTask.minutes)}`, meta: nextTask.title }
        : null;

  return (
    <>
      <PageHeader
        title={dayTitle.charAt(0).toUpperCase() + dayTitle.slice(1)}
        meta={<>{business.name}, mesure du {measured}{latest.demo ? ' (démo)' : ''}</>}
        dataDate={auditDate(latest)}
      />
      <Cascade className="rp-page">
        {/* 1. La phrase de la semaine · 2. le chiffre clé et sa variation · 3. LA chose à faire */}
        <section aria-labelledby="week-h" className="ui-card lundi-hero" data-elevation="hero" data-visite="lundi-phrase">
          <div className="lundi-hero-main">
            <div className="lundi-kicker">
              {fixed ? (
                <StatusBadge tone="up">Correction faite</StatusBadge>
              ) : firstError ? (
                <StatusBadge tone="down">{errors.length > 1 ? `${errors.length} erreurs des IA` : 'Une IA se trompe'}</StatusBadge>
              ) : (
                <StatusBadge tone="brand">La phrase de la semaine</StatusBadge>
              )}
              <span className="ui-caption">Mesuré le {measured} sur {latest.providersUsed.map((p) => PROVIDER_LABEL[p]).join(', ')}</span>
            </div>
            <h2 id="week-h" className="ui-result lundi-headline rp-settle" style={{ color: tone === 'up' ? 'var(--tone-up)' : tone === 'down' ? 'var(--tone-down)' : 'var(--ink)' }}>
              {fr(fixed && follow?.headline ? follow.headline : headline)}
            </h2>
            {headlineSub && <p className="lundi-sub">{fr(fixed ? `Lors de la dernière mesure, ${headlineSub.charAt(0).toLowerCase()}${headlineSub.slice(1)}` : headlineSub)}</p>}
            {firstError && <p className="ui-small mt-2">{fr(citedLine)}</p>}
            {doNow && (
              <div className="lundi-do">
                <Link href={doNow.href} className="ui-btn" data-variant="primary" data-size="lg">
                  {doNow.label}
                  <Icon name="chevron" size={16} />
                </Link>
                {doNow.meta && <span className="lundi-do-meta min-w-0 max-w-[44ch]">{fr(doNow.meta)}</span>}
                {firstError && !fixed && (
                  <Link href="/app/verite" className="rp-link text-[14px]">
                    Voir la fiche de vérité
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="lundi-figure" data-visite="lundi-score">
            <KeyFigure
              size="xl"
              label="Score de visibilité"
              value={Math.round(latest.score)}
              unit="/100"
              delta={scoreDelta}
              deltaUnit=" pts"
              deltaLabel={previous ? `depuis le ${fmtDate(auditDate(previous), { day: 'numeric', month: 'long' })}` : undefined}
              margin={pmargin}
              trend={history.length > 1 ? history : undefined}
              trendLabel={`Évolution du score : ${history.join(', ')}`}
            />
            <Link href="/app/concurrents" className="lundi-rank" aria-label={`Votre rang : ${rank.label}. Voir les concurrents`}>
              <span className="lundi-rank-n rp-reticle">
                <span className="ui-figure-sm" style={{ color: 'var(--primary)' }}>{ordinal(rank.rank)}</span>
              </span>
              <span className="min-w-0">
                <span className="lundi-rank-t block text-[14px] font-semibold leading-snug">sur {rank.of} {business.cohort}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--muted)]">
                  {places !== 0 ? <Delta value={places} unit={Math.abs(places) > 1 ? ' places' : ' place'} label="sur un mois" /> : <span>Rang stable sur un mois</span>}
                  <span>Part de voix {pct(myShare(latest))}</span>
                </span>
              </span>
            </Link>
          </div>
          <div className="lundi-kpis lg:col-span-2">
            <KeyFigure size="sm" label="Réponses qui vous citent" value={mentioned} unit={`sur ${stats.answers}`} foot={stats.methodLabel} />
            <KeyFigure size="sm" label="Visites venues des IA, 7 jours" value={digest?.aiVisits ?? null} foot="Plancher mesuré" href="/app/trafic" />
            <div className="ui-stat">
              <span className="ui-stat-label">Exactitude</span>
              {errors.length ? (
                <Link href="/app/verite" className="mt-1 self-start">
                  <StatusBadge tone="down" size="lg">
                    {errors.length} erreur{errors.length > 1 ? 's' : ''} à corriger
                  </StatusBadge>
                </Link>
              ) : (
                <span className="mt-1 self-start">
                  <StatusBadge tone="up" size="lg">Tout est juste</StatusBadge>
                </span>
              )}
              <span className="ui-stat-foot">{latest.factCheck?.items?.length ? `${latest.factCheck.items.length} faits vérifiés` : 'Faits vérifiés à chaque mesure'}</span>
            </div>
          </div>
        </section>

        {explain && (
          <Disclosure data-visite="lundi-expliquer" title="Expliquer ce changement" summary={fr(explain.headline)} icon={<Icon name="info" size={18} />}>
            {!explain.comparable && (
              <p className="mb-2 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning-ink)]">
                Les deux mesures ne portent pas exactement sur les mêmes questions ou les mêmes IA : comparez avec prudence.
              </p>
            )}
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px]">
              {explain.sentences.map((t, i) => (
                <li key={i}>{fr(t)}</li>
              ))}
            </ul>
            {explain.warnings.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-[13px] text-[var(--muted)]">
                {explain.warnings.map((t, i) => (
                  <li key={i}>{fr(t)}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/app/copilote?context=${encodeURIComponent('Expliquer ce changement')}`} className="ui-btn" data-size="sm">
                <Icon name="spark" size={15} /> Creuser avec le copilote
              </Link>
            </div>
          </Disclosure>
        )}

        <div className="lundi-grid">
          <div className="lundi-col">
            <Surface
              id="tasks-h"
              elevation="raised"
              title="Vos 3 tâches de la semaine"
              aside={
                <>
                  <span className="rp-num">≈ {minutes(weekMin)}</span>
                  {' · '}
                  <Link href="/app/actions" className="rp-link">
                    Toutes les actions
                  </Link>
                </>
              }
            >
              {weekly.length ? (
                <WeeklyTasks initial={weekly} businessId={business.id} demo={ws.demo} />
              ) : (
                <EmptyState compact title={previous ? `${calmWord} : rien d’urgent` : 'Vos premières tâches arrivent'}>
                  {previous ? 'Votre position tient. Les prochaines tâches suivront la prochaine mesure.' : 'Elles sont préparées à partir de cette mesure.'}
                </EmptyState>
              )}
            </Surface>

            <Surface id="quotes-h" title="Ce que les IA disent de vous" aside={<Link href="/app/ia" className="rp-link">Tous les verbatims</Link>}>
              <div className="flex flex-col gap-4">
                {best && <QuoteCard q={best} emphasis="best" />}
                {toFix && <QuoteCard q={toFix} emphasis="fix" />}
                {!best && !toFix && <p className="ui-small">Aucun verbatim cette semaine.</p>}
              </div>
            </Surface>
          </div>

          <div className="lundi-col">
            <StartList businessId={business.id} signaux={signaux} demo={ws.demo} />
            <Surface id="alerts" title="Alertes" aside={alerts.length ? <span className="rp-num">{alerts.length}</span> : undefined}>
              {alerts.length ? (
                <ul className="-my-1 flex flex-col">
                  {alerts.map((a, i) => (
                    <li key={i}>
                      <Link href={a.href} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--surface-2)]">
                        <span
                          className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg"
                          style={{
                            background: `var(--tone-${a.tone === 'danger' ? 'down' : a.tone === 'warning' ? 'warn' : a.tone === 'success' ? 'up' : 'brand'}-bg)`,
                            color: `var(--tone-${a.tone === 'danger' ? 'down' : a.tone === 'warning' ? 'warn' : a.tone === 'success' ? 'up' : 'brand'})`,
                          }}
                          aria-hidden="true"
                        >
                          <Icon name={a.tone === 'danger' ? 'alert' : a.tone === 'success' ? 'arrowUp' : a.tone === 'warning' && a.title.startsWith('Vous perdez') ? 'arrowDown' : 'podium'} size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold leading-snug">{fr(a.title)}</span>
                          <span className="block text-[13px] text-[var(--muted)]">{fr(a.body)}</span>
                        </span>
                        <Icon name="chevron" size={16} className="mt-1 flex-none text-[var(--muted)]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ui-small">{previous ? `${calmWord} : aucune alerte. Votre position tient.` : 'Première mesure : les alertes (concurrent qui passe devant, rang qui bouge) arrivent dès la prochaine mesure.'}</p>
              )}
            </Surface>
            <Surface id="rank-h" title="Qui est cité autour de vous" aside={<Link href="/app/concurrents" className="rp-link">Détail</Link>}>
              <ol className="flex flex-col gap-0.5">
                {around.map((r) => {
                  const pos = rows.indexOf(r) + 1;
                  const top = Math.max(...rows.map((x) => x.share), 0.0001);
                  return (
                    <li key={r.name} className={`grid grid-cols-[28px_minmax(0,1fr)_44px] items-center gap-x-3 rounded-lg px-2 py-1.5 text-[14px] ${r.isMe ? 'rp-reticle bg-[var(--surface-me)] font-semibold' : ''}`}>
                      <span className="rp-num text-[12px] text-[var(--muted)]">{ordinal(pos)}</span>
                      <span className="min-w-0">
                        <span className="block truncate">{r.isMe ? business.name : r.name}</span>
                        <ProgressBar value={r.share} max={top} size="sm" tone={r.isMe ? 'brand' : 'neutral'} label={`Part de voix ${pct(r.share)}`} className="mt-1" />
                      </span>
                      <span className="rp-num text-right text-[13px] text-[var(--muted)]">{pct(r.share)}</span>
                    </li>
                  );
                })}
              </ol>
            </Surface>
            {notes.length > 0 && (
              <Surface id="notes-h" elevation="flat" title="Annotations récentes" aside={<Link href="/app/concurrents" className="rp-link">Sur les courbes</Link>}>
                <ul className="flex flex-col gap-2">
                  {notes.map((n) => (
                    <li key={n.id} className="flex items-start gap-3 text-[14px]">
                      <span className="rp-num w-14 flex-none pt-0.5 text-[12px] text-[var(--muted)]">{fmtDate(n.date, { day: 'numeric', month: 'short' })}</span>
                      <span className="min-w-0 flex-1">
                        {n.href ? (
                          <Link href={n.href} className="hover:underline">
                            {n.label}
                          </Link>
                        ) : (
                          n.label
                        )}
                        {n.demo ? <span className="text-[var(--muted)]"> (démo)</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </Surface>
            )}
          </div>
        </div>
        {process.env.NODE_ENV !== 'production' && ws.fb.list.length > 0 && (
          <p className="text-[11px] text-[var(--muted)]">Dev : repli démo pour {ws.fb.list.join(', ')}.</p>
        )}
      </Cascade>
    </>
  );
}
