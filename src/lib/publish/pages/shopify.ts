/**
 * Shopify (Admin GraphQL) : pages (`pageCreate` / `pageUpdate` / `pageDelete`) et articles de blog (`articleCreate` /
 * `articleUpdate` / `articleDelete`), créés avec `isPublished: false` (non visibles sur la boutique) puis mis en ligne
 * par `isPublished: true`. Méta titre / description : métachamps `global.title_tag` / `global.description_tag`
 * passés à la création. Portée `write_content` (ou `write_online_store_pages`). Pas de corbeille chez Shopify : la
 * suppression est définitive, donc le retour arrière par défaut est le retrait (hors ligne), la suppression est un
 * second geste explicite. https://shopify.dev/docs/api/admin-graphql/latest/mutations/pageCreate
 */
import { shopifyGraphql } from '../connectors/shopify';
import { PublishError, type ConnectorContext } from '../types';
import type { PageConnector, PageDraftInput, PageFormat, PageOptions, RemotePage } from './types';

interface ShopNode {
  id: string;
  handle: string;
  title?: string;
  body?: string;
  isPublished?: boolean;
  blog?: { handle: string };
}

function userErrors(p: { userErrors?: { message: string }[] } | null | undefined, what: string): void {
  const e = p?.userErrors ?? [];
  if (e.length) throw new PublishError(422, `${what} : ${e.map((x) => x.message).join(' ; ').slice(0, 300)}`, 'user_error');
}

function toRemote(ctx: ConnectorContext, format: PageFormat, n: ShopNode, blogHandle?: string): RemotePage {
  const shop = ctx.config.shop ?? '';
  const numeric = n.id.split('/').pop() ?? n.id;
  const path = format === 'page' ? `/pages/${n.handle}` : `/blogs/${n.blog?.handle ?? blogHandle ?? 'news'}/${n.handle}`;
  return {
    platform: 'shopify',
    format,
    id: n.id,
    status: n.isPublished ? 'published' : 'draft',
    url: `https://${ctx.config.domain || shop}${path}`,
    editUrl: `https://${shop}/admin/${format === 'page' ? 'pages' : 'articles'}/${numeric}`,
    title: n.title,
    html: (n.body ?? '').slice(0, 200_000),
    ...(n.blog?.handle || blogHandle ? { extra: { blogHandle: n.blog?.handle ?? blogHandle ?? '' } } : {}),
  };
}

async function blogOf(ctx: ConnectorContext, opts: PageOptions): Promise<{ id: string; handle: string }> {
  const d = await shopifyGraphql<{ blogs: { nodes: { id: string; handle: string }[] } }>(ctx, `query { blogs(first: 10) { nodes { id handle } } }`);
  const hit = opts.shopifyBlogId ? d.blogs.nodes.find((b) => b.id === opts.shopifyBlogId) : d.blogs.nodes[0];
  if (!hit) throw new PublishError(404, 'Aucun blog dans cette boutique : créez-en un dans Shopify (Boutique en ligne > Articles de blog).', 'not_found');
  return hit;
}

const seo = (i: PageDraftInput) => [
  { namespace: 'global', key: 'title_tag', type: 'single_line_text_field', value: i.metaTitle },
  { namespace: 'global', key: 'description_tag', type: 'single_line_text_field', value: i.metaDescription },
];

const FIELDS = 'id handle title body isPublished';

