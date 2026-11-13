/** Unitaires : rédaction (IA + repli + anti-invention), client HTTP sûr, ZIP, modèle, robots, journal concurrent. */
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appendJournal, readJournal, verifyJournal } from '../journal';
import { createSafeHttp, normalizeSiteUrl } from '../http';
import { allowBotsInRobots, blocksEverything, inferKind } from '../planner';
import { computeAfter, statusAfterApply } from '../model';
import { createAiWriter, filenameWords, rulesWriter, unsupportedFacts, writeText, type WriteTask } from '../writer';
import { buildZip, crc32, readZip } from '../zip';
import type { Change } from '../types';
import { isolateStore } from './helpers';

isolateStore('units');

const task: WriteTask = { kind: 'meta.title', sourceText: 'Boulangerie Dupain à Nantes : pain au levain, viennoiseries. Ouvert du mardi au dimanche.', h1: 'Boulangerie artisanale à Nantes', siteName: 'Boulangerie Dupain', city: 'Nantes' };

describe('rédaction', () => {
  it('garde-fou : nombres et noms propres absents de la source refusés', () => {
    expect(unsupportedFacts('Boulangerie Dupain à Nantes, depuis 1987', task.sourceText)).toEqual(['1987']);
    expect(unsupportedFacts('Meilleure boulangerie de Paris', task.sourceText)).toEqual(['Meilleure', 'Paris']);
    expect(unsupportedFacts('Le pain au levain de Boulangerie Dupain', task.sourceText)).toEqual([]);
  });

  it('IA qui invente → repli déterministe ; IA en panne → repli ; IA sûre → texte IA', async () => {
    const lying = createAiWriter({ vendor: 'openai', model: 'x', costPerCallEur: 0, completeJson: async () => JSON.stringify({ text: 'Boulangerie Dupain, n°1 à Nantes depuis 1950' }) });
    expect(await writeText(task, lying)).toEqual({ value: 'Boulangerie artisanale à Nantes | Boulangerie Dupain', by: 'rules' });
    const broken = createAiWriter({ vendor: 'openai', model: 'x', costPerCallEur: 0, completeJson: async () => { throw new Error('quota'); } });
    expect((await writeText(task, broken))?.by).toBe('rules');
    const good = createAiWriter({ vendor: 'openai', model: 'x', costPerCallEur: 0, completeJson: async () => JSON.stringify({ text: 'Pain au levain à Nantes | Boulangerie Dupain' }) });
    expect(await writeText(task, good)).toEqual({ value: 'Pain au levain à Nantes | Boulangerie Dupain', by: 'ai' });
  });

  it('règles : description depuis les phrases de la page ; alt seulement si le nom de fichier est parlant', async () => {
    expect(await rulesWriter.write({ ...task, kind: 'meta.description' })).toBe('Boulangerie Dupain à Nantes : pain au levain, viennoiseries. Ouvert du mardi au dimanche.');
    expect(filenameWords('/wp-content/uploads/pain-au-levain-1024x768.jpg')).toEqual(['pain', 'au', 'levain']);
    expect(await rulesWriter.write({ ...task, kind: 'image.alt', imageSrc: '/IMG_2034.jpg' })).toBeNull();
    expect(await rulesWriter.write({ ...task, kind: 'rewrite', passage: 'x' })).toBeNull();
    expect(await writeText({ ...task, kind: 'meta.description', sourceText: 'Trop court.' }, rulesWriter)).toBeNull();
  });
});

