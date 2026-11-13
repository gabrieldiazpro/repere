/**
 * Planificateur : constats SEO/GEO (`Finding`) → `ChangeSet` en brouillon, un par constat et par plateforme.
 * Chaque changement part de faits relevés sur le site (exploration) ; les textes sont rédigés par l'IA configurée,
 * avec repli déterministe et garde-fou anti-invention (writer.ts). Ce qui ne peut pas être proposé sans inventer est
 * renvoyé dans `skipped`, avec la raison.
 * Routage : la première plateforme connectée qui sait appliquer le type de changement, sinon l'export.
 */
import type { SiteCrawl } from '@/lib/crawl/types';
import { expandAutoFix, TO_COMPLETE_RE } from './autofix';
import { canonicalJson } from './connectors/gbp';
import { maxRisk, newChangeSetId, stableId } from './model';
import { unsupportedFacts, writeText, type TextWriter, type WriteKind } from './writer';
import {
  KIND_RISK,
  type Actor,
  type AutoFixPayload,
  type Change,
  type ChangeKind,
  type ChangePatch,
  type ChangeSet,
  type ChangeTarget,
  type Finding,
  type Platform,
  type SkippedFix,
} from './types';

export interface PlanPage {
  url: string;
  title?: string;
  metaDescription?: string;
  h1?: string[];
  canonical?: string;
  metaRobots?: string;
  /** blocs JSON-LD déjà présents (pour une fusion) */
  jsonLd?: unknown[];
  images?: { src: string; alt?: string }[];
  /** texte visible (base factuelle des textes proposés) */
  text?: string;
  isIndexable?: boolean;
}

export interface PlanSite {
  businessId: string;
  origin: string;
  name?: string;
  city?: string;
  pages: PlanPage[];
  robotsTxt?: string | null;
  llmsTxt?: string | null;
  /** description factuelle du commerce (fiche de vérité), si connue */
  description?: string;
}

export interface PlanTarget {
  platform: Platform;
  capabilities: readonly ChangeKind[];
}

export interface PlanOptions {
  writer?: TextWriter;
  actor?: Actor;
  now?: Date;
  /** plafond de changements par ChangeSet (défaut 50) */
  maxChanges?: number;
}

export interface Plan {
  changeSets: ChangeSet[];
  skipped: SkippedFix[];
}

const MAX_TEXT = 20_000;

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Adaptateur SiteCrawl (CRAWL) → PlanSite. */
export function siteFromCrawl(crawl: SiteCrawl, extra: { businessId: string; name?: string; city?: string; description?: string; llmsTxt?: string | null }): PlanSite {
  return {
    businessId: extra.businessId,
    origin: crawl.finalOrigin || crawl.origin,
    name: extra.name,
    city: extra.city,
    description: extra.description,
    robotsTxt: crawl.robots && crawl.robots.status === 200 ? (crawl.robots.text ?? '') : null,
    llmsTxt: extra.llmsTxt,
    pages: crawl.pages.map((p) => ({
      url: p.finalUrl || p.url,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.h1,
      canonical: p.canonical,
      metaRobots: p.metaRobots,
      jsonLd: p.jsonLd,
      images: p.images.map((i) => ({ src: i.src, alt: i.alt })),
      text: p.html ? stripHtml(/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(p.html)?.[1] ?? p.html).slice(0, MAX_TEXT) : undefined,
      isIndexable: p.isIndexable,
    })),
  };
}

/** Type de changement déduit d'un identifiant de constat (quand `autoFix` manque). */
export function inferKind(f: Pick<Finding, 'id'>): ChangeKind | null {
  const id = f.id.toLowerCase();
  if (/(^|\.)title(\.|$)/.test(id) && !/og|twitter/.test(id)) return 'meta.title';
  if (/meta[._-]?description|(^|\.)description\.(missing|empty|too|duplicate)/.test(id)) return 'meta.description';
  if (/(^|\.)(img|image|images)\.alt|alt\.missing/.test(id)) return 'image.alt';
  if (/canonical\.missing/.test(id)) return 'canonical';
  if (/llms/.test(id)) return 'llms.txt';
  return null;
}

