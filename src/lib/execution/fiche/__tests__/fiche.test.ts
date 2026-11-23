import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-fiche-'));
process.env.CRON_SECRET = 'fiche-cron';
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];

import {
  EMBED_MAX_BYTES,
  applyPatch,
  buildDemoFiche,
  buildOfficialJsonLd,
  checkConsistency,
  confirmFiche,
  embedData,
  embedScript,
  embedStaticSnippet,
  extractSiteFacts,
  ficheLlmsTxt,
  ficheMarkdown,
  migrateFromLegacy,
  parseCredentials,
  parseServices,
  publicView,
  readSite,
  reminderDue,
  sanitizePatch,
  syncFromLegacy,
  FicheError,
  type LegacySources,
  type OfficialFiche,
} from '@/lib/execution/fiche';

const NOW = new Date('2026-11-23T10:00:00Z');
const B = 'http://localhost:3000';
const ACTOR = { id: 'u1', email: 'a@exemple.fr' };

function legacy(over: Partial<LegacySources> = {}): LegacySources {
  return {
    businessId: 'b1',
    business: { name: 'Serrurerie Dupont', website: 'serrurerie-dupont.fr', trade: 'serrurier' },
    verite: { facts: { telephone: '01 23 45 67 89', adresse: '3 rue Lepic, 75018 Paris', horaires: 'Lun-ven 8h-19h', services: 'ouverture de porte, blindage', certifications: 'Qualibat (Qualibat) n° E-1234' }, updatedAt: '2026-10-01T00:00:00.000Z' },
    contenu: { facts: { activite: 'Serrurier à Paris 18e', services: 'Ouverture de porte : à partir de 89 € TTC\nBlindage', garanties: 'Garantie 2 ans', paiement: 'Carte, espèces' }, updatedAt: '2026-10-05T00:00:00.000Z' },
    settings: { sameAs: ['https://www.facebook.com/serrurerie-dupont'], updatedAt: '2026-09-01T00:00:00.000Z' },
    ...over,
  };
}

