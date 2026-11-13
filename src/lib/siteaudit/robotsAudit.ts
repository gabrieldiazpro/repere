/**
 * Verdict robot par robot (outil « Robots IA », contrôle « robots » de la readiness).
 * Recommandation nuancée : bloquer l'entraînement est un choix légitime ; bloquer la recherche rend invisible.
 */
import { AI_BOTS, BOTS_VERSION, ROLE_LABELS, SEARCH_CRITICAL } from './bots';
import { SafeFetchError, normalizeInputUrl, safeFetch, type SafeFetchOptions } from './fetch';
import { decide, disallowedPaths, parseRobots, type ParsedRobots } from './robots';
import type { AiBot, BotVerdict, RobotsReport } from './types';

export const ROBOTS_LIMITS = [
  'Un robots.txt est une demande, pas une barrière : un robot peut l’ignorer, et un pare-feu (Cloudflare…) peut bloquer un robot que le robots.txt autorise. Cet outil lit le fichier, il ne teste pas le pare-feu.',
  'Google-Extended n’agit que sur Gemini (entraînement et ancrage) : il ne retire pas le site des AI Overviews ni de l’AI Mode, qui dépendent de Googlebot.',
  'Les robots « à la demande » (ChatGPT-User, Perplexity-User…) peuvent ne pas appliquer robots.txt, selon leurs opérateurs.',
];

function recommendation(bot: AiBot, blocked: boolean, partial: boolean): { severity: BotVerdict['severity']; text: string } {
  if (bot.role === 'training') {
    return blocked
      ? { severity: 'info', text: `Bloqué : vos pages ne servent pas à l’entraînement de ${bot.operator}. C’est un choix légitime, sans effet sur votre présence dans les réponses avec recherche.` }
      : { severity: 'ok', text: `Autorisé : vos pages peuvent servir à l’entraînement. Le bloquer est un choix légitime, qui ne vous retire pas des réponses avec recherche.` };
  }
  if (bot.role === 'control') {
    return blocked
      ? {
          severity: 'info',
          text:
            bot.token === 'Google-Extended'
              ? 'Bloqué : Gemini ne s’entraîne pas sur vos pages et ne s’en sert pas pour ancrer ses réponses. Choix légitime, mais il peut réduire votre présence dans Gemini. Sans effet sur la recherche Google ni sur les AI Overviews.'
              : 'Bloqué : vos pages ne servent pas à l’entraînement des modèles d’Apple. Choix légitime ; Applebot continue d’indexer le site.',
        }
      : { severity: 'ok', text: 'Autorisé (jeton de contrôle, aucune visite). Le bloquer est un choix légitime pour l’entraînement.' };
  }
  if (bot.role === 'search') {
    if (blocked)
      return {
        severity: 'critical',
        text: `Bloqué : votre site est invisible pour ${bot.product}${SEARCH_CRITICAL.includes(bot.token) ? '' : ' (robot secondaire)'}. Autorisez ${bot.token} si vous voulez être cité.`,
      };
    if (partial) return { severity: 'warn', text: `Autorisé sur l’accueil, mais certaines parties du site sont interdites. Vérifiez que vos pages importantes n’en font pas partie.` };
    return { severity: 'ok', text: `Autorisé : ${bot.product} peut lire et citer vos pages.` };
  }
  // user
  if (blocked)
    return {
      severity: 'warn',
      text: `Bloqué : quand un utilisateur de ${bot.product} demande votre page, l’IA ne peut pas la lire${bot.mayIgnoreRobots ? ' (si elle applique robots.txt, ce qui n’est pas garanti)' : ''}. Autorisez-le si vous voulez que vos pages soient lues à la demande.`,
    };
  return { severity: 'ok', text: `Autorisé : ${bot.product} peut lire vos pages quand un utilisateur le demande.` };
}

/** Verdicts pour un robots.txt déjà analysé (sans réseau). `paths` : chemins testés, « / » en premier. */
export function verdictsFor(parsed: ParsedRobots | null, paths: string[] = ['/'], opts: { unreachable?: boolean } = {}): BotVerdict[] {
  return AI_BOTS.map((bot) => {
    if (!parsed) {
      const blocked = !!opts.unreachable;
      const r = recommendation(bot, blocked, false);
      return {
        token: bot.token,
        operator: bot.operator,
        product: bot.product,
        role: bot.role,
        roleLabel: ROLE_LABELS[bot.role],
        status: blocked ? 'blocked' : 'not_mentioned',
        group: 'none',
        line: null,
        rule: null,
        blockedPaths: [],
        severity: blocked ? r.severity : 'ok',
        recommendation: blocked
          ? `robots.txt inaccessible (erreur serveur) : les robots respectueux considèrent tout le site interdit. ${r.text}`
          : 'Aucun robots.txt : tout est permis par défaut.',
      };
    }
    const home = decide(parsed, bot.token, paths[0] ?? '/');
    const others = paths.slice(1).map((p) => ({ p, d: decide(parsed, bot.token, p) }));
    const blockedPaths = [...new Set([...others.filter((o) => !o.d.allowed).map((o) => o.p), ...disallowedPaths(parsed, bot.token).filter((p) => p !== '/')])];
    const blocked = !home.allowed;
    const r = recommendation(bot, blocked, !blocked && blockedPaths.length > 0);
    const status: BotVerdict['status'] = blocked ? 'blocked' : home.kind === 'specific' ? 'allowed' : 'not_mentioned';
    const groupLine = home.kind === 'none' ? null : (parsed.groups.find((g) => g.agents.some((a) => (home.kind === 'wildcard' ? a === '*' : a.split(/[\s/]/)[0] === bot.token.toLowerCase())))?.line ?? null);
    return {
      token: bot.token,
      operator: bot.operator,
      product: bot.product,
      role: bot.role,
      roleLabel: ROLE_LABELS[bot.role],
      status,
      group: home.kind,
      line: home.rule?.line ?? groupLine,
      rule: home.rule?.raw ?? null,
      blockedPaths: blockedPaths.slice(0, 20),
      severity: r.severity,
      recommendation: status === 'not_mentioned' && !blocked ? `Non mentionné${home.kind === 'wildcard' ? ' (règles « * » appliquées)' : ''} : autorisé par défaut. ${r.text.replace(/^Autorisé : /, '')}` : r.text,
    };
  });
}

