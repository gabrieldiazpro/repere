/** Agent de contenu : détection, modèles, garde-fous anti-invention, contrôles, quota, mentions, effet (purs). */
import { describe, expect, it } from 'vitest';
import type { MentionResult, QuerySpec } from '@/lib/engine/types';
import type { DomainStat } from '@/lib/engine/types-v2';
import { acceptRewrite, buildDraft, finalizeDraft, type ContentWriter } from '../draft';
import { detectOpportunities, guessPageType } from '../detect';
import { compareEffect, refreshEffect, snapshot, startEffect } from '../effect';
import { mergeFacts, sanitizeFacts } from '../facts';
import { bodyToHtml, parseBody, slugify, todosOf } from '../markdown';
import { mentionTargets } from '../mentions';
import { MONTHLY_QUOTA, quotaView } from '../quota';
import { buildJsonLd, cannibalization, citabilityOf, faqPairs } from '../checks';
import type { ContentDraft, ContentOpportunity } from '../types';

const NOW = new Date('2026-11-22T10:00:00Z');
const q = (id: string, text: string, extra: Partial<QuerySpec> = {}): QuerySpec => ({ id, text, intent: 'reco' as QuerySpec['intent'], ...extra });
const m = (queryId: string, mentioned: boolean, competitors: string[], run = 0): MentionResult => ({ provider: 'chatgpt', queryId, run, mentioned, rank: null, competitors });

const pages = [
  { url: 'https://plomberie.test/', title: 'Plomberie Martin – Lyon', words: 400, indexable: true, depth: 0 },
  { url: 'https://plomberie.test/contact/', title: 'Contact', words: 60, indexable: true, depth: 1 },
  { url: 'https://plomberie.test/chauffe-eau/', title: 'Remplacement de chauffe-eau à Lyon', words: 120, indexable: true, depth: 1 },
  { url: 'https://plomberie.test/mentions-legales/', title: 'Mentions légales', words: 80, indexable: true, depth: 1 },
];

const facts = mergeFacts(
  { activite: 'Plombier chauffagiste', services: 'Recherche de fuite\nRemplacement de chauffe-eau', zone: 'Lyon 3e et Villeurbanne', telephone: '04 78 00 00 00', prix: 'Déplacement : 49 € TTC', delais: 'Intervention sous 48 h' },
  { horaires: 'Lun–ven 8 h–19 h', adresse: '12 rue Paul Bert, 69003 Lyon' },
);

