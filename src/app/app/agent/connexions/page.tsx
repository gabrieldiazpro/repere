import { PageHeader } from '@/components/app/PageHeader';
import { AgentTabs, SimBand } from '@/components/app/agent/Chrome';
import { Connections } from '@/components/app/agent/Connections';
import { PLATFORM_NAME } from '@/components/app/agent/model';
import { loadAgent } from '@/components/app/agent/server';

export const metadata = { title: 'Connexions de l’agent' };

export default async function AgentConnectionsPage() {
  const d = await loadAgent();
  const ok = d.connections.filter((c) => c.lastTest?.ok);
  const ko = d.connections.filter((c) => c.lastTest && !c.lastTest.ok);
  return (
    <>
      <PageHeader
        title="Agent"
        meta="Connexions"
        result={ko.length ? `La connexion à ${PLATFORM_NAME[ko[0].platform]} ne répond plus` : ok.length ? `Connecté à ${ok.map((c) => PLATFORM_NAME[c.platform]).join(' et ')}` : 'Aucune plateforme connectée'}
        resultTone={ko.length ? 'down' : ok.length ? 'up' : 'warn'}
        subtitle="Connecté, l’agent applique lui-même les corrections que vous validez. Sans connexion, il prépare des fichiers à déposer."
      />
      <div className="rp-page">
        <SimBand />
        <AgentTabs current="connexions" />
        <Connections gbpAvailable={d.platforms.find((p) => p.id === 'gbp')?.available ?? false} />
      </div>
    </>
  );
}
