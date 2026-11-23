import { PageHeader } from '@/components/app/PageHeader';
import { AgentTabs, SimBand } from '@/components/app/agent/Chrome';
import { Pilote } from '@/components/app/agent/Pilote';
import { loadPilote } from '@/components/app/agent/pilote-server';

export const metadata = { title: 'Pilote automatique' };

/** V10 (PILOTE-AUTO) : tout fait pour vous, sans rendez-vous, dans le cadre d'un mandat écrit et révocable. */
export default async function PilotePage() {
  const d = await loadPilote();
  const now = Date.now();
  const week = d.state.series.filter((s) => now - Date.parse(s.appliedAt) <= 7 * 86_400_000 && s.status !== 'failed').length;
  const review = d.state.contents.filter((c) => c.status === 'scheduled').length;
  const live = d.mandate && d.mandate.status !== 'revoked' ? d.mandate : null;
  const result = !d.offer
    ? 'Le pilote automatique fait le travail pour vous, sans rendez-vous'
    : !live
      ? 'Votre pilote automatique démarre en 3 étapes'
      : live.status === 'paused'
        ? 'Pilote en pause : rien n’est fait sur votre site'
        : week || review
          ? `${week} série${week > 1 ? 's' : ''} faite${week > 1 ? 's' : ''} cette semaine${review ? `, ${review} contenu${review > 1 ? 's' : ''} en relecture` : ''}`
          : 'Pilote actif : il passe après chaque analyse de votre site';
  return (
    <>
      <PageHeader
        title="Agent"
        meta={d.demo ? 'Pilote automatique · démo simulée, entreprise fictive' : 'Pilote automatique'}
        result={result}
        resultTone={live?.status === 'paused' ? 'warn' : live ? 'up' : 'brand'}
        subtitle="Vous donnez votre accord une fois, par écrit, catégorie par catégorie. Repéré applique, vous prévient après coup, et chaque action s’annule en un clic."
      />
      <div className="rp-page">
        <SimBand />
        <AgentTabs current="pilote" />
        {d.loadError && (
          <p role="status" className="mb-4 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning-ink)]">
            Une partie des données du pilote n’a pas pu être chargée. Rechargez la page pour réessayer.
          </p>
        )}
        <div className="max-w-[860px]">
          <Pilote data={d} now={now} />
        </div>
      </div>
    </>
  );
}
