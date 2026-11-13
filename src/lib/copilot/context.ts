/**
 * Contexte compact du copilote : uniquement les données du client (docs/v2/06-indispensable.md § 3).
 * Dernier audit (score, sources top 10, perception, gaps, factCheck), fiche de vérité, tâches, trafic IA.
 */
import type { AuditResult, ProviderId } from '@/lib/engine';
import type {
  AiTrafficSummary,
  AuditResultV2Ext,
  BenchmarkPosition,
  BrandFacts,
  ExecTask,
  FactCheckReport,
  Segment,
} from '@/lib/engine/types-v2';
import { getBusinessRecord, listAuditsForBusiness, type BusinessRecord } from '@/lib/db';
import { FACT_LABELS, getFacts, getLatestFactCheck } from '@/lib/facts';
import { rankInAudit } from '@/lib/digest/benchmark';
import { auditStats, rankMove } from '@/lib/digest/stats';
import { getAiTraffic, listTasks } from '@/lib/digest/deps';
import { PROVIDER_LABEL } from '@/lib/alerts';

export type AuditV2 = AuditResult & AuditResultV2Ext;

export interface CopilotContext {
  business: BusinessRecord;
  segment: Segment;
  latest: AuditV2 | null;
  history: { at: string; score: number }[];
  rank: BenchmarkPosition | null;
  facts: BrandFacts;
  factCheck: FactCheckReport | null;
  tasks: ExecTask[];
  traffic: AiTrafficSummary | null;
  demo: boolean;
  /** audits du plus ancien au plus récent (évolution du rang) */
  historyAudits?: AuditV2[];
  /** e-commerce : présence par PRODUIT, mêmes chiffres que l'écran Produits (buildProductTracking) */
  products?: import('@/lib/ecommerce/types').ProductStat[];
  /** e-commerce : catalogue suivi (fiches au niveau du produit) */
  catalog?: import('@/lib/ecommerce/types').CatalogProduct[];
  /** local : dernier audit de la fiche Google (même calcul que /app/local/fiche-google) ; null = pas encore audité */
  gbp?: GbpSummary | null;
}

export interface GbpSummary {
  score: number;
  /** part de la grille évaluée (points / 100) */
  coverage: number;
  createdAt: string;
  demo: boolean;
  /** critères manquants ou incomplets, du plus coûteux au moins coûteux */
  missing: { label: string; fix: string; lost: number; status: 'fail' | 'warn' }[];
  evaluated: number;
  ok: number;
}

export async function loadCopilotContext(businessId: string): Promise<CopilotContext | null> {
  const business = await getBusinessRecord(businessId);
  if (!business) return null;
  const audits = (await listAuditsForBusiness(businessId)) as AuditV2[];
  const latest = audits.at(-1) ?? null;
  const [facts, check, tasks, traffic] = await Promise.all([
    getFacts(businessId),
    getLatestFactCheck(businessId),
    listTasks(businessId),
    getAiTraffic(businessId, 30),
  ]);
  return {
    business,
    segment: business.segment ?? latest?.segment ?? 'local',
    latest,
    history: audits.map((a) => ({ at: a.createdAt, score: a.score })),
    rank: latest ? rankInAudit(latest) : null,
    facts,
    factCheck: check?.report ?? latest?.factCheck ?? null,
    tasks,
    traffic,
    demo: Boolean(latest?.demo),
    historyAudits: audits,
    ...(await ecommerceOf(business, (business.segment ?? latest?.segment) === 'ecommerce')),
    ...((business.segment ?? latest?.segment ?? 'local') === 'local' ? { gbp: await gbpOf(business.id) } : {}),
  };
}

/** Résumé de l'audit de fiche Google (démo : audit de démonstration ; sinon dernier audit rangé). Jamais bloquant. */
export async function gbpOf(businessId: string): Promise<GbpSummary | null> {
  try {
    const { buildLocalDemo, gbpPriorities } = await import('@/lib/local');
    const { isDemoBusinessId } = await import('@/lib/demo-v2');
    let audit: import('@/lib/local/types').GbpAudit | null = null;
    if (isDemoBusinessId(businessId)) audit = (await buildLocalDemo(businessId))?.gbp ?? null;
    else audit = await (await import('@/lib/local/repo')).latestGbpAudit(businessId);
    if (!audit) return null;
    const evaluatedCriteria = audit.criteria.filter((x) => x.status !== 'unknown');
    return {
      score: audit.score,
      coverage: audit.coverage,
      createdAt: audit.createdAt,
      demo: Boolean(audit.demo),
      missing: gbpPriorities(audit, 6).map((x) => ({ label: x.label, fix: x.fix, lost: x.max - x.points, status: x.status as 'fail' | 'warn' })),
      evaluated: evaluatedCriteria.length,
      ok: audit.criteria.filter((x) => x.status === 'ok').length,
    };
  } catch {
    return null;
  }
}

