/**
 * JSON-LD de la fiche officielle : Organization / LocalBusiness (ou sous-type) EXACT et complet, construit seulement
 * avec les faits publiés (saisis ou confirmés par le client). JAMAIS pour un compte démo : la fonction renvoie null.
 */
import type { Segment } from '@/lib/engine/types-v2';
import { parseAddress, parseOpeningHours, schemaTypeFor, yearOf } from '../jsonld';
import type { FaqItem } from '../types';
import { capitalize, cleanUrl, splitList } from '../util';
import type { PublicFiche } from './model';

type Node = Record<string, unknown>;

export interface OfficialJsonLdInput {
  fiche: PublicFiche;
  business: { id: string; name: string; trade: string; city?: string };
  segment: Segment;
  /** URL de la fiche publique /p/<slug> */
  pageUrl: string;
  schemaType?: string;
  logoUrl?: string;
  faq?: FaqItem[];
  /** compte démo : aucun balisage, quoi qu'il arrive */
  demo: boolean;
}

const LANG: Record<string, string> = {
  francais: 'fr',
  anglais: 'en',
  espagnol: 'es',
  allemand: 'de',
  italien: 'it',
  portugais: 'pt',
  arabe: 'ar',
  chinois: 'zh',
  neerlandais: 'nl',
  russe: 'ru',
  polonais: 'pl',
  turc: 'tr',
  japonais: 'ja',
  roumain: 'ro',
};
const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** « Français, anglais » → ['fr', 'en'] (langues inconnues : nom tel quel). */
export function languageCodes(s: string | undefined): string[] {
  return [...new Set(splitList(s).map((l) => LANG[strip(l)] ?? capitalize(l.trim())))];
}

export function buildOfficialJsonLd(input: OfficialJsonLdInput): Node | null {
  if (input.demo || input.fiche.demo) return null;
  const { fiche, business, segment } = input;
  const t = fiche.text;
  const name = t.nom || business.name;
  const site = cleanUrl(t.site);
  const orgId = `${input.pageUrl}#organization`;
  const type = schemaTypeFor(business.trade, segment, input.schemaType);
  const org: Node = { '@type': type, '@id': orgId, name };
  if (site) org.url = site;
  if (t.activite) org.description = t.activite;
  if (input.logoUrl) org.logo = input.logoUrl;
  if (t.telephone) org.telephone = t.telephone;
  if (t.email) org.email = t.email;
  const address = parseAddress(t.adresse, business.city);
  if (t.adresse && address) org.address = address;
  const year = yearOf(t.creation);
  if (year) org.foundingDate = year;
  if (t.dirigeant) org.founder = { '@type': 'Person', name: t.dirigeant.replace(/,.*$/, '').trim() };
  const zones = splitList(t.zone);
  if (zones.length) org.areaServed = zones.map((z) => ({ '@type': 'Place', name: z }));
  const sameAs = [...new Set([...fiche.sameAs])];
  if (sameAs.length) org.sameAs = sameAs;
  const langs = languageCodes(t.langues);
  if (langs.length) org.knowsLanguage = langs;
  if (t.telephone || t.email)
    org.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      ...(t.telephone ? { telephone: t.telephone } : {}),
      ...(t.email ? { email: t.email } : {}),
      ...(langs.length ? { availableLanguage: langs } : {}),
    };
  const local = type !== 'Organization' && type !== 'OnlineStore';
  if (local) {
    const hours = parseOpeningHours(t.horaires);
    if (hours.length) org.openingHoursSpecification = hours;
    if (t.paiement) org.paymentAccepted = splitList(t.paiement).join(', ');
  }
  if (fiche.exceptions.length)
    org.specialOpeningHoursSpecification = fiche.exceptions.map((e) => ({
      '@type': 'OpeningHoursSpecification',
      validFrom: e.from,
      validThrough: e.to ?? e.from,
      ...(e.closed ? { opens: '00:00', closes: '00:00' } : { opens: e.opens, closes: e.closes }),
    }));
  if (fiche.services.length)
    org.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: segment === 'ecommerce' ? 'Produits' : 'Services',
      itemListElement: fiche.services.map((s) =>
        typeof s.priceFrom === 'number'
          ? {
              '@type': 'Offer',
              itemOffered: { '@type': segment === 'ecommerce' ? 'Product' : 'Service', name: s.name },
              priceSpecification: { '@type': 'PriceSpecification', minPrice: s.priceFrom, priceCurrency: 'EUR', ...(s.unit ? { description: `à partir de ${s.priceFrom} € ${s.unit}` } : {}) },
            }
          : { '@type': 'Service', name: s.name },
      ),
    };
  if (fiche.certifications.length)
    org.hasCredential = fiche.certifications.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      name: c.name,
      ...(c.number ? { identifier: c.number } : {}),
      ...(c.verifyUrl ? { url: c.verifyUrl } : {}),
      ...(c.issuer ? { recognizedBy: { '@type': 'Organization', name: c.issuer } } : {}),
    }));

  const page: Node = {
    '@type': 'ProfilePage',
    '@id': `${input.pageUrl}#page`,
    url: input.pageUrl,
    name: `${name} : fiche officielle`,
    inLanguage: 'fr-FR',
    mainEntity: { '@id': orgId },
    ...(fiche.updatedAt ? { dateModified: fiche.updatedAt } : {}),
    ...(fiche.confirmedAt ? { lastReviewed: fiche.confirmedAt } : {}),
  };
  const graph: Node[] = [org, page];
  if (input.faq?.length)
    graph.push({
      '@type': 'FAQPage',
      '@id': `${input.pageUrl}#faq`,
      url: input.pageUrl,
      about: { '@id': orgId },
      mainEntity: input.faq.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    });
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** Balisage pour la page du client (encart) : seulement le nœud de l'entreprise, avec un lien vers la fiche. */
export function clientSiteJsonLd(full: Node | null): Node | null {
  if (!full) return null;
  const graph = (full['@graph'] as Node[] | undefined) ?? [];
  const org = graph.find((n) => n['@id'] && String(n['@id']).endsWith('#organization'));
  if (!org) return null;
  const page = graph.find((n) => n['@type'] === 'ProfilePage');
  return { '@context': 'https://schema.org', ...org, ...(page?.url ? { subjectOf: { '@type': 'WebPage', url: page.url } } : {}) };
}
