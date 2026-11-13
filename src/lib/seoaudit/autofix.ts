/**
 * Propositions de correctifs automatisables (appliquées par PUBLICATION après validation du client).
 * Tout est proposé, jamais publié ici ; les textes générés sont marqués `review: true` (à relire).
 *
 * Formes (`autoFix.kind` → `payload`) :
 *  - 'meta.title'        { items: { url, value, review }[] }
 *  - 'meta.description'  { items: { url, value, review }[] }
 *  - 'img.alt'           { items: { url, src, alt, review }[] }
 *  - 'jsonld'            { items: { url, type, jsonld }[] }
 *  - 'redirect'          { items: { from, to, status: 301 }[] }
 *  - 'canonical'         { items: { url, href }[] }
 *  - 'link.update'       { items: { page, from, to }[] }
 *  - 'sitemap'           { url, xml, count }
 *  - 'robots'            { text, changes: string[] }
 *  - 'meta.robots'       { items: { url, value }[] }
 */
import type { AuditCtx, CrawledPage } from './types';
import { addressesIn, clip, hostOf, paragraphs, phonesIn, textOf } from './util';

const SEP = /\s+[|\-–—·:•»]\s+/;

/** Nom du site : og:site_name, sinon le segment commun des titres, sinon l'hôte. */
export function guessSiteName(pages: CrawledPage[], home?: CrawledPage): string {
  const og = home?.openGraph['og:site_name'] ?? pages.find((p) => p.openGraph['og:site_name'])?.openGraph['og:site_name'];
  if (og?.trim()) return og.trim();
  const counts = new Map<string, number>();
  for (const p of pages) {
    const parts = (p.title ?? '').split(SEP).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      counts.set(last, (counts.get(last) ?? 0) + 1);
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) return best[0];
  const ht = home?.title?.split(SEP)[0]?.trim();
  if (ht && ht.length <= 40) return ht;
  const h = hostOf(home?.finalUrl ?? pages[0]?.finalUrl ?? '').replace(/^www\./, '');
  const base = h.split('.')[0] ?? h;
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Votre site';
}

function slugWords(url: string): string {
  try {
    const segs = new URL(url).pathname.split('/').filter(Boolean);
    const last = segs[segs.length - 1] ?? '';
    return decodeURIComponent(last).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_+]+/g, ' ').trim();
  } catch {
    return '';
  }
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Titre proposé (≤ 60 caractères) : H1 ou intitulé de l'URL + nom du site. */
export function proposeTitle(p: CrawledPage, siteName: string): string {
  const base = (p.h1.find((h) => h.trim()) ?? p.headings.find((h) => h.text.trim())?.text ?? cap(slugWords(p.finalUrl)) ?? '').trim();
  const core = base || siteName;
  if (!base || core.toLowerCase().includes(siteName.toLowerCase())) return clip(core, 60);
  const full = `${core} | ${siteName}`;
  return full.length <= 60 ? full : clip(core, 60);
}

/** Description proposée (≤ 155 caractères) : premier paragraphe substantiel de la page. */
export function proposeDescription(p: CrawledPage, siteName: string): string {
  const paras = p.html ? paragraphs(p.html) : [];
  const good = paras.find((t) => t.length >= 60 && !/cookie|javascript/i.test(t)) ?? paras.find((t) => t.length >= 25);
  if (good) return clip(good, 155);
  const h = p.h1[0] ?? p.title ?? siteName;
  return clip(`${h} — ${siteName}. Découvrez nos informations, nos services et comment nous contacter.`, 155);
}

