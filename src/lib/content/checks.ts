/**
 * Contrôles d'un brouillon (purs, sans réseau) :
 * - citabilité : passages notés avec les critères de src/lib/geo (autonomie, chiffre, date, source, réponse directe,
 *   longueur, entités) — heuristique de rédaction, pas une mesure de citation ;
 * - titre, méta-description, structure, longueur, adresse ;
 * - cannibalisation avec les pages existantes (même sujet → réécrire plutôt que créer) ;
 * - maillage interne proposé (dans les deux sens) ;
 * - JSON-LD construit uniquement à partir des faits ;
 * - sources publiques : pages que les IA citent sur les questions visées (institutions, presse, encyclopédies).
 */
import type { CrawledPage, SiteCrawl } from '@/lib/crawl/types';
import { extractPassages, scorePassage } from '@/lib/geo/passages';
import { geoPages, overlap, stems } from '@/lib/geo/util';
import type { UrlStat } from '@/lib/engine/types-v3';
import { escapeHtml } from '@/lib/publish/pages';
import { factLines, factValue } from './facts';
import { bodyToHtml, bodyToText, parseBody, TODO_TEST, wordsOf } from './markdown';
import type { CannibalRisk, CheckItem, Citability, FactSheet, InternalLink, PageFormat, PageType, PublicSource } from './types';

export interface SitePage {
  url: string;
  title?: string | null;
  h1?: string | null;
  words: number;
}

// ---------------------------------------------------------------------------
// Citabilité (src/lib/geo)
// ---------------------------------------------------------------------------
function fakeCrawl(url: string, html: string): SiteCrawl {
  const page: CrawledPage = {
    url,
    finalUrl: url,
    status: 200,
    redirectChain: [],
    depth: 1,
    contentType: 'text/html',
    bytes: html.length,
    fetchMs: 0,
    headers: {},
    html,
    hreflang: [],
    h1: [],
    headings: [],
    wordCount: 0,
    textHash: '',
    images: [],
    jsonLd: [],
    jsonLdErrors: [],
    openGraph: {},
    internalLinks: 0,
    externalLinks: 0,
    isIndexable: true,
    renderHints: { scriptsCount: 0, textToHtmlRatio: 1, likelyClientRendered: false },
  };
  const origin = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return 'https://exemple.invalid';
    }
  })();
  return { startUrl: url, origin, finalOrigin: origin, startedAt: new Date(0).toISOString(), durationMs: 0, truncated: false, robots: null, sitemaps: [], sitemapUrls: [], pages: [page], links: [], errors: [] };
}

export function citabilityOf(title: string, body: string, brand: string, url = 'https://exemple.invalid/brouillon'): Citability {
  const html = `<!doctype html><html lang="fr"><head><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1>${bodyToHtml(stripSources(body))}</main></body></html>`;
  const [page] = geoPages(fakeCrawl(url, html));
  if (!page) return { score: 0, passages: [] };
  const passages = extractPassages(page).map((p) => scorePassage(p, brand));
  if (!passages.length) return { score: 0, passages: [] };
  const score = Math.round(passages.reduce((s, p) => s + p.score, 0) / passages.length);
  return { score, passages: passages.map((p) => ({ heading: p.heading, score: p.score, missing: p.missing })) };
}

/** La section « Sources » et « À lire aussi » ne sont pas des passages de contenu. */
function stripSources(body: string): string {
  return body.replace(/\n## (Sources|À lire aussi)\n[\s\S]*?(?=\n## |$)/g, '\n');
}

// ---------------------------------------------------------------------------
// Méta
// ---------------------------------------------------------------------------
const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : t.slice(0, max)).replace(/[\s,;:–—|-]+$/, '');
};

export function metaTitleFor(title: string, name: string): string {
  const withName = title.toLowerCase().includes(name.toLowerCase()) ? title : `${title} | ${name}`;
  return clip(withName.length <= 60 ? withName : title, 60);
}

