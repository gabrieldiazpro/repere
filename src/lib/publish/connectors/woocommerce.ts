/**
 * Produits WooCommerce pour le connecteur WordPress (V8, agent ECOM) — même connexion (mot de passe d'application),
 * API REST WooCommerce v3 (https://developer.woocommerce.com/docs/apis/rest-api/v3/products/, lue le 22 nov. 2026) :
 * - `GET /wp-json/wc/v3/products?slug=<slug>` (« Limit result set to products with a specific slug ») → id ;
 * - `GET|PUT /wp-json/wc/v3/products/<id>` : `meta_data` (`key`, `value` ; `id` en lecture seule) pour les champs de
 *   l'extension SEO (Yoast `_yoast_wpseo_*`, Rank Math `rank_math_*`, mêmes clés que pour les pages), `description`
 *   (réécriture, données structurées et FAQ ajoutées au texte du produit). Les textes alternatifs des images produit
 *   passent déjà par la médiathèque WordPress (`wp/v2/media`).
 * Contrairement aux pages, WooCommerce renvoie les métas des extensions dans `meta_data` sans extension d'aide : un
 * champ jamais rempli est simplement absent (valeur avant = vide, l'extension SEO reprend alors son modèle par défaut).
 * L'acceptation du mot de passe d'application par l'API WooCommerce est vérifiée au test de connexion (lecture d'un
 * produit) : si elle échoue, les produits partent à l'export.
 */
import { basicAuth, requestJson } from '../http';
import { PublishError, type ChangeKind, type ConnectorContext, type ResourceRef } from '../types';

interface WcProduct {
  id: number;
  permalink?: string;
  description?: string;
  meta_data?: { id?: number; key: string; value: unknown }[];
}

const wc = (ctx: ConnectorContext, path: string) => `${ctx.config.siteUrl}/wp-json/wc/v3${path}`;
const auth = (ctx: ConnectorContext) => ({ authorization: basicAuth(ctx.credentials.username ?? '', ctx.credentials.password ?? '') });

export const wooEnabled = (ctx: ConnectorContext) => ctx.config.woocommerce === '1';

/** Test de connexion : l'API produits répond-elle avec ces identifiants ? (aucune écriture) */
export async function wooProbe(ctx: ConnectorContext, namespaces: string[]): Promise<boolean> {
  if (!namespaces.includes('wc/v3')) return false;
  const res = await ctx.http({ method: 'GET', url: wc(ctx, '/products?per_page=1&_fields=id'), headers: auth(ctx) });
  return res.status === 200;
}

/** Adresse d'un produit (« /produit/<slug>/ », « /product/<slug>/ » ou base personnalisée) → id, sinon null. */
export async function wooLocate(ctx: ConnectorContext, url: string, normPath: (u: string) => string): Promise<ResourceRef | null> {
  let slug = '';
  try {
    slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
  } catch {
    return null;
  }
  if (!slug) return null;
  const list = await requestJson<WcProduct[]>(ctx.http, { method: 'GET', url: wc(ctx, `/products?slug=${encodeURIComponent(slug)}&_fields=id,permalink`), headers: auth(ctx) }, 'Recherche du produit WooCommerce', [200]);
  const hit = list.find((p) => p.permalink && normPath(p.permalink) === normPath(url)) ?? (list.length === 1 ? list[0] : undefined);
  return hit ? { type: 'product', id: String(hit.id) } : null;
}

/** Chemin produit typique (pour chercher d'abord dans les produits). */
export const looksLikeProduct = (url: string) => /\/(produit|product|boutique\/[^/]+)\/[^/]+\/?$/i.test((() => { try { return new URL(url).pathname; } catch { return ''; } })());

async function load(ctx: ConnectorContext, ref: ResourceRef): Promise<WcProduct> {
  if (!ref.id) throw new PublishError(404, 'Produit WooCommerce introuvable.');
  return requestJson<WcProduct>(ctx.http, { method: 'GET', url: wc(ctx, `/products/${encodeURIComponent(ref.id)}?context=edit`), headers: auth(ctx) }, 'Lecture du produit WooCommerce', [200]);
}

/** `metaKey` : clé de l'extension SEO pour les méta ; `null` pour le texte du produit (description). */
export async function wooRead(ctx: ConnectorContext, ref: ResourceRef, metaKey: string | null): Promise<string> {
  const p = await load(ctx, ref);
  if (metaKey === null) return p.description ?? '';
  const m = (p.meta_data ?? []).find((x) => x.key === metaKey);
  return m?.value == null ? '' : String(m.value);
}

export async function wooWrite(ctx: ConnectorContext, ref: ResourceRef, metaKey: string | null, value: string): Promise<void> {
  const body = metaKey === null ? { description: value } : { meta_data: [{ key: metaKey, value }] };
  await requestJson(ctx.http, { method: 'PUT', url: wc(ctx, `/products/${encodeURIComponent(ref.id ?? '')}`), headers: { ...auth(ctx), 'content-type': 'application/json' }, body: JSON.stringify(body) }, 'Mise à jour du produit WooCommerce', [200]);
}

/** Types de changement applicables aux produits (méta via l'extension SEO détectée ; texte du produit). */
export const WOO_KINDS: readonly ChangeKind[] = ['meta.title', 'meta.description', 'canonical', 'rewrite', 'jsonld', 'faq'];
