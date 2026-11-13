import { PageHeader } from '@/components/app/PageHeader';
import { AgentTabs, SimBand } from '@/components/app/agent/Chrome';
import { JournalView } from '@/components/app/agent/JournalView';
import { loadAgent } from '@/components/app/agent/server';

export const metadata = { title: 'Journal de l’agent' };

export default async function AgentJournalPage() {
  const d = await loadAgent();
  const writes = d.journal.filter((e) => e.action === 'change.applied').length;
  const reverts = d.journal.filter((e) => e.action === 'reverted').length;
  return (
    <>
      <PageHeader
        title="Agent"
        meta="Journal"
        result={writes ? `${writes} écriture${writes > 1 ? 's' : ''} sur votre site, ${reverts} annulation${reverts > 1 ? 's' : ''}` : 'Aucune écriture sur votre site pour l’instant'}
        resultTone="brand"
        subtitle="Qui a fait quoi, et quand. Chaque changement en ligne peut être annulé : l’agent remet la valeur d’avant."
      />
      <div className="rp-page">
        <SimBand />
        <AgentTabs current="journal" />
        <JournalView />
      </div>
    </>
  );
}