/** Produits suivis (même calcul que l'écran Produits), tolérant à l'absence du module. */
async function ecommerceOf(business: BusinessRecord, ecom: boolean): Promise<Pick<CopilotContext, 'products' | 'catalog'>> {
  if (!ecom) return {};
  try {
    const { loadContext, buildProductTracking } = await import('@/lib/ecommerce');
    const c = await loadContext({ id: business.id, name: business.name, website: business.website });
    const t = buildProductTracking(c.audit, c.catalog, { demo: c.demo });
    return { products: t.products, catalog: c.catalog.products };
  } catch {
    return {};
  }
}

export const frDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(iso));

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const pct = (x: number) => `${Math.round(x * 100)} %`;
/** Montant en euros au format français (« 1 234,50 € ») : le modèle reprend tel quel ce qu'il lit. */
const eur = (x: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(x).replace(/[\u202f\u00a0]/g, ' ')} €`;
/** Donnée tierce (réponses d'IA, sources, concurrents, trafic, saisies) : jamais de balise, d'accent grave ni de saut de ligne (E4). */
const d = (s: unknown, n = 300) => cut(String(s ?? '').replace(/[<>`]/g, ' ').replace(/\s+/g, ' ').trim(), n);
/** Chemin d'URL : caractères d'URL seulement. */
const pathOf = (s: string) => s.replace(/[^A-Za-z0-9/_.~%-]/g, '').slice(0, 80) || '/';