describe('détection des pages manquantes', () => {
  const audit = {
    measuredAt: '2026-11-20T08:00:00Z',
    queries: [q('q1', 'Combien coûte un plombier à Lyon ?'), q('q2', 'Plombier urgence Lyon 3'), q('q3', 'Plomberie Martin avis', { kind: 'brand' })],
    mentions: [m('q1', false, ['Durand Plomberie']), m('q1', false, ['Durand Plomberie'], 1), m('q2', true, ['Durand Plomberie']), m('q3', false, ['X'])],
  };

  it('propose une page quand les IA citent un concurrent et pas le client, avec la preuve', () => {
    const ops = detectOpportunities({ businessName: 'Plomberie Martin', segment: 'local', city: 'Lyon', audit, pages });
    const tarifs = ops.find((o) => o.pageType === 'tarifs')!;
    expect(tarifs).toBeTruthy();
    expect(tarifs.evidence.some((e) => e.source === 'questions_ia' && e.text.includes('Durand Plomberie') && e.text.includes('2 réponses'))).toBe(true);
    expect(tarifs.questionIds).toContain('q1');
    // q2 : le client est cité → pas de proposition IA ; q3 : question de marque ignorée
    expect(ops.some((o) => o.questionIds.includes('q2') || o.questionIds.includes('q3'))).toBe(false);
  });

  it('sans aucune donnée, ne propose rien', () => {
    expect(detectOpportunities({ businessName: 'X', segment: 'local', pages: [] })).toEqual([]);
  });

  it('Search Console : impressions sans page dédiée ; requête de marque ignorée', () => {
    const ops = detectOpportunities({
      businessName: 'Plomberie Martin',
      segment: 'pme',
      gsc: { updatedAt: '2026-11-21', topQueries: [{ key: 'détartrage ballon eau chaude', impressions: 320, clicks: 3, position: 14.2 }, { key: 'plomberie martin', impressions: 900, clicks: 200, position: 1 }, { key: 'remplacement chauffe-eau lyon', impressions: 200, clicks: 5, position: 9 }] },
      pages,
    });
    const gsc = ops.filter((o) => o.evidence.some((e) => e.source === 'search_console'));
    expect(gsc.map((o) => o.target)).toEqual(['détartrage ballon eau chaude']);
    expect(gsc[0].evidence[0].text).toContain('320 impressions');
  });

  it('constats GEO : pages types absentes et pages trop minces (hors mentions légales / contact)', () => {
    const ops = detectOpportunities({ businessName: 'Plomberie Martin', segment: 'local', pages, geo: { findingIds: ['geo.entite.no_about'], fanOut: [] }, crawledAt: '2026-11-19T00:00:00Z' });
    expect(ops.find((o) => o.pageType === 'faq')?.evidence[0].text).toMatch(/Aucune page de questions fréquentes parmi les 4 pages explorées/);
    expect(ops.find((o) => o.pageType === 'a-propos')?.evidence.length).toBe(2);
    const thin = ops.find((o) => o.existingUrl === 'https://plomberie.test/chauffe-eau/');
    expect(thin?.action).toBe('rewrite');
    expect(ops.some((o) => o.existingUrl?.includes('mentions-legales') || o.existingUrl?.includes('contact'))).toBe(false);
  });

  it('exclut les propositions déjà rédigées ou écartées', () => {
    const ops = detectOpportunities({ businessName: 'Plomberie Martin', segment: 'local', audit, pages });
    const again = detectOpportunities({ businessName: 'Plomberie Martin', segment: 'local', audit, pages, taken: [ops[0].id], dismissed: [ops[1].id] });
    expect(again.some((o) => o.id === ops[0].id || o.id === ops[1].id)).toBe(false);
  });

  it('devine le type de page', () => {
    expect(guessPageType('Quel est le prix d’un ravalement ?')).toBe('tarifs');
    expect(guessPageType('Logiciel A vs logiciel B')).toBe('comparatif');
    expect(guessPageType('Comment détartrer un ballon ?')).toBe('article');
  });
});

describe('faits et Markdown', () => {
  it('nettoie la saisie et donne la priorité au client sur la fiche de vérité', () => {
    expect(sanitizeFacts({ prix: '  10 €  ', inconnu: 'x', zone: '' })).toEqual({ prix: '10 €' });
    const s = mergeFacts({ horaires: 'Tous les jours' }, { horaires: 'Lun–ven', adresse: '1 rue A' });
    expect(s.horaires).toEqual({ value: 'Tous les jours', origin: 'client' });
    expect(s.adresse?.origin).toBe('verite');
  });

  it('parse le Markdown restreint et échappe le HTML', () => {
    const b = parseBody('## Titre\n\nUn <script>x</script> paragraphe.\n\n- un\n- deux\n\n### Q ?\nRéponse [lien](/contact).');
    expect(b.map((x) => x.type)).toEqual(['h2', 'p', 'ul', 'h3', 'p']);
    const html = bodyToHtml('Texte <b>gras</b> [ici](/a) et [mal](javascript:alert(1))');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('<a href="/a">ici</a>');
    expect(html).not.toContain('href="javascript');
    expect(todosOf('a [à compléter : prix] b [à compléter]')).toEqual(['prix', 'information manquante']);
    expect(slugify('Nos tarifs à Lyon’s 3e !')).toBe('nos-tarifs-a-lyon-s-3e');
  });
});

const op = (o: Partial<ContentOpportunity> = {}): ContentOpportunity => ({
  id: 'op_abc',
  action: 'create',
  pageType: 'tarifs',
  format: 'page',
  title: 'Nos tarifs à Lyon',
  target: 'Combien coûte un plombier à Lyon ?',
  why: 'x',
  evidence: [],
  priority: 7,
  needs: ['prix'],
  questionIds: ['q1'],
  competitors: [],
  ...o,
});

