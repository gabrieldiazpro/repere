/**
 * Agent de publication automatique (RACCORDS-FINAUX, 13 nov. 2026) : après chaque exploration ou analyse d'un compte
 * RÉEL, transforme les constats corrigeables (`Finding.autoFix`, ou type déduit de l'identifiant) en brouillons de
 * ChangeSets, selon les réglages du client (`publish.agent_settings` : types autorisés, rythme, notification).
 *
 * Garanties :
 * - JAMAIS d'application : seuls des brouillons sont créés (statut `draft`), puis éventuellement « proposés » (lecture
 *   de l'état réel du site, sans écriture). La validation explicite du client reste obligatoire (service.ts).
 * - Comptes démo : rien (lecture seule).
 * - Rythme : `manual` = jamais automatiquement ; `weekly` / `monthly` = au plus une passe automatique par période.
 * - Désactivable : PUBLISH_AGENT_AUTO=0 coupe toutes les passes automatiques.
 * - Pas de doublon : un constat déjà traité par un ChangeSet ouvert n'est pas recréé (createChangeSets).
 */
import { isDemoBusinessId } from '@/lib/demo-v2';
import { log } from '@/lib/log';
import { getDoc, putDoc } from '@/lib/store';
import type { SiteCrawl } from '@/lib/crawl/types';
import { sanitizeSettings, type AgentSettings } from '@/components/app/agent/model';
import { expandAutoFix } from './autofix';
import { inferKind, siteFromCrawl, type PlanSite } from './planner';
import type { Actor, ChangeKind, Finding } from './types';

export const AGENT_SETTINGS_COLLECTION = 'publish.agent_settings';
export const AGENT_RUNS_COLLECTION = 'publish.agent_runs';
/** Constats traités par passe automatique (les plus utiles d'abord) : le client n'est pas noyé de propositions. */
export const AGENT_MAX_FINDINGS = 8;

const DAY = 86_400_000;
const MIN_INTERVAL: Record<'weekly' | 'monthly', number> = { weekly: 6 * DAY, monthly: 27 * DAY };
const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const AGENT_ACTOR: Actor = { id: 'agent', role: 'system' };

export interface AgentRunState {
  lastAutoAt: string;
  lastCreated: number;
  trigger: string;
}

export type AgentRunResult =
  | { status: 'created'; created: number; changeSetIds: string[]; proposed: number; notified: 'email' | 'app' | 'off' | 'none' }
  | { status: 'skipped'; reason: 'disabled' | 'demo' | 'manual' | 'not_due' | 'nothing' };

export function agentAutoEnabled(): boolean {
  return process.env.PUBLISH_AGENT_AUTO !== '0';
}

/** Types de modification d'un constat (autoFix normalisé, sinon déduit de l'identifiant). */
export function kindsOf(f: Finding): ChangeKind[] {
  const ex = expandAutoFix(f);
  if (ex && ex.length) return [...new Set(ex.map((e) => e.kind))];
  if (!f.autoFix) return [];
  const k = inferKind(f);
  return k ? [k] : [];
}

/** Constats éligibles : corrigeables, de types autorisés par le client, triés par utilité, plafonnés. */
export function eligibleFindings(findings: Finding[], settings: Pick<AgentSettings, 'kinds'>, max = AGENT_MAX_FINDINGS): Finding[] {
  const allowed = new Set<string>(settings.kinds);
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of findings) {
    if (!f || seen.has(f.id)) continue;
    seen.add(f.id);
    const kinds = kindsOf(f);
    if (!kinds.length || !kinds.every((k) => allowed.has(k))) continue;
    out.push(f);
  }
  return out
    .sort((a, b) => b.impact - a.impact || (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) || a.effort - b.effort)
    .slice(0, max);
}

/** Passe due selon le rythme choisi ? */
export function agentRunDue(frequency: AgentSettings['frequency'], lastAutoAt: string | null | undefined, now: Date): boolean {
  if (frequency === 'manual') return false;
  if (!lastAutoAt) return true;
  const t = Date.parse(lastAutoAt);
  return !Number.isFinite(t) || now.getTime() - t >= MIN_INTERVAL[frequency];
}

export interface AgentRunInput {
  findings: Finding[];
  /** exploration complète (HTML compris) : base factuelle des textes proposés */
  crawl?: SiteCrawl;
  site?: PlanSite;
  name?: string;
  city?: string;
  trigger: 'crawl' | 'analysis' | 'scheduled';
  now?: Date;
  /** injection (tests) */
  deps?: Partial<AgentDeps>;
}

