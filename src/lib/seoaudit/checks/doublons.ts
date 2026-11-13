/** Section « Doublons et cannibalisation » : contenus, titres, descriptions, H1 identiques ; balises canonical. */
import { proposeTitle } from '../autofix';
import { SRC } from '../sources';
import type { AuditCtx, CheckDef, CrawledPage, Hit } from '../types';
import { headOf, hostOf, isNoindex, norm, pl, sameSite, tags, attr } from '../util';
import { hitItems, hitPages, pageAt } from './helpers';

const sec = 'doublons' as const;

function groups(ps: CrawledPage[], key: (p: CrawledPage) => string | undefined): CrawledPage[][] {
  const m = new Map<string, CrawledPage[]>();
  for (const p of ps) {
    const k = key(p)?.trim().toLowerCase();
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  return [...m.values()].filter((g) => g.length > 1);
}

function groupHit(gs: CrawledPage[][], label: (p: CrawledPage) => string | undefined, extra: Partial<Hit> = {}): Hit | null {
  if (!gs.length) return null;
  const items = gs.flatMap((g, i) => g.map((p) => ({ url: p.finalUrl, detail: `groupe ${i + 1} (${g.length} pages) : ${label(p) ?? ''}`.slice(0, 160) })));
  return { items, evidence: `${gs.length} groupe(s) de doublons`, ...extra };
}

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'à', 'a', 'au', 'aux', 'en', 'pour', 'un', 'une', 'sur', 'par', 'avec', 'votre', 'vos', 'nos', 'notre', 'the', 'and', 'of', 'd', 'l']);
function tokens(t: string, brand: string): Set<string> {
  const b = brand.toLowerCase();
  const core = t.toLowerCase().split(/\s+[|\-–—·:•»]\s+/).filter((s) => s.trim() !== b)[0] ?? '';
  return new Set(core.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)));
}

function canonicalAbs(p: CrawledPage): string | undefined {
  if (!p.canonical) return undefined;
  return norm(p.canonical, p.finalUrl) ?? undefined;
}