/** Sérialise le contexte en texte compact (≈ 6 à 9 k caractères max) pour le prompt. */
export function contextToText(c: CopilotContext): string {
  const L: string[] = [];
  const b = c.business;
  L.push(`# Entreprise`);
  L.push(`${d(b.name, 120)} — parcours ${c.segment} — ${d(b.trade, 80)}, ${d(b.city, 80)}${b.district ? ` ${d(b.district, 60)}` : ''}${b.website ? ` — site ${d(b.website, 120)}` : ''}${c.demo ? ' — DONNÉES DE DÉMONSTRATION' : ''}`);

  const a = c.latest;
  if (!a) {
    L.push(`\n# Audit\nAucun audit disponible pour l'instant.`);
  } else {
    const st = auditStats(a);
    L.push(`\n# Dernier audit (${frDate(a.measuredAt ?? a.createdAt)})`);
    L.push(`Score ${a.score}/100 (marge ${a.range.low}–${a.range.high}), confiance ${a.confidence}.`);
    L.push(`Chiffres clés : ${st.methodLabel} ; vous êtes cité dans ${st.citations} réponses sur ${st.answers} (${st.citedQuestions} questions sur ${st.questions}) ; part de voix ${pct(st.shareOfVoice)} ; rang ${d(st.label, 160)}.`);
    L.push(`Historique : ${c.history.map((h) => `${frDate(h.at)} ${h.score}`).join(' → ')}`);
    L.push(`Par IA : ${(Object.entries(a.subScores) as [ProviderId, number | null][]).filter(([, v]) => v !== null).map(([p, v]) => `${PROVIDER_LABEL[p]} ${v}`).join(', ')}`);
    const mv = rankMove([...(c.historyAudits ?? [])], 'month');
    if (mv) L.push(`Évolution du rang : ${mv.label}${mv.explanation ? ` — ${d(mv.explanation, 160)}` : ''}`);
    if (st.rows.length > 1) L.push(`Classement (citations) : ${st.rows.slice(0, 10).map((x) => `${d(x.name, 80)} ${x.mentions} (${pct(x.share)})`).join(' ; ')}`);
    L.push(`Questions posées aux IA : ${a.queries.slice(0, 12).map((q) => `« ${d(q.text, 160)} »`).join(' ; ')}`);
    if (a.sources) {
      L.push(`\n# Sources citées (top 10 sur ${a.sources.totalCitations} citations)${a.sources.note ? ` — ${a.sources.note}` : ''}`);
      for (const x of a.sources.domains.slice(0, 10)) {
        L.push(`- ${d(x.domain, 80)} (${x.category}, ${x.citations} cit., client ${x.clientPresence === 'present' ? 'présent' : x.clientPresence === 'absent' ? 'absent' : 'inconnu'}${x.competitorsPresent.length ? `, concurrents présents : ${x.competitorsPresent.slice(0, 4).map((n) => d(n, 60)).join(', ')}` : ''})`);
      }
      if (a.sources.opportunities.length) {
        L.push(`Opportunités classées : ${a.sources.opportunities.slice(0, 6).map((o) => `${d(o.label, 80)} [score ${o.score}, effort ${o.effort}] : ${d(o.action, 160)}`).join(' ; ')}`);
      }
    }
    if (a.perception) {
      const s = a.perception.sentiment;
      L.push(`\n# Ce que disent les IA`);
      L.push(`Sentiment : positif ${pct(s.positif)}, neutre ${pct(s.neutre)}, négatif ${pct(s.negatif)}. Thèmes : ${a.perception.themes.map((t) => d(t, 60)).join(', ') || '—'}.`);
      for (const q of a.perception.quotes.slice(0, 5)) L.push(`- ${PROVIDER_LABEL[q.provider]} (« ${d(q.query, 80)} », ${q.sentiment}) : « ${d(q.text, 260)} »`);
      for (const cl of a.perception.claims.slice(0, 8)) L.push(`- Affirmation ${PROVIDER_LABEL[cl.provider]} sur ${cl.field} : « ${d(cl.value, 120)} »`);
    } else if (a.excerpts.length) {
      L.push(`\n# Extraits de réponses`);
      for (const e of a.excerpts.slice(0, 4)) L.push(`- ${PROVIDER_LABEL[e.provider]} (« ${d(e.query, 80)} »${e.mentioned ? ', vous cite' : ', ne vous cite pas'}) : « ${d(e.text, 220)} »`);
    }
    if (a.gaps?.length) {
      L.push(`\n# Pourquoi les concurrents passent devant`);
      for (const g of a.gaps.slice(0, 5)) L.push(`- ${d(g.competitor, 80)} (${g.mentions} citations) : ${g.reasons.map((r) => d(r, 160)).join(' ; ')}${g.presentOn.length ? ` — présent sur ${g.presentOn.slice(0, 5).map((x) => d(x, 60)).join(', ')} (pas vous)` : ''}`);
    }
  }

  const facts = Object.entries(c.facts.facts) as [keyof typeof FACT_LABELS, string][];
  L.push(`\n# Fiche de vérité${c.facts.updatedAt ? ` (mise à jour le ${frDate(c.facts.updatedAt)})` : ''}`);
  L.push(facts.length ? facts.map(([k, v]) => `- ${FACT_LABELS[k]} : ${d(v, 300)}`).join('\n') : 'Non renseignée.');
  if (c.factCheck) {
    const errs = c.factCheck.items.filter((i) => i.verdict === 'faux');
    L.push(`Exactitude : ${errs.length} erreur(s) sur ${c.factCheck.items.length} affirmation(s) vérifiée(s).`);
    for (const e of errs.slice(0, 5)) L.push(`- ERREUR ${PROVIDER_LABEL[e.provider]} sur ${FACT_LABELS[e.field]} : dit « ${d(e.stated, 200)} », vrai « ${d(e.expected, 200)} »`);
  }

  if (c.tasks.length) {
    L.push(`\n# Tâches`);
    for (const t of c.tasks.slice(0, 10)) L.push(`- [${t.status}] ${d(t.title, 160)} (${t.minutes} min, impact ${t.impact})`);
  }
  if (c.traffic && (c.traffic.installed || c.traffic.demo)) {
    const t = c.traffic.totals;
    L.push(`\n# Trafic venu des IA (30 jours${c.traffic.demo ? ', démo' : ''})`);
    L.push(`${t.aiVisits} visites (${pct(t.aiShare)} du trafic), ${t.conversions} ${c.segment === 'local' ? 'appels ou e-mails déclenchés' : 'conversions'}. Par moteur : ${Object.entries(t.byEngine).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
    if (c.traffic.commerce) {
      const k = c.traffic.commerce;
      L.push(`Ventes venues des IA (${k.source}) : ${k.orders} commandes, ${eur(k.revenueEur)} de CA. Par IA : ${Object.entries(k.byEngine).map(([e, v]) => `${e} ${v?.orders ?? 0} commandes / ${eur(v?.revenueEur ?? 0)}`).join(', ')}. Produits : ${k.products.map((p) => `${d(p.name, 60)} ${p.orders} commandes / ${eur(p.revenueEur)}`).join(', ')}.`);
    } else if (c.segment === 'ecommerce') {
      L.push('Ventes venues des IA : non connectées (Shopify ou GA4 à connecter).');
    }
    if (c.traffic.topLandingPages.length) L.push(`Pages d'arrivée : ${c.traffic.topLandingPages.slice(0, 5).map((p) => `${pathOf(p.path)} (${p.visits})`).join(', ')}`);
  } else {
    L.push(`\n# Trafic venu des IA\nNon mesuré (snippet non installé).`);
  }
  // Le délimiteur </donnees_client> ne peut jamais être reproduit par une donnée.
  return cut(L.join('\n').replace(/<\/?\s*donnees_client/gi, ' '), 9000);
}
