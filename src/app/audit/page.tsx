import type { Metadata } from 'next';
import r from '@/components/report/report.module.css';
import s from './audit.module.css';
import { AuditForm, type AuditPrefill } from './AuditForm';
import { ARRONDISSEMENTS, CITIES, TRADES } from './options';
import { Header } from '@/components/site/Header';
import { abs } from '@/lib/seo/site';
import { breadcrumbListLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/lib/seo/shell';

const AUDIT_TITLE = 'Votre audit de visibilité IA gratuit';
const AUDIT_DESC = 'Commerce, PME ou e-commerce : découvrez en quelques minutes si ChatGPT, Gemini et Perplexity vous citent, qui ils citent à votre place et quelles sources ils lisent.';

export const metadata: Metadata = {
  title: AUDIT_TITLE,
  description: AUDIT_DESC,
  alternates: { canonical: abs('/audit') },
  openGraph: { title: AUDIT_TITLE, description: AUDIT_DESC, url: abs('/audit'), type: 'website', locale: 'fr_FR', siteName: 'Repéré' },
  twitter: { card: 'summary_large_image', title: AUDIT_TITLE, description: AUDIT_DESC },
};

const AUDIT_CRUMBS = breadcrumbListLd('/audit', [
  { name: 'Accueil', path: '/' },
  { name: 'Audit gratuit', path: '/audit' },
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
          <span className={r.eyebrow}>Audit gratuit · sans engagement</span>
          <h1>Votre audit de visibilité IA</h1>
          <p>
            {prefill.segment === 'pme'
              ? 'Le nom de votre entreprise et votre secteur suffisent. Nous posons aux IA les questions de vos acheteurs.'
              : prefill.segment === 'ecommerce'
                ? 'Le nom de votre marque et une catégorie de produits suffisent. Nous posons aux IA les questions de vos acheteurs.'
                : 'Trois informations suffisent : le site et l\'e-mail sont facultatifs. Nous nous occupons du reste.'}
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
      </main>
    </div>
    </>
  );
}
