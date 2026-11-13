/**
 * Contenus rédigés (pas des plans) à partir des SEULES données du compte :
 * - page « comparatif honnête » face au concurrent qui passe devant (PME surtout, tous parcours) ;
 * - fiches produits enrichies (texte, balisage Product, FAQ produit) par produit phare (e-commerce).
 * Règle : aucun fait inventé. Ce que nous ne savons pas sur un concurrent est marqué « [à vérifier sur leur site] » ;
 * ce qui manque dans la fiche de vérité est listé à part, jamais rempli par un gabarit troué dans le balisage.
 */
import type { Segment } from '@/lib/engine/types-v2';
import type { FactsMap } from './types';
import { capitalize, escapeHtml, splitList } from './util';

export const TO_CHECK = '[à vérifier sur leur site]';
/** Cellule concurrent sans information publique relevée : à compléter explicitement avant publication. */
export const TO_FILL = '[à compléter : à vérifier sur leur site]';

/** Information publique relevée sur le concurrent (réponse d'une IA, source citée), avec sa provenance. */
export interface PublicCell {
  value: string;
  /** « réponses des IA », « sources citées par les IA »… */
  source: string;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const frLongDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(iso));

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ');
  return t ? capitalize(t).replace(/[.;,\s]*$/, '.') : '';
};
/** Minuscule initiale, sauf sigle (PME, DSN) ou nom propre (France, Lyon…). */
const PROPER = /^(France|Belgique|Suisse|Luxembourg|Europe|Paris|Lyon|Marseille|Lille|Nantes|Bordeaux|Toulouse|Cosmos|Ecocert|Google|Shopify)\b/;
const lower = (s: string) => (!s || /^[A-ZÀ-Ý]{2}/.test(s) || PROPER.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

// ---------------------------------------------------------------------------
// Comparatif honnête
// ---------------------------------------------------------------------------

export interface ComparisonInput {
  name: string;
  segment: Segment;
  /** « logiciel de paie pour PME », « plombier », « cosmétiques solides » */
  activity: string;
  /** offre en une phrase (saisie à l'audit), facultative */
  offering?: string;
  facts: FactsMap;
  competitor: string;
  /** ce que les DONNÉES disent du concurrent (descriptions relevées dans les réponses des IA, sources où il est présent) */
  competitorNotes?: string[];
  /** ISO */
  date: string;
  /** cellules concurrent pré-remplies (clé = libellé du critère, ex. « Prix public ») avec ce qui est publiquement relevé */
  competitorCells?: Record<string, PublicCell>;
  /** critères supplémentaires connus côté concurrent (sources où il est cité, description par les IA) */
  extraRows?: { label: string; mine: string | null; them: PublicCell }[];
}

export interface ComparisonPage {
  title: string;
  markdown: string;
  html: string;
}

interface Row {
  label: string;
  mine: string;
  them?: string;
}

/** Cible d'une fiche « clients » : on retire les compteurs (« 1 200 entreprises clientes ») qui ne sont pas un profil. */
export function audienceOf(clients: string | undefined): string | null {
  if (!clients) return null;
  const parts = clients
    .split(/[;\n]/)
    .map((x) => x.trim().replace(/\.$/, ''))
    .filter((x) => x && !/^(plus de |près de |environ |\+)?\d[\d\s .]*\s*(entreprises?|clients?|utilisateurs?|commandes?|avis)\b/i.test(x));
  return parts.length ? parts.join(' ; ') : null;
}

/** Page comparatif rédigée (Markdown + HTML), prête à relire et publier. */
export function buildComparisonPage(i: ComparisonInput): ComparisonPage {
  const f = i.facts;
  const me = i.name;
  const them = i.competitor;
  const what = i.segment === 'pme' ? 'solution' : i.segment === 'ecommerce' ? 'marque' : 'entreprise';
  const title = `${me} ou ${them} : ${i.segment === 'local' ? `quel ${i.activity} choisir` : `lequel choisir pour votre ${i.activity}`} ?`;
  const services = splitList(f.services ?? f.produits);
  const offer = i.offering?.replace(/\.$/, '') || (services.length ? services.join(', ') : '');
  // Aucune donnée d'audit dans une page publique (« cité 45 fois contre 18 ») : on ne garde que ce que disent les IA et les sources.
  const notes = (i.competitorNotes ?? []).map((n) => n.trim()).filter((n) => n && !/\bcit[ée]e? \d+ fois\b|\bdans l[’']audit\b|\bcitations?\b/i.test(n)).slice(0, 3);
  const dated = frLongDate(i.date);
  // « Pour qui » : la cible seulement (« PME de 10 à 250 salariés »), jamais un nombre de clients.
  const audience = audienceOf(f.clients);
  const descs = notes.map((n) => /« (.+?) »/.exec(n)?.[1]).filter((x): x is string => Boolean(x));

  // 1. Introduction
  const intro = [
    `Vous hésitez entre ${me} et ${them} ? Cette page les compare sur des critères vérifiables : prix public, contenu de l’offre, profil des clients.`,
    `Elle est rédigée par l’équipe ${me}. Nous l’avons voulue honnête : vous y trouverez aussi les cas où ${them} peut mieux vous convenir.`,
  ];

  // 2. En bref
  const brief: string[] = [];
  brief.push(
    `**${me}** — ${[offer && sentence(offer), f.prix && `Prix public : ${lower(f.prix).replace(/\.$/, '')}.`, audience && `Pour : ${lower(audience)}.`]
      .filter(Boolean)
      .join(' ') || `${capitalize(i.activity)}.`}`,
  );
  brief.push(
    `**${them}** — ${
      notes.length ? `D’après les réponses des IA analysées le ${dated} : ${notes.map((n) => n.replace(/\.$/, '')).join(' ; ')}.` : `Présentation ${TO_CHECK}.`
    } Offre et tarifs ${TO_CHECK}.`,
  );

  // 3. Tableau (seulement les critères que la fiche de vérité renseigne)
  const rows: Row[] = [];
  if (f.prix) rows.push({ label: 'Prix public', mine: f.prix });
  if (services.length) rows.push({ label: i.segment === 'ecommerce' ? 'Produits' : 'Ce qui est inclus', mine: services.join(', ') });
  if (audience) rows.push({ label: i.segment === 'pme' ? 'Pour quelles entreprises' : 'Pour qui', mine: audience });
  if (f.zone) rows.push({ label: i.segment === 'local' ? 'Zone d’intervention' : 'Couverture', mine: f.zone });
  if (f.livraison) rows.push({ label: 'Livraison', mine: f.livraison });
  if (f.retours) rows.push({ label: 'Retours', mine: f.retours });
  if (f.certifications) rows.push({ label: 'Labels', mine: f.certifications });
  if (f.horaires) rows.push({ label: 'Horaires', mine: f.horaires });
  if (f.creation) rows.push({ label: 'Création', mine: f.creation });
  // Cellules concurrent : ce qui est publiquement relevé (avec sa provenance et sa date), sinon « à compléter » explicite.
  const cell = (c: PublicCell | undefined) => (c && c.value.trim() ? `${c.value.trim().replace(/\.$/, '')} (${c.source}, relevé le ${dated})` : TO_FILL);
  for (const r of rows) r.them = cell(i.competitorCells?.[r.label]);
  for (const x of i.extraRows ?? []) if (x.them.value.trim()) rows.push({ label: x.label, mine: x.mine?.trim() || '—', them: cell(x.them) });

  // 4. Pour qui
  const forMe: string[] = [];
  if (audience) forMe.push(/^(pme|tpe|eti|entreprises?|start-?ups?|ind[ée]pendants?|cabinets?|associations?)\b/i.test(audience) ? `Vous êtes une ${lower(audience).replace(/^entreprises\b/, 'entreprise')}.` : `Vous êtes dans ce cas : ${lower(audience)}.`);
  if (services.length) forMe.push(`Vous voulez ${services.length > 1 ? `${services.slice(0, -1).join(', ')} et ${services[services.length - 1]}` : services[0]} au même endroit.`.replace(/Vous voulez (\S)/, (_, c: string) => `Vous voulez ${c.toLowerCase()}`));
  if (f.prix) forMe.push(`Vous voulez un prix affiché dès le départ : ${lower(f.prix).replace(/\.$/, '')}.`);
  if (f.zone && i.segment === 'local') forMe.push(`Vous êtes dans notre zone : ${f.zone}.`);
  if (!forMe.length) forMe.push(`Complétez votre fiche de vérité (prix, offre, clients) pour rédiger cette partie à partir de faits.`);

  // « Pour qui choisir l'autre » : des cas explicites à compléter, jamais une phrase creuse.
  const forThem: string[] = [];
  const size = /(\d[\d\s]*)\s*(?:à|-)\s*(\d[\d\s]*)\s*salari/i.exec(audience ?? '');
  if (size) forThem.push(`Si vous avez plus de ${size[2].trim()} salariés : ${TO_CHECK}.`);
  for (const d of descs.slice(0, 2)) forThem.push(`Si « ${d} » est votre premier critère : c’est ainsi que les IA décrivent ${them} (relevé le ${dated}) ${TO_CHECK}.`);
  if (forThem.length < 2) forThem.push(`Si vous cherchez ${i.segment === 'ecommerce' ? 'un produit ou un format que nous ne proposons pas' : 'une fonction que nous ne proposons pas'} : ${TO_CHECK}.`);

  // 5. FAQ (3 questions, réponses tirées de la fiche)
  const faq: { q: string; a: string }[] = [];
  faq.push({
    q: `Combien coûte ${me} par rapport à ${them} ?`,
    a: f.prix ? `${me} : ${lower(f.prix).replace(/\.$/, '')}. Le tarif de ${them} est ${TO_CHECK} (indiquez le prix public et sa date).` : `Nos prix sont ${'[à compléter dans votre fiche de vérité]'} ; celui de ${them} ${TO_CHECK}.`,
  });
  if (services.length) faq.push({ q: `Que comprend ${me} ?`, a: `${sentence(services.join(', '))}` });
  if (audience) faq.push({ q: `${me} convient-il à mon ${i.segment === 'pme' ? 'entreprise' : 'besoin'} ?`, a: `${me} s’adresse en priorité aux ${lower(audience).replace(/^(aux?|les)\s+/i, '')}.` });
  if (faq.length < 3 && f.zone) faq.push({ q: `Où ${me} intervient-il ?`, a: sentence(f.zone) });
  if (faq.length < 3 && f.creation) faq.push({ q: `Depuis quand ${me} existe-t-il ?`, a: `${me} existe depuis ${f.creation}.` });

  const mention = `Comparatif rédigé par ${me} le ${dated}, à partir de nos informations et des informations publiques de ${them} vérifiées à cette date. Une erreur sur ${them} ? Signalez-la-nous : nous corrigeons la page.`;

  const md = [
    `# ${title}`,
    '',
    ...intro,
    '',
    '## En bref',
    '',
    ...brief.map((b) => `- ${b}`),
    '',
    '## Comparatif point par point',
    '',
    `| Critère | ${me} | ${them} |`,
    '|---|---|---|',
    ...rows.map((r) => `| ${r.label} | ${r.mine.replace(/\|/g, '/')} | ${(r.them ?? TO_FILL).replace(/\|/g, '/')} |`),
    '',
    `## Pour qui choisir ${me}`,
    '',
    ...forMe.map((x) => `- ${x}`),
    '',
    `## Pour qui choisir ${them}`,
    '',
    ...forThem.map((x) => `- ${x}`),
    '',
    '## Questions fréquentes',
    '',
    ...faq.flatMap((x) => [`**${x.q}**`, x.a, '']),
    `_${mention}_`,
  ].join('\n');

  const h = escapeHtml;
  const strong = (s: string) => h(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const html = [
    `<article class="comparatif">`,
    `  <h1>${h(title)}</h1>`,
    ...intro.map((p) => `  <p>${h(p)}</p>`),
    `  <h2>En bref</h2>`,
    `  <ul>`,
    ...brief.map((b) => `    <li>${strong(b)}</li>`),
    `  </ul>`,
    `  <h2>Comparatif point par point</h2>`,
    `  <table>`,
    `    <thead><tr><th scope="col">Critère</th><th scope="col">${h(me)}</th><th scope="col">${h(them)}</th></tr></thead>`,
    `    <tbody>`,
    ...rows.map((r) => `      <tr><th scope="row">${h(r.label)}</th><td>${h(r.mine)}</td><td>${h(r.them ?? TO_FILL)}</td></tr>`),
    `    </tbody>`,
    `  </table>`,
    `  <h2>Pour qui choisir ${h(me)}</h2>`,
    `  <ul>`,
    ...forMe.map((x) => `    <li>${h(x)}</li>`),
    `  </ul>`,
    `  <h2>Pour qui choisir ${h(them)}</h2>`,
    `  <ul>`,
    ...forThem.map((x) => `    <li>${h(x)}</li>`),
    `  </ul>`,
    `  <h2>Questions fréquentes</h2>`,
    ...faq.flatMap((x) => [`  <h3>${h(x.q)}</h3>`, `  <p>${h(x.a)}</p>`]),
    `  <p><em>${h(mention)}</em></p>`,
    `</article>`,
  ].join('\n');
  return { title, markdown: md, html };
}

// ---------------------------------------------------------------------------
// Fiches produits enrichies (e-commerce)
// ---------------------------------------------------------------------------

export interface ProductSheet {
  product: string;
  /** prix lu dans la fiche de vérité, sinon null */
  price: number | null;
  title: string;
  text: string;
  faq: { q: string; a: string }[];
  /** balisage Product (+ FAQPage) sans aucune valeur inventée */
  jsonLd: Record<string, unknown>[];
  /** informations manquantes, à ajouter dans la fiche de vérité ou dans Shopify */
  missing: string[];
}

/** Prix d'un produit lu dans la fiche (« Shampoing solide 12,90 € ; déodorant solide 9,90 € »). */
export function priceFor(prix: string | undefined, product: string): number | null {
  if (!prix) return null;
  const head = fold(product).split(/\s+/)[0];
  for (const part of prix.split(/[;\n]/)) {
    if (!fold(part).includes(head)) continue;
    const m = /(\d{1,4}(?:[,.]\d{1,2})?)\s?€/.exec(part);
    if (m) return Number(m[1].replace(',', '.'));
  }
  return null;
}

function returnDays(retours: string | undefined): number | null {
  const m = retours ? /(\d{1,3})\s*(?:j|jours)\b/i.exec(retours) : null;
  return m ? Number(m[1]) : null;
}

/** Un produit du catalogue suivi (fiche au niveau du PRODUIT) ; une chaîne seule = une catégorie. */
export interface SheetProduct {
  name: string;
  category?: string | null;
  description?: string;
  price?: number;
  gtin?: string;
  sku?: string;
  url?: string;
}

const COUNTRY_RE = /^(france|belgique|suisse|luxembourg|canada|monaco|europe|france enti[eè]re|france m[ée]tropolitaine)$/i;

/** Ville réelle (jamais un pays : « Fabriqué par X à France » est omis). */
export function realCity(city: string | undefined): string | undefined {
  const c = city?.trim();
  return c && !COUNTRY_RE.test(c) ? c : undefined;
}

/** Composition sans la phrase d'instruction « liste INCI complète sur chaque fiche produit » (qui n'a rien à faire DANS la fiche). */
function compositionOf(ingredients: string | undefined): { text: string | null; inci: string | null } {
  if (!ingredients) return { text: null, inci: null };
  const inciM = /\bINCI\s*:\s*([^;\n]{12,})/i.exec(ingredients);
  const text = ingredients
    .split(/;/)
    .map((x) => x.trim())
    .filter((x) => x && !/\bINCI\b/i.test(x))
    .join(' ; ');
  return { text: text || null, inci: inciM ? inciM[1].trim() : null };
}

/** « pour cheveux normaux à secs » tiré de la description du produit, s'il y en a un. */
function forWhom(desc: string | undefined): string | null {
  const m = desc ? /\bpour ((?:les |la |le )?(?:cheveux|peaux?|cuirs?|b[ée]b[ée]s?|enfants|hommes|femmes|sportifs|cuir chevelu)[^,.;]*)/i.exec(desc) : null;
  return m ? m[1].trim() : null;
}

/**
 * Fiches enrichies, une par PRODUIT du catalogue suivi (sinon par catégorie). Structure : accroche bénéfice, pour qui,
 * composition (INCI réel si fourni, sinon « [collez votre liste INCI] »), labels, fabrication, prix, livraison, retours,
 * FAQ, balisage Product + Offer + FAQPage. Aucun fait inventé : ce qui manque est listé dans `missing`, pas écrit vide.
 */
export function buildProductSheets(args: { name: string; website?: string; facts: FactsMap; products: (string | SheetProduct)[]; city?: string }): ProductSheet[] {
  const { name, facts: f } = args;
  const site = args.website ? (/^https?:\/\//.test(args.website) ? args.website : `https://${args.website}`).replace(/\/$/, '') : undefined;
  const city = realCity(args.city) ?? realCity(/\d{5}\s+([^,;()]+)/.exec(f.adresse ?? '')?.[1]);
  const seen = new Set<string>();
  const list = args.products
    .map((x) => (typeof x === 'string' ? { name: x, category: x } : x))
    .filter((x) => {
      const k = fold(x.name);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return list.slice(0, 3).map((item) => {
    const isProduct = fold(item.name) !== fold(item.category ?? '');
    const product = item.name;
    const kind = item.category || product;
    const price = typeof item.price === 'number' ? item.price : priceFor(f.prix, kind);
    const title = isProduct ? `${product.replace(/\s+/g, ' ')} — ${name}` : `${capitalize(product)} — ${name}`;
    const comp = compositionOf(f.ingredients);
    const who = forWhom(item.description);
    const lines: string[] = [];
    const missing: string[] = [];
    // 1. accroche : le bénéfice du produit (description du catalogue), jamais une phrase vide
    if (item.description) lines.push(`${isProduct ? product.replace(/\s+/g, ' ') : capitalize(product)} de ${name} : ${lower(item.description).replace(/\.$/, '')}.`);
    else {
      lines.push(`${isProduct ? product.replace(/\s+/g, ' ') : capitalize(product)} de ${name}.`);
      missing.push('bénéfice principal (pour quel besoin, quel résultat)', 'poids ou contenance', 'nombre d’utilisations ou durée');
    }
    if (who) lines.push(`Pour qui : ${who}.`);
    else missing.push('pour qui (type de cheveux, de peau, usage)');
    if (comp.text) lines.push(`Composition : ${lower(comp.text).replace(/\.$/, '')}.`);
    lines.push(`Liste INCI : ${comp.inci ?? '[collez votre liste INCI]'}`);
    if (!comp.inci) missing.push('liste INCI complète du produit');
    if (f.certifications) lines.push(`Labels : ${f.certifications.replace(/\.$/, '')}.`);
    missing.push('mode d’emploi (2 ou 3 gestes)');
    if (city && f.creation) lines.push(`Fabriqué par ${name} à ${city}, depuis ${f.creation}.`);
    else if (city) lines.push(`Fabriqué par ${name} à ${city}.`);
    if (price !== null) lines.push(`Prix : ${price.toFixed(2).replace('.', ',')} €.`);
    if (f.livraison) lines.push(`Livraison : ${lower(f.livraison).replace(/\.$/, '')}.`);
    if (f.retours) lines.push(`Retours : ${lower(f.retours).replace(/\.$/, '')}.`);

    const label = isProduct ? product.replace(/\s+/g, ' ') : `${product} ${name}`;
    const faq: { q: string; a: string }[] = [];
    if (comp.text) faq.push({ q: `Que contient le ${label} ?`, a: sentence(comp.text) });
    if (who) faq.push({ q: `Pour qui est fait le ${label} ?`, a: `Il est conçu pour ${who}.` });
    if (f.certifications) faq.push({ q: `Le ${label} est-il certifié ?`, a: `Oui : ${f.certifications.replace(/\.$/, '')}.` });
    if (price !== null) faq.push({ q: `Combien coûte le ${label} ?`, a: `${price.toFixed(2).replace('.', ',')} €${f.livraison ? ` ; livraison ${lower(f.livraison).replace(/\.$/, '')}` : ''}.` });
    else if (f.livraison) faq.push({ q: `Quels sont les frais de livraison ?`, a: sentence(f.livraison) });
    if (f.retours) faq.push({ q: `Peut-on retourner le ${isProduct ? label : product} ?`, a: sentence(f.retours) });
    const offer: Record<string, unknown> | null =
      price !== null
        ? {
            '@type': 'Offer',
            price: price.toFixed(2),
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
            ...(item.url ? { url: item.url } : {}),
            ...(returnDays(f.retours) !== null
              ? {
                  hasMerchantReturnPolicy: {
                    '@type': 'MerchantReturnPolicy',
                    applicableCountry: 'FR',
                    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                    merchantReturnDays: returnDays(f.retours),
                    ...(/gratuit/i.test(f.retours ?? '') ? { returnFees: 'https://schema.org/FreeReturn' } : {}),
                  },
                }
              : {}),
          }
        : null;
    // nettoie les valeurs indéfinies (pas de champ vide dans le balisage)
    const clean = (o: unknown): unknown =>
      Array.isArray(o)
        ? o.map(clean)
        : o && typeof o === 'object'
          ? Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)]))
          : o;
    const productLd = clean({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: isProduct ? product.replace(/\s+/g, ' ') : title,
      brand: { '@type': 'Brand', name },
      category: kind,
      description: lines.filter((l) => !l.includes('[')).slice(0, 3).join(' '),
      ...(item.gtin ? { gtin13: item.gtin } : {}),
      ...(item.sku ? { sku: item.sku } : {}),
      ...(item.url ? { url: item.url } : {}),
      ...(f.certifications ? { award: f.certifications } : {}),
      ...(offer ? { offers: offer } : {}),
    }) as Record<string, unknown>;
    const jsonLd: Record<string, unknown>[] = [productLd];
    if (faq.length)
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
      });
    if (price === null) missing.push(`prix du ${product} (fiche de vérité, champ Prix)`);
    if (!comp.text) missing.push('composition (fiche de vérité)');
    if (!f.certifications) missing.push('labels et certifications réels (fiche de vérité)');
    if (!item.gtin) missing.push('GTIN/EAN si vous en avez (dans Shopify : déjà présent dans votre catalogue)');
    if (!item.url) missing.push('photo et URL de la fiche');
    if (!site) missing.push('site officiel (fiche de vérité)');
    return { product, price, title, text: lines.join('\n'), faq, jsonLd, missing };
  });
}
