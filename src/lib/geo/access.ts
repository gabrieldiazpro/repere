/**
 * Section « Accès des robots d'IA » : robots.txt (réutilise siteaudit/robotsAudit), en-têtes et méta qui limitent
 * l'usage des pages, pare-feu / CDN qui bloque, rendu côté client illisible sans JavaScript.
 */
import type { SiteCrawl } from '@/lib/crawl/types';
import { SEARCH_CRITICAL } from '@/lib/siteaudit/bots';
import { decide, parseRobots } from '@/lib/siteaudit/robots';
import { recommendedRobots, robotsReportFromText } from '@/lib/siteaudit/robotsAudit';
import type { RobotsReport } from '@/lib/siteaudit/types';
import type { GeoFinding, GeoSection } from './types';
import { clip, effDepth, finding, plural, section, type GeoPage } from './util';

const CAT = 'geo.acces';

/** Signes d'un défi anti-robot (pare-feu applicatif, CDN) dans une réponse. */
const CHALLENGE_BODY =
  /(cf-chl-|challenge-platform|just a moment\.\.\.|attention required! \| cloudflare|cf-browser-verification|captcha-delivery\.com|datadome|px-captcha|_incapsula_resource|incapsula incident|sucuri website firewall|access denied \| .* used cloudflare|verify you are human|vérifiez que vous êtes humain)/i;

function challengeOf(headers: Record<string, string>, status: number, html?: string): string | null {
  if (headers['cf-mitigated']) return `Cloudflare (cf-mitigated: ${headers['cf-mitigated']})`;
  if (html && CHALLENGE_BODY.test(html.slice(0, 20_000))) {
    const m = CHALLENGE_BODY.exec(html.slice(0, 20_000));
    return `page de vérification anti-robot (« ${clip(m?.[0] ?? '', 40)} »)`;
  }
  if ((status === 403 || status === 429 || status === 503) && /cloudflare|akamai|sucuri|imperva|incapsula|datadome/i.test(`${headers.server ?? ''} ${headers['x-cdn'] ?? ''}`))
    return `HTTP ${status} servi par ${headers.server ?? headers['x-cdn']}`;
  return null;
}

const SNIPPET_BLOCK = /\b(nosnippet|noarchive|max-snippet\s*:\s*0)\b/i;

export interface AccessResult {
  section: GeoSection;
  robots: RobotsReport | null;
  searchBlocked: string[];
}