describe('modèle de faits unifié', () => {
  it('migre les anciennes fiches sans perte, avec source, date et statut', () => {
    const f = migrateFromLegacy(legacy(), NOW.toISOString());
    expect(f.text.telephone).toMatchObject({ value: '01 23 45 67 89', source: 'client', verified: false, from: 'facts.brand', at: '2026-10-01T00:00:00.000Z' });
    expect(f.text.activite?.from).toBe('content.facts');
    expect(f.text.nom?.value).toBe('Serrurerie Dupont');
    expect(f.text.site?.value).toBe('serrurerie-dupont.fr');
    // les faits clés priment sur la fiche Vérité (règle V8)
    expect(f.services?.value[0]).toEqual({ name: 'Ouverture de porte', priceFrom: 89, unit: 'TTC' });
    expect(f.certifications?.value[0]).toMatchObject({ name: 'Qualibat', issuer: 'Qualibat', number: 'E-1234' });
    expect(f.sameAs?.value).toEqual(['https://www.facebook.com/serrurerie-dupont']);
    expect(f.migratedFrom).toEqual(['facts.brand', 'content.facts', 'exec.settings']);
    expect(f.publication.indexable).toBe(false);
  });

  it('reprend une modification plus récente faite dans Vérité, sans ressusciter un fait effacé', () => {
    const f = migrateFromLegacy(legacy(), '2026-11-01T00:00:00.000Z');
    const saved = applyPatch(f, { text: { garanties: '' } }, ACTOR, '2026-11-10T00:00:00.000Z');
    expect(saved.text.garanties).toBeUndefined();
    const later = legacy({ verite: { ...legacy().verite!, facts: { ...legacy().verite!.facts, telephone: '01 99 99 99 99' }, updatedAt: '2026-11-15T00:00:00.000Z' } });
    const { fiche, changed } = syncFromLegacy(saved, later);
    expect(changed).toContain('telephone');
    expect(fiche.text.telephone).toMatchObject({ value: '01 99 99 99 99', verified: false });
    expect(fiche.text.garanties).toBeUndefined();
  });

  it('valide la saisie champ par champ', () => {
    expect(() => sanitizePatch({ text: { telephone: 'abc', inconnu: 'x' }, sameAs: ['http://non-https.fr'], certifications: [{ name: 'RGE', verifyUrl: 'javascript:alert(1)' }] })).toThrow(FicheError);
    try {
      sanitizePatch({ text: { telephone: 'abc' }, exceptions: [{ from: '2026-12-31', to: '2026-12-01' }] });
    } catch (e) {
      expect((e as FicheError).errors).toMatchObject({ telephone: expect.any(String), 'exceptions.0': expect.any(String) });
    }
    const ok = sanitizePatch({ text: { telephone: '01 23 45 67 89' }, services: [{ name: 'Pose', priceFrom: '120,5', unit: 'TTC' }], exceptions: [{ from: '2026-12-25', closed: true, label: 'Noël' }] });
    expect(ok.services).toEqual([{ name: 'Pose', priceFrom: 120.5, unit: 'TTC' }]);
  });

  it('confirmation : tout devient vérifié ; la vue publique écarte ce qui est seulement lu sur le site', () => {
    let f = migrateFromLegacy(legacy(), NOW.toISOString());
    f = { ...f, text: { ...f.text, email: { value: 'contact@dupont.fr', source: 'site', at: NOW.toISOString(), verified: false } } };
    expect(publicView(f, NOW).text.email).toBeUndefined();
    const c = confirmFiche(f, ACTOR, NOW.toISOString());
    expect(c.confirmedAt).toBe(NOW.toISOString());
    expect(Object.values(c.text).every((x) => x?.verified)).toBe(true);
    expect(publicView(c, NOW).text.email).toBe('contact@dupont.fr');
  });

  it('parse services et labels', () => {
    expect(parseServices('Débouchage, recherche de fuite')).toEqual([{ name: 'Débouchage' }, { name: 'Recherche de fuite' }]);
    expect(parseServices('Diagnostic : dès 1 200 € HT')[0]).toEqual({ name: 'Diagnostic', priceFrom: 1200, unit: 'HT' });
    expect(parseCredentials('RGE n° 123 ; vegan')).toEqual([{ name: 'RGE', number: '123' }, { name: 'vegan' }]);
  });

  it('rappel : dû si jamais confirmée ou après 90 jours', () => {
    const f = migrateFromLegacy(legacy(), NOW.toISOString());
    expect(reminderDue(f, NOW)).toBe(true);
    const c = confirmFiche(f, ACTOR, '2026-10-01T00:00:00.000Z');
    expect(reminderDue(c, NOW)).toBe(false);
    expect(reminderDue(c, new Date('2027-01-05T00:00:00Z'))).toBe(true);
  });
});

