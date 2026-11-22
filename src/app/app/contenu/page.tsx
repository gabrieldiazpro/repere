import { PageHeader } from '@/components/app/PageHeader';
import { ContentTabs, QuotaSlots, SimBand } from '@/components/app/contenu/Chrome';
import { ContentPrimary, ContentResult, Guardrails } from '@/components/app/contenu/Head';
import { DraftRows, FactsHint, OpportunityList } from '@/components/app/contenu/Overview';
import { loadContent } from '@/components/app/contenu/server';

export const metadata = { title: 'Contenus' };

export default async function ContenuPage({ searchParams }: { searchParams: Promise<{ tache?: string }> }) {
  const sp = await searchParams;
  const d = await loadContent();
  return (
    <>
      <PageHeader
        title="Contenus"
        meta={d.demo ? 'Démo simulée' : d.sources.audit ? 'D’après votre dernière mesure IA' : undefined}
        result={<ContentResult />}
        resultTone="brand"
        subtitle="L’agent repère les pages qui vous manquent, preuves à l’appui, les rédige avec vos seuls faits, puis les crée en brouillon sur votre site après votre validation."
        primary={<ContentPrimary />}
      />
      <div className="rp-page">
        <SimBand />
        <ContentTabs current="propositions" />
        {d.loadError && (
          <p role="status" className="mb-4 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning-ink)]">
            Une partie des données n’a pas pu être chargée. Rechargez la page pour réessayer.
          </p>
        )}
        {sp.tache && (
          <p role="status" className="mb-4 rounded-lg bg-[var(--primary-bg)] px-3 py-2 text-[13.5px] text-[var(--primary)]">
            Cette action du Centre d’actions se traite ici : choisissez la proposition correspondante, ou complétez vos faits clés.
          </p>
        )}
        <QuotaSlots />
        <FactsHint />
        <DraftRows />
        <OpportunityList />
        <Guardrails />
      </div>
    </>
  );
}
