/**
 * Wix Blog (Draft Posts API) : `POST /blog/v3/draft-posts` sans `publish` → brouillon d'article non publié ;
 * mise en ligne : `POST /blog/v3/draft-posts/{id}/publish` ; retrait : `POST /blog/v3/draft-posts/{id}/unpublish` ;
 * corbeille : `DELETE /blog/v3/draft-posts/{id}` (corbeille du blog). Corps au format Ricos (texte toujours dans un
 * PARAGRAPH). `memberId` obligatoire hors propriétaire : membre choisi dans les réglages, sinon le premier membre
 * (`GET /members/v1/members`). Repéré ne crée JAMAIS de membre sur le site du client : sans membre, il s'arrête et
 * explique. Pages statiques Wix : pas d'API de création → export guidé.
 * https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/create-draft-post
 */
import { wixRequest } from '../connectors/wix';
import { PublishError, type ConnectorContext } from '../types';
import { blocksToRicos } from './render';
import type { PageConnector, PageOptions, RemotePage } from './types';

const BLOG = ['/blog/v3'] as const;

interface WixDraft {
  id: string;
  title?: string;
  status?: string;
  seoSlug?: string;
  url?: { base?: string; path?: string };
  hasUnpublishedChanges?: boolean;
  firstPublishedDate?: string;
}

function toRemote(d: WixDraft): RemotePage {
  const url = d.url?.base && d.url.path ? `${d.url.base.replace(/\/$/, '')}${d.url.path}` : undefined;
  return { platform: 'wix', format: 'article', id: d.id, status: d.status === 'PUBLISHED' ? 'published' : d.status === 'IN_TRASH' ? 'trashed' : 'draft', url, title: d.title, ...(d.seoSlug ? { extra: { slug: d.seoSlug } } : {}) };
}

async function memberId(ctx: ConnectorContext, opts: PageOptions): Promise<string> {
  if (opts.wixMemberId) return opts.wixMemberId;
  const d = await wixRequest<{ members?: { id: string }[] }>(ctx, 'GET', ['/members/v1'], '/members?fieldsets=PUBLIC&paging.limit=1', undefined, 'Membres du site Wix');
  const id = d.members?.[0]?.id;
  if (!id) throw new PublishError(422, 'Wix demande un auteur (membre du site) pour créer un article. Repéré n’en crée pas à votre place : inscrivez-vous comme membre de votre site, puis réessayez.', 'needs_setting');
  return id;
}

export const wixPages: PageConnector = {
  platform: 'wix',
  support: { page: false, article: true, draft: true, unpublish: true, notes: ['Wix ne permet pas de créer une page statique par l’API : les pages passent par l’export guidé, les articles par le blog Wix.'] },

  async findBySlug(ctx, format, slug) {
    if (format === 'page') return null;
    try {
      const d = await wixRequest<{ post?: WixDraft }>(ctx, 'GET', BLOG, `/posts/slugs/${encodeURIComponent(slug)}`, undefined, 'Recherche Wix');
      return d.post ? { ...toRemote(d.post), status: 'published' } : null;
    } catch (e) {
      if (e instanceof PublishError && e.status === 404) return null;
      throw e;
    }
  },

  async createDraft(ctx, input, opts) {
    if (input.format === 'page') throw new PublishError(422, 'Wix : création de page statique impossible par l’API (utilisez l’export guidé).', 'unsupported');
    const author = await memberId(ctx, opts);
    const d = await wixRequest<{ draftPost: WixDraft }>(
      ctx,
      'POST',
      BLOG,
      '/draft-posts?fieldsets=URL',
      {
        draftPost: {
          title: input.title,
          memberId: author,
          seoSlug: input.slug,
          excerpt: input.excerpt,
          richContent: blocksToRicos(input.blocks),
          seoData: { tags: [{ type: 'title', children: input.metaTitle }, { type: 'meta', props: { name: 'description', content: input.metaDescription } }] },
        },
      },
      'Création du brouillon Wix',
    );
    return toRemote(d.draftPost);
  },

  async read(ctx, ref) {
    try {
      const d = await wixRequest<{ draftPost: WixDraft }>(ctx, 'GET', BLOG, `/draft-posts/${encodeURIComponent(ref.id)}?fieldsets=URL`, undefined, 'Relecture Wix');
      return toRemote(d.draftPost);
    } catch (e) {
      if (e instanceof PublishError && e.status === 404) return null;
      throw e;
    }
  },

  async publish(ctx, ref) {
    await wixRequest(ctx, 'POST', BLOG, `/draft-posts/${encodeURIComponent(ref.id)}/publish`, {}, 'Publication Wix');
    return { ...ref, status: 'published' };
  },

  async unpublish(ctx, ref) {
    await wixRequest(ctx, 'POST', BLOG, `/draft-posts/${encodeURIComponent(ref.id)}/unpublish`, {}, 'Retrait Wix');
    return { ...ref, status: 'draft' };
  },

  async remove(ctx, ref) {
    await wixRequest(ctx, 'DELETE', BLOG, `/draft-posts/${encodeURIComponent(ref.id)}`, undefined, 'Corbeille Wix', [200, 204]);
  },
};
