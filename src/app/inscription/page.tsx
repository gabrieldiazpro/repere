import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAudit } from '@/lib/db';
import { authMode } from '@/lib/auth/config';
import { tradeOfAudit, type OriginAuditInput } from '@/lib/auth/profile';
import { SignupForm } from '../connexion/AccountForms';
import { AuthShell, Notice } from '../connexion/AuthShell';

export const metadata: Metadata = {
  title: 'Créer un compte gratuit',
  description:
    'Offre Découverte gratuite et sans limite de durée : 1 marque, 5 questions suivies, 1 mesure par mois sur ChatGPT, Gemini et Perplexity.',
  alternates: { canonical: '/inscription' },
};
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function InscriptionPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (await getSession()) redirect('/app');
  // Paramètres d'entrée : ?parcours=, ?analyse=<id>&site=&nom= (analyse 60 s), ?offre=<segment>_decouverte (rapport), ?audit=<id> (pré-remplissage et
  // rattachement de l'audit gratuit s'il a été demandé avec la même adresse), ?suite=carte, ?ref=<code parrainage>.
  const isSeg = (v: string | undefined): v is 'local' | 'pme' | 'ecommerce' => v === 'local' || v === 'pme' || v === 'ecommerce';
  const p = first(sp.parcours);
  const offre = first(sp.offre);
  const fromOffer = offre && /^[a-z]+_decouverte$/.test(offre) ? offre.split('_')[0] : undefined;
  const auditId = first(sp.audit);
  const audit = auditId && /^[A-Za-z0-9_-]{1,80}$/.test(auditId) && !auditId.startsWith('demo-') ? await getAudit(auditId).catch(() => null) : null;
  const fromAudit = (audit?.input as { segment?: string } | undefined)?.segment;
  const segment = isSeg(p) ? p : isSeg(fromOffer) ? fromOffer : isSeg(fromAudit) ? fromAudit : undefined;
  const ref = first(sp.ref);
  const suite = first(sp.suite) === 'carte' ? ('carte' as const) : undefined;
  // Métier, ville et catégories d'un audit public : repris même si l'e-mail diffère (seul le rattachement de l'audit
  // dépend de la même adresse, côté serveur).
  const origin = (audit?.input as OriginAuditInput | undefined) ?? null;
  // Parcours choisi différent de celui de l'audit (?parcours=) : rien n'est repris.
  const originSeg = origin?.segment ?? 'local';
  const same = !!origin && (segment ?? originSeg) === originSeg;
  // ?analyse=<id> (analyse 60 s, V5) : site et nom repris de l'URL (affichage seulement) ; le rattachement et les valeurs
  // définitives sont vérifiés côté serveur (même adresse e-mail que celle saisie pour l'analyse, lib/auth/claims.ts).
  const analysisId = first(sp.analyse);
  const analysis = !audit && analysisId && /^an_[A-Za-z0-9_-]{1,77}$/.test(analysisId) ? analysisId : undefined;
  const clip = (v: string | undefined, n: number) => (v ? v.trim().slice(0, n) : '');
  const site = analysis ? clip(first(sp.site), 200) : '';
  const prefill = {
    name: audit?.input.businessName ?? (analysis ? clip(first(sp.nom), 120) : ''),
    website: audit?.input.website ?? (/^https?:\/\//i.test(site) ? site : ''),
    analysis,
    trade: same ? tradeOfAudit(origin) || undefined : undefined,
    city: same ? (originSeg === 'local' ? origin?.city : origin?.market) || undefined : undefined,
    district: same && originSeg === 'local' ? origin?.district || undefined : undefined,
    audit: audit ? audit.id : undefined,
    ref: ref && /^[A-Za-z0-9_-]{1,20}$/.test(ref) ? ref : undefined,
    suite: audit ? suite : undefined,
  };
  return (
    <AuthShell
      title="Créer un compte gratuit"
      intro="Offre Découverte : 1 marque, 5 questions suivies, 1 mesure par mois sur ChatGPT, Gemini et Perplexity. Gratuit, sans carte bancaire, sans limite de durée."
      aside={
        <p>
          Déjà un compte ? <Link href="/connexion" className="font-semibold text-primary underline">Connectez-vous</Link>.
        </p>
      }
    >
      {authMode() === 'off' ? (
        <Notice tone="warning">L’inscription n’est pas disponible dans cet environnement (configuration incomplète).</Notice>
      ) : (
        <>
          {prefill.audit && prefill.suite !== 'carte' && (
            <Notice tone="info">
              Votre audit de {prefill.name || 'votre entreprise'} vous attend : utilisez l’adresse e-mail donnée lors de l’audit pour le retrouver dans votre espace, avec le suivi mensuel.
            </Notice>
          )}
          {prefill.analysis && (
            <Notice tone="info">
              Votre analyse vous attend : utilisez l’adresse e-mail saisie lors de l’analyse pour la retrouver dans votre espace.
            </Notice>
          )}
          {prefill.suite === 'carte' && (
            <Notice tone="info">Votre carte de score sera publiée dès que vous aurez confirmé votre adresse (celle utilisée pour l’audit).</Notice>
          )}
          <SignupForm defaultSegment={segment} prefill={prefill} />
        </>
      )}
    </AuthShell>
  );
}
