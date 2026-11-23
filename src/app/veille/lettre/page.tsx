import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, h1Class, h1Style } from '@/lib/seo/shell';
import { pageMeta } from '@/lib/seo/meta';
import { breadcrumbListLd } from '@/lib/seo/jsonld';
import { NewsletterForm } from '@/lib/newsletter/ui/NewsletterForm';

const PATH = '/veille/lettre';

export const metadata: Metadata = pageMeta({
  path: PATH,
  title: 'Lettre mensuelle de veille Google et IA',
  description: 'Une fois par mois, les changements qui comptent pour la visibilité de votre site sur Google et dans les IA : datés, sourcés, avec ce qu’il faut faire.',
});

const STATES: Record<string, { tone: 'ok' | 'warn' | 'err'; title: string; text: string }> = {
  confirme: { tone: 'ok', title: 'Inscription confirmée', text: 'Merci. Vous recevrez le prochain numéro de la lettre, une fois par mois. Chaque numéro contient un lien de désinscription en un clic.' },
  'deja-inscrit': { tone: 'ok', title: 'Vous êtes déjà inscrit', text: 'Votre adresse était déjà confirmée : rien à faire.' },
  desinscrit: { tone: 'ok', title: 'Vous êtes désinscrit', text: 'Vous ne recevrez plus la lettre mensuelle. Vous pouvez vous réinscrire à tout moment avec le formulaire ci-dessous.' },
  'lien-expire': { tone: 'warn', title: 'Ce lien ne fonctionne plus', text: 'Cette adresse a été désinscrite ou n’est plus en attente de confirmation. Inscrivez-vous de nouveau ci-dessous si vous le souhaitez.' },
  'lien-invalide': { tone: 'err', title: 'Lien incomplet', text: 'Ce lien est incomplet ou a été modifié. Copiez-le en entier depuis l’e-mail, ou répondez « STOP » à notre e-mail pour être retiré à la main.' },
  erreur: { tone: 'err', title: 'Erreur temporaire', text: 'Votre demande n’a pas pu être enregistrée. Réessayez dans quelques minutes.' },
};

const TONE = {
  ok: { bg: 'var(--success-bg)', ink: 'var(--success-ink)', mark: '✓' },
  warn: { bg: 'var(--warning-bg)', ink: 'var(--warning-ink)', mark: '◆' },
  err: { bg: 'var(--danger-bg)', ink: 'var(--danger-ink)', mark: '!' },
};

export default async function LettrePage({ searchParams }: { searchParams: Promise<{ etat?: string }> }) {
  const { etat } = await searchParams;
  const st = etat ? STATES[etat] : undefined;
  return (
    <PageShell narrow>
      <JsonLd data={breadcrumbListLd(PATH, [{ name: 'Accueil', path: '/' }, { name: 'Veille', path: '/veille' }, { name: 'Lettre mensuelle', path: PATH }])} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Veille', href: '/veille' }, { name: 'Lettre mensuelle' }]} />
      {st ? (
        <div role="status" className="mb-8 rounded-2xl p-5" style={{ background: TONE[st.tone].bg, color: TONE[st.tone].ink }}>
          <p className="text-lg font-semibold"><span aria-hidden>{TONE[st.tone].mark} </span>{st.title}</p>
          <p className="mt-1">{st.text}</p>
        </div>
      ) : null}
      <h1 className={h1Class} style={h1Style}>La lettre mensuelle de veille Google et IA</h1>
      <p className="mt-4 text-lg leading-relaxed">
        Une fois par mois, les changements qui comptent pour un commerce, une PME ou une boutique en ligne : les mises à
        jour de Google, les nouveautés des assistants IA, les règles qui s&apos;appliquent. Chaque point renvoie à une{' '}
        <Link href="/veille" className="underline underline-offset-2">fiche datée et sourcée</Link>.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-6 leading-relaxed">
        <li>Un e-mail par mois, jamais plus.</li>
        <li>Inscription confirmée par e-mail (rien n&apos;est envoyé sans votre clic).</li>
        <li>Désinscription en un clic, dans chaque numéro.</li>
        <li>Pas de pixel de suivi d&apos;ouverture, pas de revente d&apos;adresse, pas de publicité.</li>
      </ul>
      <div className="mt-8">
        <NewsletterForm source="veille" title="M'inscrire" text={null} />
      </div>
    </PageShell>
  );
}
