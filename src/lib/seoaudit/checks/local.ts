/** Section « Local » : NAP (nom, adresse, téléphone), page contact, horaires, zones, fiche d'établissement liée. */
import { SRC } from '../sources';
import type { AuditCtx, CheckDef } from '../types';
import { addressesIn, normPhone, phonesIn, str, typesOf, type FoundAddress } from '../util';
import { siteHasPage } from './contenu';
import { isLocalType } from './donnees';
import { hitItems, hitSite } from './helpers';

const sec = 'local' as const;
const cat = 'local';
const L: ['local'] = ['local'];

const MAPS = /(google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl|g\.page\/|business\.google\.com|g\.co\/kgs|search\.google\.com\/local)/i;

function localNodes(ctx: AuditCtx): Record<string, unknown>[] {
  return ctx.html.flatMap((p) => ctx.nodes(p).filter((n) => typesOf(n).some(isLocalType)));
}

function siteText(ctx: AuditCtx): string {
  return ctx.html.slice(0, 80).map((p) => ctx.text(p)).join('\n');
}

function visiblePhones(ctx: AuditCtx): string[] {
  const s = new Set(phonesIn(siteText(ctx)));
  for (const p of ctx.html) for (const m of (p.html ?? '').match(/href\s*=\s*["']tel:([^"']+)/gi) ?? []) s.add(normPhone(m.replace(/^.*tel:/i, '')));
  return [...s].filter((x) => x.length === 10);
}

function visibleAddresses(ctx: AuditCtx): FoundAddress[] {
  return addressesIn(siteText(ctx));
}

function jsonAddress(n: Record<string, unknown>): { postalCode?: string; city?: string } | null {
  const a = n.address;
  if (!a || typeof a !== 'object' || Array.isArray(a)) return typeof a === 'string' ? { postalCode: /\b\d{5}\b/.exec(a)?.[0] } : null;
  const o = a as Record<string, unknown>;
  return { postalCode: str(o.postalCode), city: str(o.addressLocality) };
}

/** Ville principale : adresse JSON-LD, sinon première adresse visible. */
export function mainCity(ctx: AuditCtx): string | undefined {
  for (const n of localNodes(ctx)) {
    const c = jsonAddress(n)?.city;
    if (c) return c;
  }
  return visibleAddresses(ctx)[0]?.city;
}

export const LOCAL: CheckDef[] = [
  {
    id: 'seo.local.no_contact_page', section: sec, category: cat, severity: 'high', impact: 2, effort: 1, scope: 'site', types: L,
    label: 'Page contact introuvable',
    title: () => 'Aucune page « Contact » ou « Accès » trouvée',
    why: 'Vos clients cherchent d’abord comment vous joindre et venir : c’est aussi l’une des pages que Google et les IA lisent pour vous situer.',
    fix: 'Créez une page Contact avec adresse complète, téléphone cliquable, horaires et plan d’accès, liée depuis le menu.',
    source: SRC.localRanking,
    run: (ctx) => (siteHasPage(ctx, /contact|acces|venir|nous-trouver|coordonnees|plan-d-acces/i, /contact|acc[eè]s|nous trouver|venir|coordonn[ée]es/i) ? null : hitSite(ctx)),
  },
  {
    id: 'seo.local.no_phone', section: sec, category: cat, severity: 'high', impact: 3, effort: 1, scope: 'site', types: L,
    label: 'Téléphone introuvable',
    title: () => 'Aucun numéro de téléphone trouvé sur le site',
    why: 'Pour un commerce local, le téléphone est l’action n°1 des visiteurs mobiles, et une donnée clé pour Google et les IA.',
    fix: 'Affichez votre numéro en texte (pas en image) dans l’en-tête ou le pied de page, en lien cliquable « tel: ».',
    source: SRC.localRanking,
    run: (ctx) => (visiblePhones(ctx).length || localNodes(ctx).some((n) => typeof n.telephone === 'string') ? null : hitSite(ctx)),
  },
  {
    id: 'seo.local.no_address', section: sec, category: cat, severity: 'high', impact: 3, effort: 1, scope: 'site', types: L,
    label: 'Adresse postale introuvable',
    title: () => 'Aucune adresse postale complète trouvée sur le site',
    why: 'Sans adresse lisible, Google et les IA rattachent mal votre site à votre ville et à votre fiche d’établissement.',
    fix: 'Affichez l’adresse complète (numéro, rue, code postal, ville) en texte dans le pied de page et sur la page contact.',
    source: SRC.localRanking,
    run: (ctx) => (visibleAddresses(ctx).length || localNodes(ctx).some((n) => jsonAddress(n)?.postalCode) ? null : hitSite(ctx)),
  },
  {
    id: 'seo.local.nap_inconsistent', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site', types: L,
    label: 'Coordonnées incohérentes (NAP)',
    title: () => 'Vos coordonnées ne sont pas les mêmes partout sur le site',
    why: 'Un téléphone ou un code postal différent entre le balisage et le texte sème le doute chez Google et les IA sur la bonne information.',
    fix: 'Unifiez nom, adresse et téléphone sur toutes les pages, dans le balisage et sur votre fiche Google.',
    source: SRC.gbpGuidelines,
    run: (ctx) => {
      const phones = visiblePhones(ctx);
      const addrs = visibleAddresses(ctx);
      const issues: string[] = [];
      for (const n of localNodes(ctx)) {
        if (typeof n.telephone === 'string') {
          const t = normPhone(n.telephone);
          if (phones.length && t.length === 10 && !phones.includes(t)) issues.push(`téléphone balisé ${n.telephone} ≠ téléphone affiché ${phones[0]}`);
        }
        const cp = jsonAddress(n)?.postalCode;
        if (cp && addrs.length && !addrs.some((a) => a.postalCode === cp)) issues.push(`code postal balisé ${cp} ≠ affiché ${addrs[0].postalCode}`);
      }
      const uniq = [...new Set(issues)];
      return uniq.length ? hitSite(ctx, uniq.join(' ; '), { evidence: uniq.join(' ; ') }) : null;
    },
  },
  {
    id: 'seo.local.no_tel_link', section: sec, category: cat, severity: 'low', impact: 2, effort: 1, scope: 'site', types: L,
    label: 'Téléphone non cliquable',
    title: () => 'Votre numéro de téléphone n’est pas cliquable sur mobile',
    why: 'Sur téléphone, un numéro cliquable (« tel: ») transforme une visite en appel en un geste.',
    fix: 'Entourez le numéro d’un lien <a href="tel:+33…">.',
    source: SRC.localRanking,
    run: (ctx) => (phonesIn(siteText(ctx)).length && !ctx.html.some((p) => /href\s*=\s*["']tel:/i.test(p.html ?? '')) ? hitSite(ctx) : null),
  },
  {
    id: 'seo.local.no_hours', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site', types: L,
    label: 'Horaires d’ouverture absents',
    title: () => 'Vos horaires d’ouverture ne figurent pas sur le site',
    why: '« Ouvert maintenant ? » est l’une des questions les plus posées à Google et aux assistants IA pour un commerce.',
    fix: 'Affichez vos horaires en texte et balisez-les (openingHoursSpecification).',
    source: SRC.sdLocal,
    run: (ctx) => {
      if (localNodes(ctx).some((n) => n.openingHoursSpecification || n.openingHours)) return null;
      const t = siteText(ctx);
      const hasDays = /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun\.|mar\.|du lundi)/i.test(t);
      const hasTimes = /\b\d{1,2}\s?(h|:)\s?\d{0,2}\b/i.test(t);
      return hasDays && hasTimes ? null : hitSite(ctx);
    },
  },
  {
    id: 'seo.local.no_gbp_link', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site', types: L,
    label: 'Fiche Google (Maps) non reliée',
    title: () => 'Votre site ne renvoie pas vers votre fiche Google (Maps)',
    why: 'Relier site et fiche d’établissement (lien, carte intégrée, sameAs) aide Google à associer les deux et facilite l’itinéraire.',
    fix: 'Ajoutez un lien « Itinéraire / Voir sur Google Maps » ou une carte intégrée, et l’adresse de la fiche dans sameAs.',
    source: SRC.gbpGuidelines,
    run: (ctx) => {
      if (ctx.crawl.links.some((l) => MAPS.test(l.to))) return null;
      if (ctx.html.some((p) => /<iframe[^>]+src\s*=\s*["'][^"']*(google\.[a-z.]+\/maps|maps\.google)/i.test(p.html ?? ''))) return null;
      if (localNodes(ctx).some((n) => MAPS.test(JSON.stringify(n.sameAs ?? '')) || MAPS.test(String(n.hasMap ?? '')))) return null;
      return hitSite(ctx);
    },
  },
  {
    id: 'seo.local.city_not_in_title', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site', types: L,
    label: 'Ville absente du titre de l’accueil',
    title: () => 'Le titre de votre page d’accueil ne mentionne pas votre ville',
    why: 'Les recherches locales contiennent souvent la ville (« fleuriste Angers ») ; le titre est le premier signal de pertinence.',
    fix: 'Intégrez activité + ville dans le titre de l’accueil (ex. « Fleuriste à Angers – Atelier Pétales »).',
    source: SRC.titleLink,
    run: (ctx) => {
      const city = mainCity(ctx);
      const t = ctx.home?.title ?? '';
      if (!city || !t) return null;
      const nrm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      if (nrm(t).includes(nrm(city).split(/[\s-]+cedex/)[0].trim())) return null;
      const base = t.trim();
      const value = base.length + city.length + 3 <= 60 ? `${base.replace(/\s+[|\-–—]\s+.*$/, '')} à ${city}${/\s+[|\-–—]\s+/.test(base) ? ` | ${ctx.siteName}` : ''}` : `${ctx.siteName} à ${city}`;
      return hitSite(ctx, `ville détectée : ${city}`, { autoFix: { kind: 'meta.title', payload: { items: [{ url: ctx.home?.finalUrl, value: value.slice(0, 60), review: true }] } } });
    },
  },
  {
    id: 'seo.local.zones', section: sec, category: cat, severity: 'low', impact: 1, effort: 2, scope: 'site', types: L,
    label: 'Zone d’intervention non précisée',
    title: () => 'Votre zone d’intervention ou de chalandise n’est pas précisée',
    why: 'Pour un artisan ou un service à domicile, lister les communes servies aide à apparaître sur « [métier] + [commune voisine] ».',
    fix: 'Ajoutez une section « Zone d’intervention » listant les communes servies (et areaServed dans le balisage).',
    source: SRC.localRanking,
    run: (ctx) => {
      if (localNodes(ctx).some((n) => n.areaServed)) return null;
      return /zones?\s+d['’]intervention|nous intervenons|secteurs?\s+d['’]intervention|communes? (desservies|servies)|alentours|environs|aux alentours de|dans un rayon de|zone de chalandise/i.test(siteText(ctx)) ? null : hitSite(ctx);
    },
  },
  {
    id: 'seo.local.sameas_missing', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'site', types: L,
    label: 'Profils non reliés (sameAs)',
    title: () => 'Votre balisage d’établissement ne relie pas vos profils (Google, réseaux, annuaires)',
    why: 'sameAs relie votre site à vos profils officiels : Google et les IA identifient plus sûrement votre établissement.',
    fix: 'Ajoutez sameAs avec les adresses de votre fiche Google, Facebook, Instagram, Pages Jaunes…',
    source: SRC.sdLocal,
    run: (ctx) => {
      const ns = localNodes(ctx);
      return ns.length && !ns.some((n) => n.sameAs) ? hitSite(ctx) : null;
    },
  },
  {
    id: 'seo.local.multiple_cities_one_page', section: sec, category: cat, severity: 'low', impact: 1, effort: 2, scope: 'site', types: L,
    label: 'Plusieurs établissements sans page dédiée',
    title: () => 'Plusieurs adresses apparaissent sans page dédiée par établissement',
    why: 'Chaque établissement mérite sa page (adresse, horaires, équipe) pour être trouvé dans sa ville.',
    fix: 'Créez une page par établissement, reliée à sa fiche Google respective.',
    source: SRC.localRanking,
    run: (ctx) => {
      const cities = new Set(visibleAddresses(ctx).map((a) => a.postalCode));
      if (cities.size < 2) return null;
      const perPage = ctx.html.filter((p) => addressesIn(ctx.text(p)).length === 1).length;
      return perPage === 0 ? hitItems([{ url: ctx.home?.finalUrl ?? `${ctx.origin}/`, detail: `${cities.size} codes postaux` }]) : null;
    },
  },
];
