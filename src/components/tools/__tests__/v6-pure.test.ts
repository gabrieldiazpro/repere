import { describe, expect, it } from 'vitest';
import { parseRobots, decide } from '@/lib/siteaudit/robots';
import {
  SERP,
  detectProfile,
  generateRobots,
  hreflangCode,
  lastmodIssue,
  profileBots,
  readability,
  serpPreview,
  splitList,
  syllablesFr,
  textWidth,
  titleDescriptionChecks,
  truncateToWidth,
  worst,
} from '../v6/pure';

describe('largeur en pixels et troncature Google', () => {
  it('mesure plus large un texte de « m » qu’un texte de « i »', () => {
    expect(textWidth('mmmmmmmmmm', 20)).toBeGreaterThan(textWidth('iiiiiiiiii', 20) * 3);
    expect(textWidth('é', 20)).toBe(textWidth('e', 20));
    expect(textWidth('', 20)).toBe(0);
  });
  it('ne coupe pas un titre court, coupe un titre long au dernier mot avec « … »', () => {
    const short = truncateToWidth('Plombier à Lyon 3', SERP.titlePx, SERP.titleFont);
    expect(short.truncated).toBe(false);
    expect(short.shown).toBe('Plombier à Lyon 3');
    const long = truncateToWidth('Plomberie Martin – Plombier chauffagiste à Lyon 3, dépannage de fuite, chauffe-eau et débouchage 7 jours sur 7', SERP.titlePx, SERP.titleFont);
    expect(long.truncated).toBe(true);
    expect(long.shown.endsWith(' …')).toBe(true);
    expect(textWidth(long.shown, SERP.titleFont)).toBeLessThanOrEqual(SERP.titlePx);
    expect(long.full.startsWith(long.shown.replace(/ …$/, ''))).toBe(true);
  });
  it('coupe un mot unique trop long au caractère', () => {
    const r = truncateToWidth('a'.repeat(200), 100, 20);
    expect(r.truncated).toBe(true);
    expect(r.shown.length).toBeLessThan(200);
  });
  it('construit le fil d’adresse et signale une description reprise du texte', () => {
    const p = serpPreview({ title: 'T', description: '', url: 'https://www.exemple.fr/services/plomberie.html', pageText: 'Texte de la page.' });
    expect(p.breadcrumb).toBe('www.exemple.fr › services › plomberie');
    expect(p.host).toBe('exemple.fr');
    expect(p.descriptionFromPage).toBe(true);
  });
  it('contrôles : titre absent en erreur, description courte en alerte, bonne longueur en vert', () => {
    expect(titleDescriptionChecks('', 'x'.repeat(150)).find((c) => c.id === 'title.missing')?.status).toBe('fail');
    expect(titleDescriptionChecks('Accueil', '').map((c) => c.id)).toEqual(expect.arrayContaining(['title.short', 'title.generic', 'desc.missing']));
    const good = titleDescriptionChecks('Plombier à Lyon 3 : dépannage en 2 h | Martin', 'Fuite, chauffe-eau, débouchage : intervention en 2 heures à Lyon et Villeurbanne. Devis écrit avant travaux, pièces garanties deux ans.');
    expect(worst(good)).toBe('ok');
    expect(titleDescriptionChecks('Même texte ici pour les deux balises', 'Même texte ici pour les deux balises').some((c) => c.id === 'desc.same')).toBe(true);
  });
});

describe('lisibilité en français (Kandel et Moles)', () => {
  it('compte les syllabes en retirant le e muet final', () => {
    expect(syllablesFr('table')).toBe(1);
    expect(syllablesFr('chocolat')).toBe(3);
    expect(syllablesFr('l’atelier')).toBe(3);
    expect(syllablesFr('2026')).toBe(1);
    expect(syllablesFr('a')).toBe(1);
  });
  it('note un texte simple au-dessus d’un texte dense', () => {
    const simple = 'Le chat dort. Il fait beau. Nous allons au parc. Le pain est chaud. Tu bois du lait. Elle lit un livre. Le bus est là. On part tôt. Le ciel est bleu. Il a faim.';
    const dense =
      'L’administration intercommunale, considérant l’augmentation significative des consommations énergétiques constatées, préconise systématiquement l’installation d’équipements thermodynamiques particulièrement performants, conformément aux recommandations réglementaires européennes récemment publiées.';
    const a = readability(simple);
    const b = readability(dense);
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.score).toBeGreaterThanOrEqual(70);
    expect(b.band.tone).toBe('fail');
    const long = readability(`${'Nous intervenons rapidement chez vous '.repeat(6)}pour réparer la fuite.`);
    expect(long.longSentences).toHaveLength(1);
    expect(long.checks.find((c) => c.id === 'read.long')?.status).toBe('fail');
  });
  it('donne mots, phrases, temps de lecture et mots fréquents ; texte vide sans erreur', () => {
    const r = readability('Plombier à Lyon. Plombier sérieux et rapide.\n\nUn plombier disponible le samedi.');
    expect(r.words).toBe(12);
    expect(r.sentences).toBe(3);
    expect(r.paragraphs).toBe(2);
    expect(r.readingMinutes).toBe(1);
    expect(r.topWords[0]).toMatchObject({ word: 'plombier', count: 3 });
    expect(r.checks.some((c) => c.id === 'read.short')).toBe(true);
    const empty = readability('   ');
    expect(empty.words).toBe(0);
    expect(empty.verdict.title).toMatch(/Aucun texte/);
  });
});