/** Méta-description tirée des premières phrases du corps (jamais de texte nouveau). */
export function metaDescriptionFor(body: string): string {
  // Paragraphes seulement (ni intertitres ni listes), sans marqueur « [à compléter] ».
  const text = parseBody(stripSources(body))
    .filter((b) => b.type === 'p')
    .map((b) => b.text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^\s)]*\)/g, '$1'))
    .join(' ');
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && !TODO_TEST.test(s));
  let out = '';
  for (const s of sentences) {
    if ((out ? `${out} ${s}` : s).length > 158) break;
    out = out ? `${out} ${s}` : s;
  }
  if (!out && sentences[0]) out = `${clip(sentences[0], 155)}…`;
  return out;
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------
export function structureChecks(d: { title: string; slug: string; metaTitle: string; metaDescription: string; body: string; format: PageFormat; jsonLd: string[] }, cannibal: CannibalRisk[], citability: Citability): CheckItem[] {
  const blocks = parseBody(d.body);
  const h2 = blocks.filter((b) => b.type === 'h2').length;
  const words = wordsOf(bodyToText(stripSources(d.body)));
  const todos = TODO_TEST.test(`${d.title}\n${d.metaTitle}\n${d.metaDescription}\n${d.body}`);
  const minWords = d.format === 'article' ? 500 : 250;
  return [
    { id: 'todo', label: 'Aucun fait manquant', ok: !todos, detail: todos ? 'Des « [à compléter] » restent : complétez la fiche faits clés ou le texte.' : 'Toutes les informations viennent de vos faits.', blocking: true },
    { id: 'title', label: 'Titre de la page (balise title)', ok: d.metaTitle.length >= 20 && d.metaTitle.length <= 60, detail: `${d.metaTitle.length} caractères (20 à 60 conseillés).` },
    { id: 'description', label: 'Méta-description', ok: d.metaDescription.length >= 70 && d.metaDescription.length <= 160, detail: d.metaDescription ? `${d.metaDescription.length} caractères (70 à 160 conseillés).` : 'Absente : elle se remplira avec vos faits.' },
    { id: 'structure', label: 'Intertitres', ok: h2 >= 2, detail: `${h2} intertitre${h2 > 1 ? 's' : ''} (au moins 2 pour des passages citables).` },
    { id: 'length', label: 'Longueur', ok: words >= minWords, detail: `${words} mots (${minWords} conseillés pour ${d.format === 'article' ? 'un article' : 'une page'} ; jamais de remplissage).` },
    { id: 'slug', label: 'Adresse', ok: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug) && d.slug.length <= 70, detail: `/${d.slug}` },
    { id: 'jsonld', label: 'Données structurées', ok: d.jsonLd.length > 0, detail: d.jsonLd.length ? `${d.jsonLd.length} bloc${d.jsonLd.length > 1 ? 's' : ''} JSON-LD construit${d.jsonLd.length > 1 ? 's' : ''} depuis vos faits.` : 'Aucun bloc : faits insuffisants.' },
    { id: 'citability', label: 'Citabilité des passages (GEO)', ok: citability.score >= 55, detail: `${citability.score}/100 en moyenne sur ${citability.passages.length} passage${citability.passages.length > 1 ? 's' : ''} (heuristique de rédaction, pas une garantie de citation).` },
    {
      id: 'cannibal',
      label: 'Pas de doublon avec vos pages',
      ok: !cannibal.some((c) => c.level === 'fort'),
      detail: cannibal.length ? `${cannibal.length} page${cannibal.length > 1 ? 's' : ''} proche${cannibal.length > 1 ? 's' : ''} : ${cannibal[0].url}` : 'Aucune page existante ne traite le même sujet.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Cannibalisation et maillage
// ---------------------------------------------------------------------------
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

const hay = (p: SitePage) => `${p.title ?? ''} ${p.h1 ?? ''} ${decodeURIComponent(pathOf(p.url)).replace(/[-_/]+/g, ' ')}`;

/** Recouvrement de sujets, hors mots de la marque (présents dans tous les titres du site). */
function topicOverlap(q: string, text: string, brand: string): number {
  const skip = new Set(stems(brand));
  const a = [...new Set(stems(q))].filter((w) => !skip.has(w));
  if (!a.length) return 0;
  const b = new Set(stems(text));
  return a.filter((w) => b.has(w)).length / a.length;
}

export function cannibalization(target: string, title: string, pages: SitePage[], exceptUrl?: string, brand = ''): CannibalRisk[] {
  const out: CannibalRisk[] = [];
  for (const p of pages) {
    if (exceptUrl && p.url === exceptUrl) continue;
    if (pathOf(p.url).replace(/\/+$/, '') === '') continue;
    const o = Math.max(topicOverlap(target, hay(p), brand), topicOverlap(title, hay(p), brand));
    if (o < 0.5) continue;
    out.push({
      url: p.url,
      title: p.title || p.h1 || pathOf(p.url),
      overlap: Math.round(o * 100) / 100,
      level: o >= 0.75 ? 'fort' : 'moyen',
      advice: o >= 0.75 ? 'Même sujet : enrichissez plutôt cette page (réécriture) pour ne pas créer deux pages concurrentes.' : 'Sujet voisin : reliez les deux pages et gardez des angles distincts.',
    });
  }
  return out.sort((a, b) => b.overlap - a.overlap).slice(0, 5);
}

const CONTACT_RE = /contact|nous[-\s]joindre|devis/i;
const PRICE_RE = /tarif|prix/i;

export function internalLinks(target: string, pageType: PageType, pages: SitePage[], draftPath: string): InternalLink[] {
  const out: InternalLink[] = [];
  const seen = new Set<string>();
  const push = (l: InternalLink) => {
    const k = `${l.direction}:${l.url}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(l);
  };
  const scored = pages
    .filter((p) => pathOf(p.url) !== draftPath && pathOf(p.url).replace(/\/+$/, '') !== '')
    .map((p) => ({ p, s: overlap(target, hay(p)) }))
    .filter((x) => x.s >= 0.25 && x.s < 0.75)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  for (const { p } of scored) {
    push({ url: pathOf(p.url), anchor: (p.title || p.h1 || pathOf(p.url)).split(/[|–—]/)[0].trim(), reason: 'Sujet voisin : lien utile au lecteur.', direction: 'depuis_brouillon' });
    push({ url: pathOf(p.url), anchor: '', reason: 'Ajouter sur cette page un lien vers la nouvelle page (mot-clé visé en ancre).', direction: 'vers_brouillon' });
  }
  const contact = pages.find((p) => CONTACT_RE.test(pathOf(p.url)));
  if (contact && pageType !== 'contact') push({ url: pathOf(contact.url), anchor: 'Nous contacter', reason: 'Prochaine étape du lecteur.', direction: 'depuis_brouillon' });
  const price = pages.find((p) => PRICE_RE.test(pathOf(p.url)));
  if (price && pageType !== 'tarifs') push({ url: pathOf(price.url), anchor: 'Nos tarifs', reason: 'Question la plus fréquente après la découverte d’un service.', direction: 'depuis_brouillon' });
  const home = pages.find((p) => pathOf(p.url).replace(/\/+$/, '') === '');
  if (home) push({ url: '/', anchor: '', reason: 'Lien depuis l’accueil ou le menu pour que la page soit trouvée par les robots.', direction: 'vers_brouillon' });
  return out.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Sources publiques
// ---------------------------------------------------------------------------
const CITABLE_CATEGORIES = new Set(['institutionnel', 'media_national', 'media_local', 'wikipedia']);

export function publicSourcesFor(urls: UrlStat[] | undefined, questionIds: string[], max = 4): PublicSource[] {
  if (!urls?.length || !questionIds.length) return [];
  const q = new Set(questionIds);
  return urls
    .filter((u) => CITABLE_CATEGORIES.has(u.category) && u.queries.some((x) => q.has(x)) && /^https:\/\//.test(u.url))
    .sort((a, b) => b.citations - a.citations)
    .slice(0, max)
    .map((u, i) => ({
      n: i + 1,
      url: u.url,
      title: (u.title || u.domain).slice(0, 120),
      domain: u.domain,
      note: `page citée ${u.citations} fois par les assistants IA sur cette question`,
    }));
}

// ---------------------------------------------------------------------------
// JSON-LD (faits uniquement)
// ---------------------------------------------------------------------------
export function buildJsonLd(o: { pageType: PageType; format: PageFormat; name: string; site: string; url: string; title: string; description: string; body: string; facts: FactSheet; segment: 'local' | 'pme' | 'ecommerce'; now: Date }): string[] {
  const out: Record<string, unknown>[] = [];
  const org: Record<string, unknown> = { '@type': o.segment === 'local' ? 'LocalBusiness' : 'Organization', name: o.name, url: o.site };
  const tel = factValue(o.facts, 'telephone');
  const addr = factValue(o.facts, 'adresse');
  const email = factValue(o.facts, 'email');
  if (tel) org.telephone = tel;
  if (addr) org.address = addr;
  if (email) org.email = email;
  const zone = factValue(o.facts, 'zone');
  if (zone && o.segment !== 'ecommerce') org.areaServed = zone;

  if (o.format === 'article') {
    out.push({ '@context': 'https://schema.org', '@type': 'Article', headline: o.title.slice(0, 110), description: o.description, datePublished: o.now.toISOString().slice(0, 10), author: { '@type': 'Organization', name: o.name, url: o.site }, publisher: { '@type': 'Organization', name: o.name }, mainEntityOfPage: o.url });
  } else if (o.pageType === 'a-propos') {
    out.push({ '@context': 'https://schema.org', '@type': 'AboutPage', name: o.title, url: o.url, mainEntity: { ...org, ...(factValue(o.facts, 'creation') ? { foundingDate: factValue(o.facts, 'creation') } : {}) } });
  } else if (o.pageType === 'contact') {
    out.push({ '@context': 'https://schema.org', '@type': 'ContactPage', name: o.title, url: o.url, mainEntity: org });
  } else if (o.pageType === 'service' || o.pageType === 'zone' || o.pageType === 'tarifs') {
    const services = factLines(o.facts, 'services');
    out.push({ '@context': 'https://schema.org', '@type': 'Service', name: o.title, url: o.url, provider: org, ...(zone ? { areaServed: zone } : {}), ...(services.length ? { hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Services', itemListElement: services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s } })) } } : {}) });
  } else {
    out.push({ '@context': 'https://schema.org', '@type': 'WebPage', name: o.title, url: o.url, about: org });
  }
  // FAQ balisée : seulement les questions VISIBLES dont la réponse est complète.
  const faq = faqPairs(o.body);
  if (faq.length >= 2) {
    out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
  return out.map((x) => JSON.stringify(x));
}

/** Questions (### …?) suivies de leur réponse, sans marqueur « [à compléter] ». */
export function faqPairs(body: string): { q: string; a: string }[] {
  const blocks = parseBody(body);
  const out: { q: string; a: string }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if ((b.type === 'h3' || b.type === 'h2') && b.text.trim().endsWith('?')) {
      const next = blocks[i + 1];
      if (next && next.type === 'p' && !TODO_TEST.test(next.text)) out.push({ q: b.text, a: next.text.replace(/\*\*/g, '') });
    }
  }
  return out.slice(0, 20);
}
