import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyToken } from '@/lib/newsletter/tokens';
import { GUIDE_2027 } from '@/lib/veille/guide2027';
import { GUIDE_CSS, GuideChapters, GuideCover, GuideToc } from '../_components/GuideBody';
import { PrintButton } from '../_components/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: GUIDE_2027.title, robots: { index: false, follow: false } };

/** Lecture du guide (lien signé reçu par e-mail). Non indexée. */
export default async function LireGuide({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e, t } = await searchParams;
  const email = (e || '').trim().toLowerCase();
  const ok = Boolean(email) && verifyToken('res-guide-2027', email, t);
  if (!ok) {
    return (
      <main id="contenu" className="mx-auto max-w-xl px-4 py-16" style={{ color: 'var(--ink)' }}>
        <h1 className="text-2xl font-semibold">Ce lien de lecture est incomplet</h1>
        <p className="mt-3">Le lien du guide est personnel et arrive par e-mail. Copiez-le en entier depuis l&apos;e-mail, ou demandez un nouveau lien : c&apos;est gratuit.</p>
        <p className="mt-6">
          <Link href="/ressources/guide-2027" className="font-semibold underline underline-offset-2" style={{ color: 'var(--primary)' }}>Recevoir le guide par e-mail</Link>
        </p>
      </main>
    );
  }
  const pdf = `/ressources/guide-2027/pdf?e=${encodeURIComponent(email)}&t=${encodeURIComponent(t ?? '')}`;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GUIDE_CSS }} />
      <div className="g27-bar">
        <div className="g27-bar-in">
          <Link href="/" className="font-bold" style={{ color: 'var(--primary)' }}>Repéré</Link>
          <span style={{ color: 'var(--muted)' }} className="mr-auto">Guide 2027</span>
          <a href={pdf} className="font-semibold underline underline-offset-2" style={{ color: 'var(--primary)' }}>Télécharger le PDF</a>
          <PrintButton />
        </div>
      </div>
      <main id="contenu" className="g27">
        <GuideCover email={email} />
        <GuideToc />
        <GuideChapters />
        <p className="no-print mt-12">
          <Link href="/veille" className="font-semibold underline underline-offset-2" style={{ color: 'var(--primary)' }}>Suivre la veille mise à jour</Link>
        </p>
      </main>
    </>
  );
}
