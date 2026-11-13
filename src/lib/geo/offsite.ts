/**
 * Section « Présence hors site » : à partir des sources que citent réellement les IA (moteur d'audit), quels sites
 * tiers comptent (annuaires, avis, Reddit et forums, Wikipédia, médias, comparateurs, marketplaces) et où le client
 * n'a ni lien ni présence vérifiée. Sans réponses d'IA mesurées : section « non mesurée » (aucune liste générique).
 */
import type { ProviderAnswer } from '@/lib/engine/types';
import type { SourceCategory } from '@/lib/engine/types-v2';
import { CATEGORY_LABEL, classifyDomain, normalizeUrl } from '@/lib/engine/sources/classify';
import { extractInlineUrls, howToFor, sourceAnswers } from '@/lib/engine/sources';
import { registrableDomain } from '@/lib/engine/detect';
import type { EngineSourceInput, GeoFinding, GeoSection, OffsiteDomain, OffsiteSummary } from './types';
import { finding, plural, section } from './util';

const CAT = 'geo.sources';

const TARGETS: { cats: SourceCategory[]; id: string; label: string; why: string }[] = [
  { cats: ['annuaire'], id: 'annuaires', label: 'annuaires et plateformes de fiches', why: 'Les IA s’appuient sur ces fiches pour vérifier qu’une entreprise existe, où et quand elle ouvre.' },
  { cats: ['avis'], id: 'avis', label: 'plateformes d’avis', why: 'Les avis tiers sont une des sources les plus reprises pour recommander une entreprise plutôt qu’une autre.' },
  { cats: ['forum'], id: 'forums', label: 'forums, Reddit et sites de questions-réponses', why: 'Les IA citent des discussions réelles d’utilisateurs ; y être mentionné de façon authentique compte.' },
  { cats: ['wikipedia'], id: 'wikipedia', label: 'Wikipédia et encyclopédies', why: 'Les encyclopédies servent de référence d’identité ; l’admissibilité dépend de sources indépendantes.' },
  { cats: ['media_national', 'media_local'], id: 'medias', label: 'médias', why: 'Les moteurs d’IA citent surtout des médias tiers plutôt que les sites de marque (étude Univ. Toronto, 2025).' },
  { cats: ['comparatif'], id: 'comparatifs', label: 'comparatifs et classements', why: 'Les listes « meilleurs … » et comparateurs sont reprises telles quelles dans les réponses de type « quel … choisir ».' },
  { cats: ['marketplace'], id: 'marketplaces', label: 'marketplaces', why: 'Pour les questions d’achat, les IA renvoient souvent vers les fiches des places de marché.' },
];

interface Agg {
  domain: string;
  url?: string;
  title?: string;
  citations: number;
  providers: Set<string>;
  category?: SourceCategory;
  clientPresent?: boolean | null;
}

function domainOf(x: string): string | null {
  const n = normalizeUrl(x);
  return n?.domain ?? (x.includes('.') ? registrableDomain(x) : null);
}

/** Agrège les sources fournies (moteur) et celles des réponses brutes. */
export function aggregateSources(engineSources: EngineSourceInput[] = [], aiAnswers: ProviderAnswer[] = []): Agg[] {
  const map = new Map<string, Agg>();
  const add = (raw: string, n: number, provider: string | undefined, extra: Partial<Agg> = {}) => {
    const d = domainOf(raw);
    if (!d) return;
    const a = map.get(d) ?? { domain: d, citations: 0, providers: new Set<string>() };
    a.citations += n;
    if (provider) a.providers.add(provider);
    if (!a.url && /^https?:/i.test(raw)) a.url = raw;
    if (extra.title && !a.title) a.title = extra.title;
    if (extra.category && !a.category) a.category = extra.category;
    if (extra.clientPresent !== undefined && extra.clientPresent !== null) a.clientPresent = a.clientPresent === true ? true : extra.clientPresent;
    map.set(d, a);
  };
  for (const s of engineSources) {
    const raw = s.url ?? s.domain;
    if (!raw) continue;
    add(raw, Math.max(1, s.count ?? 1), undefined, { title: s.title, category: s.category, clientPresent: s.clientPresent });
    const a = map.get(domainOf(raw) ?? '');
    if (a) for (const p of s.providers ?? []) a.providers.add(p);
  }
  for (const ans of sourceAnswers(aiAnswers)) {
    const urls = ans.sources?.length ? ans.sources.filter((s) => s.kind !== 'retrieved').map((s) => s.url) : ans.citations;
    for (const u of new Set([...urls, ...extractInlineUrls(ans.text)])) add(u, 1, ans.provider);
  }
  return [...map.values()];
}

