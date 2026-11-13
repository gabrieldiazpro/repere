/**
 * Section « llms.txt » : informative uniquement (poids 0, sévérité info). Aucune preuve d'effet sur les citations ;
 * Google ne l'utilise pas. On propose un fichier construit à partir des pages explorées (réutilise siteaudit/llms).
 */
import type { SiteCrawl } from '@/lib/crawl/types';
import { LLMS_HONEST, buildLlmsTxt, validateLlmsTxt, type LlmsPage } from '@/lib/siteaudit/llms';
import type { GeoFinding, GeoSection } from './types';
import { UTILITY_PATH } from './entity';
import { finding, homePage, section, type GeoPage } from './util';

const CAT = 'geo.llms';
const WHY = `${LLMS_HONEST.points[0]} ${LLMS_HONEST.points[2]}`;

export function proposeLlmsTxt(pages: GeoPage[], name: string | null, summary?: string | null): string {
  const picked: LlmsPage[] = pages
    .filter((p) => p.page.isIndexable !== false && !UTILITY_PATH.test(p.path))
    .slice(0, 25)
    .map((p) => ({ url: p.url, title: p.page.title || p.page.h1[0] || p.path, description: p.page.metaDescription }));
  return buildLlmsTxt({ name: name || homePage(pages)?.page.title || 'Site', summary: summary ?? undefined }, picked);
}

export function auditLlms(crawl: SiteCrawl, pages: GeoPage[], given: { status: number; text?: string } | null | undefined, name: string | null, summary: string | null): GeoSection {
  const origin = crawl.finalOrigin || crawl.origin;
  const url = `${origin}/llms.txt`;
  const fromCrawl = crawl.pages.find((p) => /\/llms\.txt$/i.test(p.finalUrl || p.url));
  const file = given ?? (fromCrawl ? { status: fromCrawl.status, text: fromCrawl.html } : null);
  const findings: GeoFinding[] = [];
  const proposal = () => ({ kind: 'llms.txt', payload: { url, value: proposeLlmsTxt(pages, name, summary), honest: LLMS_HONEST } });
  let note: string;
  if (!file) {
    note = 'llms.txt non vérifié par l’exploration. Informatif : aucun effet démontré sur les citations.';
    findings.push(
      finding({
        id: 'geo.llms.unchecked',
        category: CAT,
        severity: 'info',
        title: 'llms.txt : non vérifié (facultatif, sans effet démontré)',
        why: WHY,
        fix: LLMS_HONEST.verdict,
        affected: [{ url }],
        impact: 1,
        effort: 1,
        evidenceLevel: 'demontre',
        autoFix: proposal(),
      }),
    );
  } else if (file.status !== 200 || !file.text || /<html|<!doctype/i.test(file.text.slice(0, 500))) {
    note = 'Pas de llms.txt. Informatif : aucun effet démontré sur les citations.';
    findings.push(
      finding({
        id: 'geo.llms.missing',
        category: CAT,
        severity: 'info',
        title: 'Pas de fichier llms.txt (facultatif, sans effet démontré sur les citations)',
        why: WHY,
        fix: `${LLMS_HONEST.verdict} Un fichier est proposé si vous souhaitez le publier.`,
        affected: [{ url }],
        impact: 1,
        effort: 1,
        evidenceLevel: 'demontre',
        autoFix: proposal(),
      }),
    );
  } else {
    const issues = validateLlmsTxt(file.text);
    note = issues.length ? `llms.txt présent, ${issues.length} problème(s) de forme.` : 'llms.txt présent et bien formé (informatif).';
    if (issues.length) {
      findings.push(
        finding({
          id: 'geo.llms.invalid',
          category: CAT,
          severity: 'info',
          title: `Votre llms.txt ne suit pas le format proposé (${issues.length} point(s))`,
          why: WHY,
          fix: issues.join(' '),
          affected: [{ url }],
          impact: 1,
          effort: 1,
          evidenceLevel: 'demontre',
          autoFix: proposal(),
        }),
      );
    }
  }
  return section('llms', 'llms.txt (informatif)', 0, findings, note);
}
