import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { AnalysisReport } from '@/components/analysis/AnalysisReport';
import { hostOf } from '@/components/analysis/format';
import s from '@/components/analysis/analysis.module.css';
import { getStoredAnalysis, toPublicAnalysis, tokenMatches, type FullAnalysis } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ id: string }>; searchParams: Promise<SP> };

const ROBOTS: Metadata['robots'] = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } };

/** Rapport partageable : jamais indexé (lien signé personnel), ni suivi ; le titre nomme le site seulement avec un lien valide. */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const got = await load(id, Array.isArray(sp.t) ? sp.t[0] : sp.t);
  const host = got ? hostOf(got.analysis.crawl?.finalOrigin ?? got.analysis.input.url) : '';
  return { title: host ? `Analyse SEO et IA de ${host}` : 'Rapport d’analyse SEO et IA', robots: ROBOTS, referrer: 'no-referrer' };
}

async function load(id: string, token: string | undefined): Promise<{ analysis: FullAnalysis; share: string | null } | null> {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return null;
  const doc = await getStoredAnalysis(id).catch(() => null);
  if (!doc) return null;
  if (tokenMatches(doc, token)) return { analysis: toPublicAnalysis(doc.analysis), share: `/analyse/${encodeURIComponent(id)}?t=${token}` };
  // Membre de l'espace auquel l'analyse est rattachée (sans jeton).
  if (doc.businessId) {
    try {
      const jar = await cookies();
      const cookie = jar.getAll().map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
      if (cookie) {
        const { requireBusiness } = await import('@/lib/auth');
        await requireBusiness(new Request('http://localhost/', { headers: { cookie } }), doc.businessId);
        return { analysis: toPublicAnalysis(doc.analysis), share: null };
      }
    } catch {
      /* pas membre */
    }
  }
  return null;
}

export default async function AnalyseRapportPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const t = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const got = await load(id, t);
  return (
    <>
      <Header />
      <main id="contenu" style={{ background: 'var(--color-canvas)' }}>
        <div className={s.wrap}>
          {got ? (
            <>
              <AnalysisReport analysis={got.analysis} shareUrl={got.share} />
              <p className={`${s.small} mt-8 ${s.noPrint}`}>
                <Link href={`/analyse?site=${encodeURIComponent(got.analysis.crawl?.finalOrigin ?? got.analysis.input.url)}`} className="font-semibold text-primary underline underline-offset-2">
                  Relancer une analyse de ce site
                </Link>{' '}
                ou{' '}
                <Link href="/analyse" className="underline underline-offset-2">
                  analyser un autre site
                </Link>
                .
              </p>
            </>
          ) : (
            <div className="max-w-2xl">
              <h1 className={s.verdict}>Ce lien d’analyse est expiré ou incomplet</h1>
              <p className={`${s.lede}`}>
                Les liens de rapport sont personnels et valables 90 jours. Vérifiez que l’adresse a été copiée en entier (avec la partie « ?t= »), ou
                relancez une analyse : elle prend une minute.
              </p>
              <p className="mt-6">
                <Link href="/analyse" className="ui-btn" data-variant="primary" data-size="lg">
                  Analyser mon site
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
