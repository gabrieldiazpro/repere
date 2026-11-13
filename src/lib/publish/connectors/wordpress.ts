/**
 * Connecteur WordPress (REST API + mot de passe d'application, docs/v5/publication.md § WordPress).
 * - Méta titre / description / canonique : métas de l'extension SEO (Yoast : `_yoast_wpseo_*`, exposées par
 *   l'extension d'aide ; Rank Math : `rank_math_*`, écrites par `rankmath/v1/updateMeta`). Sans méta lisible : export.
 * - Alt d'image : `wp/v2/media/<id>` `alt_text`.
 * - JSON-LD, FAQ, réécriture : `content.raw` de la page (avant/après = contenu complet, exact et réversible).
 */
import { basicAuth, normalizeSiteUrl, parseJson, requestJson, statusError } from '../http';
import { PublishError, type Change, type ChangeKind, type ConnectInput, type ConnectorContext, type PublishConnector, type ResourceRef, type TestResult } from '../types';

type SeoPlugin = 'yoast' | 'rankmath' | 'none';

const META_KEYS: Record<Exclude<SeoPlugin, 'none'>, Partial<Record<ChangeKind, string>>> = {
  yoast: { 'meta.title': '_yoast_wpseo_title', 'meta.description': '_yoast_wpseo_metadesc', canonical: '_yoast_wpseo_canonical' },
  rankmath: { 'meta.title': 'rank_math_title', 'meta.description': 'rank_math_description', canonical: 'rank_math_canonical_url' },
};

const CONTENT_KINDS: ChangeKind[] = ['jsonld', 'faq', 'rewrite'];
const META_KINDS: ChangeKind[] = ['meta.title', 'meta.description', 'canonical'];

interface WpPost {
  id: number;
  link?: string;
  type?: string;
  content?: { raw?: string };
  meta?: Record<string, unknown>;
}

const api = (ctx: ConnectorContext, path: string) => `${ctx.config.siteUrl}/wp-json${path}`;
const auth = (ctx: ConnectorContext) => ({ authorization: basicAuth(ctx.credentials.username ?? '', ctx.credentials.password ?? '') });
const restBase = (type: string) => (type === 'post' ? 'posts' : 'pages');

