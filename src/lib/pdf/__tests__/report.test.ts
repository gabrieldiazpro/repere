import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AuditResult, ActionItem } from '@/lib/engine';
import { renderReportPdf, renderActionPlanPdf } from '../Report';
import { signPlanToken, verifyPlanToken } from '../sign';
import { createMockAudit } from '@/lib/engine/audit';

const providers = ['chatgpt', 'perplexity', 'gemini'] as const;
const queries: AuditResult['queries'] = [
  { id: 'q1', text: 'Meilleur plombier Paris 11e', intent: 'best' },
  { id: 'q2', text: 'Plombier urgence Bastille', intent: 'urgent' },
  { id: 'q3', text: "Fuite d'eau 11e, qui appeler ?", intent: 'specific' },
  { id: 'q4', text: 'Plombier près de moi Oberkampf', intent: 'nearby' },
];
const mentions: AuditResult['mentions'] = [];
for (const q of queries) for (const p of providers) for (const run of [0, 1]) {
  const hit = (q.id === 'q2' && p !== 'gemini') ;
  mentions.push({ provider: p, queryId: q.id, run, mentioned: hit, rank: hit ? 3 : null, competitors: ['Martin Plomberie', "Plomb'Express"] });
}
const actions: ActionItem[] = [
  { id: 'gbp', title: 'Compléter votre fiche Google Business Profile', why: 'Les IA s’appuient beaucoup sur les données locales publiques.', how: ['Ajoutez vos horaires et services', 'Ajoutez 5 photos récentes', 'Décrivez votre métier et votre quartier'], effort: 'S', impact: 3 },
  { id: 'avis', title: 'Obtenir 5 avis récents', why: 'Des avis récents citant le métier et le quartier sont lus par les IA.', how: ['Envoyez un SMS après chaque chantier', 'Citez le quartier', 'Répondez à chaque avis'], effort: 'M', impact: 3 },
  { id: 'page', title: 'Créer une page « Plombier à Paris 11e »', why: 'Une page dédiée associe votre nom au métier et au lieu.', how: ['Ajoutez 5 questions-réponses', 'Indiquez votre adresse', 'Liez la page depuis l’accueil'], effort: 'L', impact: 2 },
];
const audit: AuditResult = {
  id: 'test-abc123',
  input: { businessName: 'Dupont Plomberie', trade: 'Plombier', city: 'Paris', district: '11e', website: 'dupont-plomberie.fr' },
  createdAt: '2026-11-09T09:00:00.000Z', measuredAt: '2026-11-09T09:00:00.000Z',
  score: 23, range: { low: 15, high: 31 }, agreement: 0.7,
  subScores: { chatgpt: 41, perplexity: 18, gemini: 0, claude: null },
  providersUsed: ['chatgpt', 'perplexity', 'gemini'],
  mentionRate: 0.17, avgRank: 3, shareOfVoice: 0.12,
  competitors: [{ name: 'Martin Plomberie', mentions: 20, share: 0.62 }, { name: 'Paris Dépannage 24', mentions: 14, share: 0.45 }, { name: "Plomb'Express", mentions: 7, share: 0.22 }, { name: 'PagesJaunes', mentions: 5, share: 0.15 }],
  queries, mentions, answers: [],
  confidence: 'moyenne', demo: true,
  excerpts: [
    { provider: 'chatgpt', query: 'Meilleur plombier Paris 11e', text: "Parmi les plombiers du 11e arrondissement, Martin Plomberie et Paris Dépannage 24 reviennent souvent dans les avis. Ils proposent des interventions rapides, des devis gratuits et une bonne disponibilité le week-end, avec des tarifs clairs affichés avant l'intervention.", competitorsHighlighted: ['Martin Plomberie', 'Paris Dépannage 24'], mentioned: false },
    { provider: 'perplexity', query: 'Plombier urgence Bastille', text: "Pour une urgence près de Bastille : Plomb'Express (24h/24) puis Dupont Plomberie.", competitorsHighlighted: ["Plomb'Express"], mentioned: true },
  ],
  topActions: actions,
};

const countPages = (buf: Buffer) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