function canonicalTags(p: CrawledPage): string[] {
  return tags(headOf(p.html ?? ''), 'link').filter((t) => /rel\s*=\s*["']?canonical/i.test(t));
}

/** Pages dont la canonique pointe ailleurs. */
function canonicalised(ctx: AuditCtx): CrawledPage[] {
  return ctx.html.filter((p) => {
    const c = canonicalAbs(p);
    return !!c && c !== norm(p.finalUrl);
  });
}

export const DOUBLONS: CheckDef[] = [
  {
    id: 'seo.dup.content', section: sec, category: 'contenu', severity: 'high', impact: 3, effort: 2, scope: 'page',
    label: 'Contenus identiques',
    title: (n) => `${pl(n, 'page indexable a', 'pages indexables ont')} un contenu strictement identique à une autre`,
    why: 'Google ne garde qu’une version et choisit lui-même laquelle : vos autres pages n’apparaissent pas.',
    fix: 'Fusionnez les doublons (redirection 301) ou indiquez la page de référence avec une balise canonical.',
    source: SRC.canonical,
    run: (ctx) => groupHit(groups(ctx.indexable.filter((p) => p.wordCount >= 30), (p) => p.textHash), (p) => p.title),
  },
  {
    id: 'seo.dup.title', section: sec, category: 'balisage', severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Titres en double',
    title: (n) => `${pl(n, 'page partage', 'pages partagent')} le même titre qu’une autre`,
    why: 'Des titres identiques empêchent Google de savoir quelle page montrer : elles se concurrencent.',
    fix: 'Rendez chaque titre unique en précisant le sujet propre de la page.',
    source: SRC.titleLink,
    run: (ctx) => {
      const gs = groups(ctx.indexable, (p) => p.title);
      return groupHit(gs, (p) => p.title, { autoFix: { kind: 'meta.title', payload: { items: gs.flatMap((g) => g.slice(1)).map((p) => ({ url: p.finalUrl, value: proposeTitle(p, ctx.siteName), review: true })) } } });
    },
  },
  {
    id: 'seo.dup.meta', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Descriptions en double',
    title: (n) => `${pl(n, 'page partage', 'pages partagent')} la même description qu’une autre`,
    why: 'Une description recopiée sur plusieurs pages ne décrit vraiment aucune d’elles.',
    fix: 'Écrivez une description propre à chaque page importante.',
    source: SRC.snippet,
    run: (ctx) => groupHit(groups(ctx.indexable, (p) => p.metaDescription), (p) => p.metaDescription),
  },
  {
    id: 'seo.dup.h1', section: sec, category: 'contenu', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'H1 en double',
    title: (n) => `${pl(n, 'page partage', 'pages partagent')} le même H1 qu’une autre`,
    why: 'Deux pages au même titre principal semblent traiter du même sujet.',
    fix: 'Différenciez les H1 selon le sujet réel de chaque page.',
    source: SRC.seoStarter,
    run: (ctx) => groupHit(groups(ctx.indexable, (p) => p.h1[0]), (p) => p.h1[0]),
  },
  {
    id: 'seo.dup.cannibal', section: sec, category: 'contenu', severity: 'medium', impact: 2, effort: 2, scope: 'page',
    label: 'Cannibalisation probable',
    title: (n) => `${pl(n, 'page vise', 'pages visent')} visiblement la même recherche qu’une autre (cannibalisation)`,
    why: 'Deux pages presque identiques sur le même sujet se partagent les clics et se classent moins bien qu’une seule page forte.',
    fix: 'Fusionnez-les ou différenciez nettement leurs sujets (titre, H1, contenu).',
    source: SRC.helpful,
    run: (ctx) => {
      const ps = ctx.indexable.filter((p) => p.title && !ctx.isProduct(p)).slice(0, 400);
      const toks = ps.map((p) => tokens(p.title ?? '', ctx.siteName));
      const items: { url: string; detail?: string }[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = toks[i];
          const b = toks[j];
          if (a.size < 2 || b.size < 2) continue;
          if ((ps[i].title ?? '').trim().toLowerCase() === (ps[j].title ?? '').trim().toLowerCase()) continue; // déjà « titres en double »
          let inter = 0;
          for (const w of a) if (b.has(w)) inter++;
          const jac = inter / (a.size + b.size - inter);
          if (jac >= 0.75) {
            for (const [x, y] of [[ps[i], ps[j]], [ps[j], ps[i]]]) {
              if (!seen.has(x.finalUrl)) {
                seen.add(x.finalUrl);
                items.push({ url: x.finalUrl, detail: `proche de ${y.finalUrl} (« ${x.title} »)` });
              }
            }
          }
        }
      }
      return hitItems(items);
    },
  },
  {
    id: 'seo.dup.trailing_slash', section: sec, category: 'technique', severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Pages avec et sans slash final',
    title: (n) => `${pl(n, 'page répond', 'pages répondent')} à la fois avec et sans « / » final`,
    why: 'Deux adresses pour une même page : la popularité se partage et Google peut choisir la mauvaise.',
    fix: 'Choisissez une forme et redirigez l’autre en 301 (ou ajoutez une canonical vers la bonne).',
    source: SRC.canonical,
    run: (ctx) => {
      const set = new Map(ctx.indexable.map((p) => [norm(p.finalUrl) ?? p.finalUrl, p]));
      const items: { from: string; to: string }[] = [];
      for (const [u] of set) {
        const x = new URL(u);
        if (x.pathname === '/' || !x.pathname.endsWith('/')) continue;
        const alt = `${x.origin}${x.pathname.slice(0, -1)}${x.search}`;
        if (set.has(alt)) items.push({ from: alt, to: u });
      }
      return hitItems(items.map((i) => ({ url: i.from, detail: `doublon de ${i.to}` })), { autoFix: { kind: 'redirect', payload: { items: items.map((i) => ({ ...i, status: 301 })) } } });
    },
  },
  {
    id: 'seo.canonical.missing', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Balise canonical absente',
    title: (n) => `${pl(n, 'page indexable n’a', 'pages indexables n’ont')} pas de balise canonical`,
    why: 'La canonical protège contre les doublons créés par les paramètres d’URL (publicités, tri, partage).',
    fix: 'Ajoutez sur chaque page une canonical vers sa propre adresse (réglage standard des extensions SEO).',
    source: SRC.canonical,
    run: (ctx) => {
      const ps = ctx.indexable.filter((p) => !p.canonical);
      return hitPages(ps, undefined, { autoFix: { kind: 'canonical', payload: { items: ps.map((p) => ({ url: p.finalUrl, href: p.finalUrl })) } } });
    },
  },
  {
    id: 'seo.canonical.to_error', section: sec, category: 'balisage', severity: 'high', impact: 3, effort: 1, scope: 'page',
    label: 'Canonical vers une page en erreur, redirigée ou noindex',
    title: (n) => `${pl(n, 'page désigne', 'pages désignent')} comme référence une page en erreur, redirigée ou exclue`,
    why: 'Google ignore une canonical incohérente et peut n’indexer aucune des deux pages.',
    fix: 'Faites pointer la canonical vers une page en ligne (200), indexable et non redirigée.',
    source: SRC.canonical,
    run: (ctx) => hitPages(ctx.html.filter((p) => {
      const c = canonicalAbs(p);
      if (!c || c === norm(p.finalUrl)) return false;
      const t = pageAt(ctx, c);
      return !!t && (t.status !== 200 || t.redirectChain.length > 0 || isNoindex(t));
    }), (p) => {
      const t = pageAt(ctx, canonicalAbs(p) ?? '');
      return `${p.canonical} → ${t ? (t.status !== 200 ? `HTTP ${t.status}` : t.redirectChain.length ? 'redirigée' : 'noindex') : ''}`;
    }),
  },
  {
    id: 'seo.canonical.multiple', section: sec, category: 'balisage', severity: 'high', impact: 2, effort: 1, scope: 'page',
    label: 'Plusieurs canonical contradictoires',
    title: (n) => `${pl(n, 'page déclare', 'pages déclarent')} plusieurs balises canonical différentes`,
    why: 'Face à des canonical contradictoires, Google les ignore toutes.',
    fix: 'N’en gardez qu’une (souvent un conflit thème / extension SEO).',
    source: SRC.canonical,
    run: (ctx) => hitPages(ctx.html.filter((p) => new Set(canonicalTags(p).map((t) => attr(t, 'href') ?? '')).size > 1)),
  },
  {
    id: 'seo.canonical.relative', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Canonical en adresse relative',
    title: (n) => `${pl(n, 'page utilise', 'pages utilisent')} une canonical relative (« /page » au lieu de l’adresse complète)`,
    why: 'Google la comprend en général, mais une adresse complète évite toute ambiguïté (http/https, www).',
    fix: 'Écrivez la canonical en adresse absolue (https://…).',
    source: SRC.canonical,
    run: (ctx) => hitPages(ctx.html.filter((p) => canonicalTags(p).some((t) => {
      const h = attr(t, 'href') ?? '';
      return !!h && !/^https?:\/\//i.test(h);
    }))),
  },
  {
    id: 'seo.canonical.other_domain', section: sec, category: 'balisage', severity: 'medium', impact: 3, effort: 1, scope: 'page',
    label: 'Canonical vers un autre domaine',
    title: (n) => `${pl(n, 'page désigne', 'pages désignent')} une page d’un autre site comme référence`,
    why: 'Vous demandez à Google d’indexer l’autre site à votre place (fréquent après une copie de site ou un changement de domaine).',
    fix: 'Corrigez la canonical vers votre propre domaine, sauf contenu volontairement repris d’un autre site.',
    source: SRC.canonical,
    run: (ctx) => hitPages(ctx.html.filter((p) => {
      const c = canonicalAbs(p);
      return !!c && !sameSite(c, ctx.origin);
    }), (p) => p.canonical),
  },
  {
    id: 'seo.canonical.http', section: sec, category: 'balisage', severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Canonical en http sur un site https',
    title: (n) => `${pl(n, 'page désigne', 'pages désignent')} une version http comme référence`,
    why: 'Vous dites à Google de préférer la version non sécurisée.',
    fix: 'Passez les canonical en https.',
    source: SRC.canonical,
    run: (ctx) => {
      if (!ctx.https) return null;
      const ps = ctx.html.filter((p) => (canonicalAbs(p) ?? '').startsWith('http://') && sameSite(canonicalAbs(p) ?? '', ctx.origin));
      return hitPages(ps, (p) => p.canonical, { autoFix: { kind: 'canonical', payload: { items: ps.map((p) => ({ url: p.finalUrl, href: (canonicalAbs(p) ?? '').replace(/^http:/, 'https:') })) } } });
    },
  },
  {
    id: 'seo.canonical.chain', section: sec, category: 'balisage', severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Canonical en chaîne',
    title: (n) => `${pl(n, 'page désigne', 'pages désignent')} une référence qui elle-même renvoie ailleurs`,
    why: 'Google ne suit pas toujours les canonical en cascade : le signal se perd.',
    fix: 'Faites pointer directement la canonical vers la page de référence finale.',
    source: SRC.canonical,
    run: (ctx) => {
      const ps: { p: CrawledPage; final: string }[] = [];
      for (const p of ctx.html) {
        const c = canonicalAbs(p);
        if (!c || c === norm(p.finalUrl)) continue;
        const t = pageAt(ctx, c);
        const c2 = t ? canonicalAbs(t) : undefined;
        if (t && t.status === 200 && c2 && c2 !== norm(t.finalUrl) && c2 !== norm(p.finalUrl)) ps.push({ p, final: c2 });
      }
      return hitItems(ps.map(({ p, final }) => ({ url: p.finalUrl, detail: `${p.canonical} → ${final}` })), { autoFix: { kind: 'canonical', payload: { items: ps.map(({ p, final }) => ({ url: p.finalUrl, href: final })) } } });
    },
  },
  {
    id: 'seo.canonical.fragment', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Canonical avec ancre (#)',
    title: (n) => `${pl(n, 'canonical contient', 'canonical contiennent')} une ancre « # »`,
    why: 'Google ignore la partie après « # » : la canonical ne veut pas dire ce que vous pensez.',
    fix: 'Retirez le fragment « #… » de la canonical.',
    source: SRC.canonical,
    run: (ctx) => hitPages(ctx.html.filter((p) => (p.canonical ?? '').includes('#'))),
  },
  {
    id: 'seo.canonical.canonicalised', section: sec, category: 'balisage', severity: 'info', impact: 1, effort: 1, scope: 'page',
    label: 'Pages canonicalisées vers une autre (information)',
    title: (n) => `${pl(n, 'page renvoie', 'pages renvoient')} vers une autre page de référence (canonical)`,
    why: 'C’est normal pour des variantes ou des filtres ; vérifiez seulement que ce sont bien des doublons.',
    fix: 'Rien à faire si c’est voulu.',
    source: SRC.canonical,
    run: (ctx) => hitPages(canonicalised(ctx).filter((p) => sameSite(p.canonical ?? ctx.origin, ctx.origin) || !hostOf(p.canonical ?? '')), (p) => `→ ${p.canonical}`),
  },
];