function normPath(u: string): string {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '') || '/'}`;
  } catch {
    return u;
  }
}

async function get<T>(ctx: ConnectorContext, path: string, what: string): Promise<T> {
  return requestJson<T>(ctx.http, { method: 'GET', url: api(ctx, path), headers: auth(ctx) }, what, [200]);
}

async function post<T>(ctx: ConnectorContext, path: string, body: unknown, what: string): Promise<T> {
  return requestJson<T>(ctx.http, { method: 'POST', url: api(ctx, path), headers: { ...auth(ctx), 'content-type': 'application/json' }, body: JSON.stringify(body) }, what, [200, 201]);
}

function seoPlugin(ctx: ConnectorContext): SeoPlugin {
  const s = ctx.config.seoPlugin;
  return s === 'yoast' || s === 'rankmath' ? s : 'none';
}

function metaKey(ctx: ConnectorContext, kind: ChangeKind): string {
  const p = seoPlugin(ctx);
  const k = p === 'none' ? undefined : META_KEYS[p][kind];
  if (!k) throw new PublishError(422, 'Aucune extension SEO compatible (Yoast ou Rank Math) détectée : utilisez l’export.', 'unsupported');
  return k;
}

/** Nom de fichier comparable (sans dimensions « -300x200 » ni « -scaled »). */
export function mediaStem(src: string): string {
  let name = src;
  try {
    name = new URL(src, 'https://x.invalid').pathname;
  } catch {
    /* tel quel */
  }
  name = decodeURIComponent(name.split('/').pop() ?? '');
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/-(\d+x\d+|scaled|rotated)$/i, '').toLowerCase();
}

async function loadPost(ctx: ConnectorContext, ref: ResourceRef): Promise<WpPost> {
  if (!ref.id) throw new PublishError(404, 'Page WordPress introuvable.');
  return get<WpPost>(ctx, `/wp/v2/${restBase(ref.type)}/${encodeURIComponent(ref.id)}?context=edit`, 'Lecture de la page WordPress');
}

export const wordpressConnector: PublishConnector = {
  platform: 'wordpress',
  kinds: ['meta.title', 'meta.description', 'canonical', 'image.alt', 'jsonld', 'faq', 'rewrite'],

  connect(input: ConnectInput): ConnectInput {
    const siteUrl = normalizeSiteUrl(input.config.siteUrl ?? '');
    const username = String(input.credentials.username ?? '').trim();
    // Les mots de passe d'application s'affichent par groupes de 4 séparés d'espaces : WordPress accepte les deux.
    const password = String(input.credentials.password ?? '').replace(/\s+/g, '');
    if (!username || password.length < 16) throw new PublishError(400, 'Identifiant et mot de passe d’application WordPress requis (Utilisateurs > Profil > Mots de passe d’application).');
    return { config: { siteUrl }, credentials: { username, password } };
  },

  async test(ctx): Promise<TestResult> {
    const index = await ctx.http({ method: 'GET', url: api(ctx, '/'), headers: { accept: 'application/json' } });
    if (index.status !== 200) {
      return { ok: false, detail: index.status === 404 ? 'API REST WordPress introuvable à cette adresse (/wp-json/).' : statusError(index, 'API WordPress').message, capabilities: [] };
    }
    const root = parseJson<{ name?: string; namespaces?: string[] }>(index, 'API WordPress');
    const ns = root.namespaces ?? [];
    const plugin: SeoPlugin = ns.includes('rankmath/v1') ? 'rankmath' : ns.includes('yoast/v1') ? 'yoast' : 'none';
    const me = await ctx.http({ method: 'GET', url: api(ctx, '/wp/v2/users/me?context=edit'), headers: auth(ctx) });
    if (me.status !== 200) return { ok: false, detail: statusError(me, 'Connexion WordPress').message, capabilities: [] };
    const caps = parseJson<{ capabilities?: Record<string, boolean> }>(me, 'Profil WordPress').capabilities ?? {};
    const capabilities: ChangeKind[] = [];
    const canEdit = Boolean(caps.edit_pages || caps.edit_posts);
    if (canEdit && plugin !== 'none') {
      // Les métas SEO doivent être lisibles dans `meta` (sinon impossible de garder l'avant exact).
      const sample = await ctx.http({ method: 'GET', url: api(ctx, '/wp/v2/pages?per_page=1&context=edit'), headers: auth(ctx) });
      const first = sample.status === 200 ? parseJson<WpPost[]>(sample, 'Pages WordPress')[0] : undefined;
      const keys = META_KEYS[plugin];
      for (const k of META_KINDS) if (keys[k] && first?.meta && keys[k]! in first.meta) capabilities.push(k);
    }
    if (caps.upload_files) capabilities.push('image.alt');
    if (canEdit) capabilities.push('rewrite');
    // Un bloc <script> dans le contenu n'est conservé qu'avec la capacité unfiltered_html.
    if (canEdit && caps.unfiltered_html) capabilities.push('jsonld', 'faq');
    const missingMeta = plugin !== 'none' && !capabilities.includes('meta.title');
    return {
      ok: canEdit,
      detail: canEdit
        ? `Connecté à « ${root.name ?? 'WordPress'} »${plugin !== 'none' ? ` (extension ${plugin === 'yoast' ? 'Yoast SEO' : 'Rank Math'})` : ''}.${missingMeta ? ' Les champs SEO ne sont pas exposés à l’API : installez l’extension d’aide indiquée pour que Repéré puisse les modifier.' : ''}`
        : 'Cet utilisateur ne peut pas modifier les pages : choisissez un compte Éditeur ou Administrateur.',
      capabilities,
      info: { seoPlugin: plugin, siteName: String(root.name ?? '') },
    };
  },

  async locate(ctx, change: Change): Promise<ResourceRef> {
    if (change.target.resource?.id) return change.target.resource;
    const url = change.target.url ?? '';
    if (change.kind === 'image.alt') {
      const stem = mediaStem(change.target.imageSrc ?? '');
      if (!stem) throw new PublishError(404, 'Image introuvable.');
      const list = await get<{ id: number; source_url?: string }[]>(ctx, `/wp/v2/media?per_page=20&search=${encodeURIComponent(stem.replace(/[-_]+/g, ' '))}`, 'Recherche de l’image');
      const hit = list.find((m) => mediaStem(m.source_url ?? '') === stem);
      if (!hit) throw new PublishError(404, 'Image introuvable dans la médiathèque WordPress.', 'not_found');
      return { type: 'media', id: String(hit.id) };
    }
    const want = normPath(url);
    const slug = (() => {
      try {
        return new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
      } catch {
        return '';
      }
    })();
    for (const type of ['page', 'post'] as const) {
      const q = slug ? `slug=${encodeURIComponent(slug)}` : 'per_page=100';
      const list = await get<WpPost[]>(ctx, `/wp/v2/${restBase(type)}?${q}&_fields=id,link`, 'Recherche de la page');
      const hit = list.find((p) => p.link && normPath(p.link) === want) ?? (slug && list.length === 1 ? list[0] : undefined);
      if (hit) return { type, id: String(hit.id) };
    }
    throw new PublishError(404, 'Page introuvable dans WordPress (adresse modifiée ou page générée par une extension).', 'not_found');
  },

  async read(ctx, change): Promise<string | null> {
    const ref = await wordpressConnector.locate(ctx, change);
    if (change.kind === 'image.alt') {
      const m = await get<{ alt_text?: string }>(ctx, `/wp/v2/media/${encodeURIComponent(ref.id ?? '')}?context=edit`, 'Lecture de l’image');
      return m.alt_text ?? '';
    }
    const p = await loadPost(ctx, ref);
    if (CONTENT_KINDS.includes(change.kind)) return p.content?.raw ?? '';
    const key = metaKey(ctx, change.kind);
    if (!p.meta || !(key in p.meta)) throw new PublishError(422, 'Champ SEO non exposé par WordPress : installez l’extension d’aide, ou utilisez l’export.', 'unsupported');
    const v = p.meta[key];
    return typeof v === 'string' ? v : v == null ? '' : String(v);
  },

  async apply(ctx, change) {
    await write(ctx, change, change.after ?? '');
    return {};
  },

  async revert(ctx, change) {
    await write(ctx, change, change.before ?? '');
  },
};

async function write(ctx: ConnectorContext, change: Change, value: string): Promise<void> {
  const ref = await wordpressConnector.locate(ctx, change);
  if (change.kind === 'image.alt') {
    await post(ctx, `/wp/v2/media/${encodeURIComponent(ref.id ?? '')}`, { alt_text: value }, 'Mise à jour de l’image');
    return;
  }
  if (CONTENT_KINDS.includes(change.kind)) {
    await post(ctx, `/wp/v2/${restBase(ref.type)}/${encodeURIComponent(ref.id ?? '')}`, { content: value }, 'Mise à jour du contenu');
    return;
  }
  const key = metaKey(ctx, change.kind);
  if (seoPlugin(ctx) === 'rankmath') {
    await post(ctx, '/rankmath/v1/updateMeta', { objectType: 'post', objectID: Number(ref.id), meta: { [key]: value } }, 'Mise à jour Rank Math');
    return;
  }
  await post(ctx, `/wp/v2/${restBase(ref.type)}/${encodeURIComponent(ref.id ?? '')}`, { meta: { [key]: value } }, 'Mise à jour du champ SEO');
}