const ctx = { businessId: 'b1', name: 'Plomberie Martin', site: 'https://plomberie.test', segment: 'local' as const, city: 'Lyon', facts, pages, now: NOW };

describe('rédaction', () => {
  it('modèle structuré : faits recopiés, « [à compléter] » pour le reste, aucun fait inventé', async () => {
    const d = await buildDraft(op(), { ...ctx, writer: null });
    expect(d.writer).toBe('modele');
    expect(d.body).toContain('Déplacement : 49 € TTC');
    expect(d.body).toContain('Intervention sous 48 h');
    expect(d.body).toMatch(/\[à compléter : moyens de paiement\]/);
    expect(d.missing).toContain('moyens de paiement');
    expect(d.checks.find((c) => c.id === 'todo')?.ok).toBe(false);
    expect(d.slug).toBe('nos-tarifs-a-lyon');
    expect(d.jsonLd.some((j) => JSON.parse(j)['@type'] === 'Service')).toBe(true);
    // aucun nombre absent des faits
    const nums = (d.body.match(/\d+/g) ?? []).filter((n) => !['49', '48', '2026', '3', '04', '78', '00', '12', '69003', '8', '19'].includes(n));
    expect(nums).toEqual([]);
  });

  it('IA : texte accepté seulement sans fait nouveau et avec les marqueurs conservés', async () => {
    const tpl = await buildDraft(op(), { ...ctx, writer: null });
    const honest: ContentWriter = { id: 'ia', rewrite: async () => JSON.stringify({ body: tpl.body.replace('Cette page présente', 'Voici') }) };
    const liar: ContentWriter = { id: 'ia', rewrite: async () => JSON.stringify({ body: tpl.body.replace('Déplacement : 49 € TTC', 'Déplacement : 39 € TTC, devis gratuit, note 4,9 sur Google') }) };
    const filler: ContentWriter = { id: 'ia', rewrite: async () => JSON.stringify({ body: tpl.body.replace(/\[à compléter : moyens de paiement\]/, 'Carte bancaire et espèces') }) };
    const a = await buildDraft(op(), { ...ctx, writer: honest });
    const b = await buildDraft(op(), { ...ctx, writer: liar });
    const c = await buildDraft(op(), { ...ctx, writer: filler });
    expect(a.writer).toBe('ia');
    expect(b.writer).toBe('modele');
    expect(b.writerNote).toMatch(/absents de vos faits/);
    expect(b.body).not.toContain('39 €');
    expect(c.writer).toBe('modele');
    expect(c.writerNote).toMatch(/sans votre fiche/);
  });

  it('refuse les superlatifs non fournis', () => {
    const sk = '## A\n\nPlomberie Martin intervient.\n\n## B\n\nTexte de structure suffisamment long pour le contrôle de longueur minimale.';
    expect(acceptRewrite(sk.replace('intervient.', 'est le meilleur plombier.'), sk, ['Plomberie Martin'])).toMatchObject({ ok: false });
  });

  it('réécriture : le texte actuel est conservé, les sections manquantes ajoutées', async () => {
    const d = await buildDraft(op({ action: 'rewrite', pageType: 'service', existingUrl: 'https://plomberie.test/chauffe-eau/', target: 'Remplacement de chauffe-eau' }), {
      ...ctx,
      writer: null,
      existing: { url: 'https://plomberie.test/chauffe-eau/', title: 'Chauffe-eau', text: 'Nous remplaçons votre chauffe-eau rapidement.' },
    });
    expect(d.action).toBe('rewrite');
    expect(d.slug).toBe('chauffe-eau');
    expect(d.body.startsWith('Nous remplaçons votre chauffe-eau rapidement.')).toBe(true);
    expect(d.body).toContain('## Tarifs');
  });

  it('après complétion, plus rien ne bloque et la FAQ balisée suit les questions visibles', async () => {
    const d = await buildDraft(op({ pageType: 'faq', title: 'Questions fréquentes' }), { ...ctx, writer: null });
    const done = finalizeDraft({ ...d, body: d.body.replace(/\[à compléter[^\]]*\]/g, 'Garantie 2 ans') }, { ...ctx, facts: mergeFacts({ ...Object.fromEntries(Object.entries(facts).map(([k, v]) => [k, v!.value])), garanties: 'Garantie 2 ans' }) });
    expect(done.missing).toEqual([]);
    expect(done.checks.find((c) => c.id === 'todo')?.ok).toBe(true);
    expect(faqPairs(done.body).length).toBeGreaterThanOrEqual(4);
    expect(done.jsonLd.some((j) => JSON.parse(j)['@type'] === 'FAQPage')).toBe(true);
  });
});

