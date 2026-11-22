/**
 * Détection des pages manquantes, à partir de données RÉELLES uniquement (pur, sans réseau) :
 * 1. questions suivies où les IA citent un concurrent et pas le client (dernière mesure) ;
 * 2. requêtes Search Console avec des impressions mais sans page dédiée (si connectée) ;
 * 3. constats GEO (pas de page tarifs, FAQ, zone, comparatif, « à propos », contact ; sous-questions non couvertes) ;
 * 4. pages existantes trop minces.
 * Chaque proposition porte ses preuves (source, date, chiffres). Sans donnée, aucune proposition n'est inventée.
 */
import { overlap, stableId } from '@/lib/geo/util';
import type { FanOutFacet, SubQuestionCoverage } from '@/lib/geo/types';
import type { MentionResult, QuerySpec } from '@/lib/engine/types';
import type { ContentOpportunity, Evidence, FactKey, OpportunitySource, PageType } from './types';

export interface DetectPage {
  url: string;
  title?: string | null;
  h1?: string | null;
  words: number;
  indexable?: boolean;
  depth?: number;
}

export interface DetectInput {
  businessName: string;
  segment: 'local' | 'pme' | 'ecommerce';
  city?: string;
  trade?: string;
  audit?: { measuredAt: string; queries: QuerySpec[]; mentions: MentionResult[] } | null;
  gsc?: { updatedAt?: string | null; topQueries: { key: string; impressions: number; clicks: number; position: number }[] } | null;
  geo?: { generatedAt?: string; findingIds: string[]; fanOut?: SubQuestionCoverage[] } | null;
  pages: DetectPage[];
  crawledAt?: string;
  /** propositions déjà transformées en brouillon (non rejeté) : exclues */
  taken?: string[];
  /** propositions écartées par le client : exclues */
  dismissed?: string[];
}

export const MIN_GSC_IMPRESSIONS = 30;
export const THIN_WORDS = 250;
export const MAX_THIN = 3;
export const MAX_OPPORTUNITIES = 12;

const NEEDS: Record<PageType, FactKey[]> = {
  tarifs: ['prix', 'services', 'paiement', 'delais'],
  faq: ['services', 'zone', 'horaires', 'prix', 'delais', 'garanties'],
  zone: ['zone', 'services', 'adresse', 'delais', 'telephone'],
  comparatif: ['services', 'prix', 'difference', 'garanties'],
  'a-propos': ['activite', 'histoire', 'creation', 'dirigeant', 'equipe', 'certifications'],
  service: ['services', 'prix', 'zone', 'delais', 'garanties'],
  garanties: ['garanties', 'certifications', 'retours'],
  contact: ['adresse', 'telephone', 'email', 'horaires'],
  article: ['activite', 'services'],
};

export const PAGE_TYPE_LABEL: Record<PageType, string> = {
  tarifs: 'Page tarifs',
  faq: 'Questions fréquentes',
  zone: 'Page zone d’intervention',
  comparatif: 'Comparatif honnête',
  'a-propos': 'Page « À propos »',
  service: 'Page service',
  garanties: 'Page garanties',
  contact: 'Page contact',
  article: 'Article de conseil',
};

const NONE_LABEL: Record<PageType, string> = {
  tarifs: 'page de tarifs',
  faq: 'page de questions fréquentes',
  zone: 'page sur votre zone d’intervention',
  comparatif: 'page comparative',
  'a-propos': 'page « À propos »',
  service: 'page de service',
  garanties: 'page sur vos garanties',
  contact: 'page de contact',
  article: 'article',
};

/** Pages repérables par leur adresse ou leur titre. */
const TYPE_RE: Partial<Record<PageType, RegExp>> = {
  tarifs: /tarif|prix|pricing|price|devis|cout|coût/i,
  faq: /faq|questions?[-\s]frequentes|questions?[-\s]fréquentes|aide/i,
  zone: /zone|secteur|intervention|livraison|ou[-\s]nous[-\s]trouver|villes?/i,
  comparatif: /compar|versus|\bvs\b|alternative/i,
  'a-propos': /a[-\s]propos|qui[-\s]sommes|about|notre[-\s]histoire|equipe|équipe/i,
  contact: /contact|nous[-\s]joindre/i,
  garanties: /garantie|assurance|retours?|rembourse/i,
};