function normUrl(u: string): string {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '') || '/'}${x.search}`;
  } catch {
    return u;
  }
}

function findPage(site: PlanSite, url: string): PlanPage | undefined {
  const n = normUrl(url);
  return site.pages.find((p) => normUrl(p.url) === n);
}

function absolute(site: PlanSite, u: string): string {
  try {
    return new URL(u, site.origin).toString();
  } catch {
    return u;
  }
}

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'CCBot', 'Mistral'] as const;

/**
 * robots.txt : retire les robots demandés des groupes qui les bloquent et leur ajoute un groupe « Allow: / ».
 * Les autres groupes et les lignes Sitemap restent identiques.
 */
export function allowBotsInRobots(before: string | null, bots: string[]): string {
  const want = [...new Set(bots.filter((b) => /^[A-Za-z0-9._-]{2,40}$/.test(b)))];
  const lower = new Set(want.map((b) => b.toLowerCase()));
  type Group = { agents: { name: string; line: string }[]; rules: string[] };
  const items: (string | Group)[] = [];
  let cur: Group | null = null;
  for (const l of (before ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const ua = /^\s*user-agent\s*:\s*(.+?)\s*(?:#.*)?$/i.exec(l);
    if (ua) {
      if (!cur || cur.rules.length) {
        cur = { agents: [], rules: [] };
        items.push(cur);
      }
      cur.agents.push({ name: ua[1], line: l });
      continue;
    }
    if (!l.trim() || /^\s*sitemap\s*:/i.test(l) || !cur) {
      cur = null;
      items.push(l);
      continue;
    }
    cur.rules.push(l);
  }
  const out: string[] = [];
  for (const it of items) {
    if (typeof it === 'string') {
      out.push(it);
      continue;
    }
    const kept = it.agents.filter((a) => !lower.has(a.name.toLowerCase()));
    if (!kept.length) continue; // groupe dédié aux robots autorisés : remplacé plus bas
    out.push(...kept.map((a) => a.line), ...it.rules);
  }
  const body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const add = want.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n');
  return `${body ? `${body}\n\n` : ''}${add}\n`;
}

/** Interdit-on tout le site à tous les robots ? (garde-fou : jamais introduit par Repéré) */
export function blocksEverything(robots: string | null): boolean {
  if (!robots) return false;
  const groups = robots.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  return groups.some((g) => /user-agent\s*:\s*\*/i.test(g) && /^\s*disallow\s*:\s*\/\s*$/im.test(g));
}

/** llms.txt à partir des seules pages explorées (titre, adresse, méta-description existante). */
export function buildLlmsTxt(site: PlanSite, max = 25): string | null {
  const pages = site.pages.filter((p) => p.isIndexable !== false && p.title).slice(0, max);
  const name = site.name || site.pages.find((p) => normUrl(p.url) === normUrl(site.origin))?.title;
  if (!name || !pages.length) return null;
  const home = findPage(site, site.origin);
  const summary = site.description || home?.metaDescription;
  const lines = [`# ${name}`, ''];
  if (summary) lines.push(`> ${summary.replace(/\s+/g, ' ').trim()}`, '');
  lines.push('## Pages principales', '');
  for (const p of pages) lines.push(`- [${p.title!.replace(/[[\]]/g, '')}](${p.url})${p.metaDescription ? `: ${p.metaDescription.replace(/\s+/g, ' ').trim()}` : ''}`);
  return `${lines.join('\n')}\n`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** JSON sûr dans un <script> (pas de « </script> » possible). */
function jsonForScript(v: unknown): string {
  return JSON.stringify(v, null, 2).replace(/</g, '\\u003c');
}

export function faqBlock(faq: { question: string; answer: string }[]): string {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })) };
  return [
    '<!-- Repéré : FAQ -->',
    '<section class="repere-faq"><h2>Questions fréquentes</h2>',
    ...faq.map((q) => `<h3>${escapeHtml(q.question)}</h3>\n<p>${escapeHtml(q.answer)}</p>`),
    '</section>',
    `<script type="application/ld+json">${jsonForScript(ld)}</script>`,
    '<!-- /Repéré : FAQ -->',
  ].join('\n');
}

