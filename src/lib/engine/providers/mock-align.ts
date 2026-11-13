/**
 * Alignement d'une réponse de démonstration sur un état de citation voulu (comptes démo façonnés, src/lib/demo-v2.ts).
 *
 * Règle : on ne marque jamais « cité » une réponse dont le texte ne contient pas le nom, ni l'inverse. On modifie donc
 * le TEXTE (nom injecté au rang demandé, ou retiré avec ses phrases), puis la détection habituelle du moteur
 * (detectMention) en dérive « cité » et le rang. Les sources sont ajustées (site du client retiré s'il n'est plus cité,
 * positions recalculées).
 */
import { registrableDomain } from '../detect';
import type { ProviderAnswer, ProviderId, RawSource } from '../types';

export interface AlignOptions {
  /** nom affiché du client (tel qu'il apparaît dans les réponses mock) */
  client: string;
  /** domaine du site du client (ex. paysia.fr), pour retirer ses sources quand il n'est plus cité */
  clientDomain?: string;
  /** état voulu */
  mention: boolean;
  /** rang voulu (1 = premier) quand le nom est injecté ; ignoré si le nom est déjà présent */
  rank?: number;
  /** concurrents à retirer de la réponse (jamais tous : au moins une recommandation reste) */
  drop?: string[];
  /** description courte du client quand il est injecté */
  description?: string;
  /** sources où un client cité figure (ex. sa fiche Google Maps) : il est ajouté à leur extrait s'il manque */
  listedOn?: (url: string) => boolean;
}

const LIST_LINE = /^(\d+\.|-|\*) \*\*(.+?)\*\*/;

type Style = 'numbered' | 'dash' | 'star';
function styleOf(marker: string): Style {
  return /^\d/.test(marker) ? 'numbered' : marker === '-' ? 'dash' : 'star';
}
function lineFor(style: Style, name: string, desc: string): string {
  if (style === 'numbered') return `1. **${name}** – ${desc}.`;
  if (style === 'dash') return `- **${name}** : ${desc}.`;
  return `* **${name}** — ${desc}.`;
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Retire les phrases (hors liste) qui nomment `name`. */
function dropSentencesWith(line: string, name: string): string {
  if (!line.includes(name)) return line;
  return line
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !s.includes(name))
    .join(' ');
}

