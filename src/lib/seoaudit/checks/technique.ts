/** Section « Technique et redirections » : HTTPS, statuts, redirections, URL, HTML de base. */
import { SRC } from '../sources';
import type { AuditCtx, CheckDef, CrawledPage } from '../types';
import { attr, headOf, hostOf, norm, pl, sameSite, tags } from '../util';
import { hitItems, hitPages, hitSite, pageAt } from './helpers';

const sec = 'technique' as const;
const cat = 'technique';

const SOFT404 = /(page\s+)?(introuvable|non trouv[ée]e|n['’]existe (plus|pas)|erreur 404|\b404\b|not found|page not found|oups)/i;
const SESSION = /[?&;](sid|sessionid|session_id|phpsessid|jsessionid|oscsid|zenid)=/i;

function redirectHops(p: CrawledPage): number {
  return p.redirectChain.filter((h) => h.status >= 300 && h.status < 400).length;
}

/** Redirection aboutie (destination en 2xx, sur le site). */
function resolvedRedirect(ctx: AuditCtx, p: CrawledPage): boolean {
  return p.redirectChain.length > 0 && p.status >= 200 && p.status < 300 && sameSite(p.finalUrl, ctx.origin);
}

function isLoop(ctx: AuditCtx, p: CrawledPage): boolean {
  if (!p.redirectChain.length) return false;
  const urls = p.redirectChain.map((h) => norm(h.url));
  if (new Set(urls).size < urls.length) return true;
  if (p.status >= 300 && p.status < 400 && urls.includes(norm(p.finalUrl))) return true;
  const r = ctx.crawl.redirects?.find((x) => norm(x.from) === norm(p.url));
  return !!r?.error && /boucle|loop/i.test(r.error);
}

const srcItems = (ps: CrawledPage[], detail: (p: CrawledPage) => string) => ps.map((p) => ({ url: p.url, detail: detail(p) }));

export const TECHNIQUE: CheckDef[] = [
  {
    id: 'seo.https.not_https', section: sec, category: cat, severity: 'critical', impact: 3, effort: 2, scope: 'site',
    label: 'Site sans HTTPS',
    title: () => 'Votre site n’est pas servi en HTTPS',
    why: 'Les navigateurs affichent « Non sécurisé », ce qui fait fuir les visiteurs, et Google privilégie les pages en HTTPS.',
    fix: 'Activez un certificat (gratuit chez la plupart des hébergeurs) et redirigez tout le http vers https en 301.',
    source: SRC.https,
    run: (ctx) => (ctx.https ? null : hitSite(ctx, ctx.origin)),
  },
  {
    id: 'seo.https.http_pages', section: sec, category: cat, severity: 'high', impact: 2, effort: 2, scope: 'page',
    label: 'Pages encore servies en http',
    title: (n) => `${pl(n, 'page est encore servie', 'pages sont encore servies')} en http (non sécurisé)`,
    why: 'Une partie du site reste en http : doublons http/https et avertissement « Non sécurisé ».',
    fix: 'Redirigez en 301 chaque adresse http vers son équivalent https.',
    source: SRC.https,
    run: (ctx) => (ctx.https ? hitPages(ctx.pages.filter((p) => p.status < 400 && p.finalUrl.startsWith('http://') && sameSite(p.finalUrl, ctx.origin)), undefined, { autoFix: { kind: 'redirect', payload: { items: ctx.pages.filter((p) => p.finalUrl.startsWith('http://') && sameSite(p.finalUrl, ctx.origin)).map((p) => ({ from: p.finalUrl, to: p.finalUrl.replace(/^http:/, 'https:'), status: 301 })) } } }) : null),
  },
  {
    id: 'seo.https.mixed_content', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Contenu mixte (ressources en http)',
    title: (n) => `${pl(n, 'page charge', 'pages chargent')} des ressources en http (contenu mixte)`,
    why: 'Le navigateur bloque ou signale ces ressources : images manquantes, cadenas barré.',
    fix: 'Remplacez « http:// » par « https:// » dans les adresses des images, scripts et feuilles de style.',
    source: SRC.mixedContent,
    run: (ctx) => {
      if (!ctx.https) return null;
      const re = /<(?:img|script|iframe|source|video|audio|embed)\b[^>]*\ssrc\s*=\s*["']http:\/\/[^"']+|<link\b[^>]*rel\s*=\s*["']?stylesheet[^>]*href\s*=\s*["']http:\/\/[^"']+/i;
      return hitPages(ctx.html.filter((p) => p.finalUrl.startsWith('https:') && !!p.html && re.test(p.html)), (p) => (re.exec(p.html ?? '')?.[0] ?? '').slice(0, 140));
    },
  },
  {
    id: 'seo.https.hsts', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'site',
    label: 'En-tête HSTS absent',
    title: () => 'Votre site n’impose pas le HTTPS aux navigateurs (en-tête HSTS absent)',
    why: 'HSTS garantit que les visiteurs restent en HTTPS, même s’ils tapent l’adresse en http.',
    fix: 'Ajoutez l’en-tête « Strict-Transport-Security: max-age=31536000 » une fois tout le site en HTTPS.',
    source: SRC.hsts,
    run: (ctx) => (ctx.https && ctx.home && !ctx.home.headers['strict-transport-security'] ? hitSite(ctx) : null),
  },
  {
    id: 'seo.https.http_links', section: sec, category: cat, severity: 'medium', impact: 1, effort: 1, scope: 'page',
    label: 'Liens internes en http',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} des liens internes en http`,
    why: 'Chaque clic passe par une redirection : temps perdu et signal brouillé pour Google.',
    fix: 'Mettez à jour ces liens en https (une recherche-remplacement dans le CMS suffit souvent).',
    source: SRC.redirects,
    run: (ctx) => {
      if (!ctx.https) return null;
      const bad = ctx.internalLinks.filter((l) => l.to.startsWith('http://'));
      const byPage = new Map<string, string[]>();
      for (const l of bad) byPage.set(l.from, [...(byPage.get(l.from) ?? []), l.to]);
      return hitItems([...byPage.entries()].map(([url, tos]) => ({ url, detail: `${tos.length} lien(s), ex. ${tos[0]}` })), {
        autoFix: { kind: 'link.update', payload: { items: bad.slice(0, 500).map((l) => ({ page: l.from, from: l.to, to: l.to.replace(/^http:/, 'https:') })) } },
      });
    },
  },
  {
    id: 'seo.host.duplicate', section: sec, category: cat, severity: 'high', impact: 3, effort: 2, scope: 'site',
    label: 'Deux versions du site (www et sans www)',
    title: () => 'Votre site répond sur deux adresses (avec et sans « www ») sans redirection',
    why: 'Google voit deux sites identiques : la popularité est partagée entre les deux.',
    fix: 'Choisissez une version et redirigez l’autre en 301 (réglage de l’hébergeur ou du CMS).',
    source: SRC.canonical,
    run: (ctx) => {
      const hosts = new Set(ctx.html.map((p) => hostOf(p.finalUrl)));
      const bare = ctx.host.replace(/^www\./, '');
      return hosts.has(bare) && hosts.has(`www.${bare}`) ? hitSite(ctx, `${bare} et www.${bare}`) : null;
    },
  },
  {
    id: 'seo.status.5xx', section: sec, category: cat, severity: 'critical', impact: 3, effort: 2, scope: 'page',
    label: 'Erreurs serveur (5xx)',
    title: (n) => `${pl(n, 'page renvoie', 'pages renvoient')} une erreur serveur (5xx)`,
    why: 'Les erreurs serveur répétées font ralentir l’exploration de Google puis retirer les pages.',
    fix: 'Consultez les journaux d’erreurs de l’hébergeur ou du CMS (extension défaillante, mémoire, base de données).',
    source: SRC.httpErrors,
    run: (ctx) => hitPages(ctx.pages.filter((p) => p.status >= 500), (p) => `HTTP ${p.status}`),
  },
  {
    id: 'seo.status.soft404', section: sec, category: cat, severity: 'high', impact: 2, effort: 1, scope: 'page',
    label: 'Fausses pages 404 (soft 404)',
    title: (n) => `${pl(n, 'page affiche', 'pages affichent')} « page introuvable » mais répondent 200`,
    why: 'Google les classe en « soft 404 » : du budget d’exploration gaspillé et des pages vides qui peuvent apparaître.',
    fix: 'Faites répondre ces adresses en 404/410, ou redirigez-les en 301 vers une page utile.',
    source: SRC.httpErrors,
    run: (ctx) => hitPages(ctx.html.filter((p) => SOFT404.test(`${p.title ?? ''} ${p.h1.join(' ')}`) && p.wordCount < 400), (p) => p.title),
  },
  {
    id: 'seo.redirect.chain', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Chaînes de redirections',
    title: (n) => `${pl(n, 'adresse passe', 'adresses passent')} par plusieurs redirections successives`,
    why: 'Chaque saut ralentit le visiteur ; Google abandonne au-delà de 10 sauts et la popularité se perd en route.',
    fix: 'Redirigez directement l’adresse de départ vers la destination finale (une seule 301).',
    source: SRC.redirects,
    run: (ctx) => {
      const ps = ctx.pages.filter((p) => redirectHops(p) >= 2 && resolvedRedirect(ctx, p));
      return hitItems(srcItems(ps, (p) => `${redirectHops(p)} sauts → ${p.finalUrl}`), { autoFix: { kind: 'redirect', payload: { items: ps.map((p) => ({ from: p.url, to: p.finalUrl, status: 301 })) } } });
    },
  },
  {
    id: 'seo.redirect.loop', section: sec, category: cat, severity: 'high', impact: 3, effort: 1, scope: 'page',
    label: 'Boucles de redirection',
    title: (n) => `${pl(n, 'adresse tourne', 'adresses tournent')} en boucle de redirections`,
    why: 'La page ne s’affiche jamais : ni pour les visiteurs, ni pour Google.',
    fix: 'Corrigez la règle de redirection fautive (souvent http↔https ou slash final).',
    source: SRC.redirects,
    run: (ctx) => hitItems(srcItems(ctx.pages.filter((p) => isLoop(ctx, p)), (p) => p.redirectChain.map((h) => h.url).join(' → '))),
  },
  {
    id: 'seo.redirect.temporary', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Redirections temporaires (302/307)',
    title: (n) => `${pl(n, 'redirection interne est temporaire', 'redirections internes sont temporaires')} (302/307)`,
    why: 'Une redirection temporaire dit à Google de garder l’ancienne adresse ; pour un changement définitif, utilisez 301.',
    fix: 'Transformez ces redirections en 301 (ou 308) si le changement est définitif.',
    source: SRC.redirects,
    run: (ctx) => {
      const ps = ctx.pages.filter((p) => p.redirectChain.some((h) => h.status === 302 || h.status === 307) && resolvedRedirect(ctx, p));
      return hitItems(srcItems(ps, (p) => `${p.redirectChain.map((h) => h.status).join('→')} → ${p.finalUrl}`), { autoFix: { kind: 'redirect', payload: { items: ps.map((p) => ({ from: p.url, to: p.finalUrl, status: 301 })) } } });
    },
  },
  {
    id: 'seo.redirect.internal_links', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Liens internes vers des redirections',
    title: (n) => `${pl(n, 'lien interne pointe', 'liens internes pointent')} vers une adresse redirigée`,
    why: 'Chaque lien vers une redirection ajoute un détour et dilue la popularité transmise.',
    fix: 'Remplacez ces liens par l’adresse finale.',
    source: SRC.redirects,
    run: (ctx) => {
      const items: { page: string; from: string; to: string }[] = [];
      for (const l of ctx.internalLinks) {
        const t = pageAt(ctx, l.to);
        if (t && t.redirectChain.length > 0 && t.status < 400 && norm(t.finalUrl) !== norm(l.to) && !l.to.startsWith('http://')) items.push({ page: l.from, from: l.to, to: t.finalUrl });
      }
      return hitItems(items.map((i) => ({ url: i.page, detail: `${i.from} → ${i.to}` })), { autoFix: { kind: 'link.update', payload: { items: items.slice(0, 500) } } });
    },
  },
  {
    id: 'seo.redirect.meta_refresh', section: sec, category: cat, severity: 'medium', impact: 1, effort: 1, scope: 'page',
    label: 'Redirections par meta refresh',
    title: (n) => `${pl(n, 'page utilise', 'pages utilisent')} une redirection « meta refresh »`,
    why: 'Ces redirections côté page sont lentes et moins bien comprises qu’une vraie redirection serveur.',
    fix: 'Remplacez-les par une redirection 301 côté serveur.',
    source: SRC.redirects,
    run: (ctx) => hitPages(ctx.html.filter((p) => !!p.html && /<meta[^>]+http-equiv\s*=\s*["']?refresh[^>]+url\s*=/i.test(p.html))),
  },
  {
    id: 'seo.url.session_id', section: sec, category: cat, severity: 'high', impact: 2, effort: 2, scope: 'page',
    label: 'Identifiants de session dans les URL',
    title: (n) => `${pl(n, 'adresse contient', 'adresses contiennent')} un identifiant de session`,
    why: 'Chaque visite crée de nouvelles adresses : Google explore des milliers de doublons.',
    fix: 'Stockez la session dans un cookie, pas dans l’URL.',
    source: SRC.urlStructure,
    run: (ctx) => hitPages(ctx.pages.filter((p) => SESSION.test(p.url))),
  },
  {
    id: 'seo.url.tracking_internal', section: sec, category: cat, severity: 'medium', impact: 1, effort: 1, scope: 'page',
    label: 'Paramètres de suivi (utm) dans les liens internes',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} des liens internes avec paramètres utm`,
    why: 'Les paramètres de campagne sur vos propres liens créent des doublons et faussent vos statistiques.',
    fix: 'Retirez les paramètres utm_… des liens entre vos pages (gardez-les pour les campagnes externes).',
    source: SRC.urlStructure,
    run: (ctx) => {
      // CRAWL retire les paramètres de suivi des liens : on relit le HTML.
      const items: { url: string; detail?: string }[] = [];
      for (const p of ctx.html) {
        const hrefs = (p.html ?? '').match(/<a\b[^>]*href\s*=\s*["'][^"']*[?&](utm_[a-z]+|gclid|fbclid)=[^"']*["']/gi) ?? [];
        const internal = hrefs.map((t) => attr(t, 'href') ?? '').filter((h) => {
          const u = norm(h, p.finalUrl);
          return !!u && hostOf(u).replace(/^www\./, '') === ctx.host.replace(/^www\./, '');
        });
        if (internal.length) items.push({ url: p.finalUrl, detail: `${internal.length} lien(s), ex. ${internal[0]}` });
      }
      return hitItems(items);
    },
  },
  {
    id: 'seo.url.uppercase', section: sec, category: cat, severity: 'low', impact: 1, effort: 2, scope: 'page',
    label: 'Majuscules dans les URL',
    title: (n) => `${pl(n, 'adresse contient', 'adresses contiennent')} des majuscules`,
    why: 'Les adresses sont sensibles à la casse : risque de doublons et de liens cassés.',
    fix: 'Utilisez des adresses en minuscules et redirigez les anciennes.',
    source: SRC.urlStructure,
    run: (ctx) => hitPages(ctx.html.filter((p) => /[A-Z]/.test(new URL(p.finalUrl).pathname))),
  },
  {
    id: 'seo.url.underscore', section: sec, category: cat, severity: 'low', impact: 1, effort: 2, scope: 'page',
    label: 'Tirets bas dans les URL',
    title: (n) => `${pl(n, 'adresse utilise', 'adresses utilisent')} des tirets bas (_) au lieu de tirets (-)`,
    why: 'Google recommande les tirets pour séparer les mots d’une adresse.',
    fix: 'Pour les nouvelles pages, préférez des tirets ; ne changez les anciennes qu’avec une redirection 301.',
    source: SRC.urlStructure,
    run: (ctx) => hitPages(ctx.html.filter((p) => /_/.test(new URL(p.finalUrl).pathname))),
  },
  {
    id: 'seo.url.too_long', section: sec, category: cat, severity: 'low', impact: 1, effort: 2, scope: 'page',
    label: 'URL trop longues',
    title: (n) => `${pl(n, 'adresse dépasse', 'adresses dépassent')} 115 caractères`,
    why: 'Des adresses courtes et lisibles sont plus faciles à partager et à comprendre.',
    fix: 'Raccourcissez les adresses des nouvelles pages (mots-clés essentiels seulement).',
    source: SRC.urlStructure,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.finalUrl.length > 115), (p) => `${p.finalUrl.length} caractères`),
  },
  {
    id: 'seo.url.malformed', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'URL avec doubles barres, espaces ou caractères spéciaux',
    title: (n) => `${pl(n, 'adresse contient', 'adresses contiennent')} des doubles barres, espaces ou caractères non encodés`,
    why: 'Ces adresses créent des doublons et des liens fragiles.',
    fix: 'Corrigez les liens qui produisent ces adresses (souvent un « / » en trop ou un espace).',
    source: SRC.urlStructure,
    run: (ctx) => hitPages(ctx.html.filter((p) => {
      const path = new URL(p.finalUrl).pathname;
      return /\/\/|%20|\s/.test(path);
    })),
  },
  {
    id: 'seo.html.charset', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Encodage des caractères non déclaré',
    title: (n) => `${pl(n, 'page ne déclare', 'pages ne déclarent')} pas son encodage (UTF-8)`,
    why: 'Sans encodage déclaré, les accents peuvent s’afficher mal (« Ã© ») chez les visiteurs comme chez les moteurs.',
    fix: 'Ajoutez <meta charset="utf-8"> en tête de page (ou charset dans l’en-tête Content-Type).',
    source: SRC.seoStarter,
    run: (ctx) => hitPages(ctx.html.filter((p) => !!p.html && !/charset=/i.test(p.contentType ?? p.headers['content-type'] ?? '') && !/<meta[^>]+charset/i.test(headOf(p.html)))),
  },
  {
    id: 'seo.html.doctype', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Doctype absent',
    title: (n) => `${pl(n, 'page n’a', 'pages n’ont')} pas de déclaration <!DOCTYPE html>`,
    why: 'Sans doctype, les navigateurs passent en mode de compatibilité : affichage imprévisible, surtout sur mobile.',
    fix: 'Ajoutez <!DOCTYPE html> en toute première ligne du gabarit.',
    source: SRC.viewport,
    run: (ctx) => hitPages(ctx.html.filter((p) => !!p.html && !/^\s*(<!--[\s\S]*?-->\s*)*<!doctype\s+html/i.test(p.html))),
  },
  {
    id: 'seo.html.base_href', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Balise <base> vers un autre site',
    title: (n) => `${pl(n, 'page déclare', 'pages déclarent')} une balise <base> vers une autre adresse`,
    why: 'Tous les liens relatifs de la page pointent alors ailleurs : liens cassés en série.',
    fix: 'Retirez la balise <base> ou corrigez son adresse.',
    source: SRC.links,
    run: (ctx) => hitPages(ctx.html.filter((p) => {
      const b = tags(headOf(p.html ?? ''), 'base')[0];
      const href = b ? attr(b, 'href') : undefined;
      return !!href && /^https?:/i.test(href) && hostOf(href).replace(/^www\./, '') !== ctx.host.replace(/^www\./, '');
    })),
  },
];
