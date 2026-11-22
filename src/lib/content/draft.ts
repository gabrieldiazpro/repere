/**
 * Rédaction d'un brouillon (page, article ou réécriture) dans la voix de l'entreprise.
 *
 * 1. Modèle structuré (templates.ts) : faits recopiés, « [à compléter : …] » pour ce qui manque.
 * 2. Si une IA est configurée (moteur existant, `getExtractor`) et non désactivée (`CONTENT_WRITER=off`) : elle
 *    reformule ce squelette dans le ton des pages existantes, SANS ajouter de fait. Garde-fous : chaque nombre et chaque
 *    nom propre du texte doit figurer dans les faits / le squelette / la page actuelle (`unsupportedFacts`), et tous
 *    les marqueurs « [à compléter] » du squelette doivent rester. Sinon le texte de l'IA est rejeté (le modèle reste).
 * 3. Contrôles : citabilité (src/lib/geo), titre / description / structure, JSON-LD, maillage, cannibalisation.
 */
import { getExtractor, type Extractor } from '@/lib/engine/providers';
import type { UrlStat } from '@/lib/engine/types-v3';
import { unsupportedFacts } from '@/lib/publish/writer';
import { buildJsonLd, cannibalization, citabilityOf, internalLinks, metaDescriptionFor, metaTitleFor, publicSourcesFor, structureChecks, type SitePage } from './checks';
import { factSource } from './facts';
import { bodyToText, slugify, todosOf, TODO_TEST } from './markdown';
import { buildTemplate } from './templates';
import type { ContentDraft, ContentOpportunity, FactKey, FactSheet } from './types';

export interface ContentWriter {
  id: 'ia';
  model?: string;
  rewrite(input: { system: string; user: string }): Promise<string>;
}

/** IA du moteur existant, sauf `CONTENT_WRITER=off` (modèles structurés seulement). */
export function defaultContentWriter(): ContentWriter | null {
  if ((process.env.CONTENT_WRITER ?? '').toLowerCase() === 'off') return null;
  const ex = getExtractor();
  return ex ? writerFromExtractor(ex) : null;
}

export function writerFromExtractor(ex: Extractor): ContentWriter {
  return { id: 'ia', model: ex.model, rewrite: ({ system, user }) => ex.completeJson(system, user) };
}

export interface DraftContext {
  businessId: string;
  name: string;
  /** origine du site (https://exemple.fr) */
  site: string;
  segment: 'local' | 'pme' | 'ecommerce';
  city?: string;
  facts: FactSheet;
  pages: SitePage[];
  urls?: UrlStat[];
  /** extrait de pages existantes (ton de l'entreprise), pour l'IA */
  voiceSample?: string;
  /** réécriture : texte actuel de la page */
  existing?: { url: string; title?: string; text: string };
  now: Date;
  writer?: ContentWriter | null;
  demo?: boolean;
  id?: string;
}

const SYSTEM = [
  'Tu es le rédacteur web d’une petite entreprise française. Tu reformules un SQUELETTE de page en français clair, au vouvoiement, dans le ton de l’EXTRAIT fourni.',
  'RÈGLES ABSOLUES :',
  '- N’ajoute AUCUN fait : ni chiffre, ni prix, ni délai, ni lieu, ni nom, ni label, ni avis, ni promesse (« le meilleur », « garanti », « n°1 »), ni conseil technique qui ne figure pas dans FAITS ou SQUELETTE.',
  '- Garde TOUS les marqueurs « [à compléter : …] » tels quels, à leur place.',
  '- Garde les intertitres (## et ###), les listes (- ), les liens [texte](adresse) et la section « Sources » telle quelle.',
  '- Première phrase de chaque section : la réponse directe, avec le nom de l’entreprise quand c’est naturel.',
  'Réponds en JSON : {"body": "...markdown..."}',
].join('\n');