/** Texte aligné (liste à puces/numérotée ou phrase « on trouve A, B et C »). Texte sans recommandation : inchangé. */
export function alignText(text: string, o: AlignOptions): string {
  const drop = new Set((o.drop ?? []).filter((d) => d && d !== o.client));
  const desc = o.description ?? 'souvent recommandé pour son sérieux et ses avis clients';
  const lines = text.split('\n');
  const listIdx = lines.map((l, i) => (LIST_LINE.test(l) ? i : -1)).filter((i) => i >= 0);

  if (listIdx.length) {
    const style = styleOf(LIST_LINE.exec(lines[listIdx[0]])![1]);
    let items = listIdx.map((i) => ({ line: lines[i], name: LIST_LINE.exec(lines[i])![2] }));
    // Concurrents retirés (au moins une recommandation conservée).
    const others = items.filter((it) => it.name !== o.client);
    const keep1 = others.some((it) => !drop.has(it.name)) ? null : others[0];
    items = items.filter((it) => it.name === o.client || !drop.has(it.name) || it === keep1);
    const present = items.some((it) => it.name === o.client);
    if (!o.mention && present) items = items.filter((it) => it.name !== o.client);
    if (o.mention && !present) {
      const at = Math.max(0, Math.min(items.length, (o.rank ?? 1) - 1));
      items.splice(at, 0, { line: lineFor(style, o.client, desc), name: o.client });
    }
    const body = items.map((it, k) => (style === 'numbered' ? it.line.replace(/^\d+\./, `${k + 1}.`) : it.line));
    // Reconstruit : lignes hors liste conservées, bloc de liste remplacé à l'emplacement du premier élément.
    const out: string[] = [];
    lines.forEach((l, i) => {
      if (i === listIdx[0]) out.push(...body);
      else if (!listIdx.includes(i)) out.push(o.mention ? l : dropSentencesWith(l, o.client));
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  // Forme rédigée (mock local) : « … on trouve A, B et C. Desc pour A. »
  const m = /on trouve (.+?)\. /.exec(text);
  if (!m) {
    if (!o.mention) return dropSentencesWith(text, o.client);
    if (text.includes(o.client)) return text;
    // Réponse sans liste : le nom est ajouté en fin de premier paragraphe (citation unique, rang 1).
    const [head, ...rest] = text.split('\n');
    return [`${head} ${o.client} revient toutefois souvent dans les avis en ligne.`, ...rest].join('\n');
  }
  let names = m[1].split(/, | et /).map((s) => s.trim()).filter(Boolean);
  const otherNames = names.filter((n) => n !== o.client);
  const keepName = otherNames.some((n) => !drop.has(n)) ? null : otherNames[0];
  names = names.filter((n) => n === o.client || !drop.has(n) || n === keepName);
  const present = names.includes(o.client);
  if (!o.mention && present) names = names.filter((n) => n !== o.client);
  if (o.mention && !present) names.splice(Math.max(0, Math.min(names.length, (o.rank ?? 1) - 1)), 0, o.client);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}` : names[0] ?? '';
  let out = text.replace(m[0], `on trouve ${list}. `);
  // « … pour X. » : X doit rester cité.
  const forRe = /pour ([^.]+)\.(\s|$)/g;
  out = out.replace(forRe, (all, who: string, sp: string) => (names.includes(who) ? all : `pour ${names[0]}.${sp}`));
  if (!o.mention) {
    const [head, ...rest] = out.split('\n');
    out = [head, ...rest.map((l) => dropSentencesWith(l, o.client))].join('\n');
  }
  return out;
}

/** Recalcule la position d'une source dans le nouveau texte (nom qu'elle pointait), ou undefined. */
function relocate(s: RawSource, oldText: string, newText: string, names: string[]): number | undefined {
  if (s.startIndex === undefined) return undefined;
  const name = names.find((n) => oldText.startsWith(n, s.startIndex));
  if (!name) return undefined;
  const i = newText.indexOf(name);
  return i >= 0 ? i : undefined;
}

/** Réponse alignée (texte, sources, citations). Une réponse en erreur est rendue telle quelle. */
export function alignAnswer(a: ProviderAnswer, o: AlignOptions, knownNames: string[] = []): ProviderAnswer {
  if (a.error || !a.text) return a;
  const text = alignText(a.text, o);
  if (text === a.text) return a;
  const removeSite = !o.mention && !!o.clientDomain;
  const isClientSite = (u: string) => removeSite && registrableDomain(u) === o.clientDomain;
  const names = [o.client, ...knownNames];
  const citations = a.citations.filter((u) => !isClientSite(u));
  const sources = a.sources
    ?.filter((s) => !isClientSite(s.url))
    .map((s) => {
      let snippet = s.snippet;
      if (o.mention && o.listedOn?.(s.url) && !snippet?.includes(o.client)) snippet = snippet ? snippet.replace(/\s*…\s*$/, `, ${o.client} …`) : `${o.client} …`;
      if (!o.mention && snippet?.includes(o.client)) {
        snippet = snippet.replace(new RegExp(`(,\\s*)?${escapeRe(o.client)}(,\\s*)?`, 'g'), (_all, before?: string, after?: string) => (before && after ? ', ' : ''));
        if (!knownNames.some((n) => snippet!.includes(n))) snippet = undefined;
      }
      const startIndex = relocate(s, a.text, text, names);
      const next: RawSource = { ...s, snippet };
      if (snippet === undefined) delete next.snippet;
      if (startIndex === undefined) delete next.startIndex;
      else next.startIndex = startIndex;
      return next;
    })
    .map((s, i) => ({ ...s, order: i + 1 }));
  return { ...a, text, citations, ...(sources ? { sources } : {}) };
}

// ---------------------------------------------------------------------------
// Profil de citation par IA (comptes démo) : chaque IA cite le client à son propre taux et sur ses propres thèmes,
// pour que la grille thème × IA ne montre pas trois colonnes identiques. Déterministe (graine) et stable d'un mois à
// l'autre : l'ordre des questions par IA est fixe, seul le nombre de questions citées suit le taux du mois. La
// citation reste portée par le TEXTE (alignAnswer) : ce plan dit seulement quelles réponses doivent nommer le client.
// ---------------------------------------------------------------------------

export interface ProviderCitationProfile {
  /** multiplicateur du taux de citation visé (moyenne ≈ 1 sur ChatGPT, Perplexity, Gemini) */
  factor: number;
  /** thèmes où cette IA cite plus volontiers le client */
  favored: RegExp;
}

/**
 * Perplexity s'appuie sur les sites spécialisés (comparatifs, avis, alternatives) et cite plus volontiers ; Gemini
 * nomme moins de marques, sauf sur ce que lui apporte Google (proximité, où acheter, urgence) ; ChatGPT entre les deux.
 */
export const PROVIDER_CITATION_PROFILE: Record<ProviderId, ProviderCitationProfile> = {
  perplexity: { factor: 1.25, favored: /comparati|avis|alternativ/i },
  chatgpt: { factor: 1, favored: /meilleur|services|prix|marque/i },
  gemini: { factor: 0.75, favored: /proximit|acheter|urgence/i },
  claude: { factor: 0.9, favored: /meilleur|comparati/i },
  mistral: { factor: 0.85, favored: /marque|prix|proximit/i },
};

function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Questions où chaque IA doit citer le client (clés `provider|queryId`), pour un taux visé `rate` (0..1).
 * `questions` : par IA, les questions posées avec leur thème. Ordre par IA = graine commune (corrélation entre IA)
 * + graine propre à l'IA + bonus sur ses thèmes de prédilection ; k = round(taux × facteur × n).
 */
export function citationPlan(
  seed: string,
  rate: number,
  questions: ReadonlyMap<string, ReadonlyArray<{ id: string; theme: string }>>,
): Set<string> {
  const out = new Set<string>();
  for (const [provider, qs] of questions) {
    const prof = PROVIDER_CITATION_PROFILE[provider as ProviderId] ?? { factor: 1, favored: /$^/ };
    const key = (q: { id: string; theme: string }) =>
      0.45 * hash01(`${seed}|${q.id}`) + 0.55 * hash01(`${seed}|${provider}|${q.id}`) - (prof.favored.test(q.theme) ? 0.6 : 0);
    const ordered = [...qs].sort((a, b) => key(a) - key(b) || a.id.localeCompare(b.id));
    const k = Math.max(0, Math.min(ordered.length, Math.round(rate * prof.factor * ordered.length)));
    for (const q of ordered.slice(0, k)) out.add(`${provider}|${q.id}`);
  }
  return out;
}
