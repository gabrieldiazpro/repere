import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAudit, getAuditBusinessId, getBusiness } from '@/lib/db';
import { toPublicAudit } from '@/lib/publicAudit';
import { ReportView } from '@/components/report/ReportView';
import { DEMO_ACCOUNT_IDS, isDemoAccountAudit, segmentOf, topicOf, type ReportResult } from '@/components/report/adapters';
import { buildDemoWorkspaceById, findDemoAudit } from '@/lib/demo-v2';
import type { BrandFacts } from '@/lib/engine/types-v2';
import { isStripeEnabled } from '@/lib/stripe';

/** Lien public de la carte de score, seulement si son propriétaire l'a activée (module CROISSANCE). */
async function activeCardHref(id: string): Promise<string | null> {
  try {
    const { getCardRecord, cardUrl } = await import('@/lib/growth/cards');
    const rec = await getCardRecord(id);
    return rec ? cardUrl(rec.auditId, rec.token) : null;
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

async function load(id: string): Promise<ReportResult | null> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
  try {
    const r = await getAudit(id);
    return r ? (toPublicAudit(r) as ReportResult) : null; // jamais d'e-mail ni d'erreur fournisseur dans la page (E2)
  } catch {
    return null;
  }
}

/** Rapport complet visible si le commerce a un plan payé, ou pour le compte démo. */
async function isUnlocked(id: string): Promise<boolean> {
  if (findDemoAudit(id) || isDemoAccountAudit(id)) return true;
  try {
    const businessId = await getAuditBusinessId(id);
    if (!businessId) return false;
    if (DEMO_ACCOUNT_IDS.includes(businessId)) return isDemoAccountAudit(id);
    const b = await getBusiness(businessId);
    return !!b && b.plan !== 'free';
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  const robots = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } };
  if (!r) return { title: 'Rapport introuvable', robots };
  const title = `${r.input.businessName} : ${Math.round(r.score)}/100 de visibilité IA`;
  const what = segmentOf(r) === 'local'
    ? `${r.input.trade}, ${r.input.district ? `${r.input.district}, ` : ''}${r.input.city}`
    : topicOf(r);
  const description = `Rapport de visibilité IA de ${r.input.businessName} (${what}) : ce que ChatGPT, Gemini et Perplexity répondent, les sources qu'ils citent et pourquoi les concurrents passent devant.`;
  return {
    title,
    description,
    robots,
    openGraph: { title, description, type: 'article', locale: 'fr_FR', siteName: 'Repéré' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function RapportPage({ params }: Props) {
  const { id } = await params;
  const r = await load(id);
  if (!r) notFound();
  const unlocked = await isUnlocked(id);
  // Compte démo : la fiche de vérité existe, les tâches « corriger » peuvent être proposées.
  let facts: BrandFacts | null = null;
  try {
    const demo = findDemoAudit(id);
    facts = demo ? (buildDemoWorkspaceById(demo.businessId)?.facts ?? null) : null;
  } catch {
    facts = null;
  }
  const cardHref = r.demo ? null : await activeCardHref(id);
  return <ReportView result={r} unlocked={unlocked} facts={facts} cardHref={cardHref} payable={isStripeEnabled()} />;
}