export function jsonLdBlock(raw: string): string | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const items = Array.isArray(v) ? v : [v];
  if (!items.length || !items.every((x) => x && typeof x === 'object' && '@type' in (x as object))) return null;
  return `<!-- Repéré : données structurées -->\n<script type="application/ld+json">${jsonForScript(v)}</script>\n<!-- /Repéré -->`;
}

interface Draft {
  kind: ChangeKind;
  target: ChangeTarget;
  patch: ChangePatch;
  before: string | null;
  rationale: string;
  generatedBy: Change['generatedBy'];
  /** à préparer en export même si une plateforme connectée sait écrire ce type */
  exportOnly?: boolean;
}

function toChange(findingId: string, d: Draft): Change {
  return {
    id: stableId('ch', findingId, d.kind, d.target.url, d.target.imageSrc, d.target.path, d.patch.find),
    kind: d.kind,
    target: d.target,
    patch: d.patch,
    before: d.before,
    beforeSource: d.before === null ? 'none' : 'crawl',
    after: d.patch.op === 'set' ? d.patch.value : null,
    rationale: d.rationale,
    risk: KIND_RISK[d.kind],
    generatedBy: d.generatedBy,
    status: 'pending',
  };
}

function sameOrigin(site: PlanSite, to: string): boolean {
  if (to.startsWith('/') && !to.startsWith('//')) return true;
  try {
    return new URL(to).hostname.replace(/^www\./, '') === new URL(site.origin).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
}

async function draftsFor(f: Finding, kind: ChangeKind, p: AutoFixPayload, site: PlanSite, writer: TextWriter | undefined, skipped: SkippedFix[], max: number): Promise<Draft[]> {
  const urls = (p.urls ?? (p.url ? [p.url] : f.affected.map((a) => a.url))).map((u) => absolute(site, u)).slice(0, max);
  const skip = (reason: string, url?: string) => skipped.push({ findingId: f.id, kind, ...(url ? { url } : {}), reason });
  const out: Draft[] = [];
  const write = async (k: WriteKind, page: PlanPage | undefined, extra: { current?: string; imageSrc?: string; passage?: string; instruction?: string } = {}) =>
    writeText({ kind: k, sourceText: page?.text ?? site.description ?? '', pageTitle: page?.title, h1: page?.h1?.[0], siteName: site.name, city: site.city, ...extra }, writer);

  switch (kind) {
    case 'meta.title':
    case 'meta.description': {
      for (const url of urls) {
        const page = findPage(site, url);
        const current = kind === 'meta.title' ? page?.title : page?.metaDescription;
        let value = urls.length === 1 && p.value ? p.value.trim() : '';
        let by: Change['generatedBy'] = 'finding';
        if (!value) {
          if (!page) {
            skip('Page absente de l’exploration : impossible de rédiger sans son contenu.', url);
            continue;
          }
          const w = await write(kind, page, { current });
          if (!w) {
            skip('Pas assez de contenu sur la page pour proposer un texte sans rien inventer.', url);
            continue;
          }
          value = w.value;
          by = w.by;
        }
        out.push({ kind, target: { url }, patch: { op: 'set', value }, before: current ?? null, rationale: f.fix, generatedBy: by });
      }
      break;
    }
    case 'image.alt': {
      for (const a of p.urls || p.url ? urls.map((url) => ({ url, detail: p.imageSrc })) : f.affected.slice(0, max)) {
        const url = absolute(site, a.url);
        const page = findPage(site, url);
        const srcs = a.detail && /[/.]/.test(a.detail) ? [a.detail] : (page?.images ?? []).filter((i) => !i.alt?.trim()).map((i) => i.src).slice(0, 20);
        if (!srcs.length) skip('Image non identifiée.', url);
        for (const src of srcs) {
          const w = p.value && srcs.length === 1 ? { value: p.value, by: 'finding' as const } : await write('image.alt', page, { imageSrc: src });
          if (!w) {
            skip(`Impossible de décrire l’image « ${src.split('/').pop()} » sans la voir : à rédiger par vous.`, url);
            continue;
          }
          const img = page?.images?.find((i) => i.src === src);
          out.push({ kind, target: { url, imageSrc: absolute(site, src) }, patch: { op: 'set', value: w.value }, before: img?.alt ?? '', rationale: f.fix, generatedBy: w.by });
        }
      }
      break;
    }
    case 'canonical': {
      for (const url of urls) {
        const page = findPage(site, url);
        const value = (urls.length === 1 && p.value) || page?.url || url;
        out.push({ kind, target: { url }, patch: { op: 'set', value: absolute(site, value) }, before: page?.canonical ?? null, rationale: f.fix, generatedBy: p.value ? 'finding' : 'rules' });
      }
      break;
    }
    case 'jsonld': {
      if (p.merge) {
        const url = absolute(site, p.url ?? urls[0] ?? site.origin);
        const entity = (findPage(site, url)?.jsonLd ?? []).find((x) => {
          const t = String((x as { '@type'?: unknown })?.['@type'] ?? '');
          return x && typeof x === 'object' && !Array.isArray(x) && t && !/^(FAQPage|BreadcrumbList|WebSite|WebPage)$/.test(t);
        }) as Record<string, unknown> | undefined;
        if (!entity) {
          skip('Aucun bloc d’entité existant sur la page : fusion impossible.', url);
          break;
        }
        const merged: Record<string, unknown> = { ...entity };
        for (const [k, v] of Object.entries(p.merge)) {
          merged[k] = Array.isArray(v) ? [...new Set([...(Array.isArray(entity[k]) ? (entity[k] as unknown[]) : entity[k] ? [entity[k]] : []), ...v])] : v;
        }
        const block = jsonLdBlock(JSON.stringify(merged));
        if (block) out.push({ kind, target: { url }, patch: { op: 'set', value: block }, before: JSON.stringify(entity), rationale: `${f.fix} Remplacez le bloc existant par celui-ci.`, generatedBy: 'finding', exportOnly: true });
        break;
      }
      const block = p.value ? jsonLdBlock(p.value) : null;
      if (!block) {
        skip('Données structurées non fournies ou invalides : Repéré ne les invente pas (renseignez votre fiche).');
        break;
      }
      out.push({ kind, target: { url: absolute(site, p.url ?? urls[0] ?? site.origin) }, patch: { op: 'append', value: block }, before: null, rationale: f.fix, generatedBy: 'finding' });
      break;
    }
    case 'faq': {
      const url = absolute(site, p.url ?? urls[0] ?? site.origin);
      const page = findPage(site, url);
      const source = [page?.text, site.description].filter(Boolean).join('\n');
      const faq = (p.faq ?? [])
        .filter((q) => q.question?.trim() && q.answer?.trim() && (q.trusted || TO_COMPLETE_RE.test(q.answer) || unsupportedFacts(`${q.question} ${q.answer}`, source).length === 0))
        .map(({ question, answer }) => ({ question, answer }));
      if (!faq.length) {
        skip('Aucune question-réponse appuyée par le contenu de la page : la FAQ n’est pas proposée.', url);
        break;
      }
      if (faq.length < (p.faq ?? []).length) skip(`${(p.faq ?? []).length - faq.length} question(s) écartée(s) : réponse absente du contenu de la page.`, url);
      out.push({ kind, target: { url }, patch: { op: 'append', value: faqBlock(faq) }, before: null, rationale: f.fix, generatedBy: 'finding' });
      break;
    }
    case 'redirect': {
      const from = (p.from ?? '').trim();
      const to = (p.to ?? '').trim();
      if (!/^\/[^\s]*$/.test(from) || !to || !sameOrigin(site, to)) {
        skip('Redirection incomplète ou hors du site (source et cible requises, sur le même site).');
        break;
      }
      const toPath = (() => {
        try {
          const u = new URL(to, site.origin);
          return `${u.pathname}${u.search}`;
        } catch {
          return to;
        }
      })();
      if (toPath === from) {
        skip('Redirection vers la même adresse (passage en https, www) : réglage à faire chez l’hébergeur, pas par une redirection de page.');
        break;
      }
      out.push({ kind, target: { url: absolute(site, from), path: from }, patch: { op: 'set', value: to }, before: null, rationale: f.fix, generatedBy: 'finding' });
      break;
    }
    case 'robots.txt': {
      const before = site.robotsTxt ?? null;
      let value = p.value?.trim() ? `${p.value.trim()}\n` : '';
      if (!value) {
        const bots = (p.allowBots ?? []).filter((b) => (AI_BOTS as readonly string[]).includes(b) || /^[A-Za-z0-9._-]{2,40}$/.test(b));
        if (!bots.length) {
          skip('Robots à autoriser non précisés.');
          break;
        }
        value = allowBotsInRobots(before, bots);
      }
      if (blocksEverything(value) && !blocksEverything(before)) {
        skip('Proposition refusée : elle bloquerait tout le site.');
        break;
      }
      out.push({ kind, target: { url: absolute(site, '/robots.txt') }, patch: { op: 'set', value }, before, rationale: f.fix, generatedBy: p.value ? 'finding' : 'rules' });
      break;
    }
    case 'llms.txt': {
      const value = p.value?.trim() ? `${p.value.trim()}\n` : site.llmsTxt ? null : buildLlmsTxt(site);
      if (!value) {
        skip(site.llmsTxt ? 'Un llms.txt existe déjà : aucune réécriture automatique.' : 'Pas assez de pages explorées pour composer le llms.txt.');
        break;
      }
      out.push({ kind, target: { url: absolute(site, '/llms.txt') }, patch: { op: 'set', value }, before: site.llmsTxt ?? null, rationale: f.fix, generatedBy: p.value ? 'finding' : 'rules' });
      break;
    }
    case 'rewrite': {
      const url = absolute(site, p.url ?? urls[0] ?? site.origin);
      const page = findPage(site, url);
      const find = p.find?.trim();
      if (!find) {
        skip('Passage à réécrire non précisé.', url);
        break;
      }
      let value = p.replace?.trim() ?? '';
      let by: Change['generatedBy'] = 'finding';
      if (value && p.mode !== 'deterministe' && unsupportedFacts(value, `${page?.text ?? ''}\n${find}\n${site.name ?? ''}\n${site.city ?? ''}\n${site.description ?? ''}`).length) {
        skip('La réécriture fournie contient des faits absents de la page : écartée.', url);
        break;
      }
      if (!value) {
        const w = await write('rewrite', page, { passage: find, instruction: p.instruction ?? f.fix });
        if (!w) {
          skip('Réécriture impossible sans fournisseur d’IA configuré (ou texte proposé refusé par le contrôle anti-invention).', url);
          break;
        }
        value = w.value;
        by = w.by;
      }
      out.push({ kind, target: { url }, patch: { op: 'replace', find, value, ...(p.all ? { all: true } : {}) }, before: null, rationale: p.instruction && by === 'finding' ? `${f.fix} ${p.instruction}` : f.fix, generatedBy: by });
      break;
    }
    case 'meta.robots': {
      for (const url of urls) {
        const v = (p.value ?? '').trim().toLowerCase();
        if (!/^(no)?index\s*,\s*(no)?follow$|^(no)?index$/.test(v)) {
          skip('Consigne d’indexation invalide.', url);
          continue;
        }
        out.push({ kind, target: { url }, patch: { op: 'set', value: v }, before: findPage(site, url)?.metaRobots ?? null, rationale: f.fix, generatedBy: 'finding' });
      }
      break;
    }
    case 'sitemap.xml': {
      const value = p.value?.trim();
      if (!value || !/<urlset[\s>]|<sitemapindex[\s>]/.test(value)) {
        skip('Plan du site non fourni.');
        break;
      }
      out.push({ kind, target: { url: absolute(site, p.url ?? '/sitemap.xml') }, patch: { op: 'set', value: `${value}\n`.replace(/\n+$/, '\n') }, before: null, rationale: f.fix, generatedBy: 'finding' });
      break;
    }
    case 'gbp.description': {
      let value = p.value?.trim() ?? '';
      let by: Change['generatedBy'] = 'finding';
      if (!value) {
        const home = findPage(site, site.origin);
        const w = await writeText({ kind: 'gbp.description', sourceText: [site.description, home?.text].filter(Boolean).join('\n'), siteName: site.name, city: site.city, h1: home?.h1?.[0] }, writer);
        if (!w) {
          skip('Pas assez d’informations vérifiées pour rédiger la description de la fiche.');
          break;
        }
        value = w.value;
        by = w.by;
      }
      out.push({ kind, target: {}, patch: { op: 'set', value }, before: null, rationale: f.fix, generatedBy: by });
      break;
    }
    case 'gbp.hours': {
      if (!p.hours || typeof p.hours !== 'object') {
        skip('Horaires non fournis : Repéré ne les devine pas.');
        break;
      }
      out.push({ kind, target: {}, patch: { op: 'set', value: canonicalJson(p.hours) }, before: null, rationale: f.fix, generatedBy: 'finding' });
      break;
    }
  }
  return out;
}

function platformFor(kind: ChangeKind, targets: PlanTarget[]): Platform {
  for (const t of targets) {
    if (t.platform === 'export') continue;
    if (kind.startsWith('gbp.') !== (t.platform === 'gbp')) continue;
    if (t.capabilities.includes(kind)) return t.platform;
  }
  return 'export';
}

/** Constats → ChangeSets en brouillon (aucun appel à la plateforme ici). */
export async function planChanges(findings: Finding[], site: PlanSite, connectors: PlanTarget | PlanTarget[] | null, opts: PlanOptions = {}): Promise<Plan> {
  const targets = connectors ? (Array.isArray(connectors) ? connectors : [connectors]) : [];
  const now = (opts.now ?? new Date()).toISOString();
  const actor = opts.actor ?? { id: 'agent' };
  const max = Math.max(1, Math.min(opts.maxChanges ?? 50, 200));
  const skipped: SkippedFix[] = [];
  const changeSets: ChangeSet[] = [];
  for (const f of findings) {
    const fixKind = f.autoFix?.kind;
    const expanded = expandAutoFix(f);
    let fixes: { kind: ChangeKind; payload: AutoFixPayload }[];
    if (expanded === null) {
      skipped.push({ findingId: f.id, kind: fixKind, reason: `Type de correction « ${fixKind} » non pris en charge.` });
      continue;
    } else if (expanded.length) fixes = expanded;
    else {
      const k = inferKind(f);
      if (!k) {
        skipped.push({ findingId: f.id, reason: 'Pas de correction automatique pour ce constat.' });
        continue;
      }
      fixes = [{ kind: k, payload: {} }];
    }
    const drafts: Draft[] = [];
    for (const fx of fixes.slice(0, max)) drafts.push(...(await draftsFor(f, fx.kind, fx.payload, site, opts.writer, skipped, max)));
    const byPlatform = new Map<Platform, Change[]>();
    for (const d of drafts.slice(0, max)) {
      const pl = d.exportOnly ? 'export' : platformFor(d.kind, targets);
      const list = byPlatform.get(pl) ?? [];
      const ch = toChange(f.id, d);
      if (!list.some((x) => x.id === ch.id)) list.push(ch);
      byPlatform.set(pl, list);
    }
    for (const [platform, changes] of byPlatform) {
      changeSets.push({
        id: newChangeSetId(),
        businessId: site.businessId,
        platform,
        site: site.origin,
        title: f.title,
        origin: { findingId: f.id, findingTitle: f.title, severity: f.severity },
        changes,
        risk: maxRisk(changes.map((c) => c.risk)),
        status: 'draft',
        createdAt: now,
        createdBy: actor,
        ...(platform === 'export' ? { exportBundle: true } : {}),
        version: 1,
        updatedAt: now,
      });
    }
  }
  return { changeSets, skipped };
}
