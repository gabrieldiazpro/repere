import Link from 'next/link';
import './_parts/scenarios.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Icon } from '@/components/app/icons';
import { Surface } from '@/components/ui/Surface';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CrawlButton } from '@/components/app/seo/controls';
import { nextCrawlAllowed } from '@/components/app/seo/model';
import { HONESTY, METHOD, type SectionDelta } from '@/lib/scenarios';
import { loadFollowUps, loadScenarioContext, loadScenarioPage, type FollowView } from './_parts/data';
import { ScenarioBoard } from './_parts/ScenarioBoard';

export const metadata = { title: 'Scénarios' };
export const maxDuration = 60;

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
const sign = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '=');

function Honesty() {
  return (
    <div className="scn-honest" role="note">
      <span className="scn-honest-i" aria-hidden="true">i</span>
      <div>
        <p>{HONESTY}</p>
        <p>{METHOD} Aucun chiffre de trafic ni de chiffre d’affaires n’est estimé.</p>
      </div>
    </div>
  );
}

function Follow({ items }: { items: FollowView[] }) {
  if (!items.length)
    return (
      <EmptyState title="Aucun scénario lancé pour l’instant" compact>
        Après le lancement, la prochaine exploration de votre site comparera ce qui était prévu à ce qui est mesuré.
      </EmptyState>
    );
  return (
    <ul className="scn-follow m-0 list-none p-0">
      {items.map(({ launch, follow }) => {
        const done = follow.findings.filter((f) => f.measuredResolved).length;
        return (
          <li key={launch.id} className="scn-follow">
            <p className="m-0 font-semibold">
              {launch.demo && <StatusBadge tone="brand">Démo</StatusBadge>} {launch.title}
              <span className="ui-caption"> · lancé le {fmtDay(launch.at)}</span>
            </p>
            <div className="scn-pvm">
              <div className="scn-pvm-box">
                <span>Prévu par la simulation</span>
                <b>Google {follow.predicted.seo} · IA {follow.predicted.geo}</b>
                <span>depuis Google {launch.before.seo} · IA {launch.before.geo}</span>
              </div>
              <div className="scn-pvm-box">
                <span>{follow.status === 'measured' ? `Mesuré le ${fmtDay(follow.measuredAt!)}` : 'Mesuré'}</span>
                {follow.measured ? (
                  <>
                    <b>Google {follow.measured.seo} · IA {follow.measured.geo}</b>
                    <span>écart avec le prévu : Google {sign(follow.measured.seo - follow.predicted.seo)} · IA {sign(follow.measured.geo - follow.predicted.geo)}</span>
                  </>
                ) : (
                  <>
                    <b>En attente</b>
                    <span>de la prochaine exploration</span>
                  </>
                )}
              </div>
            </div>
            {follow.status === 'measured' && (
              <p className="ui-small m-0">
                {done} correction(s) sur {follow.findings.length} réglée(s) selon la nouvelle exploration. D’autres changements du site entre les deux explorations peuvent expliquer un écart.
              </p>
            )}
            <ul className="scn-list">
              {follow.findings.slice(0, 8).map((f) => (
                <li key={f.key} className="scn-plain">
                  {f.title}
                  <small>
                    Prévu : {f.predictedResolved ? 'réglé' : 'amélioré ou inchangé'} · Mesuré : {f.measuredResolved === null ? 'en attente' : f.measuredResolved ? <span className="scn-ok">réglé</span> : 'encore présent'}
                  </small>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

export default async function ScenariosPage() {
  const c = await loadScenarioContext();
  const { suite, latest } = c;
  const demo = suite.demo;
  const next = demo ? null : nextCrawlAllowed(suite.rights, suite.runs.filter((r) => r.trigger === 'manual').map((r) => r.at));
  const crawlBtn = <CrawlButton demo={demo} allowed={!next} rightsLabel={suite.rights.label} nextAt={next?.toISOString()} primary />;

  if (c.state.kind !== 'ready' || !c.base || !latest) {
    return (
      <>
        <PageHeader title="Scénarios" meta={<>Et si je corrigeais ces points ?{demo ? ' (démo)' : ''}</>} result="Simulez l’effet de vos corrections sur nos contrôles" subtitle={HONESTY} />
        <div className="rp-page scn-stack">
          <Surface title="Il faut d’abord une exploration de votre site" id="scn-empty" elevation="hero">
            <EmptyState title={c.state.kind === 'no_run' ? 'Votre site n’a pas encore été exploré' : 'Exploration à relancer'} icon={<Icon name="search" />} action={crawlBtn}>
              {c.state.kind === 'no_snapshot' ? c.state.reason : 'Repéré simule les corrections sur votre dernière exploration réelle : lancez-en une depuis « SEO et GEO ».'}
            </EmptyState>
          </Surface>
          <Honesty />
        </div>
      </>
    );
  }

  const [page, follow] = await Promise.all([loadScenarioPage(), loadFollowUps()]);
  const scenarios = page?.scenarios ?? [];
  const best = [...scenarios].filter((s) => s.keys.length).sort((a, b) => b.result.after.seo + b.result.after.geo - (a.result.after.seo + a.result.after.geo))[0];
  const result = best
    ? `« ${best.title} » : contrôles Google ${best.result.before.seo} → ${best.result.after.seo}, contrôles IA ${best.result.before.geo} → ${best.result.after.geo}`
    : 'Aucune correction simulable sur votre dernière exploration';
  const base: SectionDelta[] = scenarios[0]?.result.sections.map((s) => ({ ...s, after: s.before })) ?? [];
  const ranked = page?.ranked ?? [];
  const simulable = ranked.filter((r) => !r.unsimulable).length;

  return (
    <>
      <PageHeader
        title="Scénarios"
        meta={<>D’après l’exploration du {fmtDay(latest.at)}{demo ? ' (démo, site fictif)' : ''}</>}
        result={result}
        resultTone="neutral"
        subtitle={`${ranked.length} corrections possibles, dont ${simulable} rejouées exactement sur votre exploration. Les chiffres sont des scores de contrôles, pas des prévisions.`}
        secondary={
          <Link className="ui-btn" href="/app/seo">
            SEO et GEO
          </Link>
        }
      />
      <div className="rp-page scn-stack">
        <Honesty />
        {!c.consistent && (
          <p role="status" className="rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning-ink)]">
            Recalculés aujourd’hui, vos scores de départ sont Google {c.base.seo.score} et IA {c.base.geo.score} (contre {latest.seo.score} et {latest.geo.score} lors de l’exploration) : vos informations ont changé depuis. Les scénarios partent des scores recalculés.
          </p>
        )}
        <ScenarioBoard scenarios={scenarios} ranked={ranked} base={base} demo={demo} />
        <Surface title="Prévu vs mesuré" id="scn-follow" aside={<span>à chaque nouvelle exploration</span>}>
          <Follow items={follow} />
        </Surface>
      </div>
    </>
  );
}