export interface AgentDeps {
  createChangeSets: typeof import('./service').createChangeSets;
  proposeChangeSet: typeof import('./service').proposeChangeSet;
  listChangeSets: typeof import('./service').listChangeSets;
  notify: (businessId: string, n: { type: 'agent_proposals'; title: string; body: string; href: string; dedupeKey: string }, channel: 'email' | 'app') => Promise<void>;
}

async function defaultDeps(): Promise<AgentDeps> {
  const svc = await import('./service');
  return {
    createChangeSets: svc.createChangeSets,
    proposeChangeSet: svc.proposeChangeSet,
    listChangeSets: svc.listChangeSets,
    async notify(businessId, n, channel) {
      const m = await import('@/lib/notify');
      // « email » : canal complet (centre + e-mail selon les préférences d'alerte) ; « app » : centre seulement.
      if (channel === 'email') await m.notify(businessId, n);
      else await m.addNotification(businessId, n);
    },
  };
}

/**
 * Lance une passe de l'agent pour un espace. Ne lève jamais (journalise) : appelée après une exploration ou une
 * analyse, elle ne doit pas faire échouer celles-ci.
 */
export async function runPublishAgent(businessId: string, input: AgentRunInput): Promise<AgentRunResult> {
  const now = input.now ?? new Date();
  if (!agentAutoEnabled()) return { status: 'skipped', reason: 'disabled' };
  if (isDemoBusinessId(businessId)) return { status: 'skipped', reason: 'demo' };
  try {
    const settings = sanitizeSettings((await getDoc<AgentSettings>(AGENT_SETTINGS_COLLECTION, businessId).catch(() => null))?.data);
    if (settings.frequency === 'manual') return { status: 'skipped', reason: 'manual' };
    const state = (await getDoc<AgentRunState>(AGENT_RUNS_COLLECTION, businessId).catch(() => null))?.data;
    if (!agentRunDue(settings.frequency, state?.lastAutoAt, now)) return { status: 'skipped', reason: 'not_due' };
    const findings = eligibleFindings(input.findings, settings);
    const site = input.site ?? (input.crawl ? siteFromCrawl(input.crawl, { businessId, name: input.name, city: input.city }) : null);
    if (!findings.length || !site) return { status: 'skipped', reason: 'nothing' };

    const d = { ...(await defaultDeps()), ...input.deps };
    const before = new Set((await d.listChangeSets(businessId).catch(() => [])).map((c) => c.id));
    const plan = await d.createChangeSets(businessId, findings, site, AGENT_ACTOR, { now });
    const created = plan.changeSets.filter((c) => !before.has(c.id));
    // Proposition = lecture de l'état réel sur la plateforme (aucune écriture) ; un échec laisse le brouillon.
    let proposed = 0;
    for (const cs of created) {
      if (cs.platform === 'export') continue;
      try {
        await d.proposeChangeSet(businessId, cs.id, AGENT_ACTOR, now);
        proposed++;
      } catch {
        /* reste en brouillon : le client le verra et pourra relancer */
      }
    }
    // Le rythme ne compte que les passes qui ont proposé quelque chose (une passe vide n'en retarde pas une autre).
    if (!created.length) return { status: 'skipped', reason: 'nothing' };
    await putDoc<AgentRunState>(AGENT_RUNS_COLLECTION, businessId, { lastAutoAt: now.toISOString(), lastCreated: created.length, trigger: input.trigger }, businessId);

    let notified: 'email' | 'app' | 'off' | 'none' = 'none';
    if (settings.notify === 'off') notified = 'off';
    else {
      const n = created.length;
      try {
        await d.notify(
          businessId,
          {
            type: 'agent_proposals',
            title: n > 1 ? `${n} corrections proposées par l’agent, à valider` : '1 correction proposée par l’agent, à valider',
            body: 'Rien n’est publié sur votre site sans votre validation. Vérifiez l’avant / après, modifiez si besoin, puis validez.',
            href: '/app/agent',
            dedupeKey: `agent:${businessId}:${now.toISOString().slice(0, 10)}`,
          },
          settings.notify,
        );
        notified = settings.notify;
      } catch (e) {
        log.warn('publish.agent.notify_failed', { businessId, error: e instanceof Error ? e.message : String(e) });
      }
    }
    log.info('publish.agent.run', { businessId, trigger: input.trigger, created: created.length, proposed, skipped: plan.skipped.length });
    return { status: 'created', created: created.length, changeSetIds: created.map((c) => c.id), proposed, notified };
  } catch (e) {
    log.warn('publish.agent.failed', { businessId, error: e instanceof Error ? e.message : String(e) });
    return { status: 'skipped', reason: 'nothing' };
  }
}
