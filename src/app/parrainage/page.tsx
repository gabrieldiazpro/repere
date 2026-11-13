import Link from 'next/link';
import { pageMeta } from '@/lib/seo/meta';
import { h2Class } from '@/lib/seo/shell';
import { PageHero, SitePage } from '@/components/pages/ui';
import { Container } from '@/components/ui/Container';
import { StepPath } from '@/components/pages/v4/diagrams';
import v4 from '@/components/pages/v4/v4.module.css';
import { getRewardConfig } from '@/lib/growth/referral';
import { ReferralPanel } from './ReferralPanel';

export const dynamic = 'force-dynamic';

export const metadata = pageMeta({
  title: 'Parrainage : un mois offert à vous et à votre filleul',
  description: 'Parrainez un autre commerce : après son premier paiement, vous recevez chacun un mois offert sur votre abonnement Repéré.',
  path: '/parrainage',
});

const months = (n: number) => `${n} mois offert${n > 1 ? 's' : ''}`;

export default async function ParrainagePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const cfg = getRewardConfig();
  const businessId = b && /^[A-Za-z0-9_-]{1,100}$/.test(b) ? b : null;
  return (
    <SitePage>
      <PageHero
        crumbs={[{ name: 'Accueil', href: '/' }, { name: 'Parrainage' }]}
        title="Parrainage"
        lead="Vous connaissez un commerce qui gagnerait à être repéré par les assistants IA ? Donnez-lui votre lien. Après son premier paiement, vous recevez chacun un crédit sur votre facture."
        aside={
          <StepPath
            label="Le parrainage en trois étapes"
            start={{ icon: 'share', text: 'Votre lien personnel' }}
            steps={[
              { icon: 'send', title: 'Vous partagez votre lien', text: 'Il contient votre code de parrainage.' },
              { icon: 'users', title: 'Votre filleul s’inscrit', text: 'Avec ce lien.' },
              { icon: 'card', title: 'Il paie une première fois', text: `Vous recevez ${months(cfg.referrerMonths)}, lui ${months(cfg.refereeMonths)}, en remise sur facture.` },
            ]}
          />
        }
      />
      <Container size="narrow" className={`${v4.editorial} pb-16 pt-4`}>

      <h2 className={h2Class}>Les règles</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Jamais d’argent comptant : c’est un crédit sur votre abonnement.</li>
        <li>Le crédit n’est acquis qu’après un premier paiement réellement encaissé (un essai gratuit ne compte pas).</li>
        <li>Plafond de {cfg.annualCapMonths} mois offerts par parrain sur 12 mois glissants.</li>
        <li>Pas d’auto-parrainage : même propriétaire, même adresse e-mail ou même moyen de paiement = pas de récompense.</li>
        <li>Un filleul n’a qu’un seul parrain.</li>
      </ul>

      <h2 className={h2Class}>Votre lien</h2>
      {businessId ? (
        <ReferralPanel businessId={businessId} />
      ) : (
        <p>
          Votre code est dans votre espace client, rubrique Parrainage.{' '}
          <Link href="/connexion" className="underline underline-offset-2">
            Se connecter
          </Link>
        </p>
      )}
      </Container>
    </SitePage>
  );
}
