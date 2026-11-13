/**
 * Section « Entité » : qui est l'entreprise, de façon cohérente pour une machine.
 * Nom / adresse / téléphone entre pages, JSON-LD Organization/LocalBusiness, sameAs, page « à propos », auteurs,
 * et concordance avec la fiche de vérité. Le JSON-LD proposé n'utilise QUE des valeurs trouvées (rien d'inventé).
 */
import { generateJsonLd, ruleFor, typesOf } from '@/lib/siteaudit/jsonld';
import { norm } from '@/lib/engine/detect';
import type { FactsInput, GeoFinding, GeoSection, GeoSiteType } from './types';
import { EMAIL_RE, POSTCODE_RE, clip, formatPhone, finding, homePage, nodesOfType, normPhone, phonesIn, plural, section, str, strList, type GeoPage, type JsonNode } from './util';

const CAT = 'geo.entite';

const ORG_TYPES = new Set(['Organization', 'Corporation', 'LocalBusiness', 'OnlineStore', 'OnlineBusiness', 'Store', 'ProfessionalService', 'NGO', 'MedicalOrganization', 'EducationalOrganization']);
export function isOrgType(types: string[]): boolean {
  return types.some((t) => ORG_TYPES.has(t) || ruleFor(t)?.as === 'LocalBusiness');
}
export function isLocalType(types: string[]): boolean {
  return types.some((t) => t !== 'Organization' && t !== 'Corporation' && t !== 'OnlineStore' && t !== 'OnlineBusiness' && (t === 'LocalBusiness' || ruleFor(t)?.as === 'LocalBusiness'));
}

const ABOUT_RE = /(a-propos|apropos|qui-sommes-nous|quisommesnous|notre-histoire|notre-equipe|l-equipe|equipe|about|about-us|histoire|la-societe|entreprise|presentation|nous-connaitre)/i;
const ABOUT_TITLE = /(à propos|a propos|qui sommes-nous|notre histoire|notre équipe|l’équipe|l'équipe|about us)/i;
export const ARTICLE_URL = /\/(blog|actualites?|actus?|news|articles?|guides?|conseils?|magazine|journal|ressources)\//i;
const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'Report']);
const BYLINE = /\b(par|rédigé par|écrit par|auteur\s*:|by)\s+[A-ZÀ-Ý][\p{L}'’-]+(\s+[A-ZÀ-Ý][\p{L}'’-]+)?/u;
const SOCIAL = /(facebook\.com|instagram\.com|linkedin\.com|youtube\.com|x\.com|twitter\.com|tiktok\.com|pinterest\.|wikipedia\.org|wikidata\.org|pagesjaunes\.fr|tripadvisor\.|g\.page|maps\.app\.goo\.gl|google\.[a-z.]+\/maps|trustpilot\.com)/i;

export function isArticlePage(p: GeoPage): boolean {
  return [...p.types].some((t) => ARTICLE_TYPES.has(t)) || (p.page.openGraph?.['og:type'] ?? '') === 'article' || ARTICLE_URL.test(p.path + '/');
}

/** Pages d'information générale où une date ou un auteur n'est pas attendu. */
export const UTILITY_PATH = /(mentions|legal|cgv|cgu|confidentialit|privacy|cookies|contact|panier|cart|checkout|compte|account|login|connexion|plan-du-site|sitemap)/i;

export interface EntityFacts {
  name: string | null;
  names: string[];
  phones: string[];
  jsonLdPhones: string[];
  postcodes: string[];
  jsonLdPostcodes: string[];
  emails: string[];
  sameAs: string[];
  socialLinks: string[];
  description: string | null;
  address: string | null;
  city: string | null;
  orgNodes: JsonNode[];
  isLocal: boolean;
}

