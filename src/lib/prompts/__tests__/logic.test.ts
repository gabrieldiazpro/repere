import { describe, expect, it } from 'vitest';
import { buildDemoWorkspace } from '@/lib/demo-v2';
import { demandIndex } from '../demand';
import { demoPrompts, findDemoPrompt } from '../demo';
import { promptsToQueries, queryIdOf } from '../engine';
import { buildHistory, findAll, foldAligned, highlightText } from '../history';
import { exportCsv, parseImport, planImport } from '../io';
import { suggestPrompts, siteCandidates, inputFor } from '../suggest';
import { classifyIntent, cleanTags, dedupeTexts, isDuplicate, normalizeQuestion, validateText } from '../text';
import type { TrackedPrompt } from '../types';

const tp = (over: Partial<TrackedPrompt>): TrackedPrompt => ({
  id: 'p_x',
  businessId: 'b1',
  text: 'Quel est le meilleur plombier à Lyon ?',
  theme: 'Recommandation',
  tags: [],
  intent: 'recommandation',
  origin: 'client',
  active: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

describe('texte : normalisation et dédoublonnage', () => {
  it('normalise accents, casse et ponctuation', () => {
    expect(normalizeQuestion('  Quel PLOMBIER à Paris 11ᵉ ?! ')).toBe('quel plombier a paris 11e');
  });
  it('repère les doublons exacts et proches, pas les questions différentes', () => {
    expect(isDuplicate('Quel est le meilleur plombier à Lyon ?', 'quel est le meilleur plombier a lyon')).toBe(true);
    expect(isDuplicate('Meilleurs plombiers à Lyon ?', 'Quel est le meilleur plombier à Lyon ?')).toBe(true);
    expect(isDuplicate('Quel est le meilleur plombier à Lyon ?', 'Quel est le meilleur électricien à Lyon ?')).toBe(false);
    // même mots ou presque, mais intention différente (recommandation / avis) : pas un doublon
    expect(isDuplicate('Quel plombier a les meilleurs avis à Paris 11e ?', 'Quel est le meilleur plombier à Paris 11e ?')).toBe(false);
  });
  it('dédoublonne une liste contre l\'existant', () => {
    const out = dedupeTexts([{ text: 'A b plombier Lyon' }, { text: 'Plombier lyon a b' }, { text: 'Serrurier Lyon' }], [{ text: 'Serrurier à Lyon' }]);
    expect(out.map((o) => o.text)).toEqual(['A b plombier Lyon']);
  });
  it('valide la longueur et refuse les liens', () => {
    expect(validateText('abc').ok).toBe(false);
    expect(validateText('Voir https://exemple.fr svp').ok).toBe(false);
    expect(validateText('x'.repeat(201)).ok).toBe(false);
    expect(validateText('Quel plombier à Lyon ?')).toEqual({ ok: true, text: 'Quel plombier à Lyon ?' });
  });
  it('classe l\'intention', () => {
    expect(classifyIntent('Combien coûte un plombier ?')).toBe('prix');
    expect(classifyIntent('Quelle alternative à Paylo ?')).toBe('alternative');
    expect(classifyIntent('Plomberie Martin est-elle fiable ?', ['Plomberie Martin'])).toBe('marque');
    expect(classifyIntent('Plombier urgent ce soir')).toBe('urgence');
    expect(classifyIntent('Quel est le meilleur plombier ?')).toBe('recommandation');
  });
  it('nettoie les tags', () => {
    expect(cleanTags(['Prix', 'prix', ' <b>Urgence</b> ', ''])).toEqual(['prix', 'burgence/b']);
  });
});

describe('indice de demande', () => {
  it('est un niveau étiqueté « estimation », jamais un volume', () => {
    const d = demandIndex('Meilleur plombier ?', 'recommandation');
    expect(d).toMatchObject({ level: 'fort', label: 'estimation' });
    expect(JSON.stringify(d)).not.toMatch(/\d{2,}/);
  });
  it('baisse avec le quartier, une petite ville ou un nom de marque', () => {
    expect(demandIndex('Quel plombier spécialisé fait la recherche de fuite non destructive à Paris 11e ?', 'service').level).toBe('faible');
    expect(demandIndex('Plomberie Martin est-elle fiable ?', 'marque', { names: ['Plomberie Martin'] }).level).toBe('faible');
    expect(demandIndex('Quel plombier a les meilleurs avis à Lyon ?', 'avis').level).toBe('fort');
    const small = demandIndex('Quel plombier a les meilleurs avis à Vierzon ?', 'avis', { city: 'Vierzon' });
    expect(small.level).toBe('moyen');
    expect(small.signals).toContain('ville de taille moyenne ou petite');
  });
  it('est déterministe', () => {
    expect(demandIndex('Combien coûte un logiciel de paie ?', 'prix')).toEqual(demandIndex('Combien coûte un logiciel de paie ?', 'prix'));
  });
});

describe('import / export', () => {
  it('lit du texte, une question par ligne', () => {
    const rows = parseImport('# mes questions\n- Quel plombier à Lyon ?\n\n2) Combien coûte un plombier ?\n');
    expect(rows.map((r) => r.text)).toEqual(['Quel plombier à Lyon ?', 'Combien coûte un plombier ?']);
  });
  it('lit un CSV avec en-tête, guillemets et tags', () => {
    const rows = parseImport('question;thème;tags;intention;actif\n"Quel plombier ; pas cher ?";Prix;prix|lyon;prix;non\n');
    expect(rows[0]).toMatchObject({ text: 'Quel plombier ; pas cher ?', theme: 'Prix', tags: ['prix', 'lyon'], intent: 'prix', active: false });
  });
  it('dédoublonne contre l\'existant et dans le fichier, rejette les lignes invalides', () => {
    const plan = planImport(parseImport('Quel plombier à Lyon ?\nquel plombier a lyon\nab\nMeilleur serrurier de Lyon ?'), [{ text: 'Meilleur serrurier à Lyon' }]);
    expect(plan.accepted.map((a) => a.text)).toEqual(['Quel plombier à Lyon ?']);
    expect(plan.rejected.map((r) => r.line)).toEqual([2, 3, 4]);
  });
  it('exporte un CSV sûr (anti-formule) avec l\'indice étiqueté', () => {
    const csv = exportCsv([tp({ text: '=HYPERLINK("x") plombier ?' })]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('(estimation)');
    expect(csv.split('\r\n')[0]).toContain('question;theme;tags');
  });
});

describe('suggestions', () => {
  const ws = buildDemoWorkspace('local');
  const business = { ...ws.business, id: 'b-local' };
  it('renvoie 20 suggestions étiquetées, sans doublons ni questions déjà suivies, classées par intention', () => {
    const existing = [{ text: ws.audits[ws.audits.length - 1].queries[0].text }];
    const s = suggestPrompts({ business, audits: ws.audits, existing });
    expect(s.length).toBe(20);
    expect(s.every((x) => x.label === 'suggestion' && x.demand.label === 'estimation')).toBe(true);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) expect(isDuplicate(s[i].text, s[j].text)).toBe(false);
    expect(s.some((x) => isDuplicate(x.text, existing[0].text))).toBe(false);
    expect(s.some((x) => x.source === 'concurrents')).toBe(true);
    expect(new Set(s.map((x) => x.intent)).size).toBeGreaterThan(4);
  });
  it('20 suggestions pour chaque compte démo, même avec toutes ses questions déjà suivies', () => {
    for (const seg of ['local', 'pme', 'ecommerce'] as const) {
      const w = buildDemoWorkspace(seg);
      const existing = demoPrompts(w.business.id);
      const s = suggestPrompts({ business: w.business, audits: w.audits, existing });
      expect(s.length).toBe(20);
      expect(s.some((x) => existing.some((e) => isDuplicate(e.text, x.text)))).toBe(false);
    }
  });
  it('fonctionne sans audit (secteur seul) pour les 3 parcours', () => {
    for (const seg of ['local', 'pme', 'ecommerce'] as const) {
      const w = buildDemoWorkspace(seg);
      const s = suggestPrompts({ business: { ...w.business, id: `b-${seg}` }, offering: 'Fabriqué en France, zéro déchet, livraison et échantillons offerts' });
      expect(s.length).toBeGreaterThanOrEqual(8);
      expect(s.every((x) => validateText(x.text).ok)).toBe(true);
    }
  });
  it('tire des questions des rubriques du site', () => {
    const input = inputFor({ business });
    const c = siteCandidates(input, { url: 'https://x.fr', headings: ['Débouchage de canalisations', 'Contact', 'Plomberie Martin', 'Remplacement de chauffe-eau'] });
    expect(c.map((x) => x.text)).toEqual([
      expect.stringContaining('Débouchage de canalisations'),
      expect.stringContaining('Remplacement de chauffe-eau'),
    ]);
    expect(c.every((x) => x.source === 'site')).toBe(true);
  });
});

describe('moteur', () => {
  it('convertit les questions actives en QuerySpec, sans doublons, id stable', () => {
    const a = tp({ id: 'a', queryId: 'T1-fd2c' });
    const b = tp({ id: 'b', text: 'Combien coûte un plombier ?', intent: 'prix' });
    const c = tp({ id: 'c', text: 'quel est le meilleur plombier a lyon', active: true });
    const d = tp({ id: 'd', text: 'Plomberie Martin, avis ?', intent: 'marque', active: false });
    const qs = promptsToQueries([a, b, c, d]);
    expect(qs.map((q) => q.id)).toEqual(['T1-fd2c', queryIdOf(b)]);
    expect(qs[1]).toMatchObject({ angle: 'price', kind: 'reco' });
    expect(queryIdOf(tp({ intent: 'marque' }))).toMatch(/^BU-/);
    expect(queryIdOf(b)).toBe(queryIdOf({ ...b, text: 'combien coute un plombier' }));
  });
});

describe('démo', () => {
  it('3 comptes, 8 à 12 questions taguées cohérentes avec les audits démo', () => {
    for (const [id, seg] of [['demo', 'local'], ['demo-pme', 'pme'], ['demo-ecom', 'ecommerce']] as const) {
      const ps = demoPrompts(id);
      expect(ps.length).toBeGreaterThanOrEqual(8);
      expect(ps.length).toBeLessThanOrEqual(12);
      expect(ps.filter((p) => p.tags.length).length).toBeGreaterThanOrEqual(8);
      const last = buildDemoWorkspace(seg).audits.at(-1)!;
      for (const p of ps.filter((x) => x.origin === 'gabarit')) expect(last.queries.some((q) => q.id === p.queryId && q.text === p.text)).toBe(true);
      expect(findDemoPrompt(ps[0].id)?.text).toBe(ps[0].text);
    }
    expect(demoPrompts('autre')).toEqual([]);
  });
});

describe('historique et surlignage', () => {
  it('replie sans décaler les index', () => {
    const s = 'Électricien à Évry — Sève & Sel';
    expect(foldAligned(s).length).toBe(s.length);
    expect(findAll(s, 'seve & sel')).toEqual([{ start: s.indexOf('Sève'), end: s.length }]);
    expect(findAll('Henryville et Henry', 'Henry')).toEqual([{ start: 14, end: 19 }]);
  });
  it('surligne client, concurrents et sources sans chevauchement', () => {
    const text = 'Essayez Plomberie Martin ou Atelier Henry (voir pagesjaunes.fr).';
    const h = highlightText(text, { client: ['Plomberie Martin'], competitors: ['Atelier Henry', 'Henry'], sources: ['https://www.pagesjaunes.fr/annuaire'] });
    expect(h.map((x) => [x.kind, text.slice(x.start, x.end)])).toEqual([
      ['client', 'Plomberie Martin'],
      ['concurrent', 'Atelier Henry'],
      ['source', 'pagesjaunes.fr'],
    ]);
  });
  it('construit la série question × IA sur les 6 audits démo', () => {
    const ws = buildDemoWorkspace('local');
    const p = demoPrompts('demo')[0];
    const h = buildHistory(p, ws.audits);
    expect(h.audits).toBe(6);
    expect(h.series.length).toBeGreaterThanOrEqual(6);
    for (const pt of h.series) {
      expect(typeof pt.cited).toBe('boolean');
      expect(pt.rank === null || pt.rank >= 1).toBe(true);
      expect(Array.isArray(pt.competitors)).toBe(true);
    }
    expect(h.answers.length).toBeGreaterThan(0);
    const withHl = h.answers.find((a) => a.highlights.length);
    expect(withHl).toBeTruthy();
    for (const hl of withHl!.highlights) expect(withHl!.text.slice(hl.start, hl.end).length).toBe(hl.end - hl.start);
    expect(h.summary.length).toBe(h.providers.length);
    // Filtre par IA et par date
    const only = buildHistory(p, ws.audits, { provider: 'chatgpt', since: ws.audits.at(-1)!.measuredAt || ws.audits.at(-1)!.createdAt });
    expect(only.series.every((s) => s.provider === 'chatgpt')).toBe(true);
    expect(only.audits).toBe(1);
  });
  it('rattache une question par son texte quand l\'identifiant ne correspond pas', () => {
    const ws = buildDemoWorkspace('local');
    const q = ws.audits[0].queries[1];
    const h = buildHistory(tp({ text: q.text.toUpperCase() }), ws.audits, { answers: false });
    expect(h.queryIds).toEqual([q.id]);
    expect(h.answers).toEqual([]);
  });
});
