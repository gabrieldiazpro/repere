/**
 * Relecture réelle de la page publique après application (robot RepereBot, fetch sûr de src/lib/siteaudit/fetch.ts,
 * sans cache). Renvoie null quand la vérification publique n'a pas de sens (fiche Google).
 * Un cache de page (CDN, extension de cache) peut retarder la mise en ligne : l'échec est alors « en attente » et
 * l'action « Vérifier » peut être relancée.
 */
import { parseHtml } from '@/lib/siteaudit/html';
import { safeFetch, SafeFetchError } from '@/lib/siteaudit/fetch';
import { sameValue } from './model';
import type { Change } from './types';

export interface PublicCheck {
  ok: boolean;
  detail: string;
}

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function sameSrc(a: string, b: string, base: string): boolean {
  try {
    const x = new URL(a, base);
    const y = new URL(b, base);
    return x.pathname === y.pathname;
  } catch {
    return a === b;
  }
}

export async function checkPublic(change: Change): Promise<PublicCheck | null> {
  if (change.kind.startsWith('gbp.') || !change.target.url && change.kind !== 'redirect') return null;
  const expected = change.after;
  try {
    if (change.kind === 'redirect') {
      const site = change.target.url ? new URL(change.target.url).origin : '';
      const src = new URL(change.target.path ?? '/', site);
      const r = await safeFetch(src, { cache: false, maxRedirects: 0, respectRobots: false }).catch((e) => {
        if (e instanceof SafeFetchError && e.code === 'too_many_redirects') return null;
        throw e;
      });
      // maxRedirects 0 : une redirection lève « too_many_redirects » → la source redirige bien.
      if (r === null) return { ok: true, detail: `${src.pathname} redirige bien.` };
      return { ok: false, detail: `${src.pathname} ne redirige pas encore (statut ${r.status}).` };
    }
    if (change.kind === 'robots.txt' || change.kind === 'llms.txt' || change.kind === 'sitemap.xml') {
      const r = await safeFetch(change.target.url as string, { cache: false, respectRobots: false, accept: 'text/plain' });
      if (r.status !== 200) return { ok: false, detail: `${change.kind} répond ${r.status}.` };
      return sameValue(r.body, expected) ? { ok: true, detail: `${change.kind} en ligne et conforme.` } : { ok: false, detail: `${change.kind} en ligne mais différent de la version validée.` };
    }
    const r = await safeFetch(change.target.url as string, { cache: false });
    if (r.status !== 200) return { ok: false, detail: `La page répond ${r.status}.` };
    const page = parseHtml(r.body);
    switch (change.kind) {
      case 'meta.title':
        return norm(decode(page.title)) === norm(expected) ? { ok: true, detail: 'Titre visible sur la page.' } : { ok: false, detail: `La page affiche encore « ${page.title.slice(0, 80)} ».` };
      case 'meta.description':
        return norm(decode(page.metaDescription ?? '')) === norm(expected) ? { ok: true, detail: 'Méta-description visible sur la page.' } : { ok: false, detail: 'La méta-description de la page n’a pas encore changé.' };
      case 'meta.robots':
        return norm(page.metaRobots).toLowerCase().replace(/\s/g, '') === norm(expected).toLowerCase().replace(/\s/g, '') ? { ok: true, detail: 'Consigne d’indexation en place.' } : { ok: false, detail: 'La consigne d’indexation de la page n’a pas encore changé.' };
      case 'canonical':
        return norm(page.canonical) === norm(expected) ? { ok: true, detail: 'URL canonique en place.' } : { ok: false, detail: 'L’URL canonique de la page n’a pas encore changé.' };
      case 'image.alt': {
        const img = page.images.find((i) => sameSrc(i.src, change.target.imageSrc ?? '', r.finalUrl) || i.src.includes((change.target.imageSrc ?? '').split('/').pop()?.replace(/\.[a-z0-9]+$/i, '') ?? '\u0000'));
        if (!img) return { ok: false, detail: 'Image non retrouvée sur la page.' };
        return norm(decode(img.alt)) === norm(expected) ? { ok: true, detail: 'Texte alternatif en place.' } : { ok: false, detail: 'Le texte alternatif n’a pas encore changé.' };
      }
      case 'jsonld':
      case 'faq': {
        const want = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i.exec(change.patch.value)?.[1];
        let wantType = '';
        try {
          wantType = String((JSON.parse(want ?? '{}') as { '@type'?: unknown })['@type'] ?? '');
        } catch {
          /* ignoré */
        }
        const found = page.jsonLdRaw.some((raw) => {
          try {
            const j = JSON.parse(raw) as Record<string, unknown> | Record<string, unknown>[];
            const items = Array.isArray(j) ? j : Array.isArray((j as { '@graph'?: unknown })['@graph']) ? ((j as { '@graph': Record<string, unknown>[] })['@graph']) : [j];
            return items.some((it) => String(it['@type'] ?? '') === wantType);
          } catch {
            return false;
          }
        });
        return found ? { ok: true, detail: `Balisage ${wantType} présent sur la page.` } : { ok: false, detail: `Balisage ${wantType || 'JSON-LD'} absent de la page publique.` };
      }
      case 'rewrite': {
        if (change.patch.all) return r.body.includes(change.patch.value) && !r.body.includes(`"${change.patch.find}"`) ? { ok: true, detail: 'Liens mis à jour sur la page.' } : { ok: false, detail: 'Les liens de la page n’ont pas encore changé.' };
        const text = norm(page.bodyText);
        const target = norm(change.patch.op === 'replace' ? change.patch.value.replace(/<[^>]+>/g, ' ') : '');
        return target && text.includes(target.slice(0, 120)) ? { ok: true, detail: 'Nouveau passage visible sur la page.' } : { ok: false, detail: 'Le nouveau passage n’apparaît pas encore sur la page.' };
      }
      default:
        return null;
    }
  } catch (e) {
    return { ok: false, detail: e instanceof SafeFetchError ? 'Page injoignable pour la relecture.' : 'Relecture impossible.' };
  }
}
