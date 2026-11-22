/**
 * PrestaShop (webservice) : pages CMS (`content_management_system`). Création en XML avec `active = 0` (page
 * désactivée, invisible en boutique), champs multilingues écrits dans la langue configurée ; mise en ligne : `active = 1`
 * (PATCH, sinon PUT du XML complet relu) ; retrait : `active = 0` ; suppression : `DELETE` (définitive, pas de
 * corbeille). Pas de blog natif dans PrestaShop : les articles passent par l'export.
 * https://devdocs.prestashop-project.org/9/webservice/resources/content_management_system/
 */
import { basicAuth, statusError } from '../http';
import { PublishError, type ConnectorContext } from '../types';
import type { PageConnector, PageOptions, RemotePage } from './types';

const auth = (ctx: ConnectorContext) => ({ authorization: basicAuth(ctx.credentials.apiKey ?? '', '') });
const api = (ctx: ConnectorContext, p: string) => `${ctx.config.siteUrl}/api/${p}`;
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
const lang = (ctx: ConnectorContext) => (ctx.config.languageId || '1').replace(/\D/g, '') || '1';
const ml = (ctx: ConnectorContext, field: string, v: string) => `<${field}><language id="${lang(ctx)}">${cdata(v)}</language></${field}>`;

function toRemote(ctx: ConnectorContext, id: string, active: boolean, slug?: string, html?: string, title?: string): RemotePage {
  return {
    platform: 'prestashop',
    format: 'page',
    id,
    status: active ? 'published' : 'draft',
    ...(slug ? { url: `${ctx.config.siteUrl}/content/${id}-${slug}` } : {}),
    ...(html !== undefined ? { html: html.slice(0, 200_000) } : {}),
    ...(title ? { title } : {}),
  };
}

function langValue(v: unknown, l: string): string {
  if (Array.isArray(v)) return String((v.find((x) => String((x as { id: unknown }).id) === l) as { value?: unknown } | undefined)?.value ?? (v[0] as { value?: unknown } | undefined)?.value ?? '');
  return typeof v === 'string' ? v : '';
}

async function setActive(ctx: ConnectorContext, ref: RemotePage, on: boolean): Promise<RemotePage> {
  const body = `<?xml version="1.0" encoding="UTF-8"?><prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><content><id>${cdata(ref.id)}</id><active>${on ? 1 : 0}</active></content></prestashop>`;
  const res = await ctx.http({ method: 'PATCH', url: api(ctx, `content_management_system/${encodeURIComponent(ref.id)}`), headers: { ...auth(ctx), 'content-type': 'application/xml' }, body });
  if (res.status !== 200 && res.status !== 201) {
    if (res.status !== 405) throw statusError(res, 'Page PrestaShop');
    const full = await ctx.http({ method: 'GET', url: api(ctx, `content_management_system/${encodeURIComponent(ref.id)}`), headers: auth(ctx) });
    if (full.status !== 200) throw statusError(full, 'Lecture PrestaShop');
    const xml = full.text.replace(/<active>[\s\S]*?<\/active>|<active\s*\/>/, `<active>${cdata(on ? '1' : '0')}</active>`);
    const put = await ctx.http({ method: 'PUT', url: api(ctx, `content_management_system/${encodeURIComponent(ref.id)}`), headers: { ...auth(ctx), 'content-type': 'application/xml' }, body: xml });
    if (put.status !== 200 && put.status !== 201) throw statusError(put, 'Page PrestaShop');
  }
  return { ...ref, status: on ? 'published' : 'draft' };
}

export const prestashopPages: PageConnector = {
  platform: 'prestashop',
  support: { page: true, article: false, draft: true, unpublish: true, notes: ['Page CMS créée désactivée (invisible en boutique) ; PrestaShop n’a pas de blog natif ni de corbeille.'] },

  async findBySlug(ctx, format, slug) {
    if (format === 'article') return null;
    const res = await ctx.http({ method: 'GET', url: api(ctx, `content_management_system?output_format=JSON&display=[id,active,link_rewrite]&filter[link_rewrite]=[${encodeURIComponent(slug)}]`), headers: auth(ctx) });
    if (res.status !== 200) return null;
    const list = (JSON.parse(res.text || '{}') as { content_management_system?: { id: number | string; active?: string | number; link_rewrite?: unknown }[] }).content_management_system ?? [];
    const hit = list.find((x) => langValue(x.link_rewrite, lang(ctx)) === slug);
    return hit ? toRemote(ctx, String(hit.id), String(hit.active) === '1', slug) : null;
  },

  async createDraft(ctx, input, opts: PageOptions) {
    if (input.format === 'article') throw new PublishError(422, 'PrestaShop n’a pas de blog natif : utilisez l’export pour un article.', 'unsupported');
    const cat = /^\d{1,6}$/.test(String(opts.prestashopCategoryId ?? '')) ? String(opts.prestashopCategoryId) : '1';
    const body =
      `<?xml version="1.0" encoding="UTF-8"?><prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><content>` +
      `<id_cms_category>${cat}</id_cms_category><active>0</active><indexation>1</indexation>` +
      `${ml(ctx, 'meta_title', input.metaTitle)}${ml(ctx, 'head_seo_title', input.title)}${ml(ctx, 'meta_description', input.metaDescription)}${ml(ctx, 'link_rewrite', input.slug)}${ml(ctx, 'content', input.html)}` +
      `</content></prestashop>`;
    const res = await ctx.http({ method: 'POST', url: api(ctx, 'content_management_system?output_format=JSON'), headers: { ...auth(ctx), 'content-type': 'application/xml' }, body });
    if (res.status !== 200 && res.status !== 201) throw statusError(res, 'Création de la page PrestaShop');
    let id = '';
    try {
      const j = JSON.parse(res.text) as { content?: { id?: number | string } };
      id = String(j.content?.id ?? '');
    } catch {
      id = /<id>\s*(?:<!\[CDATA\[)?(\d+)/.exec(res.text)?.[1] ?? '';
    }
    if (!id) throw new PublishError(502, 'PrestaShop : identifiant de la page créée introuvable.');
    return toRemote(ctx, id, false, input.slug, input.html, input.title);
  },

  async read(ctx, ref) {
    const res = await ctx.http({ method: 'GET', url: api(ctx, `content_management_system/${encodeURIComponent(ref.id)}?output_format=JSON`), headers: auth(ctx) });
    if (res.status === 404) return null;
    if (res.status !== 200) throw statusError(res, 'Relecture PrestaShop');
    const c = (JSON.parse(res.text) as { content?: Record<string, unknown> }).content ?? {};
    return toRemote(ctx, ref.id, String(c.active) === '1', langValue(c.link_rewrite, lang(ctx)) || undefined, langValue(c.content, lang(ctx)), langValue(c.meta_title, lang(ctx)));
  },

  publish: (ctx, ref) => setActive(ctx, ref, true),
  unpublish: (ctx, ref) => setActive(ctx, ref, false),

  async remove(ctx, ref) {
    const res = await ctx.http({ method: 'DELETE', url: api(ctx, `content_management_system/${encodeURIComponent(ref.id)}`), headers: auth(ctx) });
    if (res.status !== 200 && res.status !== 204) throw statusError(res, 'Suppression PrestaShop');
  },
};
