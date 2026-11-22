/**
 * Création de pages / articles (V8) sur faux serveurs reproduisant les API documentées : WordPress, Shopify, Webflow,
 * Wix Blog, PrestaShop. Brouillon d'abord, mise en ligne, retrait, corbeille ; aucun accès Internet.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setPublishHttp } from '../http';
import { blocksToRicos, buildPageExport, prestashopPages, shopifyPages, webflowPages, wixPages, wordpressPages, type PageDraftInput } from '../pages';
import { readZip } from '../zip';
import type { ConnectorContext } from '../types';
import { basicOk, isolateStore, localHttp, startFake, type Fake, type FakeReq } from './helpers';

isolateStore('pages');

let fake: Fake;
beforeAll(async () => {
  fake = await startFake();
  setPublishHttp(localHttp(fake.port));
});
afterAll(async () => {
  setPublishHttp(null);
  await fake.close();
});

const input: PageDraftInput = {
  format: 'page',
  title: 'Nos tarifs à Lyon',
  slug: 'nos-tarifs-a-lyon',
  metaTitle: 'Nos tarifs à Lyon | Plomberie Martin',
  metaDescription: 'Tarifs indiqués par Plomberie Martin : déplacement 49 € TTC.',
  html: '<h2>Nos tarifs</h2>\n<ul>\n  <li>Déplacement : 49 € TTC</li>\n</ul>',
  blocks: [{ type: 'h2', text: 'Nos tarifs' }, { type: 'ul', items: ['Déplacement : 49 € TTC'] }, { type: 'p', text: 'Voir [contact](/contact).' }],
  jsonLd: ['{"@context":"https://schema.org","@type":"Service","name":"Tarifs"}'],
  excerpt: 'Tarifs',
  author: 'Plomberie Martin',
};

const ctx = (http: ReturnType<typeof localHttp>, config: Record<string, string>, credentials: Record<string, string>): ConnectorContext => ({ businessId: 'b', http, credentials, config, now: () => new Date('2026-11-22T10:00:00Z') });
const json = (r: FakeReq) => (r.body ? JSON.parse(r.body) : {});

describe('WordPress', () => {
  const items: { id: number; slug: string; status: string; title: string; content: string; type: string; meta: Record<string, string> }[] = [{ id: 5, slug: 'contact', status: 'publish', title: 'Contact', content: '', type: 'page', meta: {} }];
  beforeAll(() => {
    fake.hosts.set('wp.test', (r) => {
      if (!basicOk(r.headers, 'ed', 'pw')) return { status: 401, body: { code: 'rest_not_logged_in' } };
      const m = /^\/wp-json\/wp\/v2\/(pages|posts)(?:\/(\d+))?$/.exec(r.path);
      if (!m) return { status: 404, body: {} };
      const type = m[1] === 'pages' ? 'page' : 'post';
      const view = (i: (typeof items)[0]) => ({ id: i.id, slug: i.slug, status: i.status, link: `https://wp.test/${i.slug}/`, title: { raw: i.title }, content: { raw: i.content }, meta: i.meta });
      if (!m[2] && r.method === 'GET') return { body: items.filter((i) => i.type === type && i.slug === r.query.get('slug') && i.status !== 'trash').map(view) };
      if (!m[2] && r.method === 'POST') {
        const b = json(r);
        const it = { id: 100 + items.length, slug: b.slug, status: b.status, title: b.title, content: b.content, type, meta: { _yoast_wpseo_title: '', _yoast_wpseo_metadesc: '' } };
        items.push(it);
        return { status: 201, body: view(it) };
      }
      const it = items.find((i) => i.id === Number(m[2]));
      if (!it || it.status === 'trash') return { status: 404, body: { code: 'rest_post_invalid_id' } };
      if (r.method === 'GET') return { body: view(it) };
      if (r.method === 'POST') {
        const b = json(r);
        if (b.status) it.status = b.status;
        if (b.meta) Object.assign(it.meta, b.meta);
        return { body: view(it) };
      }
      if (r.method === 'DELETE') {
        it.status = 'trash';
        return { body: view(it) };
      }
      return { status: 405 };
    });
  });
  const c = () => ctx(localHttp(fake.port), { siteUrl: 'https://wp.test', seoPlugin: 'yoast' }, { username: 'ed', password: 'pw' });

  it('crée en brouillon (avec métas Yoast, sans JSON-LD sans unfiltered_html), met en ligne, retire, met à la corbeille', async () => {
    expect(await wordpressPages.findBySlug(c(), 'page', 'contact', {})).toMatchObject({ id: '5', status: 'published' });
    expect(await wordpressPages.findBySlug(c(), 'page', input.slug, {})).toBeNull();
    const r = await wordpressPages.createDraft(c(), input, {});
    expect(r).toMatchObject({ status: 'draft', url: 'https://wp.test/nos-tarifs-a-lyon/' });
    const it = items.find((i) => i.slug === input.slug)!;
    expect(it.status).toBe('draft');
    expect(it.content).not.toContain('ld+json');
    expect(it.meta._yoast_wpseo_title).toBe(input.metaTitle);
    expect((await wordpressPages.publish(c(), r, {})).status).toBe('published');
    expect((await wordpressPages.unpublish(c(), r, {})).status).toBe('draft');
    await wordpressPages.remove(c(), r, {});
    expect(await wordpressPages.read(c(), r, {})).toBeNull();
  });

  it('garde le JSON-LD quand l’utilisateur a unfiltered_html', async () => {
    await wordpressPages.createDraft(c(), { ...input, slug: 'avec-jsonld' }, { allowScript: true });
    expect(items.find((i) => i.slug === 'avec-jsonld')!.content).toContain('application/ld+json');
  });
});

describe('Shopify', () => {
  const pages: Record<string, { id: string; handle: string; title: string; body: string; isPublished: boolean }> = {};
  const articles: Record<string, { id: string; handle: string; title: string; body: string; isPublished: boolean; blogId: string }> = {};
  let lastVars: Record<string, unknown> = {};
  beforeAll(() => {
    fake.hosts.set('shop.myshopify.com', (r) => {
      if (r.headers['x-shopify-access-token'] !== 'shpat_test') return { status: 401, body: {} };
      const { query, variables } = json(r) as { query: string; variables: Record<string, unknown> };
      lastVars = variables;
      if (query.includes('pageCreate')) {
        const p = variables.p as { title: string; handle: string; body: string; isPublished: boolean };
        const id = `gid://shopify/Page/${Object.keys(pages).length + 1}`;
        pages[id] = { id, handle: p.handle, title: p.title, body: p.body, isPublished: p.isPublished };
        return { body: { data: { pageCreate: { page: pages[id], userErrors: [] } } } };
      }
      if (query.includes('pageUpdate')) {
        const p = pages[variables.id as string];
        Object.assign(p, variables.p);
        return { body: { data: { pageUpdate: { page: p, userErrors: [] } } } };
      }
      if (query.includes('pageDelete')) {
        delete pages[variables.id as string];
        return { body: { data: { pageDelete: { deletedPageId: variables.id, userErrors: [] } } } };
      }
      if (query.includes('blogs(')) return { body: { data: { blogs: { nodes: [{ id: 'gid://shopify/Blog/9', handle: 'news' }] } } } };
      if (query.includes('articleCreate')) {
        const a = variables.a as { title: string; handle: string; body: string; isPublished: boolean; blogId: string };
        const id = `gid://shopify/Article/${Object.keys(articles).length + 1}`;
        articles[id] = { id, handle: a.handle, title: a.title, body: a.body, isPublished: a.isPublished, blogId: a.blogId };
        return { body: { data: { articleCreate: { article: { ...articles[id], blog: { handle: 'news' } }, userErrors: [] } } } };
      }
      if (query.includes('pages(first')) return { body: { data: { pages: { nodes: Object.values(pages) } } } };
      if (query.includes('r: page(')) return { body: { data: { r: pages[variables.id as string] ?? null } } };
      return { body: { errors: [{ message: 'inconnu' }] } };
    });
  });
  const c = () => ctx(localHttp(fake.port), { shop: 'shop.myshopify.com', domain: 'boutique.test' }, { token: 'shpat_test' });

  it('page masquée avec métachamps SEO, puis visible, puis masquée, puis supprimée', async () => {
    const r = await shopifyPages.createDraft(c(), input, {});
    expect(r).toMatchObject({ status: 'draft', url: 'https://boutique.test/pages/nos-tarifs-a-lyon' });
    expect((lastVars.p as { metafields: { key: string; value: string }[] }).metafields.map((m) => m.key)).toEqual(['title_tag', 'description_tag']);
    expect(await shopifyPages.findBySlug(c(), 'page', 'nos-tarifs-a-lyon', {})).toMatchObject({ id: r.id });
    expect((await shopifyPages.publish(c(), r, {})).status).toBe('published');
    expect((await shopifyPages.read(c(), r, {}))?.status).toBe('published');
    expect((await shopifyPages.unpublish(c(), r, {})).status).toBe('draft');
    await shopifyPages.remove(c(), r, {});
    expect(await shopifyPages.read(c(), r, {})).toBeNull();
  });

  it('article dans le premier blog, auteur = l’entreprise', async () => {
    const r = await shopifyPages.createDraft(c(), { ...input, format: 'article' }, {});
    expect(r).toMatchObject({ format: 'article', status: 'draft', url: 'https://boutique.test/blogs/news/nos-tarifs-a-lyon' });
    expect((lastVars.a as { author: { name: string }; isPublished: boolean }).author.name).toBe('Plomberie Martin');
  });
});

describe('Webflow (collection CMS)', () => {
  const items: Record<string, { id: string; isDraft: boolean; lastPublished: string | null; fieldData: Record<string, unknown> }> = {};
  beforeAll(() => {
    fake.hosts.set('api.webflow.com', (r) => {
      if (r.headers.authorization !== 'Bearer wf-token-123456789012345') return { status: 401, body: {} };
      const C = 'aaaaaaaaaaaaaaaaaaaaaaaa';
      if (r.path === `/v2/collections/${C}`) return { body: { slug: 'blog', fields: [{ slug: 'name', type: 'PlainText' }, { slug: 'post-summary', type: 'PlainText', displayName: 'Résumé' }, { slug: 'post-body', type: 'RichText' }] } };
      if (r.path === `/v2/collections/${C}/items` && r.method === 'POST') {
        const b = json(r);
        const id = `i${Object.keys(items).length + 1}`;
        items[id] = { id, isDraft: b.isDraft, lastPublished: null, fieldData: b.fieldData };
        return { status: 202, body: items[id] };
      }
      if (r.path === `/v2/collections/${C}/items/publish`) {
        for (const id of json(r).itemIds as string[]) if (!items[id].isDraft) items[id].lastPublished = '2026-11-22';
        return { status: 202, body: {} };
      }
      const m = new RegExp(`^/v2/collections/${C}/items/(\\w+)(/live)?$`).exec(r.path);
      if (m && items[m[1]]) {
        if (r.method === 'PATCH') Object.assign(items[m[1]], json(r));
        if (r.method === 'DELETE' && m[2]) items[m[1]].lastPublished = null;
        if (r.method === 'DELETE' && !m[2]) delete items[m[1]];
        return { status: r.method === 'DELETE' ? 204 : 200, body: r.method === 'DELETE' ? '' : items[m[1]] };
      }
      return { status: 404, body: {} };
    });
  });
  const c = () => ctx(localHttp(fake.port), { siteId: 'b'.repeat(24), domain: 'site.test' }, { token: 'wf-token-123456789012345' });
  const opts = { webflowCollectionId: 'a'.repeat(24) };

  it('refuse une page statique et exige la collection', async () => {
    await expect(webflowPages.createDraft(c(), input, opts)).rejects.toThrow(/page statique/);
    await expect(webflowPages.createDraft(c(), { ...input, format: 'article' }, {})).rejects.toThrow(/collection CMS/);
  });

  it('élément brouillon dans le champ texte enrichi, publié, dépublié, supprimé', async () => {
    const r = await webflowPages.createDraft(c(), { ...input, format: 'article' }, opts);
    expect(items[r.id].isDraft).toBe(true);
    expect(items[r.id].fieldData['post-body']).toBe(input.html);
    expect(items[r.id].fieldData['post-summary']).toBe('Tarifs');
    expect(r.url).toBe('https://site.test/blog/nos-tarifs-a-lyon');
    await webflowPages.publish(c(), r, opts);
    expect((await webflowPages.read(c(), r, opts))?.status).toBe('published');
    await webflowPages.unpublish(c(), r, opts);
    expect((await webflowPages.read(c(), r, opts))?.status).toBe('draft');
    await webflowPages.remove(c(), r, opts);
    expect(await webflowPages.read(c(), r, opts)).toBeNull();
  });
});

describe('Wix Blog', () => {
  const drafts: Record<string, { id: string; status: string; title: string; memberId: string; richContent: unknown }> = {};
  let members: { id: string }[] = [];
  beforeAll(() => {
    fake.hosts.set('www.wixapis.com', (r) => {
      if (r.headers.authorization !== 'wix-key' || r.headers['wix-site-id'] !== 'site-1') return { status: 403, body: {} };
      if (r.path === '/members/v1/members') return { body: { members } };
      if (r.path === '/blog/v3/draft-posts' && r.method === 'POST') {
        const d = json(r).draftPost;
        const id = `d${Object.keys(drafts).length + 1}`;
        drafts[id] = { id, status: 'UNPUBLISHED', title: d.title, memberId: d.memberId, richContent: d.richContent };
        return { body: { draftPost: { ...drafts[id], url: { base: 'https://site.wix.test', path: `/post/${d.seoSlug}` } } } };
      }
      const m = /^\/blog\/v3\/draft-posts\/(\w+)(\/publish|\/unpublish)?$/.exec(r.path);
      if (m) {
        const d = drafts[m[1]];
        if (!d) return { status: 404, body: { details: {} } };
        if (m[2] === '/publish') d.status = 'PUBLISHED';
        if (m[2] === '/unpublish') d.status = 'UNPUBLISHED';
        if (r.method === 'DELETE') {
          delete drafts[m[1]];
          return { body: {} };
        }
        return { body: { draftPost: d } };
      }
      if (r.path.startsWith('/blog/v3/posts/slugs/')) return { status: 404, body: { details: { applicationError: { code: 'POST_NOT_FOUND' } } } };
      return { status: 404, body: {} };
    });
  });
  const c = () => ctx(localHttp(fake.port), { siteId: 'site-1' }, { apiKey: 'wix-key' });

  it('sans membre du site : refuse et ne crée JAMAIS de membre', async () => {
    members = [];
    await expect(wixPages.createDraft(c(), { ...input, format: 'article' }, {})).rejects.toThrow(/n’en crée pas/);
    expect(fake.log.some((l) => l.startsWith('POST www.wixapis.com/members'))).toBe(false);
  });

  it('brouillon Ricos (texte dans des PARAGRAPH), publié, retiré, mis à la corbeille', async () => {
    members = [{ id: 'm-1' }];
    expect(await wixPages.findBySlug(c(), 'article', input.slug, {})).toBeNull();
    const r = await wixPages.createDraft(c(), { ...input, format: 'article' }, {});
    expect(r).toMatchObject({ status: 'draft', url: 'https://site.wix.test/post/nos-tarifs-a-lyon' });
    const rc = drafts[r.id].richContent as { nodes: { type: string; nodes: { type: string }[] }[] };
    expect(rc.nodes.map((n) => n.type)).toEqual(['HEADING', 'BULLETED_LIST', 'PARAGRAPH']);
    expect(rc.nodes[1].nodes[0].type).toBe('LIST_ITEM');
    expect(drafts[r.id].memberId).toBe('m-1');
    await wixPages.publish(c(), r, {});
    expect((await wixPages.read(c(), r, {}))?.status).toBe('published');
    await wixPages.unpublish(c(), r, {});
    expect((await wixPages.read(c(), r, {}))?.status).toBe('draft');
    await wixPages.remove(c(), r, {});
    expect(await wixPages.read(c(), r, {})).toBeNull();
  });

  it('Ricos : liens en décoration LINK', () => {
    const d = blocksToRicos([{ type: 'p', text: 'Voir [contact](/contact).' }]);
    expect(JSON.stringify(d)).toContain('"LINK"');
  });
});

describe('PrestaShop (CMS)', () => {
  const cms: Record<string, { active: string; xml: string }> = {};
  beforeAll(() => {
    fake.hosts.set('shop.test', (r) => {
      if (!basicOk(r.headers, 'K'.repeat(32), '')) return { status: 401 };
      if (r.path === '/api/content_management_system' && r.method === 'POST') {
        const id = String(Object.keys(cms).length + 7);
        cms[id] = { active: /<active>1<\/active>/.test(r.body) ? '1' : '0', xml: r.body };
        return { status: 201, body: { content: { id } } };
      }
      if (r.path === '/api/content_management_system' && r.method === 'GET') return { body: { content_management_system: [] } };
      const m = /^\/api\/content_management_system\/(\d+)$/.exec(r.path);
      if (m && cms[m[1]]) {
        if (r.method === 'PATCH') cms[m[1]].active = /<active>1<\/active>/.test(r.body) ? '1' : '0';
        if (r.method === 'DELETE') {
          delete cms[m[1]];
          return { status: 200 };
        }
        return { body: { content: { id: m[1], active: cms[m[1]].active, link_rewrite: [{ id: '1', value: 'nos-tarifs-a-lyon' }], content: [{ id: '1', value: '<h2>Nos tarifs</h2>' }] } } };
      }
      return { status: 404 };
    });
  });
  const c = () => ctx(localHttp(fake.port), { siteUrl: 'https://shop.test', languageId: '1' }, { apiKey: 'K'.repeat(32) });

  it('page CMS désactivée en XML multilingue, activée, désactivée, supprimée', async () => {
    const r = await prestashopPages.createDraft(c(), input, {});
    expect(r).toMatchObject({ id: '7', status: 'draft' });
    expect(cms['7'].xml).toContain('<link_rewrite><language id="1"><![CDATA[nos-tarifs-a-lyon]]></language></link_rewrite>');
    expect(cms['7'].active).toBe('0');
    await prestashopPages.publish(c(), r, {});
    expect((await prestashopPages.read(c(), r, {}))?.status).toBe('published');
    await prestashopPages.unpublish(c(), r, {});
    expect((await prestashopPages.read(c(), r, {}))?.status).toBe('draft');
    await prestashopPages.remove(c(), r, {});
    expect(await prestashopPages.read(c(), r, {})).toBeNull();
    await expect(prestashopPages.createDraft(c(), { ...input, format: 'article' }, {})).rejects.toThrow(/blog natif/);
  });
});

describe('export', () => {
  it('page HTML complète, Markdown, JSON-LD et marche à suivre', () => {
    const b = buildPageExport(input, 'wix', new Date('2026-11-22T10:00:00Z'));
    const files = readZip(b.zip);
    expect(files.map((f) => f.name)).toEqual(['page.html', 'page.md', 'jsonld.json', 'LISEZ-MOI.txt']);
    expect(files[0].content).toContain('<title>Nos tarifs à Lyon | Plomberie Martin</title>');
    expect(files[0].content).toContain('application/ld+json');
    expect(files[1].content).toContain('## Nos tarifs');
    expect(files[3].content).toContain('Pages et menu');
  });
});