describe('contrôles', () => {
  it('citabilité : une réponse directe chiffrée et nommée score mieux qu’un texte creux', () => {
    const good = citabilityOf('Tarifs', '## Combien coûte un dépannage ?\n\nChez Plomberie Martin à Lyon, le déplacement coûte 49 € TTC selon nos tarifs de novembre 2026, et la recherche de fuite démarre à 120 €. Le devis est remis avant toute intervention, par écrit, avec le détail des pièces et de la main-d’œuvre.', 'Plomberie Martin');
    const bad = citabilityOf('Tarifs', '## Bienvenue\n\nBienvenue chez nous, nous sommes heureux de vous accueillir et de vous proposer nos services de qualité depuis toujours avec passion et engagement pour votre plus grande satisfaction au quotidien.', 'Plomberie Martin');
    expect(good.score).toBeGreaterThan(bad.score);
  });

  it('cannibalisation : même sujet = fort', () => {
    const r = cannibalization('remplacement chauffe-eau Lyon', 'Remplacement de chauffe-eau', pages);
    expect(r[0]).toMatchObject({ url: 'https://plomberie.test/chauffe-eau/', level: 'fort' });
  });

  it('cannibalisation : la marque, présente dans tous les titres, ne compte pas', () => {
    const site = [{ url: 'https://p.test/urgence', title: 'Plombier urgence Paris 11 | Plomberie Martin', words: 300 }];
    expect(cannibalization('Tarifs', 'Tarifs de Plomberie Martin', site, undefined, 'Plomberie Martin')).toEqual([]);
  });

  it('JSON-LD : seulement les faits présents', () => {
    const j = buildJsonLd({ pageType: 'contact', format: 'page', name: 'X', site: 'https://x.test', url: 'https://x.test/contact', title: 'Contact', description: 'd', body: '', facts: mergeFacts({ telephone: '01 02 03 04 05' }), segment: 'local', now: NOW }).map((s) => JSON.parse(s));
    expect(j[0].mainEntity.telephone).toBe('01 02 03 04 05');
    expect(j[0].mainEntity.address).toBeUndefined();
  });
});

describe('quota (proposition fondateur)', () => {
  it('Essentiel 2, Accompagné 6, Agence 6, Découverte 0 ; seuls les contenus du mois comptent', () => {
    expect([MONTHLY_QUOTA.essentiel, MONTHLY_QUOTA.accompagne, MONTHLY_QUOTA.agence, MONTHLY_QUOTA.decouverte]).toEqual([2, 6, 6, 0]);
    const drafts = [{ consumedAt: '2026-11-03T00:00:00Z' }, { consumedAt: '2026-10-30T00:00:00Z' }, {}] as ContentDraft[];
    expect(quotaView('essentiel', drafts, NOW)).toMatchObject({ used: 1, left: 1, resetsAt: '2026-12-01' });
  });
});

