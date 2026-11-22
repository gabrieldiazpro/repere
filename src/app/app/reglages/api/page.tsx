import Link from 'next/link';
import { PageHeader, Panel } from '@/components/app/PageHeader';
import { loadEntitlements, loadRole } from '@/components/app/shell/server';
import { loadWorkspace } from '@/components/app/workspace';
import { getSession } from '@/lib/auth';
import { TIER_NAMES } from '@/lib/entitlements';
import { agencyContextFor } from '@/lib/agency/load';
import { apiAllowed } from '@/lib/publicapi/access';
import { DEMO_API_KEY, listApiKeys, type ApiKeyView } from '@/lib/publicapi/keys';
import { LIMITS, usageFor } from '@/lib/publicapi/usage';
import { KeyManager, type KeyRow } from './KeyManager';

export const metadata = { title: 'API et MCP' };
export const dynamic = 'force-dynamic';

async function withUsage(keys: ApiKeyView[]): Promise<KeyRow[]> {
  const out: KeyRow[] = [];
  for (const k of keys) {
    const u = await usageFor(k.id).catch(() => ({ keyId: k.id, days: [], total30: 0, recent: [] }));
    out.push({ ...k, usage: { total30: u.total30, recent: u.recent, days: u.days } });
  }
  return out;
}

function Code({ children }: { children: string }) {
  return <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-2,rgba(127,127,127,.12))] p-3 font-mono text-[12.5px] leading-relaxed">{children}</pre>;
}

export default async function ReglagesApiPage() {
  const ws = await loadWorkspace();
  const [ent, role] = await Promise.all([loadEntitlements(), loadRole()]);
  const isAdmin = role === 'owner' || role === 'admin';
  const allowed = apiAllowed(ent);
  const session = ws.demo ? null : await getSession().catch(() => null);
  const agency = session ? await agencyContextFor(session).catch(() => null) : null;
  const canSpace = !ws.demo && isAdmin && allowed;
  const canAgency = !ws.demo && !!agency;
  const spaceKeys = canSpace || (!ws.demo && isAdmin) ? await withUsage(await listApiKeys({ kind: 'space', businessId: ws.business.id }).catch(() => [])) : [];
  const agencyKeys = canAgency && session ? await withUsage(await listApiKeys({ kind: 'agency', userId: session.userId }).catch(() => [])) : null;

  return (
    <>
      <PageHeader title="API et MCP" back={{ href: '/app/reglages', label: 'Réglages' }} meta={ws.demo ? 'Démo : lecture seule' : `Offre ${TIER_NAMES[ent.tier]}`} />
      <div className="rp-page flex flex-col gap-5">
        <Panel title="Brancher Repéré sur vos outils" id="api-intro">
          <p className="text-[15px]">
            L’API REST et le serveur MCP donnent accès en lecture aux scores (IA, SEO, GEO) et à leur historique, aux questions suivies et aux réponses des IA avec leurs marges, aux
            concurrents, aux sources, aux constats, aux propositions de l’agent et aux rapports. Une clé « lecture et écriture » peut aussi ajouter ou supprimer une question suivie et
            demander une nouvelle mesure, dans les limites de votre offre.
          </p>
          <p className="mt-2 text-[14px] text-[var(--muted)]">
            La validation des propositions de l’agent n’est pas possible par l’API : elle reste humaine, dans l’app. Limites : {LIMITS.readPerMinute} lectures et {LIMITS.writePerMinute}{' '}
            écritures par minute, {LIMITS.perDay.toLocaleString('fr-FR')} appels par jour et par clé.{' '}
            <Link href="/developpeurs" className="underline">
              Documentation et exemples
            </Link>
          </p>
        </Panel>

        {ws.demo ? (
          <Panel title="Clé de démonstration" id="api-demo" aside="Lecture seule · données fictives">
            <p className="text-[14px]">
              Cette clé publique lit uniquement les trois comptes démo (Plomberie Martin, Paysia, Maison Sora), dont toutes les données sont fictives. Elle ne peut rien modifier.
            </p>
            <Code>{DEMO_API_KEY}</Code>
            <Code>{`curl -H "Authorization: Bearer ${DEMO_API_KEY}" \\\n  https://<votre-app>/api/public/v1/spaces`}</Code>
            <p className="mt-2 text-[14px] text-[var(--muted)]">Sur votre compte (offres Accompagné et Agence), vous créez ici vos propres clés, affichées une seule fois et révocables.</p>
          </Panel>
        ) : !allowed && !agency ? (
          <Panel title="Clés d’API" id="api-keys">
            <p className="text-[15px]">L’API publique et le serveur MCP sont inclus dans les offres Accompagné et Agence. Votre offre actuelle : {TIER_NAMES[ent.tier]}.</p>
            <p className="mt-3">
              <Link href="/app/reglages#offre" className="rp-btn rp-btn-primary">
                Voir les offres
              </Link>
            </p>
            {spaceKeys.length > 0 && <KeyManager spaceKeys={spaceKeys} agencyKeys={null} canSpace={false} canAgency={false} spaceName={ws.business.name} />}
          </Panel>
        ) : !isAdmin && !agency ? (
          <Panel title="Clés d’API" id="api-keys">
            <p className="text-[15px]">Seuls le propriétaire et les administrateurs de l’espace créent et révoquent les clés d’API.</p>
          </Panel>
        ) : (
          <Panel title="Clés d’API" id="api-keys" aside={`${LIMITS.readPerMinute} lectures / min`}>
            <p className="mb-4 text-[14px] text-[var(--muted)]">
              Chaque clé n’est affichée qu’une fois, à sa création ; nous n’en gardons qu’une empreinte. Une clé d’espace lit cet espace seulement
              {agency ? ' ; une clé d’agence lit tous vos espaces clients en offre Agence (y compris ceux ajoutés plus tard)' : ''}. Si vous perdez votre rôle d’administrateur, vos clés
              cessent de fonctionner.
            </p>
            <KeyManager spaceKeys={spaceKeys} agencyKeys={agencyKeys} canSpace={canSpace} canAgency={canAgency} spaceName={ws.business.name} />
          </Panel>
        )}

        <Panel title="Serveur MCP (Claude, ChatGPT, vos agents)" id="api-mcp">
          <p className="text-[14px]">
            Adresse : <code className="font-mono">/api/mcp</code> (transport HTTP « Streamable »), en-tête <code className="font-mono">Authorization: Bearer &lt;clé&gt;</code>. Outils en
            lecture : lister_espaces, scores, questions_reponses, priorites, concurrents.
          </p>
          <p className="mt-2 text-[14px] text-[var(--muted)]">
            <Link href="/developpeurs#mcp" className="underline">
              Configuration pas à pas
            </Link>
          </p>
        </Panel>

        <Panel title="Webhooks" id="api-webhooks">
          <p className="text-[14px]">
            Nouvelle mesure, score en baisse au-delà de la marge, proposition de l’agent à valider : ces événements partent vers vos webhooks signés, à configurer dans{' '}
            <Link href="/app/reglages#integrations" className="underline">
              Réglages › Intégrations
            </Link>{' '}
            (cochez les événements voulus).
          </p>
        </Panel>
      </div>
    </>
  );
}
