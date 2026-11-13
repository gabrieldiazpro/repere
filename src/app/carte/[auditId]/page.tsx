import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Card, h1Class, h1Style } from '@/lib/seo/shell';
import { cardOgUrl, cardUrl, cardView, shareLinks } from '@/lib/growth/cards';
import { bandFor } from '@/lib/growth/score';
import { dateFr } from '@/lib/growth/measure';
import { BRAND } from '@/lib/seo/site';
import { ShareButtons } from './ShareButtons';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ auditId: string }>; searchParams: Promise<{ t?: string }> };

const NOINDEX = { index: false, follow: false } as const;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ auditId }, { t }] = await Promise.all([params, searchParams]);
  const v = await cardView(auditId, t).catch(() => null);
  if (!v || !t) return { title: { absolute: 'Page introuvable' }, robots: NOINDEX };
  const title = `Visibilité IA de ${v.name} : ${v.score}/100 | ${BRAND}`;
  const description = `Mesure de la visibilité de ${v.name} dans les assistants IA, faite le ${dateFr(v.measuredAt)}.`;
  const image = { url: cardOgUrl(auditId, t), width: 1200, height: 630, alt: title };
  return {
    title: { absolute: title },
    description,
    robots: NOINDEX,
    openGraph: { title, description, type: 'website', locale: 'fr_FR', siteName: BRAND, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function CartePage({ params, searchParams }: Props) {
  const [{ auditId }, { t }] = await Promise.all([params, searchParams]);
  const v = await cardView(auditId, t).catch(() => null);
  if (!v || !t) notFound();
  const band = bandFor(v.score);
  const url = cardUrl(auditId, t);
  const links = shareLinks(v, url);
  const place = [v.trade, v.place].filter(Boolean).join(' · ');
  return (
    <PageShell narrow>
      <Card className="text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
          Visibilité IA mesurée par {BRAND}
        </p>
        <h1 className={`${h1Class} mt-2`} style={h1Style}>
          {v.name}
        </h1>
        {place ? <p style={{ color: 'var(--muted)' }}>{place}</p> : null}
        <p className="mt-6 text-6xl font-bold tabular-nums" style={{ ...h1Style, color: band.color }} aria-label={`Score ${v.score} sur 100`}>
          {v.score}
          <span className="text-2xl font-medium" style={{ color: 'var(--muted)' }}>
            /100
          </span>
        </p>
        <p className="mt-2 inline-block rounded-full px-4 py-1 text-base font-semibold" style={{ background: band.bg, color: band.ink }}>
          {band.label}
        </p>
        <dl className="mx-auto mt-6 grid max-w-md gap-3 text-left text-sm sm:grid-cols-2">
          <div>
            <dt style={{ color: 'var(--muted)' }}>Citations</dt>
            <dd className="font-semibold">
              {v.total ? `${v.cited} réponse${v.cited > 1 ? 's' : ''} sur ${v.total}` : 'Aucune réponse exploitable'}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--muted)' }}>Rang moyen quand cité</dt>
            <dd className="font-semibold">{v.avgRank == null ? 'Jamais cité' : `${v.avgRank.toFixed(1).replace('.', ',')}`}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--muted)' }}>Marge d’erreur</dt>
            <dd className="font-semibold">
              entre {v.rangeLow} et {v.rangeHigh} (confiance {v.confidence})
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--muted)' }}>Date de la mesure</dt>
            <dd className="font-semibold">{dateFr(v.measuredAt)}</dd>
          </div>
        </dl>
        {v.demo ? (
          <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--warning-ink)' }}>
            Données de démonstration.
          </p>
        ) : null}
        <p className="mx-auto mt-6 max-w-md text-xs" style={{ color: 'var(--muted)' }}>
          Mesure ponctuelle, pas une certification : les assistants IA varient d’une réponse à l’autre.
        </p>
      </Card>
      <div className="mt-6 flex flex-col items-center gap-4">
        <Link
          href="/audit?from=carte"
          className="inline-flex min-h-11 items-center rounded-lg px-6 text-base font-semibold text-white"
          style={{ background: 'var(--primary)' }}
        >
          Testez votre entreprise
        </Link>
        <ShareButtons url={url} linkedin={links.linkedin} x={links.x} />
        <input readOnly aria-label="Lien de la carte" value={url} className="w-full max-w-xl rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--line)' }} />
      </div>
    </PageShell>
  );
}
