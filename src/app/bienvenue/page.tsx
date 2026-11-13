import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAccountBusinesses } from '@/lib/auth/businesses';
import { setupIntro } from '@/lib/auth/profile';
import { LogoutButton, WelcomeForm } from '../connexion/AccountForms';
import { AuthShell, Notice } from '../connexion/AuthShell';

export const metadata: Metadata = {
  title: 'Bienvenue',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const INVITE_MSG: Record<string, string> = {
  invalid: 'Cette invitation n’est plus valable.',
  expired: 'Cette invitation a expiré. Demandez à la personne qui vous a invité de vous en envoyer une nouvelle.',
  wrong_email: 'Cette invitation a été envoyée à une autre adresse. Connectez-vous avec l’adresse invitée.',
};

/**
 * Connecté sans espace (A7/CX2) : jamais la démo en silence. Trois issues : créer son espace gratuit, se connecter
 * avec l'adresse utilisée au paiement, ou demander une invitation à son équipe.
 */
export default async function BienvenuePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect('/connexion?next=/bienvenue');
  const businesses = await listAccountBusinesses(session);
  const toSetup = businesses.find((b) => b.needsSetup);
  if (businesses.length && !toSetup) redirect('/app');
  const invite = first(sp.invitation);

  return (
    <AuthShell
      title="Bienvenue"
      intro={
        toSetup ? (
          <>{setupIntro(toSetup)}</>
        ) : (
          <>Aucun espace n’est encore rattaché à <strong className="text-ink">{session.email}</strong>. Créez le vôtre en une minute.</>
        )
      }
      aside={
        <>
          {!toSetup?.free && (<p>
            Vous avez payé avec une autre adresse ? Déconnectez-vous puis connectez-vous avec l’adresse de votre reçu : votre espace y est rattaché.
          </p>)}
          <p>Vous rejoignez une équipe ? Demandez une invitation à la personne qui gère l’espace.</p>
          <p>
            Besoin d’aide ? <Link href="/contact" className="font-semibold text-primary underline">Contactez-nous</Link>.
          </p>
          <LogoutButton label="Se connecter avec une autre adresse" />
        </>
      }
    >
      {invite && INVITE_MSG[invite] && <Notice tone="warning">{INVITE_MSG[invite]}</Notice>}
      <WelcomeForm defaultSegment={toSetup?.segment} setupBusinessId={toSetup?.id} prefill={toSetup?.prefill} />
    </AuthShell>
  );
}
