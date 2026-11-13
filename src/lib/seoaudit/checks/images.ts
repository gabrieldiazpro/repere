/** Section « Images » : textes alternatifs, poids, dimensions, chargement différé, formats. */
import { proposeAlt } from '../autofix';
import { SRC } from '../sources';
import type { AuditCtx, CheckDef, CrawledPage } from '../types';
import { norm, pl } from '../util';
import { hitItems } from './helpers';

const sec = 'images' as const;
const cat = 'images';

type Img = CrawledPage['images'][number];

function isPixel(i: Img): boolean {
  return (i.width !== undefined && i.width <= 2) || (i.height !== undefined && i.height <= 2) || /^data:/i.test(i.src) || /(pixel|spacer|blank)\.(gif|png)|facebook\.com\/tr|\/collect\?/i.test(i.src);
}

/** Images uniques du site (première page où elles apparaissent). */
function uniqueImages(ctx: AuditCtx, pred: (i: Img, p: CrawledPage, idx: number) => boolean): { p: CrawledPage; i: Img }[] {
  const seen = new Set<string>();
  const out: { p: CrawledPage; i: Img }[] = [];
  for (const p of ctx.html) {
    p.images.forEach((i, idx) => {
      if (isPixel(i) || seen.has(i.src)) return;
      if (pred(i, p, idx)) {
        seen.add(i.src);
        out.push({ p, i });
      }
    });
  }
  return out;
}