const EXCLUDE_THIN = /^\/(?:en|de|es|it|nl|pt)(?:-[a-z]{2})?(?:\/|$)|mentions?[-\s]legales|mentions?[-\s]légales|cgv|cgu|conditions|confidentialit|privacy|cookies?|panier|cart|checkout|compte|account|login|connexion|plan[-\s]du[-\s]site|sitemap|merci|thank|recherche|search|tag\/|category\/|categorie\/|page\/\d|\/feed/i;

const FACET_TYPE: Partial<Record<FanOutFacet, PageType>> = {
  prix: 'tarifs',
  zone: 'zone',
  garanties: 'garanties',
  comparaison: 'comparatif',
  choix: 'comparatif',
  delai: 'faq',
  urgence: 'faq',
  horaires: 'faq',
  livraison: 'faq',
  retours: 'garanties',
  paiement: 'faq',
  etapes: 'faq',
  references: 'a-propos',
  origine: 'a-propos',
};

/** Type de page déduit d'une question ou d'une requête. */
export function guessPageType(q: string, angle?: string): PageType {
  const t = q.toLowerCase();
  if (angle === 'prix' || /prix|tarif|combien|co[uû]t|cher|devis/.test(t)) return 'tarifs';
  if (angle === 'comparatif' || angle === 'alternative' || /\bvs\b|versus|compar|alternative|ou bien|lequel|laquelle|diff[ée]rence entre/.test(t)) return 'comparatif';
  if (/garantie|assurance|retour|rembours/.test(t)) return 'garanties';
  if (/^(comment|pourquoi|faut-il|quand|qu['’]est|que faire|est-ce)/.test(t)) return 'article';
  return 'service';
}

const STRUCTURAL: PageType[] = ['tarifs', 'faq', 'zone', 'comparatif', 'a-propos', 'garanties', 'contact'];

function pageMatches(p: DetectPage, q: string): number {
  const hay = `${p.title ?? ''} ${p.h1 ?? ''} ${decodeURIComponent(pathOf(p.url)).replace(/[-_/]+/g, ' ')}`;
  return overlap(q, hay);
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** « Tarifs plombier | Plomberie Martin » → « Tarifs plombier » ; titre réduit à la marque → vide. */
export function cleanTitle(t: string, brand: string): string {
  const parts = t.split(/\s+[|–—-]\s+/).map((x) => x.trim()).filter(Boolean);
  const kept = parts.filter((x) => overlap(brand, x) < 0.8 || x.length > brand.length + 12);
  return (kept.join(' – ') || '').trim();
}

function pathWords(url: string): string {
  const last = pathOf(url).split('/').filter(Boolean).pop() ?? '';
  const w = decodeURIComponent(last).replace(/[-_]+/g, ' ').trim();
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
}

function isHome(url: string): boolean {
  return pathOf(url).replace(/\/+$/, '') === '';
}

function hasPageOfType(pages: DetectPage[], t: PageType): DetectPage | undefined {
  const re = TYPE_RE[t];
  if (!re) return undefined;
  return pages.find((p) => re.test(pathOf(p.url)) || re.test(p.title ?? '') || re.test(p.h1 ?? ''));
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
};

interface Draft {
  key: string;
  action: 'create' | 'rewrite';
  pageType: PageType;
  title: string;
  target: string;
  existingUrl?: string;
  evidence: Evidence[];
  score: number;
  questionIds: Set<string>;
  competitors: Set<string>;
}

function titleFor(t: PageType, target: string, name: string, city?: string): string {
  const where = city ? ` à ${city}` : '';
  switch (t) {
    case 'tarifs':
      return `Nos tarifs${where}`;
    case 'faq':
      return 'Questions fréquentes';
    case 'zone':
      return city ? `Zone d’intervention autour de ${city}` : 'Zone d’intervention';
    case 'comparatif':
      return /^comment choisir/i.test(target) ? target.replace(/\s*\?$/, ' ?') : `Comment choisir : ${target}`;
    case 'a-propos':
      return `À propos de ${name}`;
    case 'garanties':
      return 'Nos garanties';
    case 'contact':
      return `Contacter ${name}`;
    default: {
      const s = target.replace(/\?+$/, '').trim();
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
  }
}

export function detectOpportunities(input: DetectInput): ContentOpportunity[] {
  const pages = input.pages.filter((p) => p.indexable !== false);
  const map = new Map<string, Draft>();
  const brandStems = input.businessName.toLowerCase();

  const add = (d: Omit<Draft, 'questionIds' | 'competitors'> & { questionIds?: string[]; competitors?: string[] }) => {
    const prev = map.get(d.key);
    if (prev) {
      if (d.action === 'rewrite' && d.existingUrl && prev.action === 'create') {
        prev.action = 'rewrite';
        prev.existingUrl = d.existingUrl;
        prev.title = d.title;
      }
      prev.evidence.push(...d.evidence);
      prev.score += d.score;
      d.questionIds?.forEach((q) => prev.questionIds.add(q));
      d.competitors?.forEach((c) => prev.competitors.add(c));
      return;
    }
    map.set(d.key, { ...d, questionIds: new Set(d.questionIds ?? []), competitors: new Set(d.competitors ?? []) });
  };

  // 1. Questions suivies : un concurrent cité, pas vous.
  if (input.audit) {
    const at = input.audit.measuredAt;
    for (const q of input.audit.queries) {
      if (q.kind === 'brand') continue;
      if (brandStems.length >= 3 && overlap(input.businessName, q.text) >= 0.6) continue; // question sur la marque
      const ms = input.audit.mentions.filter((m) => m.queryId === q.id && !m.noRec);
      if (!ms.length) continue;
      const cited = ms.filter((m) => m.mentioned).length;
      const comp = new Map<string, number>();
      for (const m of ms) for (const c of m.competitors) comp.set(c, (comp.get(c) ?? 0) + 1);
      const top = [...comp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      // Jamais cité, ou rarement (≤ 1 réponse sur 4) quand un concurrent l'est davantage.
      if (!top.length || cited / ms.length > 0.25 || top[0][1] <= cited) continue;
      const t = guessPageType(q.text, q.angle);
      const match = pages.map((p) => ({ p, s: pageMatches(p, q.text) })).sort((a, b) => b.s - a.s)[0];
      const strong = match && match.s >= 0.6 ? match.p : undefined;
      if (strong && strong.words >= 400 && !STRUCTURAL.includes(t)) continue; // une page dédiée existe : autre problème
      const typed = STRUCTURAL.includes(t) ? hasPageOfType(pages, t) : undefined;
      if (typed && typed.words >= 400) continue; // la page type existe et elle est fournie : autre problème
      // Page type existante mais courte (ou page proche courte) : on la renforce plutôt que d'en créer une seconde.
      const rewrite = typed ?? (strong && strong.words < 400 ? strong : undefined);
      const ev: Evidence = {
        source: 'questions_ia',
        text: `Sur « ${q.text} », les IA citent ${top.map(([c, n]) => `${c} (${n} réponse${n > 1 ? 's' : ''})`).join(', ')} ${cited ? `et ${input.businessName} dans ${cited} seulement` : `et jamais ${input.businessName}`} (${ms.length} réponse${ms.length > 1 ? 's' : ''} mesurée${ms.length > 1 ? 's' : ''}).`,
        at,
        data: { reponses: ms.length, cite: cited },
      };
      const key = STRUCTURAL.includes(t) ? `create:${t}` : `${rewrite ? 'rewrite' : 'create'}:${rewrite ? rewrite.url : stableId(q.text.toLowerCase())}`;
      add({
        key,
        action: rewrite ? 'rewrite' : 'create',
        pageType: t,
        title: rewrite ? cleanTitle(rewrite.title ?? '', input.businessName) || titleFor(t, q.text, input.businessName, input.city) : titleFor(t, q.text, input.businessName, input.city),
        target: q.text,
        existingUrl: rewrite?.url,
        evidence: [ev],
        score: 4 + Math.min(2, top[0][1] / Math.max(1, ms.length) * 2),
        questionIds: [q.id],
        competitors: top.map(([c]) => c),
      });
    }
  }

  // 2. Search Console : des impressions sans page dédiée.
  if (input.gsc) {
    for (const r of input.gsc.topQueries) {
      if (r.impressions < MIN_GSC_IMPRESSIONS) continue;
      const k = r.key.toLowerCase();
      if (brandStems.length >= 3 && overlap(input.businessName, k) >= 0.6) continue; // requête sur la marque
      const best = Math.max(0, ...pages.map((p) => pageMatches(p, r.key)));
      if (best >= 0.5) continue;
      const t = guessPageType(r.key);
      if (STRUCTURAL.includes(t) && hasPageOfType(pages, t)) continue;
      add({
        key: STRUCTURAL.includes(t) ? `create:${t}` : `create:${stableId(k)}`,
        action: 'create',
        pageType: t,
        title: titleFor(t, r.key, input.businessName, input.city),
        target: r.key,
        evidence: [
          {
            source: 'search_console',
            text: `« ${r.key} » : ${r.impressions.toLocaleString('fr-FR')} impressions sur Google (28 jours), position moyenne ${r.position.toFixed(1).replace('.', ',')}, aucune page de votre site ne traite ce sujet.`,
            at: input.gsc.updatedAt ?? undefined,
            data: { impressions: r.impressions, clics: r.clicks, position: Math.round(r.position * 10) / 10 },
          },
        ],
        score: 2 + Math.min(4, Math.log10(r.impressions)),
      });
    }
  }

  // 3. Constats GEO et pages types absentes.
  if (input.geo || pages.length) {
    const at = input.geo?.generatedAt ?? input.crawledAt;
    const explored = `parmi les ${pages.length} page${pages.length > 1 ? 's' : ''} explorée${pages.length > 1 ? 's' : ''}${at ? ` le ${fmtDate(at)}` : ''}`;
    const wanted: PageType[] = input.segment === 'ecommerce' ? ['faq', 'garanties', 'a-propos', 'contact'] : input.segment === 'pme' ? ['tarifs', 'faq', 'a-propos', 'comparatif'] : ['tarifs', 'faq', 'zone', 'a-propos', 'contact'];
    const ids = new Set(input.geo?.findingIds ?? []);
    if (ids.has('geo.entite.no_about') && !wanted.includes('a-propos')) wanted.push('a-propos');
    if (ids.has('geo.entite.no_contact') && !wanted.includes('contact')) wanted.push('contact');
    if (pages.length >= 2) {
      for (const t of wanted) {
        if (hasPageOfType(pages, t)) continue;
        const ev: Evidence[] = [{ source: 'analyse_geo', text: `Aucune ${NONE_LABEL[t]} ${explored}.`, at, data: { pages: pages.length } }];
        if (t === 'a-propos' && ids.has('geo.entite.no_about')) ev.push({ source: 'analyse_geo', text: 'L’analyse GEO signale que les IA ne trouvent pas qui vous êtes (pas de page « À propos » reliée à votre entreprise).', at });
        if (t === 'contact' && ids.has('geo.entite.no_contact')) ev.push({ source: 'analyse_geo', text: 'L’analyse GEO ne trouve ni adresse ni téléphone lisibles sur le site.', at });
        add({ key: `create:${t}`, action: 'create', pageType: t, title: titleFor(t, '', input.businessName, input.city), target: PAGE_TYPE_LABEL[t], evidence: ev, score: t === 'tarifs' || t === 'faq' ? 3 : 2 });
      }
    }
    // Sous-questions des clients non couvertes, regroupées par type de page.
    const byType = new Map<PageType, SubQuestionCoverage[]>();
    for (const s of input.geo?.fanOut ?? []) {
      if (s.status !== 'absente') continue;
      const t = FACET_TYPE[s.facet];
      if (!t || (t === 'zone' && input.segment !== 'local')) continue;
      const existing = hasPageOfType(pages, t);
      if (existing && existing.words >= THIN_WORDS) continue;
      byType.set(t, [...(byType.get(t) ?? []), s]);
    }
    for (const [t, subs] of byType) {
      add({
        key: `create:${t}`,
        action: 'create',
        pageType: t,
        title: titleFor(t, subs[0].question, input.businessName, input.city),
        target: PAGE_TYPE_LABEL[t],
        evidence: [
          {
            source: 'analyse_geo',
            text: `${subs.length} question${subs.length > 1 ? 's' : ''} que se posent vos clients sans réponse sur votre site : ${subs.slice(0, 3).map((s) => `« ${s.question} »`).join(', ')}${subs.length > 3 ? '…' : ''}`,
            at,
            data: { questions: subs.length },
          },
        ],
        score: 1 + Math.min(2, subs.length / 2),
      });
    }
  }

  // 4. Pages trop minces (réécriture) : les 3 plus minces seulement (pas de production de masse).
  const thin = pages
    .filter((p) => !isHome(p.url) && !EXCLUDE_THIN.test(pathOf(p.url)) && p.words < THIN_WORDS && p.words >= 1 && (p.depth ?? 1) <= 3)
    .sort((a, b) => a.words - b.words)
    .slice(0, MAX_THIN);
  for (const p of thin) {
    if (isHome(p.url) || EXCLUDE_THIN.test(pathOf(p.url)) || p.words >= THIN_WORDS || p.words < 1) continue;
    if ((p.depth ?? 1) > 3) continue;
    const t = (Object.keys(TYPE_RE) as PageType[]).find((k) => TYPE_RE[k]!.test(pathOf(p.url)) || TYPE_RE[k]!.test(p.title ?? '')) ?? 'service';
    if (t === 'contact') continue; // une page contact courte est normale
    const key = STRUCTURAL.includes(t) ? `create:${t}` : `rewrite:${p.url}`;
    const prev = map.get(key);
    if (prev && prev.action === 'create' && STRUCTURAL.includes(t)) {
      // La page existe mais est mince : la proposition devient une réécriture.
      prev.action = 'rewrite';
      prev.existingUrl = p.url;
    }
    add({
      key,
      action: 'rewrite',
      pageType: t,
      title: cleanTitle(p.h1 || p.title || '', input.businessName) || pathWords(p.url) || PAGE_TYPE_LABEL[t],
      target: cleanTitle(p.h1 || p.title || '', input.businessName) || pathWords(p.url) || PAGE_TYPE_LABEL[t],
      existingUrl: p.url,
      evidence: [{ source: 'page_mince', text: `${pathOf(p.url)} ne contient que ${p.words} mots : trop peu pour répondre précisément (et être cité).`, at: input.crawledAt, data: { mots: p.words } }],
      score: 1 + (THIN_WORDS - p.words) / THIN_WORDS,
    });
  }

  const skip = new Set([...(input.taken ?? []), ...(input.dismissed ?? [])]);
  const out: ContentOpportunity[] = [];
  for (const d of map.values()) {
    const id = `op_${stableId(d.key)}`;
    if (skip.has(id)) continue;
    const sources = new Set(d.evidence.map((e) => e.source));
    const priority = Math.max(1, Math.min(9, Math.round(d.score + (sources.size - 1) * 1.5)));
    out.push({
      id,
      action: d.action,
      pageType: d.pageType,
      format: d.pageType === 'article' ? 'article' : 'page',
      title: d.title,
      target: d.target,
      why: whyOf(d, sources),
      evidence: d.evidence,
      priority,
      ...(d.existingUrl ? { existingUrl: d.existingUrl } : {}),
      needs: NEEDS[d.pageType],
      questionIds: [...d.questionIds],
      competitors: [...d.competitors],
    });
  }
  return out.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title)).slice(0, MAX_OPPORTUNITIES);
}

function whyOf(d: Draft, sources: Set<OpportunitySource>): string {
  const parts: string[] = [];
  if (sources.has('questions_ia')) parts.push(`les IA recommandent ${[...d.competitors].slice(0, 2).join(' et ') || 'un concurrent'} à votre place`);
  if (sources.has('search_console')) parts.push('Google vous montre déjà sur ce sujet sans page qui y réponde');
  if (sources.has('analyse_geo')) parts.push('votre site ne répond pas à des questions que se posent vos clients');
  if (sources.has('page_mince')) parts.push('la page actuelle est trop courte pour être citée');
  const s = parts.join(' ; ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}