function pathFor(site: string, slug: string, format: 'page' | 'article'): string {
  return `${site.replace(/\/+$/, '')}/${format === 'article' ? 'blog/' : ''}${slug}`;
}

export function existingPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** Applique les contrôles et recalcule ce qui dépend du texte (après rédaction ou édition). */
export function finalizeDraft(d: ContentDraft, ctx: Pick<DraftContext, 'name' | 'site' | 'segment' | 'facts' | 'pages' | 'now'>): ContentDraft {
  const url = d.existing?.url ?? d.remote?.url ?? d.liveUrl ?? pathFor(ctx.site, d.slug, d.format);
  const metaDescription = d.metaDescription && !TODO_TEST.test(d.metaDescription) ? d.metaDescription : metaDescriptionFor(d.body);
  const metaTitle = d.metaTitle || metaTitleFor(d.title, ctx.name);
  const jsonLd = buildJsonLd({ pageType: d.pageType, format: d.format, name: ctx.name, site: ctx.site, url, title: d.title, description: metaDescription, body: d.body, facts: ctx.facts, segment: ctx.segment, now: ctx.now });
  const cannibal = cannibalization(d.target, d.title, ctx.pages, d.action === 'rewrite' ? d.existing?.url : undefined, ctx.name);
  const citability = citabilityOf(d.title, d.body, ctx.name, url);
  const next: ContentDraft = { ...d, metaTitle, metaDescription, jsonLd, cannibal, citability };
  next.checks = structureChecks(next, cannibal, citability);
  next.missing = [...new Set([...todosOf(`${d.title}\n${metaTitle}\n${metaDescription}\n${d.body}`)])];
  return next;
}

export async function buildDraft(op: ContentOpportunity, ctx: DraftContext): Promise<ContentDraft> {
  const now = ctx.now;
  // Réécriture : texte actuel lu sur le site ; s'il n'a pas pu être lu, la page reste la cible (sans texte de départ).
  if (op.action === 'rewrite' && op.existingUrl && !ctx.existing) ctx = { ...ctx, existing: { url: op.existingUrl, text: '' } };
  const isRewrite = op.action === 'rewrite' && !!ctx.existing;
  const slug = isRewrite ? (existingPath(ctx.existing!.url).split('/').filter(Boolean).pop() ?? slugify(op.title)) : slugify(op.title);
  const draftPath = isRewrite ? existingPath(ctx.existing!.url) : existingPath(pathFor(ctx.site, slug, op.format));
  const links = internalLinks(op.target, op.pageType, ctx.pages, draftPath);
  const sources = publicSourcesFor(ctx.urls, op.questionIds);
  const tpl = buildTemplate({
    pageType: op.pageType,
    format: op.format,
    name: ctx.name,
    city: ctx.city,
    target: op.target,
    title: op.title,
    facts: ctx.facts,
    sources,
    links,
    existingText: isRewrite ? ctx.existing!.text : undefined,
    now,
  });
  let body = tpl.body;
  let writer: ContentDraft['writer'] = 'modele';
  let writerNote: string | undefined = ctx.writer ? undefined : 'Rédaction IA désactivée ou non configurée : modèle structuré, uniquement avec vos faits.';
  if (ctx.writer) {
    try {
      const raw = await ctx.writer.rewrite({
        system: SYSTEM,
        user: JSON.stringify({ ENTREPRISE: ctx.name, VILLE: ctx.city ?? null, SUJET: op.target, FAITS: Object.fromEntries(Object.entries(ctx.facts).map(([k, v]) => [k, v?.value])), EXTRAIT: (ctx.voiceSample ?? '').slice(0, 1500), SQUELETTE: tpl.body }),
      });
      const candidate = String((JSON.parse(raw) as { body?: unknown }).body ?? '').trim();
      const verdict = acceptRewrite(candidate, tpl.body, [factSource(ctx.facts, [ctx.name, ctx.city, op.target, ctx.existing?.text, tpl.title, ...links.map((l) => l.anchor), ...sources.map((s) => s.title)])]);
      if (verdict.ok) {
        body = candidate;
        writer = 'ia';
      } else {
        writerNote = `Texte de l’IA écarté (${verdict.reason}) : modèle structuré conservé.`;
      }
    } catch {
      writerNote = 'L’IA n’a pas répondu : modèle structuré conservé.';
    }
  }
  const d: ContentDraft = {
    id: ctx.id ?? `ct_${op.id.replace(/^op_/, '')}${now.getTime().toString(36).slice(-4)}`,
    businessId: ctx.businessId,
    opportunityId: op.id,
    action: isRewrite ? 'rewrite' : 'create',
    pageType: op.pageType,
    format: op.format,
    target: op.target,
    title: isRewrite ? op.title : tpl.title,
    slug,
    metaTitle: '',
    metaDescription: '',
    body,
    sources,
    jsonLd: [],
    links,
    cannibal: [],
    checks: [],
    citability: { score: 0, passages: [] },
    factsUsed: tpl.factsUsed as FactKey[],
    missing: [],
    writer,
    ...(writerNote ? { writerNote } : {}),
    ...(isRewrite ? { existing: ctx.existing } : {}),
    history: [{ at: now.toISOString(), by: writer === 'ia' ? 'Agent (IA)' : 'Agent (modèle)', body, note: 'Première version' }],
    status: 'draft',
    questionIds: op.questionIds,
    evidence: op.evidence,
    ...(ctx.demo ? { demo: true } : {}),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: 1,
  };
  return finalizeDraft(d, ctx);
}