/** Deux robots.txt recommandés, prêts à copier (en conservant les lignes Sitemap trouvées). */
export function recommendedRobots(sitemaps: string[] = [], keepDisallow: string[] = []): { cite: string; citeNoTraining: string } {
  const tail = [...(keepDisallow.length ? ['', 'User-agent: *', ...keepDisallow.map((p) => `Disallow: ${p}`)] : ['', 'User-agent: *', 'Allow: /']), ...(sitemaps.length ? ['', ...sitemaps.map((s) => `Sitemap: ${s}`)] : [])];
  const search = AI_BOTS.filter((b) => b.role === 'search' || b.role === 'user').map((b) => b.token);
  const training = AI_BOTS.filter((b) => b.role === 'training' || b.role === 'control').map((b) => b.token);
  const cite = [
    `# robots.txt proposé par Repéré (${BOTS_VERSION}) — profil « être cité par les IA »`,
    '# Recherche, lecture à la demande et entraînement autorisés.',
    ...search.flatMap((t) => [`User-agent: ${t}`]),
    'Allow: /',
    ...tail,
  ].join('\n');
  const citeNoTraining = [
    `# robots.txt proposé par Repéré (${BOTS_VERSION}) — profil « être cité, sans servir à l’entraînement »`,
    '# Rappel : robots.txt est une demande, pas une barrière.',
    ...search.map((t) => `User-agent: ${t}`),
    'Allow: /',
    '',
    ...training.map((t) => `User-agent: ${t}`),
    'Disallow: /',
    ...tail,
  ].join('\n');
  return { cite: `${cite}\n`, citeNoTraining: `${citeNoTraining}\n` };
}

/** Rapport complet à partir du texte (sans réseau). */
export function robotsReportFromText(url: string, text: string | null, httpStatus: number | null, paths: string[] = ['/']): RobotsReport {
  const u = new URL(url);
  const robotsUrl = `${u.origin}/robots.txt`;
  const found = text !== null && httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
  const unreachable = httpStatus === null || httpStatus >= 500;
  const parsed = found ? parseRobots(text as string) : null;
  const bots = verdictsFor(parsed, paths, { unreachable });
  const keep = parsed ? [...new Set(parsed.groups.filter((g) => g.agents.includes('*')).flatMap((g) => g.rules.filter((r) => !r.allow && r.path && r.path !== '/').map((r) => r.path)))] : [];
  return {
    url,
    robotsUrl,
    httpStatus,
    found,
    unreachable,
    sitemaps: parsed?.sitemaps ?? [],
    paths,
    bots,
    summary: {
      searchBlocked: bots.filter((b) => b.role === 'search' && b.status === 'blocked').map((b) => b.token),
      trainingBlocked: bots.filter((b) => (b.role === 'training' || b.role === 'control') && b.status === 'blocked').map((b) => b.token),
      userBlocked: bots.filter((b) => b.role === 'user' && b.status === 'blocked').map((b) => b.token),
    },
    recommended: recommendedRobots(parsed?.sitemaps ?? [], keep),
    limits: ROBOTS_LIMITS,
    botsListVersion: BOTS_VERSION,
  };
}

/** Récupère et analyse le robots.txt d'un site. `extraPath` : un chemin supplémentaire à tester (ex. « /tarifs »). */
export async function analyzeRobots(input: string, opts: SafeFetchOptions & { extraPath?: string } = {}): Promise<RobotsReport> {
  const u = normalizeInputUrl(input);
  let res: Awaited<ReturnType<typeof safeFetch>> | null = null;
  try {
    res = await safeFetch(new URL('/robots.txt', u.origin), { ...opts, respectRobots: false, accept: 'text/plain,*/*;q=0.5' });
  } catch (e) {
    // Adresse refusée (SSRF) ou domaine inexistant : erreur pour l'utilisateur ; panne réseau : robots.txt injoignable.
    if (e instanceof SafeFetchError && (e.code.startsWith('blocked') || e.code === 'invalid_url' || e.code === 'dns')) throw e;
  }
  const paths = ['/', ...(u.pathname !== '/' ? [u.pathname] : []), ...(opts.extraPath && opts.extraPath !== u.pathname ? [opts.extraPath] : [])];
  if (!res) return robotsReportFromText(u.toString(), null, null, paths);
  if (res.status >= 500) return robotsReportFromText(u.toString(), null, res.status, paths);
  // Page HTML servie à la place d'un robots.txt (« soft 404 » de SPA) : équivaut à une absence de fichier.
  const html = /text\/html/i.test(res.contentType) || /^\s*<(!doctype|html)/i.test(res.body.slice(0, 200));
  if (res.status >= 200 && res.status < 300 && html) return robotsReportFromText(u.toString(), null, 404, paths);
  return robotsReportFromText(u.toString(), res.body, res.status, paths);
}

/**
 * Point d'entrée de la tâche de fond `siteaudit.run` (src/lib/jobs/handlers.ts charge ce module).
 * Import dynamique : évite un cycle robotsAudit → runs → readiness → robotsAudit.
 */
export async function runSiteAuditJob(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const m = await import('./runs');
  return m.runSiteAuditJob(payload);
}