describe('JSON-LD, Markdown, llms.txt', () => {
  const real = () => {
    let f = migrateFromLegacy(legacy(), NOW.toISOString());
    f = applyPatch(f, { text: { langues: 'Français, anglais', email: 'contact@dupont.fr' }, exceptions: [{ from: '2026-12-25', closed: true, label: 'Noël' }], certifications: [{ name: 'Qualibat', number: 'E-1234', verifyUrl: 'https://www.qualibat.com/verif/E-1234' }] }, ACTOR, NOW.toISOString());
    return confirmFiche(f, ACTOR, NOW.toISOString());
  };

  it('vraie entreprise : JSON-LD exact et complet', () => {
    const view = publicView(real(), NOW);
    const ld = buildOfficialJsonLd({ fiche: view, business: { id: 'b1', name: 'Serrurerie Dupont', trade: 'serrurier', city: 'Paris' }, segment: 'local', pageUrl: 'https://repere-ia.fr/p/dupont', demo: false })!;
    const [org, page] = ld['@graph'] as Record<string, unknown>[];
    expect(org['@type']).toBe('Locksmith');
    expect(org).toMatchObject({ name: 'Serrurerie Dupont', telephone: '01 23 45 67 89', email: 'contact@dupont.fr', url: 'https://serrurerie-dupont.fr', knowsLanguage: ['fr', 'en'], sameAs: ['https://www.facebook.com/serrurerie-dupont'], paymentAccepted: 'Carte, espèces' });
    expect(org.address).toMatchObject({ postalCode: '75018', addressLocality: 'Paris' });
    expect((org.openingHoursSpecification as unknown[]).length).toBe(1);
    expect(org.specialOpeningHoursSpecification).toEqual([{ '@type': 'OpeningHoursSpecification', validFrom: '2026-12-25', validThrough: '2026-12-25', opens: '00:00', closes: '00:00' }]);
    const offers = (org.hasOfferCatalog as { itemListElement: Record<string, unknown>[] }).itemListElement;
    expect(offers[0]).toMatchObject({ '@type': 'Offer', priceSpecification: { minPrice: 89, priceCurrency: 'EUR' } });
    expect(org.hasCredential).toEqual([{ '@type': 'EducationalOccupationalCredential', name: 'Qualibat', identifier: 'E-1234', url: 'https://www.qualibat.com/verif/E-1234' }]);
    expect(page).toMatchObject({ '@type': 'ProfilePage', lastReviewed: NOW.toISOString() });
  });

  it('aucune démo n’émet de JSON-LD (fonction, page, encart, export)', async () => {
    for (const id of ['demo', 'demo-pme', 'demo-ecom']) {
      const f = buildDemoFiche(id, NOW)!;
      expect(f.demo).toBe(true);
      expect(buildOfficialJsonLd({ fiche: publicView(f, NOW), business: { id, name: 'x', trade: 'plombier' }, segment: 'local', pageUrl: 'https://x/p/x', demo: false })).toBeNull();
      const { loadPublicFicheByBusiness } = await import('@/lib/execution/fiche');
      const p = (await loadPublicFicheByBusiness(id, NOW))!;
      expect(p.jsonld).toBeNull();
      expect(p.clientJsonLd).toBeNull();
      expect(p.indexable).toBe(false);
      const Page = (await import('@/app/p/[slug]/page')).default;
      const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: p.ctx.settings.slug }) }));
      expect(html).not.toContain('application/ld+json');
      expect(html).toContain('Exemple de démonstration');
      const { generateMetadata } = await import('@/app/p/[slug]/page');
      expect((await generateMetadata({ params: Promise.resolve({ slug: p.ctx.settings.slug }) })).robots).toMatchObject({ index: false });
      const js = await (await import('@/app/encart/[slug]/e.js/route')).GET(new Request(`${B}/encart/x/e.js`), { params: Promise.resolve({ slug: p.ctx.settings.slug }) });
      expect(await js.text()).not.toContain('ld+json"');
      const md = await (await import('@/app/p/[slug]/fiche.md/route')).GET(new Request(`${B}/p/x.md`), { params: Promise.resolve({ slug: p.ctx.settings.slug }) });
      expect(md.headers.get('x-robots-tag')).toBe('noindex');
      expect(await md.text()).toContain('Données de démonstration');
    }
  });

  it('Markdown et llms.txt reprennent les seuls faits publiés', () => {
    const view = publicView(real(), NOW);
    const md = ficheMarkdown({ fiche: view, name: 'Serrurerie Dupont', pageUrl: 'https://repere-ia.fr/p/dupont', activity: 'serrurier', demo: false });
    expect(md).toMatch(/^# Serrurerie Dupont/);
    expect(md).toContain('Informations vérifiées par l’entreprise le 23 novembre 2026');
    expect(md).toContain('- Ouverture de porte : à partir de 89 € TTC');
    expect(md).toContain('vérifier : https://www.qualibat.com/verif/E-1234');
    expect(md).toContain('Noël : fermé le 25 décembre 2026');
    const llms = ficheLlmsTxt({ fiche: view, name: 'Serrurerie Dupont', pageUrl: 'https://repere-ia.fr/p/dupont', activity: 'serrurier', demo: false });
    expect(llms).toContain('[Fiche officielle (Markdown)](https://repere-ia.fr/p/dupont.md)');
  });
});

