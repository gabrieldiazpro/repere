import { describe, expect, it } from 'vitest';
import { buildDemoWorkspace } from '@/lib/demo-v2';
import { buildHistory, demoPrompts } from '@/lib/prompts';
import { clientNamesOf, filterUrls, listAnswers, marginText, plainAnswer, markersFor, proportionMargin, questionResult, segmentsOf, selectPeriod, sortUrls, trendOf, urlsWithHistory } from '../derive';
import { crossLink, hrefWith, parseParams } from '../params';

const iso = (m: number) => new Date(Date.UTC(2026, m, 5)).toISOString();
const audits = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => ({ id: `a${m}`, createdAt: iso(m), measuredAt: iso(m) }));

describe('params', () => {
  it('valeurs par défaut et valeurs inconnues', () => {
    expect(parseParams({})).toEqual({ periode: '6m', vs: 'precedent', ia: null, tag: null, q: '' });
    expect(parseParams({ periode: 'x', vs: 'y', ia: 'bing', tag: ' Prix ' })).toMatchObject({ periode: '6m', vs: 'precedent', ia: null, tag: 'prix' });
    expect(parseParams({ ia: 'mistral' }, ['chatgpt']).ia).toBeNull();
    expect(parseParams({ ia: ['gemini', 'claude'] }).ia).toBe('gemini');
  });
  it('liens : conserve, remplace, retire et omet les valeurs par défaut', () => {
    expect(hrefWith('/app/x', { periode: '3m', ia: 'gemini' }, { ia: null })).toBe('/app/x?periode=3m');
    expect(hrefWith('/app/x', { periode: '3m' }, { periode: '6m' })).toBe('/app/x');
    expect(hrefWith('/app/x', { b: '2', a: '1' })).toBe('/app/x?a=1&b=2');
    expect(crossLink('/app/y', { periode: '12m', q: 'plombier', tri: 'x', tag: 'prix' })).toBe('/app/y?periode=12m&tag=prix');
  });
  it('nettoie les caractères de contrôle', () => {
    expect(parseParams({ q: 'a\u0000b' }).q).toBe('a b');
  });
});

describe('selectPeriod', () => {
  it('dernière mesure seule, référence = mesure précédente', () => {
    const s = selectPeriod(audits, 'dernier', 'precedent');
    expect(s.audits.map((a) => a.id)).toEqual(['a7']);
    expect(s.reference?.id).toBe('a6');
  });
  it('3 mois : audits de la fenêtre, référence = début de période', () => {
    const s = selectPeriod(audits, '3m', 'debut');
    expect(s.audits.map((a) => a.id)).toEqual(['a4', 'a5', 'a6', 'a7']);
    expect(s.reference?.id).toBe('a4');
    expect(s.from).toBe(iso(4).slice(0, 10));
  });
  it('profondeur d’historique de l’offre', () => {
    const s = selectPeriod(audits, 'tout', 'precedent', 2);
    expect(s.audits.map((a) => a.id)).toEqual(['a5', 'a6', 'a7']);
    expect(s.limitedByPlan).toBe(true);
  });
  it('aucun audit', () => {
    expect(selectPeriod([], '6m', 'precedent').current).toBeNull();
  });
});

describe('marges et tendances', () => {
  it('libellés de marge', () => {
    expect(marginText({ value: 42, low: 36, high: 48, margin: 6.2 }, 'score')).toBe('± 6');
    expect(marginText({ value: 0.3, low: 0.26, high: 0.34, margin: 0.04 }, 'rate')).toBe('± 4 pts');
    expect(marginText(undefined, 'score')).toBeNull();
  });
  it('marge d’une proportion : plus large sur peu de réponses', () => {
    expect(proportionMargin(3, 6)).toBeGreaterThan(proportionMargin(30, 60));
    expect(proportionMargin(0, 0)).toBe(1);
  });
  it('tendance', () => {
    expect(trendOf([0.1, 0.2, 0.5, 0.6])).toBe('hausse');
    expect(trendOf([0.6, 0.5, 0.2])).toBe('baisse');
    expect(trendOf([0.3, 0.31])).toBe('stable');
    expect(trendOf([0.3])).toBeNull();
  });
});

describe('surlignage', () => {
  it('découpe un texte sans perdre de caractère', () => {
    const text = 'Essayez Plomberie Martin ou Ets Perrin (pagesjaunes.fr).';
    const segs = segmentsOf(text, [
      { start: 8, end: 24, kind: 'client', label: 'Plomberie Martin' },
      { start: 28, end: 38, kind: 'concurrent', label: 'Ets Perrin' },
    ]);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(segs.filter((s) => s.kind).map((s) => s.kind)).toEqual(['client', 'concurrent']);
  });
  it('ignore un surlignage hors limites ou chevauchant', () => {
    const segs = segmentsOf('abcdef', [
      { start: 1, end: 3, kind: 'client', label: 'x' },
      { start: 2, end: 4, kind: 'source', label: 'y' },
      { start: 5, end: 99, kind: 'source', label: 'z' },
    ]);
    expect(segs.map((s) => s.text).join('')).toBe('abcdef');
    expect(segs.filter((s) => s.kind)).toHaveLength(1);
  });
  it('noms du client', () => {
    expect(clientNamesOf('Paysia', 'www.paysia.fr')).toEqual(['Paysia', 'paysia.fr']);
    expect(clientNamesOf('X', '')).toEqual(['X']);
  });
});