describe('générateur de robots.txt', () => {
  it('profil « cité sans entraînement » : GPTBot bloqué, OAI-SearchBot et Googlebot autorisés, vérifié par le lecteur RFC 9309', () => {
    const r = generateRobots({ bots: profileBots('cite'), disallow: ['/admin/'], sitemaps: ['https://exemple.fr/sitemap.xml'] }, '2026-11-15');
    const parsed = parseRobots(r.text);
    expect(decide(parsed, 'GPTBot', '/').allowed).toBe(false);
    expect(decide(parsed, 'Google-Extended', '/').allowed).toBe(false);
    expect(decide(parsed, 'OAI-SearchBot', '/').allowed).toBe(true);
    expect(decide(parsed, 'OAI-SearchBot', '/admin/x').allowed).toBe(false);
    expect(decide(parsed, 'Googlebot', '/').allowed).toBe(true);
    expect(parsed.sitemaps).toEqual(['https://exemple.fr/sitemap.xml']);
    expect(r.verdict.tone).toBe('ok');
    expect(r.rows.find((x) => x.token === 'GPTBot')?.allowedHome).toBe(false);
    expect(r.rows.find((x) => x.token === 'PerplexityBot')).toMatchObject({ allowedHome: true, blockedSample: true });
    expect(r.text).toContain('2026-11-15');
  });
  it('fermé aux IA : rouge, car les IA de recherche ne peuvent plus citer ; bloquer Googlebot aussi', () => {
    const closed = generateRobots({ bots: profileBots('ferme'), disallow: [], sitemaps: ['https://exemple.fr/sitemap.xml'] });
    expect(closed.verdict.tone).toBe('fail');
    const searchOnly = generateRobots({ bots: { ...profileBots('cite'), 'Perplexity-User': 'block' }, disallow: [], sitemaps: ['https://exemple.fr/sitemap.xml'] });
    expect(searchOnly.verdict.tone).toBe('warn');
    expect(closed.warnings.join(' ')).toMatch(/OAI-SearchBot/);
    const bots = { ...profileBots('ouvert'), Googlebot: 'block' as const };
    const g = generateRobots({ bots, disallow: [], sitemaps: [] });
    expect(g.verdict.tone).toBe('fail');
    expect(detectProfile(bots)).toBe('perso');
    expect(detectProfile(profileBots('ouvert'))).toBe('ouvert');
  });
  it('refuse les chemins et sitemaps mal formés, signale Disallow: / pour tous', () => {
    const r = generateRobots({ bots: profileBots('ouvert'), disallow: ['admin', '/'], sitemaps: ['sitemap.xml'] });
    expect(r.errors).toHaveLength(2);
    expect(r.verdict.tone).toBe('fail');
    expect(r.warnings.join(' ')).toMatch(/interdit tout votre site/);
    expect(splitList('/a/\n/b/, /a/\n\n')).toEqual(['/a/', '/b/']);
  });
});

describe('codes hreflang et dates de sitemap', () => {
  it('valide les codes ISO et repère les erreurs courantes', () => {
    for (const ok of ['fr', 'fr-BE', 'en-GB', 'x-default', 'zh-Hant-TW', 'es-419', 'FR-fr']) expect(hreflangCode(ok).valid, ok).toBe(true);
    expect(hreflangCode('en-UK').issue).toMatch(/GB/);
    expect(hreflangCode('fr_FR').issue).toMatch(/tiret/);
    expect(hreflangCode('be').valid).toBe(true); // biélorusse : valide
    expect(hreflangCode('ch').valid).toBe(true); // chamorro : valide
    expect(hreflangCode('xx').valid).toBe(false);
    expect(hreflangCode('fr-XX').valid).toBe(false);
    expect(hreflangCode('en-EU').valid).toBe(false);
  });
  it('lastmod : format W3C, pas de date future', () => {
    const now = Date.parse('2026-11-15T00:00:00Z');
    expect(lastmodIssue('2026-11-02', now)).toBeNull();
    expect(lastmodIssue('2026-11-02T10:00:00+01:00', now)).toBeNull();
    expect(lastmodIssue('02/11/2026', now)).toBe('format');
    expect(lastmodIssue('2027-03-01', now)).toBe('future');
  });
});