describe('encart', () => {
  it('script < 5 Ko, sans cookie, sans stockage, sans requête, textContent seulement', () => {
    const f = confirmFiche(
      applyPatch(migrateFromLegacy(legacy(), NOW.toISOString()), { services: Array.from({ length: 30 }, (_, i) => ({ name: `Service numéro ${i} avec un nom assez long pour tester`, priceFrom: 1000 + i, unit: 'TTC par intervention' })), text: { horaires: 'Lundi au vendredi de 8 h à 19 h, samedi de 9 h à 13 h, urgences 7 j/7 et 24 h/24 sur Paris et petite couronne' } }, ACTOR, NOW.toISOString()),
      ACTOR,
      NOW.toISOString(),
    );
    const view = publicView(f, NOW);
    const ld = buildOfficialJsonLd({ fiche: view, business: { id: 'b1', name: 'Serrurerie Dupont', trade: 'serrurier' }, segment: 'local', pageUrl: 'https://repere-ia.fr/p/dupont', demo: false });
    const js = embedScript(embedData(view, 'Serrurerie Dupont', 'https://repere-ia.fr/p/dupont'), null);
    expect(Buffer.byteLength(js)).toBeLessThan(EMBED_MAX_BYTES);
    for (const bad of ['cookie', 'localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'innerHTML', 'sendBeacon', 'import(']) expect(js).not.toContain(bad);
    expect(() => new Function(js)).not.toThrow();
    const withLd = embedScript(embedData(view, 'Serrurerie Dupont', 'https://repere-ia.fr/p/dupont'), (ld as Record<string, unknown>));
    expect(withLd).toContain('application/ld+json');
    const html = embedStaticSnippet(embedData(view, '<script>x</script>', 'https://repere-ia.fr/p/dupont'), null);
    expect(html).toContain('Faits vérifiés');
    expect(html).not.toContain('application/ld+json');
  });

  it('le script s’exécute dans un DOM minimal et n’écrit que du texte', () => {
    const view = publicView(buildDemoFiche('demo', NOW)!, NOW);
    const js = embedScript(embedData(view, 'Plomberie Martin', 'https://repere-ia.fr/p/plomberie-martin'), null);
    const created: { tag: string; text?: string | null }[] = [];
    const el = (tag: string): Record<string, unknown> => {
      const n: Record<string, unknown> = { tag, children: [] as unknown[], setAttribute() {}, appendChild(c: unknown) { (n.children as unknown[]).push(c); return c; }, attachShadow() { return el('#shadow'); }, parentNode: null };
      Object.defineProperty(n, 'textContent', { set(v) { created.push({ tag, text: v }); }, get() { return ''; } });
      return n;
    };
    const parent = { insertBefore: () => undefined };
    const document = { currentScript: { parentNode: parent }, createElement: el, querySelector: () => null, head: el('head') };
    new Function('document', js)(document);
    expect(created.some((c) => c.text === 'Plomberie Martin')).toBe(true);
    expect(created.some((c) => /démo/.test(String(c.text)))).toBe(true);
  });
});

describe('cohérence site / fiche Google / IA', () => {
  it('signale les écarts et propose ce qui manque', () => {
    const f = migrateFromLegacy(legacy(), NOW.toISOString());
    const { alerts, suggestions } = checkConsistency({
      fiche: f,
      site: { url: 'https://serrurerie-dupont.fr', at: NOW.toISOString(), pages: [], errors: [], telephone: '01 23 45 67 00', email: 'contact@dupont.fr', sameAs: ['https://www.instagram.com/dupont'] },
      google: { at: NOW.toISOString(), phone: '01 23 45 67 89', address: '3 rue Lepic, 75018 Paris', hoursText: 'Lun-ven 9h-18h', name: 'Serrurerie Dupont' },
      ia: { checkedAt: NOW.toISOString(), items: [{ field: 'adresse', expected: '3 rue Lepic', stated: '15 rue de la République', provider: 'chatgpt', quote: '…', verdict: 'faux', severity: 'haute' }] },
    });
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain('site:telephone');
    expect(ids).toContain('google:horaires');
    expect(ids).toContain('ia:chatgpt:adresse');
    expect(ids).not.toContain('google:telephone');
    expect(ids).not.toContain('google:adresse');
    expect(alerts.find((a) => a.id === 'ia:chatgpt:adresse')?.whereLabel).toBe('ChatGPT');
    expect(suggestions).toContainEqual(expect.objectContaining({ key: 'email', value: 'contact@dupont.fr', source: 'site' }));
  });

  it('lit le site : JSON-LD, liens tel/mailto, profils', async () => {
    const home = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Locksmith","name":"Dupont","telephone":"01 23 45 67 89","address":{"@type":"PostalAddress","streetAddress":"3 rue Lepic","postalCode":"75018","addressLocality":"Paris"},"openingHoursSpecification":[{"dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"08:00","closes":"19:00"}]}</script></head><body><a href="/contact">Contact</a><a href="https://www.facebook.com/dupont">fb</a></body></html>`;
    const contact = `<html><body><a href="mailto:bonjour@dupont.fr">écrire</a></body></html>`;
    const obs = await readSite('dupont.fr', NOW, async (u) => ({ status: 200, contentType: 'text/html', finalUrl: u, body: u.endsWith('/contact') ? contact : home }));
    expect(obs).toMatchObject({ telephone: '01 23 45 67 89', email: 'bonjour@dupont.fr', adresse: '3 rue Lepic, 75018 Paris', horaires: 'lun–ven 8 h–19 h', sameAs: ['https://www.facebook.com/dupont'] });
    expect(obs.pages).toHaveLength(2);
    expect(extractSiteFacts([{ url: 'x', html: '<p>Tél. 04 78 00 00 00</p>' }]).telephone).toBe('0478000000');
  });
});

describe('service, routes et cloisonnement des espaces', () => {
  async function biz(name: string, ownerId: string | null = null) {
    const { createBusiness } = await import('@/lib/db');
    return createBusiness({ name, trade: 'plombier', city: 'Lyon', website: `${name.toLowerCase().replace(/\W+/g, '-')}.fr`, ownerId, plan: 'essentiel' } as Parameters<typeof createBusiness>[0]);
  }

  it('enregistre, recopie dans Vérité et les faits clés, et n’écrit jamais une démo', async () => {
    const { saveFiche, getFiche } = await import('@/lib/execution/fiche');
    const { getFacts } = await import('@/lib/facts');
    const content = await import('@/lib/content/service');
    const a = await biz('Plomberie Alpha');
    const { fiche } = await saveFiche(a.id, { text: { telephone: '04 78 11 22 33', adresse: '1 rue Neuve, 69002 Lyon', paiement: 'Carte' }, services: [{ name: 'Débouchage', priceFrom: 79, unit: 'TTC' }] }, ACTOR, NOW);
    expect(fiche.text.telephone).toMatchObject({ source: 'client', verified: true });
    expect((await getFacts(a.id)).facts).toMatchObject({ telephone: '04 78 11 22 33', adresse: '1 rue Neuve, 69002 Lyon', services: 'Débouchage' });
    expect((await content.getFacts(a.id))?.facts).toMatchObject({ paiement: 'Carte', services: 'Débouchage : à partir de 79 € TTC' });
    // relecture : aucune dérive après le miroir
    const again = (await getFiche(a.id, new Date(NOW.getTime() + 60_000)))!;
    expect(again.text.telephone?.verified).toBe(true);
    await expect(saveFiche('demo', { text: { telephone: '01 00 00 00 00' } }, ACTOR, NOW)).rejects.toMatchObject({ status: 403 });
  });

  it('aucune fuite entre deux espaces (fiche, page publique, API)', async () => {
    const { saveFiche, getFiche, loadPublicFicheByBusiness } = await import('@/lib/execution/fiche');
    const { putDoc } = await import('@/lib/store');
    const a = await biz('Atelier Un');
    const b = await biz('Atelier Deux');
    await saveFiche(a.id, { text: { telephone: '04 11 11 11 11', activite: 'Secret de A' } }, ACTOR, NOW);
    const fb = (await getFiche(b.id, NOW))!;
    expect(JSON.stringify(fb)).not.toContain('Secret de A');
    // document rangé sous l'id de B mais appartenant à A : ignoré
    await putDoc('fiche.official', 'faux-b', { ...(await getFiche(a.id, NOW)), businessId: a.id }, 'faux-b');
    const pb = (await loadPublicFicheByBusiness(b.id, NOW))!;
    expect(JSON.stringify(pb.view)).not.toContain('Secret de A');
    expect(pb.indexable).toBe(false);
    // espace d'un autre utilisateur : refusé sans session
    const c = await biz('Atelier Trois', 'user-autre');
    const route = await import('@/app/api/fiche/route');
    expect((await route.GET(new Request(`${B}/api/fiche?businessId=${c.id}`))).status).toBeGreaterThanOrEqual(401);
    const post = await route.POST(new Request(`${B}/api/fiche`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId: c.id, text: { telephone: '01 23 45 67 89' } }) }));
    expect([401, 403]).toContain(post.status);
    expect(JSON.stringify(await getFiche(c.id, NOW))).not.toContain('01 23 45 67 89');
  });

  it('opt-in d’indexation : noindex par défaut, index après activation, JSON-LD présent', async () => {
    const { saveFiche, setPublication, loadPublicFicheByBusiness } = await import('@/lib/execution/fiche');
    const a = await biz('Chauffage Gamma');
    await saveFiche(a.id, { text: { telephone: '04 78 22 33 44', horaires: 'Lun-ven 8h-18h' } }, ACTOR, NOW);
    let p = (await loadPublicFicheByBusiness(a.id, NOW))!;
    expect(p.indexable).toBe(false);
    expect(p.jsonld).not.toBeNull();
    const { generateMetadata, default: Page } = await import('@/app/p/[slug]/page');
    expect((await generateMetadata({ params: Promise.resolve({ slug: p.ctx.settings.slug }) })).robots).toMatchObject({ index: false });
    await setPublication(a.id, { indexable: true, embedJsonLd: true }, NOW);
    p = (await loadPublicFicheByBusiness(a.id, NOW))!;
    expect(p.indexable).toBe(true);
    expect(p.clientJsonLd).toMatchObject({ '@context': 'https://schema.org', name: 'Chauffage Gamma' });
    expect((await generateMetadata({ params: Promise.resolve({ slug: p.ctx.settings.slug }) })).robots).toMatchObject({ index: true });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: p.ctx.settings.slug }) }));
    expect(html).toContain('application/ld+json');
    expect(html).toContain('04 78 22 33 44');
    await expect(setPublication('demo', { indexable: true }, NOW)).rejects.toMatchObject({ status: 403 });
    const pub = await import('@/app/api/fiche/publication/route');
    expect((await pub.POST(new Request(`${B}/api/fiche/publication`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId: 'demo', indexable: true }) }))).status).toBe(403);
  });

  it('rappel tous les 90 jours dans le centre de notifications (dédoublonné), jamais pour une démo', async () => {
    const { saveFiche, checkFicheReminder, confirmOfficialFiche } = await import('@/lib/execution/fiche');
    const { listDocs } = await import('@/lib/store');
    const a = await biz('Vitrerie Delta');
    await saveFiche(a.id, { text: { telephone: '04 78 33 44 55' } }, ACTOR, NOW);
    expect(await checkFicheReminder(a.id, NOW)).toBe(true);
    await checkFicheReminder(a.id, NOW);
    const notes = (await listDocs<{ businessId: string; href: string }>('notify.items', { businessId: a.id })).map((d) => d.data);
    expect(notes.filter((n) => n.href === '/app/fiche')).toHaveLength(1);
    await confirmOfficialFiche(a.id, ACTOR, NOW);
    expect(await checkFicheReminder(a.id, new Date(NOW.getTime() + 30 * 86_400_000))).toBe(false);
    expect(await checkFicheReminder(a.id, new Date(NOW.getTime() + 91 * 86_400_000))).toBe(true);
    expect(await checkFicheReminder('demo', NOW)).toBe(false);
    const cron = await import('@/app/api/fiche/rappels/route');
    expect((await cron.GET(new Request(`${B}/api/fiche/rappels`))).status).toBe(401);
    expect((await cron.GET(new Request(`${B}/api/fiche/rappels`, { headers: { authorization: 'Bearer fiche-cron' } }))).status).toBe(200);
  });

  it('démo cohérente : mêmes faits que la fiche Vérité démo, étiquetée, données d’écran complètes', async () => {
    const { buildDemoWorkspaceById } = await import('@/lib/demo-v2');
    const { ficheScreenData } = await import('@/app/api/fiche/_shared');
    for (const id of ['demo', 'demo-pme', 'demo-ecom']) {
      const ws = buildDemoWorkspaceById(id)!;
      const f = buildDemoFiche(id, NOW) as OfficialFiche;
      if (ws.facts.facts.telephone) expect(f.text.telephone?.value).toBe(ws.facts.facts.telephone);
      expect(f.text.adresse?.value).toBe(ws.facts.facts.adresse);
      const d = (await ficheScreenData(id, NOW))!;
      expect(d.embed.html).toContain('démo');
      expect(d.embed.html).not.toContain('ld+json');
      expect(d.hasJsonLd).toBe(false);
    }
    const local = (await ficheScreenData('demo', NOW))!;
    expect(local.alerts.some((a) => a.where === 'ia')).toBe(true);
  });
});
