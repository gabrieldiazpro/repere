/**
 * Site illisible ou lu partiellement : diagnostic d'UNE page récupérée, avec le moteur de l'analyse complète
 * (src/lib/crawl/diagnose.ts → src/lib/analysis/access.ts). Pur (aucun réseau) : la récupération est faite par run.ts.
 * Quand rien n'a pu être lu (`blocked`), l'outil n'affiche aucun résultat calculé, seulement l'état et la marche à suivre.
 */
import { accessReport } from '@/lib/analysis/access';
import { diagnoseCrawl } from '@/lib/crawl/diagnose';
import { extractPage } from '@/lib/crawl/extract';
import { detectPlatform } from '@/lib/crawl/platform';
import type { CrawledPage, SiteCrawl } from '@/lib/crawl/types';
import { check } from '../v6/pure';
import type { AccessInfo, PageBase7 } from './types';

export interface RawFetch {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  chain: { url: string; status: number; via?: 'meta-refresh' | 'js' | 'cookie' }[];
  headers: Record<string, string>;
  html: string | null;
  bytes?: number;
  fetchMs: number;
  blockedByRobots?: boolean;
  errorCode?: string;
  error?: string;
  robots?: { url: string; status: number; text?: string } | null;
}

const origin = (u: string) => {
  try {
    return new URL(u).origin;
  } catch {
    return u;
  }
};

/** État d'accès de la page, ou null si elle a été lue normalement. */
export function accessFor(r: RawFetch): AccessInfo | null {
  const html = r.html ?? '';
  const pages: CrawledPage[] = [];
  if (r.status || r.blockedByRobots) {
    const ex = extractPage(html, r.finalUrl);
    pages.push({
      ...ex,
      url: r.requestedUrl,
      finalUrl: r.finalUrl,
      status: r.blockedByRobots ? 0 : r.status,
      redirectChain: r.chain,
      depth: 0,
      contentType: r.headers['content-type'],
      bytes: r.bytes ?? html.length,
      fetchMs: r.fetchMs,
      headers: r.headers,
      ...(r.blockedByRobots ? { blockedByRobots: true } : {}),
      internalLinks: ex.links.length,
      externalLinks: 0,
      isIndexable: true,
    });
  }
  const crawl: SiteCrawl = {
    startUrl: r.requestedUrl,
    origin: origin(r.requestedUrl),
    finalOrigin: origin(r.finalUrl || r.requestedUrl),
    startedAt: new Date(0).toISOString(),
    durationMs: r.fetchMs,
    truncated: false,
    robots: r.robots ? { ...r.robots, sitemaps: [] } : null,
    sitemaps: [],
    sitemapUrls: [],
    pages,
    links: [],
    errors: [],
    platform: html ? detectPlatform([{ html, headers: r.headers }]) : null,
  };
  crawl.diagnosis = diagnoseCrawl(crawl, { entryErrorCode: r.errorCode, entryError: r.error, entryHeaders: r.headers, entryStatus: r.status, entryBody: html.slice(0, 30_000) });
  const a = accessReport(crawl, r.error);
  if (a.state === 'ok') return null;
  // Les messages parlent de « la page d'accueil » : l'outil lit la page saisie, qui peut être une autre.
  let home = true;
  try {
    home = new URL(r.requestedUrl).pathname === '/';
  } catch {
    /* adresse déjà validée */
  }
  const fix = (s: string) => (home ? s : s.replace(/La page d’accueil/g, 'La page').replace(/la page d’accueil/g, 'la page').replace(/Votre page d’accueil/g, 'Votre page'));
  return {
    state: a.state,
    blocked: !a.readable,
    title: fix(a.title),
    message: fix(a.message).replace(/ Aucun score n’est calculé\./, ' Aucun résultat n’est calculé.'),
    howTo: a.howTo.map(fix),
    notes: a.notes,
    ...(a.platform ? { platform: a.platform.name } : {}),
  };
}

/** Rapport « illisible » commun : verdict rouge tiré de l'état d'accès, aucun contrôle calculé. */
export function blockedBase(r: { requestedUrl: string; finalUrl: string; status: number }, access: AccessInfo, now = new Date().toISOString()): PageBase7 {
  return {
    url: r.requestedUrl,
    finalUrl: r.finalUrl || r.requestedUrl,
    status: r.status,
    verdict: { tone: 'fail', title: access.title, text: 'Nous n’avons pas pu lire la page : aucun résultat n’est calculé. La marche à suivre est ci-dessous.' },
    checks: [check('access', access.title, 'fail', access.message, access.howTo[0] ?? 'Relancez l’analyse quand la page est accessible.')],
    checkedAt: now,
    access,
  };
}