export function auditOffsite(
  opts: { origin: string; brand: string | null; engineSources?: EngineSourceInput[]; aiAnswers?: ProviderAnswer[]; linkedDomains: string[] },
): { section: GeoSection; summary: OffsiteSummary } {
  const aggs = aggregateSources(opts.engineSources, opts.aiAnswers);
  const clientDomain = registrableDomain(opts.origin);
  const linked = new Set(opts.linkedDomains.map((d) => registrableDomain(d)));
  const allDemo = !!opts.aiAnswers?.length && opts.aiAnswers.every((a) => a.demo) && !opts.engineSources?.length;
  if (!aggs.length) {
    const summary: OffsiteSummary = { measured: false, totalCitations: 0, ownShare: 0, byCategory: [], domains: [] };
    const note = 'Non mesuré : aucune source citée par les IA n’a été fournie. Lancez un audit IA (moteur Repéré) pour savoir quels sites tiers les IA citent dans votre secteur.';
    return { section: section('hors_site', 'Présence hors site (sources citées par les IA)', 15, [], note, false), summary };
  }
  const domains: OffsiteDomain[] = aggs.map((a) => {
    const c = classifyDomain(a.url ?? a.domain, { clientDomain, clientName: opts.brand ?? undefined, title: a.title });
    const category = c.category === 'client' ? 'client' : (a.category ?? c.category);
    const presence: OffsiteDomain['clientPresence'] =
      category === 'client' ? 'verifiee' : a.clientPresent === true ? 'verifiee' : a.clientPresent === false ? 'absente' : linked.has(a.domain) ? 'liee' : 'inconnue';
    return {
      domain: a.domain,
      label: c.label,
      category,
      categoryLabel: CATEGORY_LABEL[category],
      citations: a.citations,
      providers: [...a.providers],
      clientPresence: presence,
      ...(c.howTo ? { howTo: c.howTo } : {}),
    };
  });
  domains.sort((x, y) => y.citations - x.citations || x.domain.localeCompare(y.domain));
  const total = domains.reduce((s, d) => s + d.citations, 0);
  const own = domains.filter((d) => d.category === 'client').reduce((s, d) => s + d.citations, 0);
  const byCat = new Map<SourceCategory, number>();
  for (const d of domains) byCat.set(d.category, (byCat.get(d.category) ?? 0) + d.citations);
  const summary: OffsiteSummary = {
    measured: true,
    totalCitations: total,
    ownShare: total ? own / total : 0,
    byCategory: [...byCat.entries()].map(([category, citations]) => ({ category, label: CATEGORY_LABEL[category], citations, share: total ? citations / total : 0 })).sort((a, b) => b.citations - a.citations),
    domains: domains.slice(0, 100),
  };

  const findings: GeoFinding[] = [];
  for (const t of TARGETS) {
    const inCat = domains.filter((d) => t.cats.includes(d.category));
    const catCitations = inCat.reduce((s, d) => s + d.citations, 0);
    const gaps = inCat.filter((d) => d.clientPresence === 'absente' || d.clientPresence === 'inconnue');
    if (!gaps.length) continue;
    const share = total ? catCitations / total : 0;
    const verifiedAbsent = gaps.filter((d) => d.clientPresence === 'absente').length;
    const steps = howToFor(t.cats[0], gaps[0].howTo);
    findings.push(
      finding({
        id: `geo.sources.${t.id}`,
        category: CAT,
        severity: share >= 0.2 ? 'high' : share >= 0.08 ? 'medium' : 'low',
        title: `Les IA citent ${plural(gaps.length, 'site', 'sites')} de type ${t.label} où ${verifiedAbsent === gaps.length ? 'vous êtes absent' : 'votre présence n’est pas établie'} (${gaps
          .slice(0, 3)
          .map((d) => d.label)
          .join(', ')}${gaps.length > 3 ? '…' : ''})`,
        why: `${t.why} Ces sites pèsent ${Math.round(share * 100)} % des citations observées.`,
        fix: steps.join(' '),
        affected: gaps.map((d) => ({
          url: d.domain.startsWith('http') ? d.domain : `https://${d.domain}`,
          detail: `${d.citations} citation(s)${d.providers.length ? ` — ${d.providers.join(', ')}` : ''} ; ${d.clientPresence === 'absente' ? 'absence vérifiée' : 'aucun lien depuis votre site, présence non vérifiée'}`,
        })),
        impact: share >= 0.2 ? 3 : 2,
        effort: t.id === 'wikipedia' || t.id === 'medias' ? 3 : 2,
        evidenceLevel: 'probable',
        evidence: `${catCitations} citation(s) sur ${total} observées${allDemo ? ' (réponses de démonstration)' : ''}.`,
      }),
    );
  }
  if (total >= 5 && own === 0) {
    findings.push(
      finding({
        id: 'geo.sources.own_never_cited',
        category: CAT,
        severity: 'medium',
        title: `Votre site n’apparaît dans aucune des ${total} citations observées`,
        why: 'Les IA vous connaissent alors par des tiers : vos pages ne servent pas de source pour les faits qui vous concernent.',
        fix: 'Travaillez l’accès des robots, les passages citables et la couverture des questions (sections ci-dessus) ; c’est ce qui rend vos pages candidates.',
        affected: [{ url: opts.origin }],
        impact: 2,
        effort: 2,
        evidenceLevel: 'probable',
      }),
    );
  }
  const note = `${total} citation(s) observée(s) sur ${plural(domains.length, 'domaine', 'domaines')}${allDemo ? ' (démo)' : ''} ; part de votre site : ${Math.round(summary.ownShare * 100)} %. Présence « liée » = votre site pointe vers ce domaine ; non vérifiée sinon.`;
  return { section: section('hors_site', 'Présence hors site (sources citées par les IA)', 15, findings, note, true), summary };
}
