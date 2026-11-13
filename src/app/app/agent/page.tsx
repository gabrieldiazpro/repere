import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app/PageHeader';
import { AgentPrimary, AgentResult, AgentTabs, SimBand } from '@/components/app/agent/Chrome';
import { AgentFlow, ProposalList } from '@/components/app/agent/ProposalList';
import { blockers, PLATFORM_NAME } from '@/components/app/agent/model';
import { loadAgent } from '@/components/app/agent/server';

export const metadata = { title: 'Agent' };

const CS_RE = /^cs_[A-Za-z0-9_-]{6,30}$/;

export default async function AgentPage({ searchParams }: { searchParams: Promise<{ cs?: string; tache?: string }> }) {
  const sp = await searchParams;
  // Repère « Publié : … » des courbes → la proposition concernée.
  if (sp.cs && CS_RE.test(sp.cs)) redirect(`/app/agent/${sp.cs}`);
  const d = await loadAgent();
  const waiting = d.changeSets.filter((c) => c.status === 'proposed');
  const validated = d.changeSets.filter((c) => c.status === 'validated');
  const taskCs = sp.tache ? d.taskLinks[sp.tache] : undefined;
  const incomplete = waiting.filter((c) => blockers(c).length).length;

  const connected = d.connections.filter((c) => c.lastTest?.ok);

  return (
    <>
      <PageHeader
        title="Agent"
        meta={d.demo ? 'Démo simulée' : connected.length ? `Connecté à ${connected.map((c) => PLATFORM_NAME[c.platform]).join(', ')}` : 'Aucune plateforme connectée'}
        result={<AgentResult fallback="L’agent attend la prochaine analyse de votre site" />}
        resultTone={waiting.length || validated.length ? 'warn' : 'brand'}
        subtitle={
          <>
            L’agent prépare les corrections, vous les validez, il les applique puis vérifie qu’elles sont en ligne. Tout est
            journalisé et peut être annulé.
            {incomplete ? ` ${incomplete} proposition${incomplete > 1 ? 's demandent' : ' demande'} une information que vous seul connaissez.` : ''}
          </>
        }
        primary={<AgentPrimary />}
      />
      <div className="rp-page">
        <SimBand />
        <AgentTabs current="propositions" />
        {d.loadError && (
          <p role="status" className="mb-4 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning-ink)]">
            Une partie des données de l’agent n’a pas pu être chargée. Rechargez la page pour réessayer.
          </p>
        )}
        {sp.tache && (
          <p role="status" className="mb-4 rounded-lg bg-[var(--primary-bg)] px-3 py-2 text-[13.5px] text-[var(--primary)]">
            {taskCs
              ? 'L’agent a déjà préparé cette action : elle est surlignée ci-dessous.'
              : 'L’agent prépare cette action à la prochaine analyse de votre site. Elle apparaîtra ici, à valider.'}
          </p>
        )}
        <AgentFlow />
        {!d.demo && !connected.length && (
          <div className="ui-card mb-5" data-tone="brand">
            <div className="ui-card-body flex flex-wrap items-center gap-3">
              <p className="m-0 min-w-0 flex-1 text-[14.5px]">
                <b>Sans connexion, l’agent prépare des fichiers à déposer vous-même.</b> Connectez WordPress, Shopify, Webflow ou
                PrestaShop pour qu’il applique les corrections validées.
              </p>
              <Link className="ui-btn" href="/app/agent/connexions">
                Connecter mon site
              </Link>
            </div>
          </div>
        )}
        <ProposalList highlight={taskCs ?? null} />
      </div>
    </>
  );
}
