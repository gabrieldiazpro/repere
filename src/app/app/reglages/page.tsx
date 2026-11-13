import Link from 'next/link';
import { Icon } from '@/components/app/icons';
import { InstallPrompt } from '@/components/app/InstallPrompt';
import { PageHeader, Panel } from '@/components/app/PageHeader';
import { AlertSettings, DigestForward, PlanChoice, ProfileForm, SignOutButton, SubscriptionActions } from '@/components/app/Settings';
import { DataPanel, GrowthPanel, HooksPanel, ReportsPanel, SharePanel, TeamPanel } from '@/components/app/shell/Reglages';
import { loadBusinessOptions, loadEntitlements, loadRole, themePref } from '@/components/app/shell/server';
import { ThemeToggle } from '@/components/app/shell/ThemeToggle';
import { Verrou } from '@/components/app/shell/Verrou';
import { engineAccess, quota } from '@/components/app/shell/verrou';
import { PROVIDER_LABEL, SEGMENT_LABEL } from '@/components/app/tokens';
import { adaptTraffic } from '@/components/app/adapters';
import { loadWorkspace } from '@/components/app/workspace';
import { connectionStatus } from '@/lib/ecommerce';
import { listPrompts } from '@/lib/prompts';
import { getBusinessRecord } from '@/lib/db';
import { getEntitlements, TIER_NAMES } from '@/lib/entitlements';
import { VAT_NOTICE } from '@/lib/plans';
import { ga4Enabled, getConnection as ga4Connection } from '@/lib/tracking/ga4';

export const metadata = { title: 'Réglages' };

const SECTIONS = [
  { id: 'compte', label: 'Compte' },
  { id: 'equipe', label: 'Équipe' },
  { id: 'offre', label: 'Offre et facturation' },
  { id: 'alertes', label: 'Alertes' },
  { id: 'rapports', label: 'Rapports planifiés' },
  { id: 'integrations', label: 'Intégrations' },
  { id: 'partage', label: 'Partage et marque blanche' },
  { id: 'croissance', label: 'Badge, carte, parrainage' },
  { id: 'donnees', label: 'Données' },
];

const FREQ_LABEL = { monthly: 'une mesure par mois', weekly: 'une mesure par semaine', daily: 'une mesure par jour' } as const;

function Meter({ label, used, max, unit }: { label: string; used: number; max: number; unit: string }) {
  const q = quota(used, max);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[14px]">
        <span>{label}</span>
        <span className="rp-num font-semibold">
          {q.used} / {q.max} <span className="font-normal text-[var(--muted)]">{unit}</span>
        </span>
      </div>
      <div className="rp-progress mt-1" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={q.max} aria-valuenow={q.used}>
        <span style={{ width: `${q.ratio * 100}%`, background: q.full ? 'var(--warning)' : undefined }} />
      </div>
    </div>
  );
}

