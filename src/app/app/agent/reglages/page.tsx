import { PageHeader } from '@/components/app/PageHeader';
import { AgentTabs, SimBand } from '@/components/app/agent/Chrome';
import { SettingsForm } from '@/components/app/agent/SettingsForm';
import { SETTINGS_KINDS } from '@/components/app/agent/model';
import { loadAgent } from '@/components/app/agent/server';

export const metadata = { title: 'Réglages de l’agent' };

export default async function AgentSettingsPage() {
  const d = await loadAgent();
  const total = SETTINGS_KINDS.flatMap((g) => g.kinds).length;
  return (
    <>
      <PageHeader
        title="Agent"
        meta="Réglages"
        result={`L’agent peut proposer ${d.settings.kinds.length} types de corrections sur ${total}`}
        resultTone="brand"
        subtitle="Choisissez ce qu’il a le droit de vous proposer et quand. Rien n’est jamais appliqué sans votre validation."
      />
      <div className="rp-page">
        <SimBand />
        <AgentTabs current="reglages" />
        <div className="max-w-[760px]">
          <SettingsForm />
        </div>
      </div>
    </>
  );
}