describe('données démo (3 comptes)', () => {
  for (const seg of ['local', 'pme', 'ecommerce'] as const) {
    const ws = buildDemoWorkspace(seg);
    const last = ws.audits.at(-1)!;
    it(`${seg} : réponses surlignées, filtre « non cité »`, () => {
      const all = listAnswers([last], clientNamesOf(ws.business.name, ws.business.website));
      expect(all.length).toBeGreaterThan(0);
      for (const a of all) expect(segmentsOf(a.text, a.highlights).map((s) => s.text).join('')).toBe(a.text);
      const nc = listAnswers([last], [ws.business.name], { notCited: true });
      expect(nc.every((a) => !a.cited && !a.brand)).toBe(true);
      const cited = all.filter((a) => a.cited);
      if (cited.length) expect(cited.some((a) => a.highlights.some((h) => h.kind === 'client'))).toBe(true);
      const gem = listAnswers(ws.audits, [ws.business.name], { ia: 'gemini' });
      expect(gem.every((a) => a.provider === 'gemini')).toBe(true);
      // tri : plus récentes d'abord
      expect(gem[0].date >= gem.at(-1)!.date).toBe(true);
    });
    it(`${seg} : URL filtrées et triées`, () => {
      const urls = last.sources?.urls ?? [];
      expect(urls.length).toBeGreaterThan(0);
      const absent = filterUrls(urls, { absent: true });
      expect(absent.every((u) => !u.clientPresent)).toBe(true);
      const byPos = sortUrls(urls, 'position');
      expect((byPos[0].bestPosition ?? 99) <= (byPos.at(-1)!.bestPosition ?? 99)).toBe(true);
      const merged = urlsWithHistory(urls, urls.slice(0, 2).map((u) => ({ ...u, firstSeen: '2026-01-01' })));
      expect(merged).toHaveLength(urls.length);
      expect(merged[0].firstSeen).toBe('2026-01-01');
    });
    it(`${seg} : résultat par question cohérent avec les mentions`, () => {
      const p = demoPrompts(ws.business.id).find((x) => x.active)!;
      const h = buildHistory(p, ws.audits, { answers: false });
      const r = questionResult(h, last.providersUsed);
      expect(r.measured).toBe(true);
      expect(r.series.length).toBe(ws.audits.length);
      for (const c of r.last) {
        const ms = last.mentions.filter((m) => m.queryId === p.queryId && m.provider === c.provider);
        expect(c.cited).toBe(ms.length ? ms.some((m) => m.mentioned) : null);
      }
    });
  }
});

describe('repères', () => {
  it('placés sur la mesure qui suit, regroupés', () => {
    const dates = [iso(0), iso(1), iso(2)];
    const mk = markersFor(dates, [
      { date: iso(0).slice(0, 10).replace(/05$/, '20'), label: 'Article' },
      { date: iso(0).slice(0, 10).replace(/05$/, '25'), label: 'Fiche Google' },
      { date: '2027-12-01', label: 'Futur' },
      { date: '2020-01-01', label: 'Trop ancien' },
    ]);
    expect(mk).toEqual([
      { index: 1, label: 'Article · Fiche Google' },
      { index: 2, label: 'Futur' },
    ]);
  });
});

describe('matrice et explication (démo)', async () => {
  const { heat } = await import('../derive');
  const { explainChange } = await import('@/lib/engine');
  it('intensité bornée', () => {
    expect(heat(0)).toBe(0);
    expect(heat(Number.NaN)).toBe(0);
    expect(heat(1)).toBe(70);
    expect(heat(2)).toBe(70);
  });
  for (const seg of ['local', 'pme', 'ecommerce'] as const) {
    it(`${seg} : matrice thème × IA et explication disponibles`, () => {
      const ws = buildDemoWorkspace(seg);
      const [prev, last] = ws.audits.slice(-2);
      expect(last.voice?.themes.length).toBeGreaterThan(0);
      for (const row of last.voice!.cells) for (const c of row) if (c) expect(c.cited).toBeLessThanOrEqual(c.answers);
      const ex = explainChange(prev, last);
      expect(ex.headline.length).toBeGreaterThan(0);
      const sel = selectPeriod(ws.audits, '6m', 'precedent');
      expect(sel.reference?.id).toBe(prev.id);
    });
  }
});

describe('plainAnswer', () => {
  it('retire le Markdown des réponses brutes sans toucher au texte', () => {
    expect(plainAnswer('1. **Paylo** – tarifs', true)).toBe('1. Paylo – tarifs');
    expect(plainAnswer('* **Netpaie** — ok\n- Salaria', true)).toBe('• Netpaie — ok\n• Salaria');
    // Segment au milieu d'une ligne : un tiret en tête n'est pas une puce.
    expect(plainAnswer('- suite', false)).toBe('- suite');
  });
});
