/**
 * Alertes V2 (docs/v2/06-indispensable.md § 2.3, § 5.2) — détection pure entre deux audits + enregistrement.
 *
 * - `competitor_overtook` : un concurrent passe devant vous sur une IA (il était derrière ou à égalité) ;
 * - `new_competitor`      : un nom absent de l'audit précédent est cité au moins 2 fois ;
 * - `fact_error`          : une IA affirme une information fausse par rapport à la fiche de vérité (nouvelle erreur) ;
 * - `visibility_change`   : variation du score au-delà de la marge d'incertitude des deux mesures.
 *
 * Honnêteté : détection sur échantillon, datée ; aucune promesse que l'IA corrigera.
 */
import type { AuditResult, ProviderId } from '@/lib/engine';
import type { AuditResultV2Ext, BrandFacts, FactCheckItem } from '@/lib/engine/types-v2';
import { recordAlert, type AlertType } from '@/lib/db';
import { FACT_LABELS, runFactCheck } from '@/lib/facts';
import { frSpaces } from '@/lib/text';

export type AuditV2 = AuditResult & AuditResultV2Ext;

export type AlertSeverity = 'critique' | 'important' | 'info';

export interface DetectedAlert {
  type: Extract<AlertType, 'competitor_overtook' | 'new_competitor' | 'fact_error' | 'visibility_change'>;
  severity: AlertSeverity;
  title: string;
  body: string;
  payload: Record<string, unknown>;
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  mistral: 'Mistral (Le Chat)',
};

export interface DetectOptions {
  /** écart minimal en points en plus de la marge (défaut 5) */
  threshold?: number;
  /** nombre max d'alertes « concurrent passe devant » (défaut 2) */
  maxOvertakes?: number;
}

const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

interface ProviderCounts {
  client: number;
  competitors: Map<string, { name: string; n: number }>;
}

function countsByProvider(a: AuditV2): Map<ProviderId, ProviderCounts> {
  const out = new Map<ProviderId, ProviderCounts>();
  for (const m of a.mentions) {
    let c = out.get(m.provider);
    if (!c) out.set(m.provider, (c = { client: 0, competitors: new Map() }));
    if (m.mentioned) c.client++;
    for (const name of new Set(m.competitors)) {
      const k = key(name);
      const e = c.competitors.get(k) ?? { name, n: 0 };
      e.n++;
      c.competitors.set(k, e);
    }
  }
  return out;
}

function detectOvertakes(prev: AuditV2, next: AuditV2, max: number): DetectedAlert[] {
  const before = countsByProvider(prev);
  const after = countsByProvider(next);
  const found: (DetectedAlert & { gap: number })[] = [];
  for (const [p, now] of after) {
    const was = before.get(p);
    for (const [k, comp] of now.competitors) {
      if (comp.n <= now.client) continue;
      const prevN = was?.competitors.get(k)?.n ?? 0;
      const prevClient = was?.client ?? 0;
      if (was && prevN > prevClient) continue; // déjà devant
      found.push({
        type: 'competitor_overtook',
        severity: 'important',
        title: `${comp.name} vient de passer devant vous sur ${PROVIDER_LABEL[p]}`,
        body: `Sur ${PROVIDER_LABEL[p]}, ${comp.name} est cité ${comp.n} fois contre ${now.client} pour vous (avant : ${prevN} contre ${prevClient}). Mesure sur échantillon de questions.`,
        payload: { competitor: comp.name, provider: p, competitorMentions: comp.n, clientMentions: now.client, before: { competitor: prevN, client: prevClient } },
        gap: comp.n - now.client,
      });
    }
  }
  return found
    .sort((a, b) => b.gap - a.gap)
    .slice(0, max)
    .map(({ gap: _gap, ...a }) => a);
}

function detectNewCompetitors(prev: AuditV2, next: AuditV2): DetectedAlert[] {
  const known = new Set(prev.competitors.map((c) => key(c.name)));
  const own = key(next.input.businessName);
  const after = countsByProvider(next);
  const out: DetectedAlert[] = [];
  for (const c of next.competitors.slice(0, 8)) {
    const k = key(c.name);
    if (known.has(k) || k === own || c.mentions < 2) continue;
    let best: { p: ProviderId; n: number } | null = null;
    for (const [p, counts] of after) {
      const n = counts.competitors.get(k)?.n ?? 0;
      if (n > (best?.n ?? 0)) best = { p, n };
    }
    out.push({
      type: 'new_competitor',
      severity: 'info',
      title: best ? `Nouveau : ${c.name} est cité ${best.n} fois sur ${PROVIDER_LABEL[best.p]}` : `Nouveau concurrent cité : ${c.name}`,
      body: `${c.name} n'apparaissait pas dans la mesure précédente ; il est cité ${c.mentions} fois cette fois-ci.`,
      payload: { competitor: c.name, mentions: c.mentions, share: c.share, provider: best?.p ?? null },
    });
    if (out.length >= 3) break;
  }
  return out;
}

const errKey = (i: FactCheckItem) => `${i.field}|${key(i.stated)}`;

