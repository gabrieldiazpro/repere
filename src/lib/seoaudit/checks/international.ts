/** Section « International » : hreflang (codes, réciprocité, auto-référence, x-default) et langues. */
import { SRC } from '../sources';
import type { AuditCtx, CheckDef, CrawledPage } from '../types';
import { headOf, norm, pl, tags, attr } from '../util';
import { hitItems, hitPages, pageAt } from './helpers';

const sec = 'international' as const;
const cat = 'international';

const ISO639 = new Set('aa ab af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'.split(' '));
const REGIONS_BAD = new Set(['uk', 'eu', 'la']); // codes fréquents mais invalides comme région (en-UK → en-GB)

export function validHreflang(code: string): boolean {
  const c = code.trim().toLowerCase();
  if (c === 'x-default') return true;
  const m = /^([a-z]{2,3})(?:-([a-z]{4}))?(?:-([a-z]{2}|\d{3}))?$/.exec(c);
  if (!m) return false;
  if (m[1].length === 2 && !ISO639.has(m[1])) return false;
  if (m[3] && REGIONS_BAD.has(m[3])) return false;
  return true;
}

function withHreflang(ctx: AuditCtx): CrawledPage[] {
  return ctx.html.filter((p) => p.hreflang.length > 0);
}

function primary(l?: string): string {
  return (l ?? '').trim().toLowerCase().split(/[-_]/)[0];
}

export function intlApplicable(ctx: AuditCtx): boolean {
  if (ctx.html.some((p) => p.hreflang.length > 0)) return true;
  return new Set(ctx.html.map((p) => primary(p.lang)).filter(Boolean)).size > 1;
}