function ext(src: string): string {
  return (/\.([a-z0-9]{3,4})(?:$|[?#])/i.exec(src)?.[1] ?? '').toLowerCase();
}

export const IMAGES: CheckDef[] = [
  {
    id: 'seo.img.alt_missing', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site',
    label: 'Images sans texte alternatif',
    title: (n) => `${pl(n, 'image n’a', 'images n’ont')} pas de texte alternatif (alt)`,
    why: 'Le texte alternatif décrit l’image à Google Images, aux IA et aux personnes malvoyantes.',
    fix: 'Décrivez chaque image utile en quelques mots (alt="…") ; laissez alt="" pour les images décoratives.',
    source: SRC.images,
    run: (ctx) => {
      const all = uniqueImages(ctx, () => true).length;
      const bad = uniqueImages(ctx, (i) => i.alt === undefined);
      return hitItems(bad.map(({ p, i }) => ({ url: p.finalUrl, detail: i.src })), {
        base: Math.max(1, all),
        autoFix: { kind: 'img.alt', payload: { items: bad.map(({ p, i }) => ({ url: p.finalUrl, src: i.src, alt: proposeAlt(i.src, p), review: true })) } },
      });
    },
  },
  {
    id: 'seo.img.alt_too_long', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'site',
    label: 'Textes alternatifs trop longs',
    title: (n) => `${pl(n, 'image a', 'images ont')} un texte alternatif de plus de 125 caractères`,
    why: 'Un alt trop long ressemble à du bourrage de mots-clés et fatigue les lecteurs d’écran.',
    fix: 'Résumez l’image en une phrase courte.',
    source: SRC.images,
    run: (ctx) => {
      const bad = uniqueImages(ctx, (i) => (i.alt?.length ?? 0) > 125);
      return hitItems(bad.map(({ p, i }) => ({ url: p.finalUrl, detail: `${i.src} (${i.alt?.length} car.)` })), { base: Math.max(1, uniqueImages(ctx, () => true).length) });
    },
  },
  {
    id: 'seo.img.alt_filename', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'site',
    label: 'Textes alternatifs = nom de fichier',
    title: (n) => `${pl(n, 'image a', 'images ont')} un nom de fichier comme texte alternatif`,
    why: '« IMG_2034.jpg » ne décrit rien : c’est comme ne pas avoir de texte alternatif.',
    fix: 'Remplacez par une vraie description de l’image.',
    source: SRC.images,
    run: (ctx) => {
      const bad = uniqueImages(ctx, (i) => !!i.alt && (/\.(jpe?g|png|webp|gif|avif|svg)$/i.test(i.alt.trim()) || /^(img|dsc|pxl|image|photo|screenshot)[\s_-]?\d+$/i.test(i.alt.trim())));
      return hitItems(bad.map(({ p, i }) => ({ url: p.finalUrl, detail: `alt="${i.alt}"` })), {
        base: Math.max(1, uniqueImages(ctx, () => true).length),
        autoFix: { kind: 'img.alt', payload: { items: bad.map(({ p, i }) => ({ url: p.finalUrl, src: i.src, alt: proposeAlt(i.src, p), review: true })) } },
      });
    },
  },
  {
    id: 'seo.img.heavy', section: sec, category: 'performance', severity: 'medium', impact: 2, effort: 1, scope: 'site',
    label: 'Images lourdes (> 200 Ko)',
    title: (n) => `${pl(n, 'image pèse', 'images pèsent')} plus de 200 Ko`,
    why: 'Les images lourdes sont la première cause de lenteur sur mobile (affichage du contenu principal, LCP).',
    fix: 'Compressez et redimensionnez (largeur affichée × 2 maximum), en WebP ou AVIF.',
    source: SRC.lcp,
    run: (ctx) => {
      const known = uniqueImages(ctx, (i) => ctx.imageBytes(i.src, i.bytes) !== undefined).length;
      const bad = uniqueImages(ctx, (i) => (ctx.imageBytes(i.src, i.bytes) ?? 0) > 200_000);
      return hitItems(bad.map(({ p, i }) => ({ url: p.finalUrl, detail: `${i.src} (${Math.round((ctx.imageBytes(i.src, i.bytes) ?? 0) / 1024)} Ko)` })), { base: Math.max(1, known) });
    },
  },
  {
    id: 'seo.img.no_dimensions', section: sec, category: 'performance', severity: 'low', impact: 1, effort: 1, scope: 'site',
    label: 'Images sans dimensions',
    title: (n) => `${pl(n, 'image n’a', 'images n’ont')} pas de largeur/hauteur déclarées`,
    why: 'Sans dimensions, la page « saute » pendant le chargement (CLS), ce qui gêne la lecture et pèse sur les signaux d’expérience.',
    fix: 'Ajoutez width et height (ou un aspect-ratio en CSS) à chaque image.',
    source: SRC.cls,
    run: (ctx) => {
      const bad = uniqueImages(ctx, (i) => (i.width === undefined || i.height === undefined) && !/\.svg(\?|$)/i.test(i.src));
      return hitItems(bad.map(({ p, i }) => ({ url: p.finalUrl, detail: i.src })), { base: Math.max(1, uniqueImages(ctx, () => true).length) });
    },
  },
  {
    id: 'seo.img.lazy_lcp', section: sec, category: 'performance', severity: 'low', impact: 2, effort: 1, scope: 'page',
    label: 'Image principale en chargement différé',
    title: (n) => `${pl(n, 'page diffère', 'pages diffèrent')} le chargement de sa première grande image`,
    why: 'L’image en haut de page doit arriver vite ; loading="lazy" la retarde et dégrade le LCP.',
    fix: 'Retirez loading="lazy" de la première image visible (gardez-le pour les suivantes).',
    source: SRC.lazy,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => {
        const first = p.images.find((i) => !isPixel(i) && !/logo|icon|\.svg/i.test(i.src) && (i.width === undefined || i.width >= 300));
        return !!first && first.loading?.toLowerCase() === 'lazy' && p.images.indexOf(first) === 0;
      });
      return hitItems(ps.map((p) => ({ url: p.finalUrl, detail: p.images[0]?.src })));
    },
  },
  {
    id: 'seo.img.no_lazy', section: sec, category: 'performance', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Nombreuses images sans chargement différé',
    title: (n) => `${pl(n, 'page charge', 'pages chargent')} plus de 8 images d’un coup, sans chargement différé`,
    why: 'Toutes les images sont téléchargées même si le visiteur ne fait pas défiler la page.',
    fix: 'Ajoutez loading="lazy" aux images situées sous la ligne de flottaison.',
    source: SRC.lazy,
    run: (ctx) => hitItems(ctx.html.filter((p) => p.images.filter((i) => !isPixel(i)).length > 8 && !p.images.some((i) => i.loading?.toLowerCase() === 'lazy')).map((p) => ({ url: p.finalUrl, detail: `${p.images.length} images` }))),
  },
  {
    id: 'seo.img.legacy_format', section: sec, category: 'performance', severity: 'low', impact: 1, effort: 2, scope: 'site',
    label: 'Formats d’image anciens',
    title: (n) => `${pl(n, 'image lourde utilise', 'images lourdes utilisent')} un format ancien (JPEG/PNG/BMP) au lieu de WebP/AVIF`,
    why: 'WebP et AVIF pèsent 25 à 50 % de moins à qualité égale.',
    fix: 'Activez la conversion automatique en WebP/AVIF (extension, CDN ou CMS).',
    source: SRC.modernImages,
    run: (ctx) => {
      const bad = uniqueImages(ctx, (i) => ['bmp', 'tif', 'tiff'].includes(ext(i.src)) || (['jpg', 'jpeg', 'png'].includes(ext(i.src)) && (ctx.imageBytes(i.src, i.bytes) ?? 0) > 100_000));
      return hitItems(bad.map(({ p, i }) => ({ url: p.finalUrl, detail: `${i.src}${i.bytes ? ` (${Math.round(i.bytes / 1024)} Ko)` : ''}` })), { base: Math.max(1, uniqueImages(ctx, () => true).length) });
    },
  },
  {
    id: 'seo.img.generic_filename', section: sec, category: cat, severity: 'low', impact: 1, effort: 2, scope: 'site',
    label: 'Noms de fichiers d’image non descriptifs',
    title: (n) => `${pl(n, 'image porte', 'images portent')} un nom de fichier sans signification (IMG_1234…)`,
    why: 'Le nom du fichier est un indice de plus pour Google Images.',
    fix: 'Pour les nouvelles images, nommez le fichier d’après son contenu (ex. « tarte-citron-meringuee.webp »).',
    source: SRC.images,
    run: (ctx) => {
      const bad = uniqueImages(ctx, (i) => /\/(img|dsc|dscn|pxl|image|photo|screenshot|capture|whatsapp[ _-]image)[\s_-]?[\d_-]{3,}[^/]*\.(jpe?g|png|webp|heic|avif)/i.test(i.src));
      return hitItems(bad.map(({ p, i }) => ({ url: p.finalUrl, detail: i.src })), { base: Math.max(1, uniqueImages(ctx, () => true).length) });
    },
  },
  {
    id: 'seo.img.page_weight', section: sec, category: 'performance', severity: 'medium', impact: 2, effort: 2, scope: 'page',
    label: 'Poids total des images par page > 3 Mo',
    title: (n) => `${pl(n, 'page charge', 'pages chargent')} plus de 3 Mo d’images`,
    why: 'Sur un réseau mobile moyen, 3 Mo d’images, c’est plusieurs secondes d’attente.',
    fix: 'Compressez, redimensionnez et différez les images de ces pages.',
    source: SRC.lcp,
    run: (ctx) => hitItems(ctx.html.map((p) => ({ p, w: p.images.reduce((s, i) => s + (ctx.imageBytes(i.src, i.bytes) ?? 0), 0) })).filter((x) => x.w > 3_000_000).map((x) => ({ url: x.p.finalUrl, detail: `${(x.w / 1_000_000).toFixed(1)} Mo` }))),
  },
  {
    id: 'seo.img.broken', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site',
    label: 'Images cassées',
    title: (n) => `${pl(n, 'image ne s’affiche', 'images ne s’affichent')} pas (erreur ou introuvable)`,
    why: 'Une image cassée laisse un trou dans la page et fait négligé.',
    fix: 'Remettez le fichier en ligne ou corrigez son adresse ; retirez l’image si elle n’existe plus.',
    source: SRC.images,
    run: (ctx) => {
      const bad = uniqueImages(ctx, (i) => {
        const c = ctx.linkChecks.get(norm(i.src) ?? i.src);
        return !!c && c.kind === 'image' && !c.blockedByRobots && (c.status >= 400 || c.status === 0);
      });
      const checked = uniqueImages(ctx, (i) => ctx.linkChecks.get(norm(i.src) ?? i.src)?.kind === 'image').length;
      return hitItems(bad.map(({ p, i }) => ({ url: p.finalUrl, detail: `${i.src} (${ctx.linkChecks.get(norm(i.src) ?? i.src)?.status || ctx.linkChecks.get(norm(i.src) ?? i.src)?.error || 'injoignable'})` })), { base: Math.max(1, checked) });
    },
  },
];
