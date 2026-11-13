import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { BrandFactField } from '@/lib/engine/types-v2';
import { buildFaq, findBusinessIdBySlug, hostedPageUrl, jsonLdString, loadExecContext, schemaForBusiness, type ExecContext } from '@/lib/execution';
import { googleReviewUrl } from '@/lib/execution/reviews';
import { cleanUrl, splitList } from '@/lib/execution/util';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<ExecContext | null> {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  try {
    const id = await findBusinessIdBySlug(slug);
    if (!id) return null;
    const ctx = await loadExecContext(id);
    if (!ctx || ctx.settings.published === false || ctx.settings.slug !== slug) return null;
    return ctx;
  } catch {
    return null;
  }
}

const SEGMENT_TYPE = { local: 'Fiche officielle', pme: 'Présentation officielle', ecommerce: 'Fiche officielle de la marque' } as const;

function activityOf(ctx: ExecContext): string {
  const input = ctx.audit?.input;
  if (ctx.segment === 'pme') return input?.offering || input?.category || ctx.business.trade;
  if (ctx.segment === 'ecommerce') return input?.offering || ctx.business.trade;
  const place = [ctx.business.city, ctx.business.district].filter(Boolean).join(' ');
  return `${ctx.business.trade}${place ? ` à ${place}` : ''}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await load(slug);
  if (!ctx) return { title: { absolute: 'Page introuvable' }, robots: { index: false, follow: false } };
  const title = `${ctx.business.name} — ${SEGMENT_TYPE[ctx.segment].toLowerCase()} et questions fréquentes`;
  const description = `${ctx.business.name} : ${activityOf(ctx)}. Informations vérifiées par l’entreprise : coordonnées, ${ctx.segment === 'local' ? 'horaires, zone, ' : ''}services et réponses aux questions fréquentes.`.slice(0, 300);
  const url = hostedPageUrl(slug);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    // Les comptes démo ne sont pas des entreprises réelles : jamais indexés.
    robots: ctx.demo ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title, description, url, type: 'website', locale: 'fr_FR', siteName: ctx.business.name },
    twitter: { card: 'summary', title, description },
  };
}

function readableOn(hex: string): string {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return '#ffffff';
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111827' : '#ffffff';
}

const ROWS: { field: BrandFactField; label: string; segments?: ExecContext['segment'][] }[] = [
  { field: 'adresse', label: 'Adresse' },
  { field: 'telephone', label: 'Téléphone' },
  { field: 'site', label: 'Site web' },
  { field: 'horaires', label: 'Horaires', segments: ['local'] },
  { field: 'zone', label: 'Zone' },
  { field: 'prix', label: 'Tarifs' },
  { field: 'livraison', label: 'Livraison' },
  { field: 'clients', label: 'Clients' },
  { field: 'creation', label: 'Création' },
  { field: 'statut', label: 'Statut' },
];

export default async function HostedPage({ params }: Props) {
  const { slug } = await params;
  const ctx = await load(slug);
  if (!ctx) notFound();
  const { business, facts: brand, settings, segment } = ctx;
  const f = brand.facts;
  const brandColor = /^#[0-9a-f]{6}$/i.test(settings.brandColor ?? '') ? (settings.brandColor as string) : '#3730A3';
  const onBrand = readableOn(brandColor);
  const faq = buildFaq(ctx.audit ?? { input: { businessName: business.name, trade: business.trade, city: business.city, district: business.district, segment } }, brand, business);
  const jsonld = await schemaForBusiness(business.id, { withFaq: true });
  const site = cleanUrl(f.site || business.website);
  const reviewUrl = settings.reviewUrl ?? googleReviewUrl(settings.placeId);
  const services = splitList(f.services);
  const products = settings.products?.length ? settings.products.map((p) => p.name) : [];
  const rows = ROWS.filter((r) => f[r.field] && (!r.segments || r.segments.includes(segment)));
  const updated = brand.updatedAt ? new Date(brand.updatedAt) : null;

  return (
    <div className="min-h-dvh bg-white text-[#1B1F2E]" style={{ ['--brand' as string]: brandColor }}>
      {jsonld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonld) }} />}
      {ctx.demo && (
        <p className="bg-[#FDF1E3] px-4 py-2 text-center text-sm text-[#92400E]">
          Données de démonstration : cette entreprise est fictive.
        </p>
      )}
      <header style={{ background: brandColor, color: onBrand }}>
        <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
          {settings.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={`Logo ${business.name}`} className="mb-5 h-12 w-auto rounded bg-white p-1" />
          )}
          <p className="text-sm font-medium uppercase tracking-wide opacity-80">{SEGMENT_TYPE[segment]}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{business.name}</h1>
          <p className="mt-3 text-lg opacity-90">{activityOf(ctx)}</p>
        </div>
      </header>

      <main id="contenu" className="mx-auto max-w-3xl px-5 py-10">
        {rows.length > 0 && (
          <section aria-labelledby="infos">
            <h2 id="infos" className="text-xl font-semibold">
              Informations pratiques
            </h2>
            <dl className="mt-4 divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
              {rows.map((r) => (
                <div key={r.field} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                  <dt className="text-sm font-medium text-[#5A6275]">{r.label}</dt>
                  <dd className="text-[15px]">
                    {r.field === 'telephone' ? (
                      <a className="underline decoration-1 underline-offset-2" href={`tel:${(f.telephone ?? '').replace(/[^\d+]/g, '')}`}>
                        {f.telephone}
                      </a>
                    ) : r.field === 'site' && site ? (
                      <a className="underline decoration-1 underline-offset-2" href={site} rel="noopener">
                        {site.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      f[r.field]
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {segment === 'ecommerce' && !products.length && f.produits && (
          <section aria-labelledby="offre" className="mt-10">
            <h2 id="offre" className="text-xl font-semibold">
              Produits
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed">{f.produits}</p>
          </section>
        )}

        {(segment === 'ecommerce' ? products.length > 0 : services.length > 0) && (
          <section aria-labelledby="offre" className="mt-10">
            <h2 id="offre" className="text-xl font-semibold">
              {segment === 'ecommerce' ? 'Produits' : segment === 'pme' ? 'Offres' : 'Services'}
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {(segment === 'ecommerce' ? products : services).map((s) => (
                <li key={s} className="rounded-lg border border-[#E5E7EB] px-4 py-3 text-[15px]">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: brandColor }} aria-hidden />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {faq.length > 0 && (
          <section aria-labelledby="faq" className="mt-10">
            <h2 id="faq" className="text-xl font-semibold">
              Questions fréquentes
            </h2>
            <div className="mt-4 space-y-5">
              {faq.map((i) => (
                <div key={i.q}>
                  <h3 className="font-semibold">{i.q}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-[#374151]">{i.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(reviewUrl || site) && (
          <section className="mt-10 flex flex-wrap gap-3">
            {site && (
              <a href={site} rel="noopener" className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: brandColor, color: onBrand }}>
                Visiter le site
              </a>
            )}
            {reviewUrl && (
              <a href={reviewUrl} rel="noopener nofollow" className="rounded-lg border border-[#D5D9E4] px-4 py-2 text-sm font-semibold">
                Donner votre avis sur Google
              </a>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-[#E5E7EB]">
        <div className="mx-auto max-w-3xl px-5 py-6 text-sm text-[#5A6275]">
          <p>
            Page publiée par {business.name} via{' '}
            <a href={process.env.NEXT_PUBLIC_SITE_URL ?? "https://repere-ia.fr"} className="underline decoration-1 underline-offset-2">
              Repéré
            </a>
            . Informations fournies et vérifiées par l’entreprise
            {updated && !Number.isNaN(updated.getTime()) ? ` (mise à jour le ${updated.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })})` : ''}.
          </p>
        </div>
      </footer>
    </div>
  );
}