export function auditAccess(crawl: SiteCrawl, pages: GeoPage[]): AccessResult {
  const findings: GeoFinding[] = [];
  const origin = crawl.finalOrigin || crawl.origin;
  const robotsUrl = crawl.robots?.url ?? `${origin}/robots.txt`;

  /* --- robots.txt ---------------------------------------------------- */
  let report: RobotsReport | null = null;
  let searchBlocked: string[] = [];
  if (crawl.robots) {
    const status = crawl.robots.status || null;
    const text = crawl.robots.text ?? (status && status >= 400 && status < 500 ? null : '');
    const keyPaths = ['/', ...pages.filter((p) => effDepth(p.page.depth) <= 1 && p.path !== '/').map((p) => p.path)].slice(0, 30);
    report = robotsReportFromText(origin, status && status < 300 ? text : null, status, keyPaths);
    const parsed = status && status < 300 && text ? parseRobots(text) : null;

    if (report.unreachable) {
      findings.push(
        finding({
          id: 'geo.acces.robots_unreachable',
          category: CAT,
          severity: 'critical',
          title: `Votre robots.txt répond en erreur (${status ?? 'injoignable'}) : les robots d'IA considèrent tout le site interdit`,
          why: 'Selon la norme RFC 9309, un robots.txt en erreur serveur vaut interdiction totale pour les robots qui la respectent.',
          fix: 'Faites répondre /robots.txt en 200 (texte) ou en 404 s’il n’existe pas. Un fichier proposé est fourni.',
          affected: [{ url: robotsUrl, detail: `HTTP ${status ?? 'aucune réponse'}` }],
          impact: 3,
          effort: 1,
          evidenceLevel: 'demontre',
          autoFix: { kind: 'robots.txt', payload: { url: robotsUrl, value: recommendedRobots(crawl.robots.sitemaps ?? []).cite, alternatives: recommendedRobots(crawl.robots.sitemaps ?? []) } },
        }),
      );
      searchBlocked = [...SEARCH_CRITICAL];
    } else {
      const blockedSearch = report.bots.filter((b) => b.role === 'search' && b.status === 'blocked');
      searchBlocked = blockedSearch.map((b) => b.token);
      const keep = parsed ? [...new Set(parsed.groups.filter((g) => g.agents.includes('*')).flatMap((g) => g.rules.filter((r) => !r.allow && r.path && r.path !== '/').map((r) => r.path)))] : [];
      const proposal = recommendedRobots(report.sitemaps, keep);
      if (blockedSearch.length) {
        const critical = blockedSearch.filter((b) => SEARCH_CRITICAL.includes(b.token));
        findings.push(
          finding({
            id: 'geo.acces.search_blocked',
            category: CAT,
            severity: critical.length ? 'critical' : 'high',
            title: `${plural(blockedSearch.length, 'robot de recherche IA est bloqué', 'robots de recherche IA sont bloqués')} par votre robots.txt (${blockedSearch.map((b) => b.token).join(', ')})`,
            why: 'Ces robots alimentent les réponses avec recherche (ChatGPT, Perplexity, Claude, Google, Copilot). Leurs opérateurs indiquent qu’un site bloqué n’est pas repris dans ces réponses.',
            fix: 'Autorisez ces robots dans robots.txt. Vous pouvez continuer à bloquer les robots d’entraînement (GPTBot, ClaudeBot, Google-Extended) : ce sont des réglages indépendants.',
            affected: blockedSearch.map((b) => ({ url: robotsUrl, detail: `${b.token} (${b.product})${b.line ? ` — ligne ${b.line} : ${b.rule ?? ''}` : ''}` })),
            impact: 3,
            effort: 1,
            evidenceLevel: 'demontre',
            evidence: blockedSearch.map((b) => `${b.token} : ${b.rule ?? 'groupe ' + b.group}`).join(' ; '),
            autoFix: { kind: 'robots.txt', payload: { url: robotsUrl, value: proposal.citeNoTraining, alternatives: proposal } },
          }),
        );
      }
      const blockedUser = report.bots.filter((b) => b.role === 'user' && b.status === 'blocked');
      if (blockedUser.length) {
        findings.push(
          finding({
            id: 'geo.acces.user_blocked',
            category: CAT,
            severity: 'medium',
            title: `${plural(blockedUser.length, 'robot de lecture à la demande est bloqué', 'robots de lecture à la demande sont bloqués')} (${blockedUser.map((b) => b.token).join(', ')})`,
            why: 'Quand un utilisateur demande à l’IA de lire votre page, ces robots ne peuvent pas la récupérer (s’ils appliquent robots.txt, ce que certains opérateurs ne garantissent pas).',
            fix: 'Autorisez ces robots si vous voulez que vos pages soient lues quand on les demande.',
            affected: blockedUser.map((b) => ({ url: robotsUrl, detail: `${b.token}${b.line ? ` — ligne ${b.line}` : ''}` })),
            impact: 2,
            effort: 1,
            evidenceLevel: 'demontre',
            autoFix: { kind: 'robots.txt', payload: { url: robotsUrl, value: proposal.citeNoTraining, alternatives: proposal } },
          }),
        );
      }
      // Blocage partiel : pages explorées interdites aux robots de recherche (alors que l'accueil est permis).
      if (parsed && !blockedSearch.length) {
        const partial: { url: string; detail: string }[] = [];
        for (const p of pages) {
          const bots = SEARCH_CRITICAL.filter((t) => !decide(parsed, t, p.path).allowed);
          if (bots.length) partial.push({ url: p.url, detail: `interdite à ${bots.join(', ')}` });
        }
        // Les pages bloquées pour RepereBot ne sont pas dans `pages` : les compter aussi.
        for (const p of crawl.pages.filter((x) => x.blockedByRobots)) {
          let path = '/';
          try {
            path = new URL(p.url).pathname;
          } catch {
            /* ignoré */
          }
          const bots = SEARCH_CRITICAL.filter((t) => !decide(parsed, t, path).allowed);
          if (bots.length) partial.push({ url: p.url, detail: `interdite à ${bots.join(', ')}` });
        }
        if (partial.length) {
          findings.push(
            finding({
              id: 'geo.acces.partial_block',
              category: CAT,
              severity: 'medium',
              title: `${plural(partial.length, 'page de votre site est interdite', 'pages de votre site sont interdites')} aux robots de recherche IA`,
              why: 'Ces pages ne peuvent pas être reprises dans les réponses avec recherche. C’est voulu pour un espace client ou un panier, pas pour vos pages d’offre.',
              fix: 'Vérifiez la liste : si ce sont des pages d’offre, de service ou d’information, retirez la règle Disallow correspondante.',
              affected: partial,
              impact: 2,
              effort: 1,
              evidenceLevel: 'demontre',
            }),
          );
        }
      }
      const trainingBlocked = report.bots.filter((b) => (b.role === 'training' || b.role === 'control') && b.status === 'blocked');
      if (trainingBlocked.length) {
        findings.push(
          finding({
            id: 'geo.acces.training_blocked',
            category: CAT,
            severity: 'info',
            title: `Vous bloquez l’entraînement des IA (${trainingBlocked.map((b) => b.token).join(', ')}) : choix légitime`,
            why: 'Bloquer l’entraînement n’empêche pas d’être cité dans les réponses avec recherche, sauf Google-Extended qui réduit l’ancrage de Gemini (pas les AI Overviews).',
            fix: 'Rien à faire si c’est voulu.',
            affected: trainingBlocked.map((b) => ({ url: robotsUrl, detail: b.token })),
            impact: 1,
            effort: 1,
            evidenceLevel: 'demontre',
          }),
        );
      }
    }
  }

  /* --- en-têtes et méta ---------------------------------------------- */
  const snippet: { url: string; detail: string }[] = [];
  for (const p of pages) {
    const xrt = p.page.headers['x-robots-tag'] ?? '';
    const meta = p.page.metaRobots ?? '';
    // X-Robots-Tag peut viser un robot précis (« googlebot: nosnippet ») : on garde tout, c'est un signal à vérifier.
    const hit = SNIPPET_BLOCK.exec(xrt) ?? SNIPPET_BLOCK.exec(meta);
    if (hit) snippet.push({ url: p.url, detail: `${xrt && SNIPPET_BLOCK.test(xrt) ? 'X-Robots-Tag' : 'meta robots'} : ${clip(SNIPPET_BLOCK.test(xrt) ? xrt : meta, 80)}` });
  }
  if (snippet.length) {
    findings.push(
      finding({
        id: 'geo.acces.snippet_controls',
        category: CAT,
        severity: 'high',
        title: `${plural(snippet.length, 'page interdit', 'pages interdisent')} la reprise d’extraits (nosnippet, noarchive ou max-snippet:0)`,
        why: 'Google n’affiche pas ces pages comme sources des AI Overviews sans extrait autorisé, et Bing exclut des réponses de Copilot les pages en noarchive.',
        fix: 'Retirez nosnippet, noarchive et max-snippet:0 des pages que vous voulez voir citées (balise meta robots ou en-tête X-Robots-Tag). Pour masquer un seul passage, utilisez data-nosnippet.',
        affected: snippet,
        impact: 3,
        effort: 1,
        evidenceLevel: 'demontre',
      }),
    );
  }

  /* --- pare-feu / CDN ------------------------------------------------ */
  const challenged: { url: string; detail: string }[] = [];
  let cdn: string | null = null;
  for (const p of crawl.pages) {
    const c = challengeOf(p.headers ?? {}, p.status, p.html);
    if (c) challenged.push({ url: p.finalUrl || p.url, detail: c });
    const server = `${p.headers?.server ?? ''}`;
    if (!cdn && (/cloudflare/i.test(server) || p.headers?.['cf-ray'])) cdn = 'Cloudflare';
  }
  const robotsChallenged = crawl.robots && (crawl.robots.status === 403 || crawl.robots.status === 429);
  if (challenged.length || (robotsChallenged && cdn)) {
    findings.push(
      finding({
        id: 'geo.acces.firewall',
        category: CAT,
        severity: 'high',
        title: `Votre pare-feu ou CDN a opposé une vérification anti-robot à notre robot sur ${plural(challenged.length || 1, 'page', 'pages')}`,
        why: 'Un pare-feu qui filtre les robots bloque aussi, très souvent, ceux des IA, même si votre robots.txt les autorise. Cloudflare bloque les robots d’IA par défaut pour ses nouveaux clients depuis juillet 2025.',
        fix: 'Dans votre pare-feu (Cloudflare : Sécurité > Robots, « Bloquer les robots d’IA » ; autres WAF : règles d’autorisation), autorisez OAI-SearchBot, PerplexityBot, Claude-SearchBot, Bingbot et Googlebot, idéalement par leurs plages d’IP publiées.',
        affected: challenged.length ? challenged : [{ url: crawl.robots?.url ?? `${origin}/robots.txt`, detail: `HTTP ${crawl.robots?.status}` }],
        impact: 3,
        effort: 1,
        evidenceLevel: 'probable',
        evidence: 'Indice : notre robot (RepereBot) n’est pas un robot d’IA ; le comportement réel envers chaque robot d’IA se vérifie dans les journaux du serveur ou la console du CDN.',
      }),
    );
  } else if (cdn) {
    findings.push(
      finding({
        id: 'geo.acces.cdn_check',
        category: CAT,
        severity: 'info',
        title: `Votre site passe par ${cdn} : vérifiez le réglage des robots d’IA`,
        why: 'Notre robot n’a pas été bloqué, mais Cloudflare peut bloquer spécifiquement les robots d’IA (réglage « Bloquer les robots d’IA », actif par défaut pour les nouveaux comptes depuis juillet 2025).',
        fix: 'Dans Cloudflare, Sécurité > Robots : vérifiez que les robots de recherche IA (OAI-SearchBot, PerplexityBot, Claude-SearchBot) ne sont pas bloqués.',
        affected: [{ url: origin }],
        impact: 2,
        effort: 1,
        evidenceLevel: 'probable',
      }),
    );
  }

  /* --- rendu côté client -------------------------------------------- */
  const csr = pages.filter((p) => p.page.renderHints?.likelyClientRendered || (p.parsed && p.page.wordCount < 60 && p.page.renderHints?.scriptsCount >= 5));
  if (csr.length) {
    const share = csr.length / Math.max(1, pages.length);
    findings.push(
      finding({
        id: 'geo.acces.client_rendered',
        category: CAT,
        severity: share >= 0.5 || csr.some((p) => p.page.depth === 0) ? 'critical' : 'high',
        title: `${plural(csr.length, 'page est quasi vide', 'pages sont quasi vides')} sans JavaScript : les robots d’OpenAI, d’Anthropic et de Perplexity n’en lisent pas le contenu`,
        why: 'Ces robots n’exécutent pas le JavaScript (mesure Vercel × MERJ, 2024) : ils ne voient que le HTML envoyé par le serveur. Google et Apple, eux, l’exécutent.',
        fix: 'Activez le rendu côté serveur ou le pré-rendu (SSR, génération statique) pour ces pages ; au minimum, mettez le texte principal dans le HTML initial.',
        affected: csr.map((p) => ({ url: p.url, detail: `${p.page.wordCount} mots lisibles, ${p.page.renderHints.scriptsCount} scripts` })),
        impact: 3,
        effort: 3,
        evidenceLevel: 'probable',
      }),
    );
  }

  const note = crawl.robots
    ? `robots.txt (HTTP ${crawl.robots.status}) lu et confronté à ${report?.bots.length ?? 0} robots d’IA ; en-têtes et HTML de ${pages.length} pages vérifiés.`
    : 'robots.txt non récupéré par l’exploration : seuls les en-têtes, le pare-feu et le rendu ont été vérifiés.';
  return { section: section('acces', 'Accès des robots d’IA', 25, findings, note), robots: report, searchBlocked };
}
