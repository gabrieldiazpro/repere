// Chargement de l'espace client V2 (serveur uniquement).
// Session valide → commerce réel (V1 db) enrichi par les modules V2 ; sinon espace démo choisi par cookie.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { COOKIES } from '@/lib/auth/cookies';
import { TIER_NAMES, getEntitlements } from '@/lib/entitlements';
import type { BrandFacts, ExecTask, Segment } from '@/lib/engine/types-v2';
import { loadDashboard } from './data';
import { auditStats, previousComparable } from '@/lib/digest/stats';
import { adaptDemoWorkspace, adaptFacts, Fallbacks, type V2Audit, type WorkspaceBusiness } from './adapters';

export const DEMO_SEGMENT_COOKIE = COOKIES.demo;
export const SEGMENTS: Segment[] = ['local', 'pme', 'ecommerce'];

export interface Workspace {
  business: WorkspaceBusiness;
  segment: Segment;
  demo: boolean;
  userEmail: string | null;
  /** du plus ancien au plus récent */
  audits: V2Audit[];
  latest: V2Audit | null;
  previous: V2Audit | null;
  facts: BrandFacts;
  fb: Fallbacks;
}

export function auditDate(a: { measuredAt?: string; createdAt: string }) {
  return a.measuredAt ?? a.createdAt;
}

async function demoSegment(): Promise<Segment> {
  const v = (await cookies()).get(DEMO_SEGMENT_COOKIE)?.value as Segment | undefined;
  return v && SEGMENTS.includes(v) ? v : 'local';
}

/**
 * E-commerce : les erreurs de prix citées (catalogue, dédoublonnées par IA × produit × valeur) sont fusionnées dans la
 * vérification des faits de la dernière mesure, pour que Lundi, Vérité, Prix et avis et le copilote comptent pareil.
 */
export async function withCatalogErrors(businessId: string, segment: Segment, latest: V2Audit | null): Promise<V2Audit | null> {
  if (!latest?.factCheck || segment !== 'ecommerce') return latest;
  try {
    const { withPriceFacts } = await import('@/lib/facts');
    const report = await withPriceFacts(businessId, { ...latest, segment: 'ecommerce' } as Parameters<typeof withPriceFacts>[1], latest.factCheck);
    return report === latest.factCheck ? latest : { ...latest, factCheck: report };
  } catch {
    return latest;
  }
}

const replaceLast = (audits: V2Audit[], last: V2Audit | null) => (last && audits.length && audits.at(-1) !== last ? [...audits.slice(0, -1), last] : audits);

export const loadWorkspace = cache(async (): Promise<Workspace> => {
  const fb = new Fallbacks();
  const d = await loadDashboard();
  if (!d.demo) {
    const b = d.business;
    const place = [b.district, b.city].filter(Boolean).join(' ');
    const raw = d.audits as V2Audit[];
    const segment: Segment = b.segment ?? raw.at(-1)?.segment ?? 'local';
    const latest = await withCatalogErrors(b.id, segment, raw.at(-1) ?? null);
    const audits = replaceLast(raw, latest);
    const facts = (await adaptFacts(b.id, fb)) ?? { businessId: b.id, facts: {}, updatedAt: new Date().toISOString() };
    return {
      business: {
        id: b.id,
        segment,
        name: b.name,
        descriptor: [b.trade, place].filter(Boolean).join(' · '),
        cohort: latest ? auditStats(latest).label.replace(/^\S+ sur \d+ /, '') : `${b.trade}s`,
        website: b.website ?? '',
        slug: b.id,
        planLabel: TIER_NAMES[getEntitlements(b).tier],
        planPrice: '',
      },
      segment,
      demo: false,
      userEmail: d.userEmail,
      audits,
      latest,
      // Mesure précédente comparable seulement (mêmes questions, ≥ 6 jours) : jamais l'audit gratuit d'un autre périmètre.
      previous: previousComparable(audits),
      facts,
      fb,
    };
  }
  const segment = await demoSegment();
  const ws = await adaptDemoWorkspace(segment, fb);
  const saved = await adaptFacts(ws.business.id, fb);
  const last = await withCatalogErrors(ws.business.id, segment, ws.audits.at(-1) ?? null);
  const audits = replaceLast(ws.audits, last);
  return {
    // « sur 10 plombiers du 11ᵉ » : même libellé que le rang (une seule source)
    business: { ...ws.business, cohort: last ? auditStats(last).label.replace(/^\S+ sur \d+ /, '') : ws.business.cohort },
    segment,
    demo: true,
    userEmail: null,
    audits,
    latest: last,
    previous: previousComparable(audits),
    facts: saved && Object.keys(saved.facts).length ? saved : ws.facts,
    fb,
  };
});

/**
 * Classement « Vous » + concurrents. Calcul UNIQUE partagé avec le digest, le copilote et le rapport :
 * src/lib/digest/stats.ts (citations sur les mêmes réponses, à égalité vous passez devant).
 */
export function ranking(a: V2Audit) {
  return auditStats(a).rows.map((r) => ({ name: r.isMe ? 'Vous' : r.name, share: r.share, mentions: r.mentions, isMe: r.isMe }));
}

export function myShare(a: V2Audit) {
  return auditStats(a).shareOfVoice;
}

export function rankOf(a: V2Audit) {
  const s = auditStats(a);
  return { rank: s.rank, of: s.of, label: s.label };
}

export function taskMinutes(tasks: ExecTask[]) {
  return tasks.reduce((s, t) => s + (t.status === 'done' ? 0 : t.minutes), 0);
}