/** Mots courants en tête de phrase (majuscule sans être des noms propres). */
const SENTENCE_WORDS = new Set(
  'voici voilà chaque ici ensuite enfin aussi également comme lorsque quand dès après avant dans selon pour ainsi alors cependant toutefois besoin retrouvez consultez appelez écrivez demandez profitez sachez tous toutes chez nos notre vos votre vous nous elle il ils elles ces cet cette ce cela ceci en au aux du des une un le la les sur sous avec sans ou où mais donc car par'.split(' '),
);

/** Texte de l'IA acceptable ? (aucun fait nouveau, marqueurs conservés, structure gardée) */
export function acceptRewrite(candidate: string, skeleton: string, sources: string[]): { ok: true } | { ok: false; reason: string } {
  if (candidate.length < 80) return { ok: false, reason: 'texte vide ou trop court' };
  if (candidate.length > skeleton.length * 3 + 2000) return { ok: false, reason: 'texte beaucoup plus long que le squelette' };
  const need = (skeleton.match(/\[\s*à compléter[^\]]*\]/gi) ?? []).length;
  const kept = (candidate.match(/\[\s*à compléter[^\]]*\]/gi) ?? []).length;
  if (kept < need) return { ok: false, reason: 'des informations manquantes ont été comblées sans votre fiche' };
  const h2s = (s: string) => (s.match(/^##\s/gm) ?? []).length;
  if (h2s(candidate) < Math.min(2, h2s(skeleton))) return { ok: false, reason: 'structure perdue' };
  const intruders = unsupportedFacts(bodyToText(candidate).replace(/\[\s*à compléter[^\]]*\]/gi, ''), `${skeleton}\n${sources.join('\n')}`).filter((w) => !SENTENCE_WORDS.has(w.toLowerCase()));
  if (intruders.length) return { ok: false, reason: `éléments absents de vos faits : ${intruders.slice(0, 4).join(', ')}` };
  if (/\b(n°\s?1|numéro un|le meilleur|la meilleure|leader|garanti(e)? à 100|satisfait ou rembours)/i.test(candidate) && !/\b(n°\s?1|numéro un|le meilleur|la meilleure|leader|garanti(e)? à 100|satisfait ou rembours)/i.test(sources.join('\n'))) {
    return { ok: false, reason: 'superlatif ou promesse non fournis par vous' };
  }
  return { ok: true };
}
