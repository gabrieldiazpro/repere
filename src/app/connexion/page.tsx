import Link from 'next/link';
import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { authMode } from '@/lib/auth/config';
import { safeNext } from '@/lib/auth/cookies';
import { AcceptInvitation, LoginForm, LogoutButton } from './AccountForms';
import { AuthShell, Notice } from './AuthShell';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à votre espace Repéré avec un lien envoyé par e-mail, sans mot de passe.',
  alternates: { canonical: '/connexion' },
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const ERRORS: Record<string, string> = {
  lien: 'Ce lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau ci-dessous.',
  indisponible: 'La connexion est momentanément indisponible. Réessayez dans quelques minutes.',
};

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const next = safeNext(first(sp.next), '/app');
  const invitation = first(sp.invitation)?.slice(0, 100);
  const email = first(sp.email)?.slice(0, 254);
  const erreur = first(sp.erreur);
  const mode = authMode();
  const session = await getSession();

  if (session) {
    return (
      <AuthShell title="Vous êtes connecté" intro={<>Compte : <strong className="text-ink">{session.email}</strong></>}>
        {invitation ? (
          <AcceptInvitation token={invitation} />
        ) : (
          <Link href={next} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-white hover:bg-primary-strong">
            Ouvrir mon espace
          </Link>
        )}
        <LogoutButton label="Utiliser une autre adresse" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={invitation ? 'Rejoindre l’espace' : 'Connexion'}
      intro={invitation ? 'Confirmez votre adresse : nous vous envoyons un lien pour rejoindre l’équipe.' : 'Indiquez votre e-mail, nous vous envoyons un lien de connexion. Pas de mot de passe à retenir.'}
      aside={
        <>
          <p>
            Pas encore de compte ? <Link href="/inscription" className="font-semibold text-primary underline">Créez un compte gratuit</Link>{' '}
            ou <Link href="/audit" className="font-semibold text-primary underline">faites un test gratuit</Link>.
          </p>
          <p>Vous avez payé ? Utilisez l’adresse e-mail de votre reçu : votre compte a été créé avec elle.</p>
          <p>
            Envie de voir avant ? <Link href="/app?compte=demo" className="font-semibold text-primary underline">Ouvrir la démo</Link> (données d’exemple).
          </p>
        </>
      }
    >
      {first(sp.deconnecte) === '1' && <Notice tone="success">Vous êtes déconnecté.</Notice>}
      {erreur && ERRORS[erreur] && <Notice tone="danger">{ERRORS[erreur]}</Notice>}
      {mode === 'off' ? (
        <Notice tone="warning">La connexion n’est pas disponible dans cet environnement (configuration incomplète).</Notice>
      ) : (
        <>
          {mode === 'local' && (
            <Notice tone="warning">
              Compte local de développement : aucun e-mail n’est envoyé, le lien de connexion s’affiche dans la console du serveur et sur cette page.
            </Notice>
          )}
          <LoginForm next={next} invitation={invitation} defaultEmail={email} />
        </>
      )}
    </AuthShell>
  );
}