function Status({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return <span className={`rp-chip ${ok === true ? 'rp-chip-success' : ok === false ? '' : 'rp-chip-warning'}`}>{children}</span>;
}

export default async function ReglagesPage() {
  const ws = await loadWorkspace();
  const id = ws.business.id;
  const [ent, role, theme, businesses, prompts, traffic, ga4, shopify, record] = await Promise.all([
    loadEntitlements(),
    loadRole(),
    themePref(),
    loadBusinessOptions(),
    listPrompts(id).catch(() => []),
    adaptTraffic(id, 30, ws.fb).catch(() => null),
    ws.demo ? Promise.resolve(null) : ga4Connection(id).catch(() => null),
    ws.segment === 'ecommerce' && !ws.demo ? connectionStatus(id).catch(() => null) : Promise.resolve(null),
    getBusinessRecord(id).catch(() => null),
  ]);
  // Démo : toutes les IA sont ouvertes pour la visite. Sinon : seules celles de l'offre sont cochées.
  const engines = engineAccess(ent, ws.segment, (b) => getEntitlements(b), { essentiel: TIER_NAMES.essentiel, accompagne: TIER_NAMES.accompagne });
  const paid = ent.tier === 'essentiel' || ent.tier === 'accompagne' || ent.tier === 'agence';
  const isOwner = role === 'owner';
  const isAdmin = role === 'owner' || role === 'admin';
  const activePrompts = prompts.filter((p) => p.active).length;
  const lastAuditId = ws.latest?.id ?? null;

  return (
    <>
      <PageHeader
        title="Réglages"
        meta={ws.business.name}
        result={`Offre ${ws.business.planLabel} : ${activePrompts} question${activePrompts > 1 ? 's' : ''} suivie${activePrompts > 1 ? 's' : ''} sur ${ent.prompts}`}
        subtitle={`${FREQ_LABEL[ent.frequency].charAt(0).toUpperCase()}${FREQ_LABEL[ent.frequency].slice(1)}. Alertes, intégrations, partage et données se règlent ci-dessous.`}
      />
      <div className="rp-page">
        <nav aria-label="Sections des réglages" className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rp-chip !h-8 flex-none !px-3 !text-[13px]">
              {s.label}
            </a>
          ))}
        </nav>
        <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
          <nav aria-label="Sections des réglages" className="sticky top-6 hidden lg:block">
            <ul className="flex flex-col gap-px">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-[14px] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-col gap-5">
            {ws.demo && (
              <p className="rounded-xl bg-[var(--warning-bg)] px-4 py-3 text-[14px] text-[var(--warning-ink)]">
                Compte démo : les réglages sont visibles mais rien n’est enregistré sur le serveur.{' '}
                <Link href="/inscription" className="font-semibold underline">
                  Créer mon espace
                </Link>
              </p>
            )}

            <div id="compte" className="scroll-mt-20">
              <Panel id="compte-h" title="Compte">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{ws.business.name}</p>
                      <p className="text-[13px] text-[var(--muted)]">
                        Parcours {SEGMENT_LABEL[ws.segment]}
                        {ws.business.website ? ` · ${ws.business.website.replace(/^https?:\/\//, '')}` : ' · pas de site renseigné'}
                        {!ws.demo && role !== 'demo' ? ` · votre rôle : ${{ owner: 'propriétaire', admin: 'administrateur', member: 'contributeur', viewer: 'lecteur' }[role]}` : ''}
                      </p>
                    </div>
                    <Link href="/app/bienvenue?etape=site" className="rp-btn rp-btn-sm">
                      Modifier le site
                    </Link>
                  </div>
                  <div className="border-t border-[var(--hair)] pt-3">
                    <p className="mb-2 text-[14px] font-semibold">Votre activité</p>
                    <ProfileForm
                      businessId={id}
                      segment={ws.segment}
                      trade={record?.trade ?? ''}
                      city={record?.city ?? ''}
                      district={record?.district ?? ''}
                      demo={ws.demo}
                      canEdit={ws.demo || isAdmin}
                    />
                  </div>
                  {businesses.length > 1 && <p className="text-[13px] text-[var(--muted)]">{businesses.length} commerces sur ce compte : changez de commerce depuis la barre latérale.</p>}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[14px] font-semibold">Thème</span>
                    <ThemeToggle initial={theme} variant="plain" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hair)] pt-3">
                    <span className="text-[14px] font-semibold">Installer l’app</span>
                  </div>
                  <InstallPrompt inline />
                  <div className="border-t border-[var(--hair)] pt-3">
                    {ws.demo ? (
                      <Link href="/connexion" className="rp-btn rp-btn-primary w-full sm:w-auto">
                        Se connecter
                      </Link>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[13px] text-[var(--muted)]">Connecté : {ws.userEmail}</p>
                        <div className="w-full sm:w-auto">
                          <SignOutButton />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </div>

            <div id="equipe" className="scroll-mt-20">
              <Panel id="equipe-h" title="Équipe">
                <Verrou ent={ent} feature="team" titre="Accès pour votre équipe">
                  <TeamPanel businessId={id} demo={ws.demo} />
                </Verrou>
              </Panel>
            </div>

            <div id="offre" className="scroll-mt-20">
              <Panel id="offre-h" title="Offre et facturation" aside={<Link href="/tarifs" className="rp-link">Comparer les offres</Link>}>
                <p className="text-[15px]">
                  Offre <strong className="font-semibold">{ws.business.planLabel}</strong> · {FREQ_LABEL[ent.frequency]}
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Meter label="Questions suivies" used={activePrompts} max={ent.prompts} unit="questions" />
                  <Meter label="Commerces" used={Math.max(1, businesses.length)} max={ent.brands} unit="commerces" />
                </div>
                <p className="mt-4 text-[13px] font-semibold">IA suivies</p>
                <ul className="mt-1 grid gap-1.5 sm:grid-cols-2" aria-label="IA suivies par votre offre">
                  {engines.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-2 text-[14px]">
                      <input type="checkbox" checked={x.included} disabled readOnly aria-label={`${PROVIDER_LABEL[x.id]} : ${x.included ? 'suivie' : 'non incluse'}`} className="h-4 w-4 accent-[var(--primary)]" />
                      <span className={x.included ? 'font-medium' : 'text-[var(--muted)]'}>{PROVIDER_LABEL[x.id]}</span>
                      {!x.included && (
                        <Link href="/tarifs?depuis=reglages" className="rp-chip !text-[12px]">
                          <Icon name="lock" size={12} /> {x.unlock ? `Avec ${x.unlock}` : 'Voir les tarifs'}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[12px] text-[var(--muted)]">Mistral n’est interrogé que lorsque son accès est activé sur la plateforme. Les aperçus IA de Google ne sont pas suivis : pas d’accès officiel.</p>
                <ul className="mt-4 grid gap-1.5 text-[14px] sm:grid-cols-2">
                  {[
                    ['Actions avec livrables', ent.execution],
                    ['Exports CSV', ent.exports],
                    ['Liens de partage', ent.shareLinks],
                    ['Intégrations (Slack, webhook, GA4)', ent.integrations],
                    ['Marque blanche', ent.whiteLabel],
                    [`Copilote : ${ent.copilotDaily} questions par jour`, true],
                  ].map(([label, ok]) => (
                    <li key={String(label)} className="flex items-center gap-2">
                      <Icon name={ok ? 'check' : 'lock'} size={16} className={ok ? 'text-[var(--success)]' : 'text-[var(--muted)]'} />
                      <span className={ok ? '' : 'text-[var(--muted)]'}>{label}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-[var(--hair)] pt-4">
                  <p className="mb-2 text-[13px] font-semibold">{paid ? 'Changer d’offre' : 'Passer à une offre payante'}</p>
                  {ws.demo && <p className="mb-2 text-[13px] text-[var(--muted)]">Compte démo : toutes les fonctions sont ouvertes pour la visite.</p>}
                  {!ws.demo && !paid && <p className="mb-2 text-[13px] text-[var(--muted)]">Vous êtes sur l’offre Découverte, gratuite et sans limite de durée.</p>}
                  <PlanChoice segment={ws.segment} currentTier={ws.demo ? '' : ent.tier} businessId={id} demo={ws.demo} canBuy={!paid && isOwner} />
                  {!ws.demo && paid && isOwner && <SubscriptionActions businessId={id} />}
                  {!ws.demo && paid && !isOwner && <p className="mt-2 text-[13px] text-[var(--muted)]">La facturation est gérée par le propriétaire de l’espace.</p>}
                  <p className="mt-2 text-[12px] text-[var(--muted)]">{VAT_NOTICE}.</p>
                </div>
              </Panel>
            </div>

            <div id="alertes" className="scroll-mt-20 flex flex-col gap-5">
              <AlertSettings businessId={id} demo={ws.demo} />
              <Panel id="digest-h" title="Le lundi de Repéré">
                <p className="text-[14px]">
                  Chaque lundi à 7 h 30, un e-mail lisible en 30 secondes : la phrase de la semaine, votre rang, les erreurs détectées et vos 3 actions.
                </p>
                <details className="mt-3">
                  <summary className="rp-link inline-flex items-center gap-1 text-[14px]">
                    <Icon name="chevron" size={14} className="rp-chevron" /> Aperçu de votre e-mail du lundi
                  </summary>
                  <iframe
                    title="Aperçu de l’e-mail du lundi"
                    src={`/api/digest/preview?businessId=${encodeURIComponent(id)}&format=html`}
                    className="mt-2 h-[520px] w-full rounded-lg border border-[var(--hair)] bg-white"
                    loading="lazy"
                    sandbox=""
                  />
                </details>
                <DigestForward businessId={id} demo={ws.demo} />
              </Panel>
            </div>

            <div id="rapports" className="scroll-mt-20">
              <Panel id="rapports-h" title="Rapports planifiés">
                <Verrou ent={ent} feature="shareLinks" titre="Rapports envoyés automatiquement">
                  <ReportsPanel businessId={id} demo={ws.demo} />
                </Verrou>
              </Panel>
            </div>

            <div id="integrations" className="scroll-mt-20">
              <Panel id="integrations-h" title="Intégrations">
                <ul className="mb-4 divide-y divide-[var(--hair)] rounded-xl border border-[var(--hair)]">
                  <li className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">Script de suivi du trafic</span>
                      <span className="block text-[12px] text-[var(--muted)]">Sans cookie : visites venues des IA et passages des robots.</span>
                    </span>
                    <Status ok={traffic?.installed ?? false}>{traffic?.installed ? 'Installé' : 'Pas encore reçu'}</Status>
                    <Link href="/app/trafic" className="rp-btn rp-btn-sm">
                      {traffic?.installed ? 'Voir' : 'Installer'}
                    </Link>
                  </li>
                  <li className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">WordPress</span>
                      <span className="block text-[12px] text-[var(--muted)]">Extension Repéré : script de suivi, données structurées et page FAQ servis par votre site.</span>
                    </span>
                    <Status ok={null}>Extension à installer</Status>
                    <a href="/integrations/repere-ia-wordpress.zip" className="rp-btn rp-btn-sm" download>
                      Télécharger
                    </a>
                  </li>
                  <li className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">Google Analytics 4</span>
                      <span className="block text-[12px] text-[var(--muted)]">Lecture seule : sessions venues des IA, en complément du script.</span>
                    </span>
                    {ws.demo ? (
                      <Status ok={null}>Démo</Status>
                    ) : !ga4Enabled() ? (
                      <Status ok={false}>Pas encore disponible</Status>
                    ) : ga4?.connected ? (
                      <Status ok>{ga4.propertyId ? 'Connecté' : 'Propriété à choisir'}</Status>
                    ) : (
                      <Status ok={false}>Non connecté</Status>
                    )}
                    {ent.integrations && !ws.demo && ga4Enabled() && isAdmin && (
                      <Link href="/app/trafic#ga4" className="rp-btn rp-btn-sm">
                        {ga4?.connected ? 'Gérer' : 'Connecter'}
                      </Link>
                    )}
                  </li>
                  {ws.segment === 'ecommerce' && (
                    <li className="flex flex-wrap items-center gap-3 px-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold">Shopify</span>
                        <span className="block text-[12px] text-[var(--muted)]">Commandes et chiffre d’affaires venus des IA, catalogue produits.</span>
                      </span>
                      {ws.demo ? (
                        <Status ok={null}>Démo</Status>
                      ) : !shopify?.enabled ? (
                        <Status ok={false}>Pas encore disponible</Status>
                      ) : shopify.connected ? (
                        <Status ok>Connecté · {shopify.shop}</Status>
                      ) : (
                        <Status ok={false}>Non connecté</Status>
                      )}
                      {ent.integrations && !ws.demo && shopify?.enabled && isAdmin && (
                        <Link href="/app/produits/ventes" className="rp-btn rp-btn-sm">
                          {shopify.connected ? 'Gérer' : 'Connecter'}
                        </Link>
                      )}
                    </li>
                  )}
                </ul>
                <p className="mb-2 text-[14px] font-semibold">Slack et webhook</p>
                <Verrou ent={ent} feature="integrations" titre="Slack et webhook">
                  {isAdmin || ws.demo ? (
                    <HooksPanel businessId={id} demo={ws.demo} />
                  ) : (
                    <p className="text-[13px] text-[var(--muted)]">Réservé aux administrateurs de l’espace.</p>
                  )}
                </Verrou>
              </Panel>
            </div>

            <div id="partage" className="scroll-mt-20">
              <Panel id="partage-h" title="Partage et marque blanche">
                <Verrou ent={ent} feature="shareLinks" titre="Liens de partage">
                  <SharePanel businessId={id} demo={ws.demo} whiteLabel={ent.whiteLabel} />
                </Verrou>
                {!ent.whiteLabel && ent.shareLinks && (
                  <div className="mt-3">
                    <Verrou ent={ent} feature="whiteLabel" titre="Marque blanche" compact />
                  </div>
                )}
              </Panel>
            </div>

            <div id="croissance" className="scroll-mt-20">
              <Panel id="croissance-h" title="Badge, carte, classement, parrainage">
                <GrowthPanel businessId={id} demo={ws.demo} auditId={lastAuditId} />
              </Panel>
            </div>

            <div id="donnees" className="scroll-mt-20">
              <Panel id="donnees-h" title="Données">
                <DataPanel businessId={id} businessName={ws.business.name} demo={ws.demo} isOwner={isOwner} />
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
