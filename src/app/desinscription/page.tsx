import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { Container } from '@/components/ui/Container';
import { addSuppression } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Désinscription',
  description: 'Se désinscrire des e-mails de Repéré.',
  alternates: { canonical: '/desinscription' },
  robots: { index: false, follow: false },
};

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * Désinscription en un clic (CPCE L34-5, docs/06-juridique.md E6/E7, qa/securite.md E5).
 * Lien signé HMAC : /desinscription?e=<email>&t=<unsubscribeToken(email)>, émis par src/lib/email.ts
 * (e-mails du site) et scripts/write-emails.ts (prospection). L'adresse est stockée hachée, jamais retirée.
 */
export default async function DesinscriptionPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const email = first(sp.e).trim().toLowerCase();
  const token = first(sp.t);
  let state: 'ok' | 'invalid' | 'error' = 'invalid';
  if (email && token && verifyUnsubscribeToken(email, token)) {
    try {
      await addSuppression(email);
      state = 'ok';
    } catch (e) {
      console.error('[desinscription]', e);
      state = 'error';
    }
  }

  const title = state === 'ok' ? 'Vous êtes désinscrit' : state === 'error' ? 'Erreur temporaire' : 'Lien invalide';
  const text =
    state === 'ok'
      ? 'Vous ne recevrez plus nos e-mails de conseils ni de prospection. Si vous êtes abonné, vos alertes mensuelles sont aussi arrêtées : pour les conserver, écrivez-nous. Les messages strictement liés à un paiement en cours peuvent encore vous parvenir.'
      : state === 'error'
        ? 'Réessayez dans un instant, ou répondez « STOP » à notre e-mail : nous vous retirerons à la main.'
        : 'Ce lien de désinscription est incomplet ou a été modifié. Répondez « STOP » à notre e-mail : nous vous retirerons à la main sous 24 h.';

  return (
    <>
      <Header />
      <main id="contenu" className="bg-canvas">
        <Container size="narrow" className="py-16 sm:py-24">
          <div className="rounded-[1.25rem] bg-white p-6 ring-1 ring-line sm:p-10" data-state={state}>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-3 text-ink/80">{text}</p>
            <p className="mt-6">
              <Link href="/" className="font-semibold text-primary underline underline-offset-4">
                Retour au site
              </Link>
            </p>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