export const INTERNATIONAL: CheckDef[] = [
  {
    id: 'seo.hreflang.invalid_code', section: sec, category: cat, severity: 'high', impact: 2, effort: 1, scope: 'page',
    label: 'Codes hreflang invalides',
    title: (n) => `${pl(n, 'page utilise', 'pages utilisent')} des codes de langue hreflang invalides`,
    why: 'Un code invalide (ex. « en-UK » au lieu de « en-GB ») fait ignorer l’annotation par Google.',
    fix: 'Utilisez langue ISO 639-1, puis région ISO 3166-1 (fr, fr-BE, en-GB) ou « x-default ».',
    source: SRC.hreflang,
    run: (ctx) => hitPages(withHreflang(ctx).filter((p) => p.hreflang.some((h) => !validHreflang(h.lang))), (p) => p.hreflang.filter((h) => !validHreflang(h.lang)).map((h) => h.lang).join(', ')),
  },
  {
    id: 'seo.hreflang.no_return', section: sec, category: cat, severity: 'high', impact: 2, effort: 2, scope: 'page',
    label: 'hreflang sans lien de retour',
    title: (n) => `${pl(n, 'annotation hreflang n’a', 'annotations hreflang n’ont')} pas de lien de retour`,
    why: 'Les versions linguistiques doivent se citer mutuellement ; sinon Google ignore la paire.',
    fix: 'Sur chaque version, listez toutes les autres versions (et elle-même).',
    source: SRC.hreflang,
    run: (ctx) => {
      const items: { url: string; detail?: string }[] = [];
      for (const p of withHreflang(ctx)) {
        const self = norm(p.finalUrl);
        for (const h of p.hreflang) {
          const target = norm(h.href, p.finalUrl);
          if (!target || target === self) continue;
          const t = pageAt(ctx, target);
          if (!t || t.status !== 200) continue;
          const back = t.hreflang.some((x) => norm(x.href, t.finalUrl) === self);
          if (!back) items.push({ url: p.finalUrl, detail: `${h.lang} → ${h.href} ne renvoie pas vers cette page` });
        }
      }
      return hitItems(items);
    },
  },
  {
    id: 'seo.hreflang.no_self', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'hreflang sans auto-référence',
    title: (n) => `${pl(n, 'page ne se cite', 'pages ne se citent')} pas elle-même dans ses hreflang`,
    why: 'Google recommande que chaque version se liste aussi elle-même.',
    fix: 'Ajoutez une ligne hreflang pointant vers la page elle-même.',
    source: SRC.hreflang,
    run: (ctx) => hitPages(withHreflang(ctx).filter((p) => !p.hreflang.some((h) => h.lang.toLowerCase() !== 'x-default' && norm(h.href, p.finalUrl) === norm(p.finalUrl)))),
  },
  {
    id: 'seo.hreflang.no_xdefault', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'x-default absent',
    title: (n) => `${pl(n, 'page n’a', 'pages n’ont')} pas de version par défaut (x-default)`,
    why: 'x-default indique la page à montrer aux visiteurs dont la langue n’est pas couverte.',
    fix: 'Ajoutez hreflang="x-default" vers votre version principale (ou un sélecteur de langue).',
    source: SRC.hreflang,
    run: (ctx) => hitPages(withHreflang(ctx).filter((p) => !p.hreflang.some((h) => h.lang.toLowerCase() === 'x-default'))),
  },
  {
    id: 'seo.hreflang.to_error', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'hreflang vers des pages en erreur ou non indexables',
    title: (n) => `${pl(n, 'page annonce', 'pages annoncent')} des versions linguistiques en erreur, redirigées ou non indexables`,
    why: 'Google ignore les annotations qui pointent vers des pages non valides.',
    fix: 'Pointez vers l’adresse finale, indexable, de chaque version.',
    source: SRC.hreflang,
    run: (ctx) => {
      const items: { url: string; detail?: string }[] = [];
      for (const p of withHreflang(ctx)) {
        for (const h of p.hreflang) {
          const t = pageAt(ctx, norm(h.href, p.finalUrl) ?? '');
          if (t && (t.status !== 200 || t.redirectChain.length > 0 || !t.isIndexable)) items.push({ url: p.finalUrl, detail: `${h.lang} → ${h.href} (${t.status !== 200 ? `HTTP ${t.status}` : t.redirectChain.length ? 'redirigée' : 'non indexable'})` });
        }
      }
      return hitItems(items);
    },
  },
  {
    id: 'seo.hreflang.relative', section: sec, category: cat, severity: 'medium', impact: 1, effort: 1, scope: 'page',
    label: 'hreflang en adresses relatives',
    title: (n) => `${pl(n, 'page utilise', 'pages utilisent')} des adresses relatives dans hreflang`,
    why: 'Google exige des adresses complètes (https://…) dans les annotations hreflang.',
    fix: 'Écrivez les href des hreflang en adresses absolues.',
    source: SRC.hreflang,
    run: (ctx) => hitPages(withHreflang(ctx).filter((p) => tags(headOf(p.html ?? ''), 'link').some((t) => /hreflang\s*=/i.test(t) && !/^https?:\/\//i.test(attr(t, 'href') ?? 'https://')))),
  },
  {
    id: 'seo.hreflang.lang_mismatch', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'hreflang et langue de la page incohérents',
    title: (n) => `${pl(n, 'page déclare', 'pages déclarent')} une langue différente dans hreflang et dans la page`,
    why: 'Des signaux de langue contradictoires brouillent le ciblage.',
    fix: 'Alignez l’attribut lang de la page et son hreflang auto-référent.',
    source: SRC.hreflang,
    run: (ctx) => hitPages(withHreflang(ctx).filter((p) => {
      const self = p.hreflang.find((h) => norm(h.href, p.finalUrl) === norm(p.finalUrl) && h.lang.toLowerCase() !== 'x-default');
      return !!self && !!p.lang && primary(self.lang) !== primary(p.lang);
    }), (p) => `lang=${p.lang}`),
  },
  {
    id: 'seo.intl.no_hreflang', section: sec, category: cat, severity: 'medium', impact: 2, effort: 2, scope: 'site',
    label: 'Plusieurs langues sans hreflang',
    title: () => 'Votre site existe en plusieurs langues mais sans annotations hreflang',
    why: 'Sans hreflang, Google peut montrer la mauvaise langue aux visiteurs.',
    fix: 'Reliez chaque page à ses traductions avec des balises hreflang (ou dans le sitemap).',
    source: SRC.hreflang,
    run: (ctx) => {
      if (ctx.html.some((p) => p.hreflang.length)) return null;
      const langs = new Set(ctx.html.map((p) => primary(p.lang)).filter(Boolean));
      return langs.size > 1 ? { items: [{ url: `${ctx.origin}/`, detail: [...langs].join(', ') }], evidence: `langues : ${[...langs].join(', ')}` } : null;
    },
  },
];
