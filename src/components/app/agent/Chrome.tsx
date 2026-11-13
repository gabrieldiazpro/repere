'use client';
// Bandeau de simulation (démo) + onglets de l'agent (liens), communs à tous les écrans /app/agent/**.
import Link from 'next/link';
import { Tabs } from '@/components/ui/Tabs';
import { useAgent } from './state';

export type AgentTab = 'propositions' | 'journal' | 'connexions' | 'reglages';

export function SimBand() {
  const a = useAgent();
  if (!a.demo) return null;
  return (
    <div className="ag-sim" role="note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 4 21 19.5H3z" />
        <path d="M12 10v4.5M12 17.2v.3" />
      </svg>
      <p className="m-0 min-w-0 flex-1">
        <b>Démo simulée.</b> Le site, les valeurs et les mesures sont des exemples. Ce que vous validez ou appliquez ici reste dans
        votre navigateur : rien n’est envoyé à un site.
        {a.simulated && (
          <>
            {' '}
            <button type="button" className="underline underline-offset-2" onClick={a.resetSimulation}>
              Remettre la démo à zéro
            </button>
          </>
        )}
      </p>
    </div>
  );
}

export function AgentTabs({ current }: { current: AgentTab }) {
  const a = useAgent();
  const todo = a.changeSets.filter((c) => c.status === 'proposed' || c.status === 'validated').length;
  return (
    <Tabs
      label="Sections de l’agent"
      value={current}
      idBase="agent"
      className="mb-5"
      items={[
        { id: 'propositions', label: 'Propositions', count: todo || undefined, href: '/app/agent' },
        { id: 'journal', label: 'Journal', href: '/app/agent/journal' },
        { id: 'connexions', label: 'Connexions', count: a.connections.length || undefined, href: '/app/agent/connexions' },
        { id: 'reglages', label: 'Réglages', href: '/app/agent/reglages' },
      ]}
    />
  );
}

/** Titre-résultat de l'écran Propositions, recalculé après chaque validation (y compris simulée). */
export function AgentResult({ fallback }: { fallback: string }) {
  const a = useAgent();
  const waiting = a.changeSets.filter((c) => c.status === 'proposed').length;
  const validated = a.changeSets.filter((c) => c.status === 'validated').length;
  const s = (n: number) => (n > 1 ? 's' : '');
  if (waiting) return <>{`${waiting} correction${s(waiting)} attend${waiting > 1 ? 'ent' : ''} votre accord`}</>;
  if (validated) return <>{`${validated} correction${s(validated)} validée${s(validated)}, prête${s(validated)} à appliquer`}</>;
  return <>{a.changeSets.length ? 'Rien à valider : l’agent surveille votre site' : fallback}</>;
}

export function AgentPrimary() {
  const a = useAgent();
  const first = a.changeSets.find((c) => c.status === 'proposed') ?? a.changeSets.find((c) => c.status === 'validated');
  if (!first) return null;
  return (
    <Link className="ui-btn" data-variant="primary" href={`/app/agent/${first.id}`}>
      {first.status === 'validated' ? 'Appliquer la correction validée' : 'Relire la première proposition'}
    </Link>
  );
}