describe('client HTTP des connecteurs (anti-SSRF)', () => {
  let server: http.Server;
  let port = 0;
  beforeAll(async () => {
    server = http.createServer((_q, r) => r.end('ok'));
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

  it('refuse http, identifiants dans l’URL, ports non standard, hôtes internes et IP privées', async () => {
    const c = createSafeHttp({ resolver: async () => [{ address: '10.0.0.5', family: 4 }] });
    await expect(c({ method: 'GET', url: `http://127.0.0.1:${port}/` })).rejects.toMatchObject({ status: 400 });
    await expect(c({ method: 'GET', url: 'https://user:pw@site.fr/' })).rejects.toMatchObject({ status: 400 });
    await expect(c({ method: 'GET', url: 'https://site.fr:8443/' })).rejects.toMatchObject({ status: 400 });
    await expect(c({ method: 'GET', url: 'https://localhost/' })).rejects.toMatchObject({ status: 400 });
    await expect(c({ method: 'GET', url: 'https://127.0.0.1/' })).rejects.toMatchObject({ status: 400 });
    await expect(c({ method: 'GET', url: 'https://site-interne.fr/' })).rejects.toMatchObject({ status: 400, message: /injoignable ou refusée/ });
    expect(() => normalizeSiteUrl('http://exemple.fr')).toThrow(/https/);
    expect(normalizeSiteUrl('exemple.fr/blog/')).toBe('https://exemple.fr/blog');
  });
});

describe('modèle', () => {
  it('computeAfter : set, append idempotent, replace unique / ambigu / déjà fait / toutes occurrences', () => {
    expect(computeAfter('a', { op: 'set', value: 'b' })).toBe('b');
    expect(computeAfter('a', { op: 'append', value: 'X' })).toBe('a\n\nX');
    expect(computeAfter('a\n\nX', { op: 'append', value: 'X' })).toBe('a\n\nX');
    expect(computeAfter('un deux', { op: 'replace', find: 'deux', value: 'trois' })).toBe('un trois');
    expect(computeAfter('un trois', { op: 'replace', find: 'deux', value: 'trois' })).toBe('un trois');
    expect(() => computeAfter('deux deux', { op: 'replace', find: 'deux', value: 'x' })).toThrow(/plusieurs fois/);
    expect(() => computeAfter('rien', { op: 'replace', find: 'deux', value: 'x' })).toThrow(/pas été trouvé/);
    expect(computeAfter('a b a', { op: 'replace', find: 'a', value: 'c', all: true })).toBe('c b c');
  });
  it('statut après application', () => {
    const c = (status: Change['status']) => ({ status }) as Change;
    expect(statusAfterApply([c('verified'), c('verified')])).toBe('verified');
    expect(statusAfterApply([c('verified'), c('applied')])).toBe('applied');
    expect(statusAfterApply([c('verified'), c('failed')])).toBe('partially_applied');
    expect(statusAfterApply([c('failed')])).toBe('failed');
  });
});

describe('robots.txt et constats', () => {
  it('autorise un robot IA sans toucher aux autres groupes', () => {
    const before = '# en-tête\nUser-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n';
    expect(allowBotsInRobots(before, ['GPTBot'])).toBe('# en-tête\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n\nUser-agent: GPTBot\nAllow: /\n');
    expect(allowBotsInRobots(null, ['ClaudeBot'])).toBe('User-agent: ClaudeBot\nAllow: /\n');
    expect(blocksEverything('User-agent: *\nDisallow: /\n')).toBe(true);
    expect(blocksEverything('User-agent: *\nDisallow: /admin\n')).toBe(false);
  });
  it('déduction du type depuis l’identifiant', () => {
    expect(inferKind({ id: 'seo.title.missing' })).toBe('meta.title');
    expect(inferKind({ id: 'seo.og.title' })).toBeNull();
    expect(inferKind({ id: 'seo.meta_description.duplicate' })).toBe('meta.description');
    expect(inferKind({ id: 'seo.images.alt_missing' })).toBe('image.alt');
    expect(inferKind({ id: 'seo.perf.lcp' })).toBeNull();
  });
});

describe('ZIP et journal', () => {
  it('ZIP lisible (CRC32 de référence)', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    const z = buildZip([{ name: 'a.txt', content: 'é' }, { name: '../b.txt', content: 'x' }]);
    expect(readZip(z)).toEqual([{ name: 'a.txt', content: 'é' }, { name: './b.txt', content: 'x' }]);
  });
  it('ajouts concurrents : séquence continue, chaîne valide', async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => appendJournal('b-j', 'cs_concurrent', { id: 'u' }, 'edited', { detail: String(i) })));
    const j = await readJournal('b-j', 'cs_concurrent');
    expect(j.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(verifyJournal(j).ok).toBe(true);
    expect(await readJournal('autre-espace', 'cs_concurrent')).toEqual([]);
  });
});
