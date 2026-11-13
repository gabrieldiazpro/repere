/**
 * Connecteur Webflow (Data API v2, docs/v5/publication.md § Webflow).
 * Méta titre / description des pages statiques : `PUT /v2/pages/{id}` `{ seo: { title, description } }` (les deux
 * champs renvoyés pour ne rien effacer), puis UNE publication du site (`POST /v2/sites/{id}/publish`, limitée à une
 * par minute) après la série de changements.
 */
import { requestJson } from '../http';
import { PublishError, type Change, type ConnectInput, type ConnectorContext, type PublishConnector, type ResourceRef, type TestResult } from '../types';

export const WEBFLOW_API = 'https://api.webflow.com/v2';

interface WfPage {
  id: string;
  title?: string;
  slug?: string;
  publishedPath?: string;
  collectionId?: string | null;
  seo?: { title?: string | null; description?: string | null };
}

const h = (ctx: ConnectorContext) => ({ authorization: `Bearer ${ctx.credentials.token ?? ''}`, accept: 'application/json' });

async function wf<T>(ctx: ConnectorContext, method: 'GET' | 'PUT' | 'POST', path: string, body: unknown, what: string, ok = [200, 202]): Promise<T> {
  return requestJson<T>(ctx.http, { method, url: `${WEBFLOW_API}${path}`, headers: { ...h(ctx), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, what, ok);
}

function pathOf(url: string | undefined): string {
  try {
    return new URL(url ?? '').pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

async function getPage(ctx: ConnectorContext, id: string): Promise<WfPage> {
  return wf<WfPage>(ctx, 'GET', `/pages/${encodeURIComponent(id)}`, undefined, 'Lecture de la page Webflow', [200]);
}

export const webflowConnector: PublishConnector = {
  platform: 'webflow',
  kinds: ['meta.title', 'meta.description'],

  connect(input: ConnectInput): ConnectInput {
    const siteId = String(input.config.siteId ?? '').trim();
    const token = String(input.credentials.token ?? '').trim();
    if (!/^[a-f0-9]{24}$/i.test(siteId)) throw new PublishError(400, 'Identifiant de site Webflow invalide (Réglages du site > Général).');
    if (token.length < 20) throw new PublishError(400, 'Jeton d’API Webflow requis (Réglages du site > Apps et intégrations).');
    return { config: { siteId }, credentials: { token } };
  },

  async test(ctx): Promise<TestResult> {
    const site = await wf<{ displayName?: string; customDomains?: { id: string; url?: string }[] }>(ctx, 'GET', `/sites/${ctx.config.siteId}`, undefined, 'Site Webflow', [200]);
    await wf<{ pages: WfPage[] }>(ctx, 'GET', `/sites/${ctx.config.siteId}/pages?limit=1`, undefined, 'Pages Webflow', [200]);
    return {
      ok: true,
      detail: `Connecté au site « ${site.displayName ?? 'Webflow'} ». Les modifications sont publiées sur ${site.customDomains?.length ? 'vos domaines' : 'le sous-domaine Webflow'} après application.`,
      capabilities: ['meta.title', 'meta.description'],
      info: { siteName: String(site.displayName ?? ''), domains: (site.customDomains ?? []).map((d) => d.id).join(',') },
    };
  },

  async locate(ctx, change: Change): Promise<ResourceRef> {
    if (change.target.resource?.id) return change.target.resource;
    const want = pathOf(change.target.url);
    for (let offset = 0; offset < 1000; offset += 100) {
      const r = await wf<{ pages: WfPage[]; pagination?: { total?: number } }>(ctx, 'GET', `/sites/${ctx.config.siteId}/pages?limit=100&offset=${offset}`, undefined, 'Pages Webflow', [200]);
      const hit = r.pages.find((p) => !p.collectionId && ((p.publishedPath ?? '').replace(/\/+$/, '') || '/') === want);
      if (hit) return { type: 'page', id: hit.id };
      if (r.pages.length < 100) break;
    }
    throw new PublishError(404, 'Page Webflow introuvable (les pages de collection se modifient dans le CMS : utilisez l’export).', 'not_found');
  },

  async read(ctx, change) {
    const ref = await webflowConnector.locate(ctx, change);
    const p = await getPage(ctx, ref.id ?? '');
    return (change.kind === 'meta.title' ? p.seo?.title : p.seo?.description) ?? '';
  },

  async apply(ctx, change) {
    await write(ctx, change, change.after ?? '');
    return {};
  },

  async revert(ctx, change) {
    await write(ctx, change, change.before ?? '');
  },

  async finalize(ctx) {
    const domains = (ctx.config.domains ?? '').split(',').filter(Boolean);
    await wf(ctx, 'POST', `/sites/${ctx.config.siteId}/publish`, domains.length ? { customDomains: domains } : { publishToWebflowSubdomain: true }, 'Publication Webflow');
  },
};

async function write(ctx: ConnectorContext, change: Change, value: string): Promise<void> {
  const ref = await webflowConnector.locate(ctx, change);
  const cur = await getPage(ctx, ref.id ?? '');
  const seo = { title: cur.seo?.title ?? '', description: cur.seo?.description ?? '' };
  if (change.kind === 'meta.title') seo.title = value;
  else seo.description = value;
  await wf(ctx, 'PUT', `/pages/${encodeURIComponent(ref.id ?? '')}`, { seo }, 'Mise à jour de la page Webflow', [200]);
}