function addressText(a: unknown): { text: string | null; postcode: string | null; city: string | null } {
  if (typeof a === 'string') return { text: a, postcode: (a.match(POSTCODE_RE) ?? [null])[0], city: null };
  if (!a || typeof a !== 'object') return { text: null, postcode: null, city: null };
  const n = (Array.isArray(a) ? a[0] : a) as JsonNode;
  const street = str(n.streetAddress);
  const pc = str(n.postalCode);
  const city = str(n.addressLocality);
  const text = [street, [pc, city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null;
  return { text, postcode: pc, city };
}

/** Faits d'entité trouvés sur le site (JSON-LD + texte visible + liens). */
export function collectEntity(pages: GeoPage[], brand?: string): EntityFacts {
  const orgs = nodesOfType(pages, isOrgType).map((x) => x.node);
  const names = [...new Set(orgs.map((n) => str(n.name)).filter((x): x is string => !!x))];
  const home = homePage(pages);
  const siteName = home?.page.openGraph?.['og:site_name'] ?? null;
  const allNames = [...new Set([...names, ...(siteName ? [siteName] : [])])];
  const jsonLdPhones = [...new Set(orgs.flatMap((n) => strList(n.telephone)).map(normPhone))];
  const addr = orgs.map((n) => addressText(n.address)).find((a) => a.text) ?? { text: null, postcode: null, city: null };
  const jsonLdPostcodes = [...new Set(orgs.map((n) => addressText(n.address).postcode).filter((x): x is string => !!x))];
  const phones = new Map<string, number>();
  const postcodes = new Set<string>();
  const emails = new Set<string>();
  const social = new Set<string>();
  for (const p of pages) {
    if (!p.parsed) continue;
    for (const ph of phonesIn(p.parsed.bodyText)) phones.set(ph, (phones.get(ph) ?? 0) + 1);
    for (const l of p.parsed.links) if (/^tel:/i.test(l.href)) { const n = normPhone(l.href); if (n.length === 10) phones.set(n, (phones.get(n) ?? 0) + 1); }
    for (const pc of p.parsed.bodyText.match(/\b\d{5}\s+[A-ZÀ-Ý][\p{L}' -]{2,}/gu) ?? []) postcodes.add(pc.slice(0, 5));
    for (const e of p.parsed.bodyText.match(EMAIL_RE) ?? []) emails.add(e.toLowerCase());
    for (const l of p.parsed.links) if (/^mailto:/i.test(l.href)) emails.add(l.href.slice(7).split('?')[0].toLowerCase());
    for (const l of p.parsed.links) if (SOCIAL.test(l.href) && /^https?:/i.test(l.href)) social.add(l.href.split('#')[0]);
  }
  const sameAs = [...new Set(orgs.flatMap((n) => strList(n.sameAs)))];
  const name = brand?.trim() || names[0] || siteName || (home?.page.title ? home.page.title.split(/\s[|–—-]\s/).pop()?.trim() || null : null);
  return {
    name: name || null,
    names: allNames,
    phones: [...phones.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k),
    jsonLdPhones,
    postcodes: [...postcodes],
    jsonLdPostcodes,
    emails: [...emails],
    sameAs,
    socialLinks: [...social],
    description: str(orgs[0]?.description) ?? home?.page.metaDescription ?? null,
    address: addr.text,
    city: addr.city,
    orgNodes: orgs,
    isLocal: orgs.some((n) => isLocalType(typesOf(n))),
  };
}

function namesDiffer(names: string[]): boolean {
  const n = [...new Set(names.map((x) => norm(x)).filter(Boolean))];
  if (n.length < 2) return false;
  // Variantes acceptées : l'un contient l'autre (« Martin » / « Plomberie Martin »).
  for (let i = 0; i < n.length; i++) for (let j = 0; j < n.length; j++) if (i !== j && !n[i].includes(n[j]) && !n[j].includes(n[i])) return true;
  return false;
}

export function auditEntity(pages: GeoPage[], siteType: GeoSiteType, origin: string, facts: FactsInput = {}, brand?: string): { section: GeoSection; entity: EntityFacts } {
  const e = collectEntity(pages, brand);
  const findings: GeoFinding[] = [];
  const home = homePage(pages);
  const homeUrl = home?.url ?? origin;
  const withHtml = pages.filter((p) => p.parsed);

  /* --- JSON-LD d'entité --------------------------------------------- */
  const schemaType = siteType === 'local' ? 'LocalBusiness' : 'Organization';
  const proposed = () =>
    generateJsonLd(schemaType, {
      name: e.name ?? undefined,
      url: origin,
      description: e.description ?? undefined,
      telephone: facts.telephone ?? (e.jsonLdPhones[0] ?? e.phones[0] ? formatPhone(e.jsonLdPhones[0] ?? e.phones[0]) : undefined),
      address: facts.adresse ?? e.address ?? undefined,
      city: e.city ?? undefined,
      openingHours: facts.horaires,
      areaServed: facts.zone,
      services: facts.services,
      foundingYear: facts.creation,
      founder: facts.dirigeant,
      sameAs: [...new Set([...e.sameAs, ...e.socialLinks])].slice(0, 15),
    });
  if (!e.orgNodes.length && withHtml.length) {
    const g = proposed();
    findings.push(
      finding({
        id: 'geo.entite.no_jsonld',
        category: CAT,
        severity: siteType === 'local' ? 'high' : 'medium',
        title: `Aucune donnée structurée ${schemaType} sur le site : votre identité n’est pas décrite pour les machines`,
        why: 'Un bloc JSON-LD dit sans ambiguïté qui vous êtes (nom, adresse, téléphone, profils officiels). Google ne l’exige pas pour ses fonctions IA, mais il lève les confusions entre homonymes ; Bing le recommande.',
        fix: `Ajoutez le bloc ${schemaType} proposé dans le <head> de l’accueil (construit uniquement avec les informations trouvées sur votre site${Object.keys(facts).length ? ' et votre fiche' : ''}).`,
        affected: [{ url: homeUrl }],
        impact: 2,
        effort: 1,
        evidenceLevel: 'probable',
        autoFix: { kind: 'jsonld', payload: { url: homeUrl, value: g.jsonld, script: g.script, notes: g.notes } },
      }),
    );
  }

  /* --- nom ------------------------------------------------------------ */
  if (namesDiffer(e.names)) {
    findings.push(
      finding({
        id: 'geo.entite.name_inconsistent',
        category: CAT,
        severity: 'medium',
        title: `Votre nom apparaît sous ${e.names.length} formes différentes dans les données du site`,
        why: 'Des noms divergents (JSON-LD, og:site_name) brouillent l’identification de l’entreprise ; Bing recommande des noms d’entité clairs et constants.',
        fix: 'Choisissez une forme officielle et utilisez-la partout (JSON-LD name, og:site_name, titre de l’accueil).',
        affected: [{ url: homeUrl, detail: e.names.map((n) => `« ${n} »`).join(', ') }],
        impact: 2,
        effort: 1,
        evidenceLevel: 'probable',
        evidence: e.names.join(' / '),
      }),
    );
  }

  /* --- téléphone ------------------------------------------------------ */
  const missingPhones = e.jsonLdPhones.filter((p) => p.length === 10 && !e.phones.includes(p));
  if (missingPhones.length && withHtml.length) {
    findings.push(
      finding({
        id: 'geo.entite.phone_mismatch',
        category: CAT,
        severity: 'high',
        title: `Le téléphone déclaré dans vos données structurées (${missingPhones.join(', ')}) n’apparaît sur aucune page`,
        why: 'Une IA qui croise vos sources peut retenir un numéro obsolète. Les données structurées doivent refléter ce qui est visible sur la page.',
        fix: `Mettez le même numéro dans le JSON-LD et sur le site${e.phones[0] ? ` (le site affiche ${e.phones[0]})` : ''}.`,
        affected: [{ url: homeUrl, detail: `JSON-LD : ${missingPhones.join(', ')} ; visible : ${e.phones.slice(0, 3).join(', ') || 'aucun'}` }],
        impact: 3,
        effort: 1,
        evidenceLevel: 'probable',
      }),
    );
  }
  if (facts.telephone && withHtml.length) {
    const f = normPhone(facts.telephone);
    if (f.length === 10 && !e.phones.includes(f) && !e.jsonLdPhones.includes(f)) {
      findings.push(
        finding({
          id: 'geo.entite.facts_phone',
          category: CAT,
          severity: 'high',
          title: `Le téléphone de votre fiche (${facts.telephone}) n’apparaît pas sur le site`,
          why: 'Les IA reprennent ce qu’elles trouvent en ligne : si votre site affiche un autre numéro, ou aucun, elles risquent de donner le mauvais.',
          fix: 'Affichez ce numéro sur le site (pied de page, page contact) et dans le JSON-LD, ou corrigez votre fiche.',
          affected: [{ url: homeUrl, detail: `visible : ${e.phones.slice(0, 3).join(', ') || 'aucun'}` }],
          impact: 3,
          effort: 1,
          evidenceLevel: 'probable',
        }),
      );
    }
  }

  /* --- adresse -------------------------------------------------------- */
  const visiblePc = new Set(e.postcodes);
  const allText = withHtml.map((p) => p.parsed?.bodyText ?? '').join(' ');
  const pcMissing = e.jsonLdPostcodes.filter((pc) => !visiblePc.has(pc) && !allText.includes(pc));
  if (pcMissing.length && withHtml.length) {
    findings.push(
      finding({
        id: 'geo.entite.address_mismatch',
        category: CAT,
        severity: 'medium',
        title: `L’adresse de vos données structurées (code postal ${pcMissing.join(', ')}) n’apparaît sur aucune page`,
        why: 'Une adresse visible et identique partout confirme votre localisation aux IA comme aux moteurs.',
        fix: 'Affichez l’adresse complète sur le site (pied de page ou page contact), identique à celle du JSON-LD et de votre fiche Google.',
        affected: [{ url: homeUrl, detail: e.address ?? pcMissing.join(', ') }],
        impact: 2,
        effort: 1,
        evidenceLevel: 'probable',
      }),
    );
  }
  if (facts.adresse && withHtml.length) {
    const fpc = (facts.adresse.match(POSTCODE_RE) ?? [])[0];
    const known = new Set([...e.postcodes, ...e.jsonLdPostcodes]);
    if (fpc && known.size && !known.has(fpc) && !allText.includes(fpc)) {
      findings.push(
        finding({
          id: 'geo.entite.facts_address',
          category: CAT,
          severity: 'high',
          title: `L’adresse de votre fiche (${clip(facts.adresse, 60)}) diffère de celle du site`,
          why: 'Une adresse contradictoire entre vos sources est une cause classique d’erreur dans les réponses des IA.',
          fix: 'Mettez la même adresse partout : site, JSON-LD, fiche Google, annuaires.',
          affected: [{ url: homeUrl, detail: `site : ${[...known].join(', ')}` }],
          impact: 3,
          effort: 1,
          evidenceLevel: 'probable',
        }),
      );
    }
  }

  /* --- coordonnées absentes (commerce local) ------------------------- */
  if (siteType === 'local' && withHtml.length && !e.phones.length && !e.emails.length && !e.postcodes.length && !e.jsonLdPhones.length) {
    findings.push(
      finding({
        id: 'geo.entite.no_contact',
        category: CAT,
        severity: 'high',
        title: 'Aucun téléphone, e-mail ni adresse lisible sur le site',
        why: 'Pour recommander un commerce local, une IA a besoin de coordonnées vérifiables ; sans elles, elle s’appuie sur des annuaires parfois inexacts.',
        fix: 'Affichez téléphone, adresse et horaires en texte (pas en image) dans le pied de page et sur une page contact.',
        affected: [{ url: homeUrl }],
        impact: 3,
        effort: 1,
        evidenceLevel: 'probable',
      }),
    );
  }

  /* --- sameAs --------------------------------------------------------- */
  if (e.orgNodes.length && !e.sameAs.length) {
    const links = e.socialLinks.slice(0, 15);
    findings.push(
      finding({
        id: 'geo.entite.no_sameas',
        category: CAT,
        severity: 'low',
        title: 'Vos données structurées ne relient pas vos profils officiels (sameAs)',
        why: 'La propriété sameAs relie votre site à vos profils (fiche Google, réseaux, annuaires, Wikipédia) : elle aide à distinguer votre entreprise d’homonymes.',
        fix: links.length ? `Ajoutez sameAs avec les ${links.length} profils déjà liés depuis votre site.` : 'Ajoutez sameAs avec les adresses de vos profils officiels (fiche Google, LinkedIn, Facebook…).',
        affected: [{ url: homeUrl }],
        impact: 1,
        effort: 1,
        evidenceLevel: 'hypothese',
        ...(links.length ? { autoFix: { kind: 'jsonld', payload: { url: homeUrl, merge: { sameAs: links } } } } : {}),
      }),
    );
  }

  /* --- page « à propos » --------------------------------------------- */
  const about = pages.some((p) => ABOUT_RE.test(p.path) || ABOUT_TITLE.test(p.page.title ?? '') || p.page.h1.some((h) => ABOUT_TITLE.test(h)));
  const aboutLinked = withHtml.some((p) => p.parsed?.links.some((l) => ABOUT_RE.test(l.href) || ABOUT_TITLE.test(l.text)));
  if (!about && !aboutLinked && pages.length >= 3) {
    findings.push(
      finding({
        id: 'geo.entite.no_about',
        category: CAT,
        severity: siteType === 'local' ? 'low' : 'medium',
        title: 'Aucune page « À propos » ou « Qui sommes-nous » trouvée',
        why: 'C’est la page où une IA trouve qui vous êtes, depuis quand, avec quelle équipe et quelles qualifications : la matière d’une recommandation.',
        fix: 'Créez une page « À propos » factuelle : date de création, équipe, qualifications, zone, chiffres vérifiables, liens vers vos profils.',
        affected: [{ url: homeUrl }],
        impact: 2,
        effort: 2,
        evidenceLevel: 'hypothese',
      }),
    );
  }

  /* --- auteurs -------------------------------------------------------- */
  const articles = pages.filter((p) => isArticlePage(p) && p.parsed);
  const noAuthor = articles.filter((p) => {
    const ld = p.nodes.some((n) => typesOf(n).some((t) => ARTICLE_TYPES.has(t)) && (str(n.author) || (n.author && typeof n.author === 'object')));
    const meta = /<meta[^>]+name=["']author["']/i.test(p.page.html ?? '') || /rel=["']author["']/i.test(p.page.html ?? '');
    return !ld && !meta && !BYLINE.test(p.parsed?.bodyText.slice(0, 3000) ?? '');
  });
  if (noAuthor.length) {
    findings.push(
      finding({
        id: 'geo.entite.no_author',
        category: CAT,
        severity: noAuthor.length / articles.length >= 0.5 ? 'medium' : 'low',
        title: `${plural(noAuthor.length, 'article n’indique', 'articles n’indiquent')} pas d’auteur`,
        why: 'Un auteur identifié (nom, fonction, expérience) rend un contenu vérifiable ; c’est un signal de fiabilité pour les lecteurs comme pour les systèmes de qualité.',
        fix: 'Ajoutez une signature (« Par Prénom Nom, fonction ») et la propriété author dans le JSON-LD Article.',
        affected: noAuthor.map((p) => ({ url: p.url })),
        impact: 1,
        effort: 1,
        evidenceLevel: 'hypothese',
      }),
    );
  }

  const note = `${plural(e.orgNodes.length, 'bloc d’entité JSON-LD', 'blocs d’entité JSON-LD')}, ${plural(e.phones.length, 'téléphone visible', 'téléphones visibles')}, ${plural(e.socialLinks.length, 'profil lié', 'profils liés')}${Object.keys(facts).length ? ', fiche de vérité comparée' : ''}.`;
  return { section: section('entite', 'Identité de l’entreprise (entité)', 15, findings, note), entity: e };
}