describe('mentions à obtenir', () => {
  const dom = (o: Partial<DomainStat>): DomainStat => ({ domain: 'x.fr', label: 'X', category: 'annuaire', citations: 3, citationShare: 0.1, providers: ['chatgpt', 'perplexity'], queries: ['q1'], clientPresence: 'absent', competitorsPresent: ['Durand Plomberie'], sampleUrls: [], ...o });
  it('liste les sites cités où le client manque, sans forums, réseaux, Wikipédia ni concurrents', () => {
    const t = mentionTargets({
      name: 'Plomberie Martin',
      site: 'https://plomberie.test',
      segment: 'local',
      city: 'Lyon',
      facts,
      domains: [dom({ domain: 'pagesjaunes.fr', label: 'PagesJaunes' }), dom({ domain: 'reddit.com', category: 'forum' }), dom({ domain: 'fr.wikipedia.org', category: 'wikipedia' }), dom({ domain: 'deja.fr', clientPresence: 'present' }), dom({ domain: 'leprogres.fr', category: 'media_local', citations: 1, competitorsPresent: [] })],
    });
    expect(t.map((x) => x.domain)).toEqual(['pagesjaunes.fr', 'leprogres.fr']);
    expect(t[0].contact).toMatch(/Solocal/);
    expect(t[0].message.body).toContain('04 78 00 00 00');
    expect(t[0].why).toContain('Durand Plomberie');
    expect(t[1].message.body).toMatch(/\[à compléter/); // l'actualité n'est jamais inventée
    expect(t[1].caution).toMatch(/garantie de publication/);
  });
});

describe('mesure d’effet', () => {
  it('référence à la mise en ligne, J+30 seulement avec une mesure postérieure, écart avec marge', () => {
    const d = { questionIds: ['q1'], target: 'plombier lyon', effect: undefined as ContentDraft['effect'] };
    const base = { measuredAt: '2026-10-01T00:00:00Z', mentions: [m('q1', false, []), m('q1', false, [], 1), m('q1', false, [], 2), m('q1', true, [], 3)] };
    d.effect = startEffect(d, { at: '2026-10-02T00:00:00Z', audit: base });
    expect(d.effect.baseline.ai).toEqual({ questionIds: ['q1'], cited: 1, total: 4 });
    expect(refreshEffect(d, { at: '', audit: base }, new Date('2026-11-05T00:00:00Z'))).toBeNull(); // mesure trop ancienne
    const later = { measuredAt: '2026-11-04T00:00:00Z', mentions: [m('q1', true, []), m('q1', true, [], 1), m('q1', true, [], 2), m('q1', false, [], 3)] };
    const e = refreshEffect(d, { at: '', audit: later }, new Date('2026-11-05T00:00:00Z'))!;
    expect(e.d30?.ai?.cited).toBe(3);
    const delta = compareEffect(e.baseline, e.d30!)[0];
    expect(delta.note).toMatch(/marge d’erreur/);
    expect(snapshot(d, { at: 'x', gsc: { topQueries: [{ key: 'Plombier Lyon', impressions: 10, clicks: 1, position: 7.25 }] } }).gsc?.position).toBe(7.3);
  });
});

describe('fiche officielle → agent de contenu (V9)', () => {
  const official = {
    about: { title: 'À propos de Plomberie Martin', markdown: 'Plombier chauffagiste à Lyon depuis 2009.\n\nInformations vérifiées : [fiche officielle de Plomberie Martin](https://repere.test/p/plomberie-martin).\n' },
    contact: { title: 'Contacter Plomberie Martin', markdown: '- Téléphone : [04 78 00 00 00](tel:0478000000)\n\nVérifié par l’entreprise. [Fiche officielle](https://repere.test/p/plomberie-martin).\n' },
  };
  it('« À propos » et « Contact » partent des faits vérifiés de la fiche ; brouillon à valider', async () => {
    const a = await buildDraft(op({ pageType: 'a-propos', title: 'À propos', target: 'À propos' }), { ...ctx, writer: null, official });
    expect(a.title).toBe('À propos de Plomberie Martin');
    expect(a.body).toContain('depuis 2009');
    expect(a.body).toContain('fiche officielle');
    expect(a.status).toBe('draft');
    expect(a.writerNote).toMatch(/fiche officielle/);
    const c = await buildDraft(op({ pageType: 'contact', title: 'Contact', target: 'Contact' }), { ...ctx, writer: null, official });
    expect(c.body).toContain('Téléphone');
  });
  it('les autres types de page gardent le modèle', async () => {
    const t = await buildDraft(op(), { ...ctx, writer: null, official });
    expect(t.body).not.toContain('depuis 2009');
    expect(t.writerNote ?? '').not.toMatch(/fiche officielle/);
  });
});