/** Texte alternatif proposé à partir du nom du fichier et du titre de la page (à relire : nous ne « voyons » pas l'image). */
export function proposeAlt(src: string, p: CrawledPage): string {
  const words = slugWords(src)
    .replace(/\b(img|image|dsc|pxl|photo|screenshot|capture|copie|copy|scaled|\d+x\d+|\d{3,})\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const ctx = p.h1[0]?.trim() ?? '';
  if (words.length >= 4) return clip(cap(words), 120);
  return clip(ctx ? `Illustration : ${ctx}` : 'Illustration', 120);
}

/** Bloc JSON-LD Organization / LocalBusiness proposé à partir de ce qu'on lit sur le site. */
export function proposeEntityJsonLd(ctx: AuditCtx, kind: 'Organization' | 'LocalBusiness'): Record<string, unknown> {
  const home = ctx.home;
  const allText = ctx.html.slice(0, 30).map((p) => ctx.text(p)).join('\n');
  const phone = phonesIn(allText)[0];
  const addr = addressesIn(allText)[0];
  const logo = home?.images.find((i) => /logo/i.test(i.src) || /logo/i.test(i.alt ?? ''))?.src;
  const sameAs = [...new Set(ctx.crawl.links.filter((l) => !l.internal && /(facebook|instagram|linkedin|youtube|tiktok|x|twitter|pinterest)\.com\//i.test(l.to)).map((l) => l.to))].slice(0, 6);
  const out: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': kind,
    name: ctx.siteName,
    url: `${ctx.origin}/`,
  };
  if (logo) out.logo = abs(logo, ctx.origin);
  if (home?.openGraph['og:image']) out.image = abs(home.openGraph['og:image'], ctx.origin);
  if (phone) out.telephone = `+33${phone.slice(1)}`;
  if (addr) out.address = { '@type': 'PostalAddress', streetAddress: addr.street, postalCode: addr.postalCode, addressLocality: addr.city, addressCountry: 'FR' };
  if (sameAs.length) out.sameAs = sameAs;
  return out;
}

function abs(u: string, origin: string): string {
  try {
    return new URL(u, `${origin}/`).toString();
  } catch {
    return u;
  }
}

/** Fil d'Ariane à partir des segments d'URL et des titres des pages parentes crawlées. */
export function proposeBreadcrumb(ctx: AuditCtx, p: CrawledPage): Record<string, unknown> {
  const u = new URL(p.finalUrl);
  const segs = u.pathname.split('/').filter(Boolean);
  const items: Record<string, unknown>[] = [{ '@type': 'ListItem', position: 1, name: 'Accueil', item: `${ctx.origin}/` }];
  let path = '';
  segs.forEach((s, i) => {
    path += `/${s}`;
    const last = i === segs.length - 1;
    const parent = ctx.byUrl.get(`${ctx.origin}${path}`) ?? ctx.byUrl.get(`${ctx.origin}${path}/`);
    const name = last ? (p.h1[0] ?? p.title?.split(SEP)[0] ?? cap(slugWords(p.finalUrl))) : (parent?.h1[0] ?? parent?.title?.split(SEP)[0] ?? cap(decodeURIComponent(s).replace(/[-_]+/g, ' ')));
    const it: Record<string, unknown> = { '@type': 'ListItem', position: i + 2, name: name.trim() };
    if (!last) it.item = parent?.finalUrl ?? `${ctx.origin}${path}/`;
    items.push(it);
  });
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

/** Sitemap XML des pages indexables crawlées. */
export function proposeSitemap(ctx: AuditCtx): { url: string; xml: string; count: number } {
  const urls = [...new Set(ctx.indexable.map((p) => p.finalUrl))].sort();
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
  return { url: `${ctx.origin}/sitemap.xml`, xml, count: urls.length };
}

/** robots.txt corrigé : on retire le blocage total, on ajoute la ligne Sitemap et (option) les facettes. */
export function proposeRobots(ctx: AuditCtx, opts: { unblockAll?: boolean; addSitemap?: boolean; unblockAssets?: boolean; disallowFacets?: string[] }): { text: string; changes: string[] } {
  const src = ctx.crawl.robots?.status === 200 ? ctx.crawl.robots.text ?? '' : '';
  const changes: string[] = [];
  let lines = src ? src.split(/\r?\n/) : ['User-agent: *', 'Allow: /'];
  if (opts.unblockAll) {
    lines = lines.map((l) => (/^\s*disallow\s*:\s*\/\s*$/i.test(l) ? (changes.push('Suppression de « Disallow: / »'), '# Disallow: / (retiré : bloquait tout le site)') : l));
  }
  if (opts.unblockAssets) {
    lines = lines.map((l) => (/^\s*disallow\s*:.*(\.css|\.js|wp-includes|\/assets|\/static|\/_next)/i.test(l) ? (changes.push(`Suppression de « ${l.trim()} »`), `# ${l.trim()} (retiré : bloque des ressources nécessaires au rendu)`) : l));
  }
  if (opts.disallowFacets?.length) {
    const idx = lines.findIndex((l) => /^\s*user-agent\s*:\s*\*\s*$/i.test(l));
    const add = opts.disallowFacets.map((p) => `Disallow: /*?*${p}=`);
    if (idx >= 0) lines.splice(idx + 1, 0, ...add);
    else lines.unshift('User-agent: *', ...add);
    changes.push(`Blocage de l'exploration des filtres : ${opts.disallowFacets.join(', ')}`);
  }
  if (opts.addSitemap && !lines.some((l) => /^\s*sitemap\s*:/i.test(l))) {
    lines.push('', `Sitemap: ${ctx.origin}/sitemap.xml`);
    changes.push('Ajout de la ligne Sitemap');
  }
  return { text: `${lines.join('\n').trim()}\n`, changes };
}

/** Texte visible complet (exporté pour les contrôles). */
export function visibleText(p: CrawledPage): string {
  return p.html ? textOf(p.html) : '';
}
