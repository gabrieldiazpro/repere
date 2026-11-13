import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimit } from '@/lib/ratelimit';
import { setFetchDeps } from '../fetch';
import { GOOD_PAGE, PRODUCT_FULL, ROBOTS_OPEN, SITEMAP, fakeNet } from './fixtures';
import { POST as robots } from '@/app/api/tools/robots/route';
import { POST as readiness } from '@/app/api/tools/readiness/route';
import { POST as citability } from '@/app/api/tools/citability/route';
import { POST as jsonldValidate } from '@/app/api/tools/jsonld/validate/route';
import { POST as jsonldGenerate } from '@/app/api/tools/jsonld/generate/route';
import { POST as llms } from '@/app/api/tools/llms/route';
import { POST as product } from '@/app/api/tools/product/route';
import { POST as compare } from '@/app/api/tools/compare/route';
import { POST as reviewLink } from '@/app/api/tools/review-link/route';

const SITE = 'https://plomberie-exemple.fr';
const net = fakeNet({
  [`${SITE}/`]: { body: GOOD_PAGE },
  [`${SITE}/robots.txt`]: { body: ROBOTS_OPEN, headers: { 'content-type': 'text/plain' } },
  [`${SITE}/sitemap.xml`]: { body: SITEMAP, headers: { 'content-type': 'application/xml' } },
  [`${SITE}/produit`]: { body: PRODUCT_FULL },
});
let restore: () => void;
beforeAll(() => {
  restore = setFetchDeps({ resolver: net.resolver, transport: net.transport });
});
afterAll(() => restore());
beforeEach(() => resetRateLimit());

let ip = 0;
const post = (body: unknown, fixedIp?: string) =>
  new Request('http://localhost/api/tools/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': fixedIp ?? `203.0.114.${++ip % 250}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const json = async (r: Response) => ({ status: r.status, body: (await r.json()) as { ok: boolean; data?: Record<string, unknown>; error?: string; code?: string } });

describe('routes /api/tools/*', () => {
  it('robots, readiness, citability, product, llms, compare renvoient { ok, data }', async () => {
    const a = await json(await robots(post({ url: SITE })));
    expect(a.status).toBe(200);
    expect(a.body.ok).toBe(true);
    expect(Array.isArray(a.body.data!.bots)).toBe(true);
    const b = await json(await readiness(post({ url: SITE })));
    expect(b.body.data!.score).toBeTypeOf('number');
    const c = await json(await citability(post({ html: GOOD_PAGE })));
    expect(c.body.data!.total).toBe(20);
    const d = await json(await product(post({ url: `${SITE}/produit` })));
    expect(d.body.data!.score).toBeTypeOf('number');
    const e = await json(await llms(post({ url: SITE })));
    expect(String(e.body.data!.llmsTxt)).toContain('# ');
    const f = await json(await compare(post({ url: SITE, competitorUrl: SITE })));
    expect(Array.isArray(f.body.data!.rows)).toBe(true);
  });
  it('JSON-LD : validation d’un bloc collé et génération', async () => {
    const v = await json(await jsonldValidate(post({ jsonld: { '@context': 'https://schema.org', '@type': 'Organization', name: 'A' } })));
    expect(v.body.ok).toBe(true);
    expect((v.body.data!.errors as string[]).join(' ')).toMatch(/url/);
    const g = await json(await jsonldGenerate(post({ type: 'LocalBusiness', fields: { name: 'Plomberie Exemple', trade: 'plombier', address: '12 rue Exemple, 69003 Lyon' } })));
    expect(String(g.body.data!.script)).toContain('Plumber');
  });
  it('lien d’avis', async () => {
    const r = await json(await reviewLink(post({ placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', name: 'Plomberie Exemple' })));
    expect(r.body.data!.reviewUrl).toContain('placeid=ChIJ');
  });
  it('erreurs : JSON invalide, schéma, adresse interne (anti-SSRF)', async () => {
    expect((await json(await readiness(post('pas du json')))).status).toBe(400);
    expect((await json(await citability(post({ url: SITE, html: '<p>x</p>' })))).status).toBe(400);
    expect((await json(await reviewLink(post({ name: 'Seul' })))).status).toBe(400);
    const s = await json(await readiness(post({ url: 'http://169.254.169.254/latest/meta-data/' })));
    expect(s.status).toBe(400);
    expect(s.body.ok).toBe(false);
    expect(s.body.code).toBe('blocked_ip');
  });
  it('limite par IP : 429 au-delà du quota', async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await compare(post({ url: SITE, competitorUrl: SITE }, '198.51.100.7'))).status;
    expect(last).toBe(429);
  });
});

describe('audits rattachés à un commerce', () => {
  it('compte démo : audit exécuté, jamais enregistré', async () => {
    const { runSiteAudit, listRuns } = await import('../runs');
    const run = await runSiteAudit('demo', SITE);
    expect(run.demo).toBe(true);
    expect(run.readiness?.score).toBeTypeOf('number');
    expect(run.citability?.total).toBe(20);
    expect(await listRuns('demo')).toEqual([]);
  });
  it('tâche de fond : point d’entrée attendu par src/lib/jobs/handlers.ts', async () => {
    const mod = await import('../robotsAudit');
    const out = await mod.runSiteAuditJob({ businessId: 'demo-pme', url: SITE, kind: 'readiness' });
    expect(out.readiness).toBeTypeOf('number');
  });
});