/** Audit PME avec les champs V2 remplis par le moteur (sources, vérification, écarts, rang). */
const auditPme = {
  ...audit,
  id: 'test-pme-1',
  input: { businessName: 'Paysia', trade: 'logiciel de paie pour PME', city: 'France', website: 'paysia.fr', segment: 'pme' as const, category: 'logiciel de paie pour PME', offering: 'La paie en ligne pour les PME de 10 à 250 salariés', market: 'France' },
  segment: 'pme' as const,
  competitors: [{ name: 'PayFit', mentions: 22, share: 0.55 }, { name: 'Silae', mentions: 15, share: 0.38 }, { name: 'Lucca', mentions: 9, share: 0.22 }],
  benchmark: { rank: 4, of: 12, label: '4ᵉ sur 12 logiciels de paie cités par les IA' },
  sources: {
    totalCitations: 40,
    domains: [
      { domain: 'capterra.fr', label: 'Capterra', category: 'comparatif' as const, citations: 9, citationShare: 0.22, providers: ['chatgpt' as const, 'perplexity' as const], queries: ['q1'], clientPresence: 'absent' as const, competitorsPresent: ['PayFit', 'Silae'], sampleUrls: ['https://www.capterra.fr/directory/paie'] },
    ],
    byCategory: { comparatif: 9 },
    opportunities: Array.from({ length: 10 }, (_, i) => ({
      domain: `source-${i + 1}.fr`, label: `Source ${i + 1}`, category: (i % 2 ? 'avis' : 'comparatif') as 'avis' | 'comparatif', score: 90 - i * 7,
      why: `Cité dans ${10 - i} réponses sur 32, par ChatGPT et Perplexity.`, action: `Être ajouté au comparatif Source ${i + 1}`,
      howTo: ['Créez votre profil.', 'Écrivez à l’auteur.', 'Collectez des avis.'], effort: 'M' as const, impact: 3 as const, competitorsPresent: ['PayFit'],
    })),
    clientCitedCount: 2,
    note: 'Gemini sans ancrage',
  },
  factCheck: {
    checkedAt: '2026-11-09T09:00:00.000Z', errors: 1,
    items: [{ field: 'prix' as const, expected: '6 € par salarié et par mois', stated: '12 € par salarié et par mois', provider: 'chatgpt' as const, quote: 'Paysia coûte 12 € par salarié et par mois.', verdict: 'faux' as const, severity: 'haute' as const }],
  },
  gaps: [{ competitor: 'PayFit', mentions: 22, share: 0.55, presentOn: ['Capterra', 'G2'], reasons: ['Présent sur Capterra et G2, où vous n’êtes pas.', 'Son comparatif « PayFit vs Silae » est cité 5 fois.'] }],
} as AuditResult;

describe('PDF', () => {
  it('génère le rapport V2 (5 pages) et l’écrit sur disque', async () => {
    const buf = await renderReportPdf(audit);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const out = path.resolve(process.cwd(), '.data/sample-report.pdf');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, buf);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(5 * 1024);
    const pages = countPages(readFileSync(out));
    expect(pages).toBeGreaterThanOrEqual(4);
    expect(pages).toBeLessThanOrEqual(5);
  });
  it('génère le rapport V2 d’un audit PME avec sources, vérité et écarts', async () => {
    const buf = await renderReportPdf(auditPme);
    writeFileSync(path.resolve(process.cwd(), '.data/sample-report-pme.pdf'), buf);
    writeFileSync(path.resolve(process.cwd(), '.data/sample-report-pme-full.pdf'), await renderReportPdf(auditPme, { unlocked: true }));
    const pages = countPages(buf);
    expect(pages).toBeGreaterThanOrEqual(4);
    expect(pages).toBeLessThanOrEqual(5);
    const full = await renderReportPdf(auditPme, { unlocked: true });
    expect(countPages(full)).toBeLessThanOrEqual(5);
  });
  it('V3 : marge d’erreur et URL citées, 5 pages au plus', async () => {
    const withUrls = {
      ...auditPme,
      margins: { method: 'bootstrap-questions', samples: 500, level: 0.9, questions: 4, score: { value: 23, low: 15, high: 31, margin: 8 }, mentionRate: { value: 0.17, low: 0.1, high: 0.25, margin: 0.075 }, shareOfVoice: { value: 0.12, low: 0.08, high: 0.16, margin: 0.04 }, label: 'Score 23 ± 8' },
      sources: {
        ...auditPme.sources!,
        urls: Array.from({ length: 7 }, (_, i) => ({ url: `https://www.capterra.fr/paie/page-${i + 1}`, domain: 'capterra.fr', category: 'comparatif' as const, providers: ['chatgpt' as const], queries: ['q1'], citations: 9 - i, bestPosition: 1, clientPresent: false, competitorsPresent: ['PayFit'] })),
      },
    } as AuditResult;
    for (const unlocked of [false, true]) {
      const buf = await renderReportPdf(withUrls, { unlocked });
      expect(countPages(buf)).toBeLessThanOrEqual(5);
      expect(countPages(buf)).toBeGreaterThanOrEqual(4);
    }
    const mock = createMockAudit({ businessName: 'Maison Sora', trade: 'cosmétiques solides', city: 'France', segment: 'ecommerce', productCategories: ['shampoing solide', 'déodorant solide'], market: 'France' } as never, 'pdf-v3');
    const full = await renderReportPdf(mock, { unlocked: true });
    writeFileSync(path.resolve(process.cwd(), '.data/sample-report-v3.pdf'), full);
    expect(countPages(full)).toBeLessThanOrEqual(5);
  });
  it('génère le plan d’action', async () => {
    const buf = await renderActionPlanPdf(audit, [...actions, ...actions.map((a) => ({ ...a, id: a.id + '2' }))]);
    expect(buf.length).toBeGreaterThan(3 * 1024);
    writeFileSync(path.resolve(process.cwd(), '.data/sample-plan.pdf'), buf);
  });
  it('signe et vérifie le jeton', () => {
    const t = signPlanToken('abc');
    expect(verifyPlanToken('abc', t)).toBe(true);
    expect(verifyPlanToken('abd', t)).toBe(false);
    expect(verifyPlanToken('abc', 'zz')).toBe(false);
    expect(verifyPlanToken('abc', null)).toBe(false);
  });
});
