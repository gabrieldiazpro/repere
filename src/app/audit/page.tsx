import type { Metadata } from 'next';
import Link from 'next/link';
import r from '@/components/report/report.module.css';
import s from './audit.module.css';
import { AuditForm, type AuditPrefill } from './AuditForm';
import { ARRONDISSEMENTS, CITIES, TRADES } from './options';
import { Header } from '@/components/site/Header';
import { abs } from '@/lib/seo/site';
import { breadcrumbListLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/lib/seo/shell';

const AUDIT_TITLE = 'Test de visibilité IA par nom, gratuit';
// ≤ 160 caractères : au-delà, Google coupe la description (V6).
const AUDIT_DESC = 'Commerce, PME ou e-commerce : ChatGPT, Gemini et Perplexity vous citent-ils ? Qui citent-ils à votre place, quelles sources lisent-ils ? Offre Découverte.';
const AUDIT_OG = { url: abs('/opengraph-image'), width: 1200, height: 630, alt: AUDIT_TITLE };

export const metadata: Metadata = {
  title: AUDIT_TITLE,
  description: AUDIT_DESC,
  alternates: { canonical: abs('/audit') },
  openGraph: { title: AUDIT_TITLE, description: AUDIT_DESC, url: abs('/audit'), type: 'website', locale: 'fr_FR', siteName: 'Repéré', images: [AUDIT_OG] },
  twitter: { card: 'summary_large_image', title: AUDIT_TITLE, description: AUDIT_DESC, images: [AUDIT_OG.url] },
};

const AUDIT_CRUMBS = breadcrumbListLd('/audit', [
  { name: 'Accueil', path: '/' },
  { name: 'Test par nom', path: '/audit' },
]);

type SP = Record<string, string | string[] | undefined>;

const first = (sp: SP, ...keys: string[]) => {
  for (const k of keys) {
    const v = sp[k];
    const x = Array.isArray(v) ? v[0] : v;
    if (x && x.trim()) return x.trim().slice(0, 120);
  }
  return undefined;
};

const fold = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function resolvePrefill(sp: SP): AuditPrefill {
  const out: AuditPrefill = {};
  const nom = first(sp, 'nom', 'name', 'businessName');
  if (nom) out.businessName = nom;

  const metier = first(sp, 'metier', 'métier', 'trade');
  if (metier) {
    const t = TRADES.find((x) => x.slug === fold(metier) || fold(x.nom) === fold(metier.replace(/-/g, ' ')));
    out.trade = t ? t.nom.toLowerCase() : metier.replace(/-/g, ' ');
  }

  const ville = first(sp, 'ville', 'city');
  if (ville) {
    const f = fold(ville);
    const arr = ARRONDISSEMENTS.find((a) => a.slug === f || fold(a.nom) === f);
    const city = CITIES.find((c) => c.slug === f || fold(c.nom) === f);
    if (arr) {
      out.city = 'Paris';
      out.district = arr.short;
    } else if (city) {
      out.city = city.nom;
    } else {
      out.city = ville;
    }
  }

  const quartier = first(sp, 'quartier', 'arrondissement', 'district');
  if (quartier && !out.district) {
    const q = fold(quartier).replace(/^paris\s*/, '');
    const n = q.match(/^(\d{1,2})/);
    const arr = n ? ARRONDISSEMENTS[Number(n[1]) - 1] : ARRONDISSEMENTS.find((a) => a.slug === q);
    if (arr && (!out.city || fold(out.city) === 'paris')) {
      out.city = 'Paris';
      out.district = arr.short;
    } else {
      out.district = quartier;
    }
  }

  const site = first(sp, 'site', 'website');
  if (site) out.website = site;

  // V2 : parcours (?segment=local|pme|ecommerce, alias e-commerce/ecom/b2b)
  const seg = fold(first(sp, 'segment', 'parcours') ?? '');
  if (seg === 'pme' || seg === 'b2b') out.segment = 'pme';
  else if (seg === 'ecommerce' || seg === 'e-commerce' || seg === 'ecom') out.segment = 'ecommerce';
  else if (seg === 'local') out.segment = 'local';
  const categorie = first(sp, 'categorie', 'secteur', 'category');
  if (categorie) out.category = categorie;
  const offre = first(sp, 'offre', 'offering');
  if (offre) out.offering = offre;
  const marche = first(sp, 'marche', 'market');
  if (marche) out.market = marche;
  const produits = first(sp, 'produits', 'productCategories');
  if (produits) out.productCategories = produits.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3);
  const concurrents = first(sp, 'concurrents', 'knownCompetitors');
  if (concurrents) out.knownCompetitors = concurrents;
  return out;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const prefill = resolvePrefill(await searchParams);
  return (
    <>
    <JsonLd data={AUDIT_CRUMBS} />
    <Header />
    <div className={r.root}>
      <main id="contenu" className={s.page}>
        <header className={s.head}>
          <span className={r.eyebrow}>Découverte · gratuit, sans inscription</span>
          <h1>Votre test de visibilité IA, par le nom</h1>
          <p>
            {prefill.segment === 'pme'
              ? 'Le nom de votre entreprise et votre secteur suffisent. Nous posons aux IA les questions de vos acheteurs.'
              : prefill.segment === 'ecommerce'
                ? 'Le nom de votre marque et une catégorie de produits suffisent. Nous posons aux IA les questions de vos acheteurs.'
                : 'Le nom, le métier et la ville suffisent : le site et l\'e-mail sont facultatifs. Nous nous occupons du reste.'}
          </p>
        </header>
        {/* V5 : qui a un site obtient l'analyse complète Google + IA (exploration réelle) ; ce formulaire reste le test par nom. */}
        <p
          role="note"
          style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--tone-brand-line)', background: 'var(--tone-brand-bg)', color: 'var(--ink)', fontSize: 15, lineHeight: 1.5 }}
        >
          Vous avez un site ?{' '}
          <a
            href={`/analyse${prefill.website || prefill.segment ? `?${new URLSearchParams({ ...(prefill.website ? { site: prefill.website } : {}), ...(prefill.segment ? { segment: prefill.segment } : {}) }).toString()}` : ''}`}
            style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Analysez-le en 60 secondes, sur Google et dans les IA
          </a>
          {' '}: notre robot l’explore page par page et vous donne vos 5 priorités.
        </p>
        <AuditForm prefill={prefill} />
        <p className={s.reassure}>
          <span>✓ Gratuit, sans carte bancaire</span>
          <span>✓ ChatGPT, Gemini et Perplexity</span>
          <span>✓ Les concurrents cités à votre place</span>
          <span>✓ Les sources que lisent les IA</span>
        </p>
        <section className={s.after} aria-labelledby="audit-contenu">
          <h2 id="audit-contenu">Ce que contient votre audit</h2>
          <ul>
            <li>Les réponses de ChatGPT, Gemini et Perplexity aux questions que posent vos clients.</li>
            <li>Votre score de visibilité sur 100, avec sa fourchette : une mesure à un instant donné, pas une position garantie.</li>
            <li>Les entreprises citées à votre place et les sources que les IA lisent pour votre activité.</li>
            <li>Les premières actions à mener, par ordre d’importance.</li>
          </ul>
          <p>
            Vous avez un site ? L’<Link href="/analyse">analyse SEO et IA en 60 secondes</Link> l’explore page par page. Comment nous mesurons :{' '}
            <Link href="/methode">notre méthode et ses limites</Link>. À lire aussi :{' '}
            <Link href="/questions/savoir-si-les-ia-recommandent-mon-entreprise">comment savoir si les IA recommandent votre entreprise</Link>{' '}
            et <Link href="/questions/audit-seo-gratuit">comment faire un audit SEO gratuit</Link>.
          </p>
        </section>
      </main>
    </div>
    </>
  );
}