function detectFactErrors(prev: AuditV2 | null, next: AuditV2, facts: BrandFacts): DetectedAlert[] {
  if (!Object.keys(facts.facts).length) return [];
  const now = runFactCheck(next, facts).items.filter((i) => i.verdict === 'faux');
  const before = prev ? new Set(runFactCheck(prev, facts).items.filter((i) => i.verdict === 'faux').map(errKey)) : new Set<string>();
  return now
    .filter((i) => !before.has(errKey(i)))
    .map((i) => {
      const label = FACT_LABELS[i.field].toLowerCase();
      return {
        type: 'fact_error' as const,
        severity: (i.severity === 'haute' ? 'critique' : i.severity === 'moyenne' ? 'important' : 'info') as AlertSeverity,
        title: `${PROVIDER_LABEL[i.provider] ?? i.provider} donne une information fausse : ${label}`,
        body: `${PROVIDER_LABEL[i.provider] ?? i.provider} indique « ${i.stated} » alors que votre fiche de vérité indique « ${i.expected} ». Détection sur échantillon ; la correction par l'IA n'est pas garantie, mais une tâche de correction est prête.`,
        payload: { field: i.field, expected: i.expected, stated: i.stated, provider: i.provider, quote: i.quote, severity: i.severity },
      };
    });
}

function detectVisibilityChange(prev: AuditV2, next: AuditV2, threshold: number): DetectedAlert[] {
  const delta = next.score - prev.score;
  const prevRange = prev.range ?? { low: prev.score, high: prev.score };
  const nextRange = next.range ?? { low: next.score, high: next.score };
  const up = nextRange.low > prevRange.high;
  const down = nextRange.high < prevRange.low;
  if ((!up && !down) || Math.abs(delta) < threshold) return [];
  return [
    {
      type: 'visibility_change',
      severity: down ? 'important' : 'info',
      title: up ? `Votre visibilité progresse : ${prev.score} → ${next.score}/100` : `Votre visibilité baisse : ${prev.score} → ${next.score}/100`,
      body: `La variation (${delta > 0 ? '+' : ''}${delta} points) dépasse la marge d'incertitude des deux mesures (${prevRange.low}–${prevRange.high} puis ${nextRange.low}–${nextRange.high}).`,
      payload: { from: prev.score, to: next.score, delta, direction: up ? 'up' : 'down', prevRange, nextRange },
    },
  ];
}

const ORDER: Record<AlertSeverity, number> = { critique: 0, important: 1, info: 2 };

/**
 * Compare deux audits (prev peut être null pour un premier audit : seules les erreurs factuelles sont signalées).
 * Résultat trié par gravité.
 */
export function detectAlerts(prev: AuditV2 | null, next: AuditV2, facts: BrandFacts | null, opts: DetectOptions = {}): DetectedAlert[] {
  const threshold = opts.threshold ?? 5;
  const out: DetectedAlert[] = [];
  if (facts) out.push(...detectFactErrors(prev, next, facts));
  if (prev) {
    out.push(...detectOvertakes(prev, next, opts.maxOvertakes ?? 2));
    out.push(...detectNewCompetitors(prev, next));
    out.push(...detectVisibilityChange(prev, next, threshold));
  }
  // Typographie française : espace insécable avant « : ; ! ? » (pas de signe seul en début de ligne sur mobile).
  return out.map((a) => ({ ...a, title: frSpaces(a.title), body: frSpaces(a.body) })).sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

/** Enregistre les alertes détectées dans le journal (db.recordAlert). */
export async function recordAlerts(businessId: string, auditId: string | null, alerts: DetectedAlert[], emailSent = false): Promise<number> {
  for (const a of alerts) {
    await recordAlert({ businessId, auditId, type: a.type, title: a.title, body: a.body, payload: { ...a.payload, severity: a.severity }, emailSent });
  }
  // Centre de notifications + Slack / webhook selon les préférences (import dynamique : notify importe ce module).
  if (alerts.length) {
    try {
      const { notify, notifTypeOfAlert } = await import('@/lib/notify');
      for (const a of alerts) {
        const type = notifTypeOfAlert(a.type);
        if (!type) continue;
        const delta = typeof a.payload.delta === 'number' ? a.payload.delta : undefined;
        await notify(businessId, {
          type,
          title: a.title,
          body: a.body,
          href: a.type === 'fact_error' ? '/app/verite' : '/app/concurrents',
          severity: a.severity,
          data: a.payload,
          dedupeKey: `alert:${auditId ?? 'none'}:${a.type}:${a.title}`,
          delta,
        });
      }
    } catch (e) {
      console.warn('[alerts] notification impossible', e);
    }
  }
  return alerts.length;
}

/** Détecte puis enregistre. */
export async function detectAndRecordAlerts(
  businessId: string,
  prev: AuditV2 | null,
  next: AuditV2,
  facts: BrandFacts | null,
  opts: DetectOptions = {},
): Promise<DetectedAlert[]> {
  const alerts = detectAlerts(prev, next, facts, opts);
  await recordAlerts(businessId, next.id, alerts);
  return alerts;
}
