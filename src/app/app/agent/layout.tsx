// Agent de publication (V5) : données chargées une fois pour toutes les sections, état partagé côté navigateur.
import '@/components/app/agent/agent.css';
import { loadAgent } from '@/components/app/agent/server';
import { AgentProvider } from '@/components/app/agent/state';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const d = await loadAgent();
  return (
    <AgentProvider
      initial={{
        businessId: d.businessId,
        demo: d.demo,
        role: d.role,
        meId: d.meId,
        changeSets: d.changeSets,
        journal: d.journal,
        connections: d.connections,
        effects: d.effects,
        settings: d.settings,
      }}
    >
      {children}
    </AgentProvider>
  );
}