export const shopifyPages: PageConnector = {
  platform: 'shopify',
  support: { page: true, article: true, draft: true, unpublish: true, notes: ['Créé « masqué » dans Shopify : invisible sur la boutique jusqu’à la mise en ligne. Shopify n’a pas de corbeille : la suppression est définitive.'] },

  async findBySlug(ctx, format, slug) {
    if (format === 'page') {
      const d = await shopifyGraphql<{ pages: { nodes: ShopNode[] } }>(ctx, `query($q: String) { pages(first: 5, query: $q) { nodes { ${FIELDS} } } }`, { q: `handle:${slug}` });
      const hit = d.pages.nodes.find((n) => n.handle === slug);
      return hit ? toRemote(ctx, 'page', hit) : null;
    }
    const d = await shopifyGraphql<{ articles: { nodes: ShopNode[] } }>(ctx, `query($q: String) { articles(first: 5, query: $q) { nodes { ${FIELDS} blog { handle } } } }`, { q: `handle:${slug}` });
    const hit = d.articles.nodes.find((n) => n.handle === slug);
    return hit ? toRemote(ctx, 'article', hit) : null;
  },

  async createDraft(ctx, input, opts) {
    if (input.format === 'page') {
      const d = await shopifyGraphql<{ pageCreate: { page: ShopNode | null; userErrors: { message: string }[] } }>(
        ctx,
        `mutation($p: PageCreateInput!) { pageCreate(page: $p) { page { ${FIELDS} } userErrors { message } } }`,
        { p: { title: input.title, handle: input.slug, body: input.html, isPublished: false, metafields: seo(input) } },
      );
      userErrors(d.pageCreate, 'Création de la page Shopify');
      if (!d.pageCreate.page) throw new PublishError(502, 'Shopify : page non créée.');
      return toRemote(ctx, 'page', d.pageCreate.page);
    }
    const blog = await blogOf(ctx, opts);
    const d = await shopifyGraphql<{ articleCreate: { article: ShopNode | null; userErrors: { message: string }[] } }>(
      ctx,
      `mutation($a: ArticleCreateInput!) { articleCreate(article: $a) { article { ${FIELDS} blog { handle } } userErrors { message } } }`,
      { a: { blogId: blog.id, title: input.title, handle: input.slug, body: input.html, summary: input.excerpt ?? null, isPublished: false, author: { name: input.author ?? 'La rédaction' }, metafields: seo(input) } },
    );
    userErrors(d.articleCreate, 'Création de l’article Shopify');
    if (!d.articleCreate.article) throw new PublishError(502, 'Shopify : article non créé.');
    return toRemote(ctx, 'article', d.articleCreate.article, blog.handle);
  },

  async read(ctx, ref) {
    const field = ref.format === 'page' ? 'page' : 'article';
    const d = await shopifyGraphql<Record<string, ShopNode | null>>(ctx, `query($id: ID!) { r: ${field}(id: $id) { ${FIELDS}${ref.format === 'article' ? ' blog { handle }' : ''} } }`, { id: ref.id });
    return d.r ? toRemote(ctx, ref.format, d.r) : null;
  },

  async publish(ctx, ref) {
    return setPublished(ctx, ref, true);
  },

  async unpublish(ctx, ref) {
    return setPublished(ctx, ref, false);
  },

  async remove(ctx, ref) {
    if (ref.format === 'page') {
      const d = await shopifyGraphql<{ pageDelete: { userErrors: { message: string }[] } }>(ctx, `mutation($id: ID!) { pageDelete(id: $id) { deletedPageId userErrors { message } } }`, { id: ref.id });
      userErrors(d.pageDelete, 'Suppression de la page');
      return;
    }
    const d = await shopifyGraphql<{ articleDelete: { userErrors: { message: string }[] } }>(ctx, `mutation($id: ID!) { articleDelete(id: $id) { deletedArticleId userErrors { message } } }`, { id: ref.id });
    userErrors(d.articleDelete, 'Suppression de l’article');
  },
};

async function setPublished(ctx: ConnectorContext, ref: RemotePage, on: boolean): Promise<RemotePage> {
  if (ref.format === 'page') {
    const d = await shopifyGraphql<{ pageUpdate: { page: ShopNode | null; userErrors: { message: string }[] } }>(ctx, `mutation($id: ID!, $p: PageUpdateInput!) { pageUpdate(id: $id, page: $p) { page { ${FIELDS} } userErrors { message } } }`, { id: ref.id, p: { isPublished: on } });
    userErrors(d.pageUpdate, 'Page Shopify');
    return toRemote(ctx, 'page', d.pageUpdate.page ?? { id: ref.id, handle: '', isPublished: on });
  }
  const d = await shopifyGraphql<{ articleUpdate: { article: ShopNode | null; userErrors: { message: string }[] } }>(ctx, `mutation($id: ID!, $a: ArticleUpdateInput!) { articleUpdate(id: $id, article: $a) { article { ${FIELDS} blog { handle } } userErrors { message } } }`, { id: ref.id, a: { isPublished: on } });
  userErrors(d.articleUpdate, 'Article Shopify');
  return toRemote(ctx, 'article', d.articleUpdate.article ?? { id: ref.id, handle: '', isPublished: on }, ref.extra?.blogHandle);
}
