/**
 * Normalisation des `Finding.autoFix` émis par SEO-AUDIT (src/lib/seoaudit) et GEO-OPT (src/lib/geo) vers la charge
 * utile interne `AutoFixPayload` (un élément par page / passage / image). Formats pris en charge :
 *
 * SEO-AUDIT (forme `{ items: [...] }`)
 * - meta.title, meta.description : { items: { url, value, review? }[] }
 * - img.alt (alias image.alt)    : { items: { url, src, alt, review? }[] }
 * - canonical                   : { items: { url, href }[] }
 * - meta.robots                 : { items: { url, value }[] }              (export : réglage d'indexation)
 * - redirect                    : { items: { from, to, status }[] }       (from/to absolus ou chemins)
 * - link.update                 : { items: { page, from, to }[] }         (réécriture des adresses de liens)
 * - jsonld                      : { items: { url, type, jsonld }[] }
 * - robots (alias robots.txt)   : { text, changes }
 * - sitemap (alias sitemap.xml) : { url, xml, count }                     (export)
 * GEO-OPT (docs/v5/demandes-PUBLICATION.md)
 * - robots.txt : { url, value, alternatives }
 * - jsonld     : { url, value: objet | chaîne, script?, notes? }  ou  { url, merge: { sameAs } } (export)
 * - faq        : { url, value: { question, answer, from: 'fiche' | 'a_completer' }[], jsonld?, notes? }
 * - rewrite    : { items: { url, passageId, before, value, mode, notes }[] }
 * - llms.txt   : { url, value, honest }
 * Ainsi que la forme « plate » de publication.md ({ url, value, … }).
 */
import { isChangeKind, type AutoFixPayload, type ChangeKind, type Finding } from './types';

export interface ExpandedFix {
  kind: ChangeKind;
  payload: AutoFixPayload;
}

const ALIASES: Record<string, ChangeKind> = {
  'img.alt': 'image.alt',
  robots: 'robots.txt',
  sitemap: 'sitemap.xml',
  'link.update': 'rewrite',
  'meta.canonical': 'canonical',
  llms: 'llms.txt',
};

/** Marqueur des champs à compléter par le client : bloque la validation tant qu'il reste. */
export const TO_COMPLETE_RE = /\[\s*à compléter\s*\]/i;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const items = (p: Record<string, unknown>): Record<string, unknown>[] => (Array.isArray(p.items) ? p.items.map(obj).filter((x): x is Record<string, unknown> => !!x) : []);

function jsonText(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (v && typeof v === 'object') return JSON.stringify(v);
  return undefined;
}

/** Chemin (et requête) d'une adresse absolue ou relative. */
function pathOf(u: string): string {
  try {
    const x = new URL(u, 'https://x.invalid');
    return `${x.pathname}${x.search}`;
  } catch {
    return u;
  }
}

/** Constat → corrections normalisées (vide si aucune ; `kind` d'origine inconnu → null). */
export function expandAutoFix(f: Pick<Finding, 'autoFix'>): ExpandedFix[] | null {
  const raw = f.autoFix;
  if (!raw) return [];
  const kind = ALIASES[raw.kind] ?? (isChangeKind(raw.kind) ? raw.kind : null);
  if (!kind) return null;
  const p = obj(raw.payload) ?? {};
  const list = items(p);
  const out: ExpandedFix[] = [];
  const push = (payload: AutoFixPayload) => out.push({ kind, payload });

  switch (raw.kind === 'link.update' ? 'link.update' : kind) {
    case 'meta.title':
    case 'meta.description':
    case 'meta.robots':
      if (list.length) for (const it of list) push({ url: str(it.url), value: str(it.value) });
      else push({ url: str(p.url), urls: Array.isArray(p.urls) ? (p.urls as string[]) : undefined, value: str(p.value) });
      break;
    case 'image.alt':
      if (list.length) for (const it of list) push({ url: str(it.url), imageSrc: str(it.src) ?? str(it.imageSrc), value: str(it.alt) ?? str(it.value) });
      else push({ url: str(p.url), imageSrc: str(p.src) ?? str(p.imageSrc), value: str(p.alt) ?? str(p.value) });
      break;
    case 'canonical':
      if (list.length) for (const it of list) push({ url: str(it.url), value: str(it.href) ?? str(it.value) });
      else push({ url: str(p.url), value: str(p.href) ?? str(p.value) });
      break;
    case 'redirect':
      if (list.length) for (const it of list) push({ from: str(it.from) && pathOf(it.from as string), to: str(it.to) });
      else push({ from: str(p.from) && pathOf(p.from as string), to: str(p.to) });
      break;
    case 'link.update':
      // Une correction par page et par lien : toutes les occurrences de l'ancienne adresse sont remplacées.
      for (const it of list) if (str(it.page) && str(it.from) && str(it.to)) push({ url: it.page as string, find: it.from as string, replace: it.to as string, all: true, mode: 'deterministe' });
      break;
    case 'jsonld':
      if (list.length) for (const it of list) push({ url: str(it.url), value: jsonText(it.jsonld ?? it.value) });
      else if (obj(p.merge)) push({ url: str(p.url), merge: obj(p.merge)! });
      else push({ url: str(p.url), value: jsonText(p.value) });
      break;
    case 'faq': {
      const qa = (Array.isArray(p.value) ? p.value : Array.isArray(p.faq) ? p.faq : []).map(obj).filter((x): x is Record<string, unknown> => !!x);
      push({
        url: str(p.url),
        faq: qa.map((q) => ({
          question: String(q.question ?? ''),
          answer: q.from === 'a_completer' ? '[à compléter]' : String(q.answer ?? ''),
          // Réponses tirées de la fiche de vérité (déjà vérifiée) : pas de contrôle contre le texte de la page.
          ...(q.from === 'fiche' ? { trusted: true } : {}),
        })),
      });
      break;
    }
    case 'rewrite':
      if (list.length) for (const it of list) push({ url: str(it.url), find: str(it.before) ?? str(it.find), replace: str(it.value) ?? str(it.replace), instruction: str(it.notes), mode: it.mode === 'ia' ? 'ia' : it.mode === 'deterministe' ? 'deterministe' : undefined });
      else push({ url: str(p.url), find: str(p.find) ?? str(p.before), replace: str(p.replace) ?? str(p.value), instruction: str(p.instruction) });
      break;
    case 'robots.txt':
      push({ url: str(p.url), value: str(p.value) ?? str(p.text), allowBots: Array.isArray(p.allowBots) ? (p.allowBots as string[]) : undefined });
      break;
    case 'sitemap.xml':
      push({ url: str(p.url), value: str(p.xml) ?? str(p.value) });
      break;
    default:
      push(p as AutoFixPayload);
  }
  return out;
}
