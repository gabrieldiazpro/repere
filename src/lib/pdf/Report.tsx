import React from 'react';
import { Document, Page, Text, View, Svg, Path, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
import type { AuditResult, ActionItem } from '@/lib/engine';
import { C, bandFor } from './theme';
import {
  PROVIDER_LABEL, pct, formatDateFr, providersOf, queryMatrix, byProvider, isDirectory,
  highlightSegments, excerptAround, siteUrl,
} from './derive';
import type { CompetitorGap, Segment } from '@/lib/engine/types-v2';
import {
  AUTOMATION_LABEL, CATEGORY_LABEL, FIELD_LABEL, benchmarkOf, groupClaims, factCheckOf, gapsOf, isDemoAccountAudit, isPlatformName,
  marketOf, offersFor, perceptionOf, previewTasks, segmentOf, shockLine, sourcesOf, topicOf,
  type ReportResult, type SegmentOffer, type SourcesView, type TaskPreview,
} from '@/components/report/adapters';
import { citedUrls, shortUrl, summaryOf, type CitedUrl, type Summary } from '@/components/report/v3';

// Helvetica intégrée : aucune police réseau. Pas de césure automatique.
Font.registerHyphenationCallback((w) => [w]);

const F = 'Helvetica';
const FB = 'Helvetica-Bold';
const MARGIN = 40; // ≈ 14 mm

const s = StyleSheet.create({
  page: { paddingTop: MARGIN, paddingHorizontal: MARGIN, paddingBottom: 56, fontFamily: F, fontSize: 9.5, color: C.ink, lineHeight: 1.35 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  brand: { fontFamily: FB, fontSize: 14, color: C.primary },
  brandSub: { fontSize: 8, color: C.muted },
  dateTxt: { fontSize: 9, color: C.muted },
  demoBanner: { backgroundColor: C.warningBg, color: C.warningInk, fontFamily: FB, fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 10, borderRadius: 3 },
  h1: { fontFamily: FB, fontSize: 22, color: C.ink, lineHeight: 1.2, marginBottom: 2 },
  sub: { fontSize: 11, color: C.muted, marginTop: 2 },
  h2: { fontFamily: FB, fontSize: 10, color: C.primary, letterSpacing: 0.8, marginBottom: 6 },
  section: { marginTop: 10 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line, marginTop: 8 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 7, marginBottom: 5, backgroundColor: C.white },
  small: { fontSize: 8.5, color: C.muted },
  bold: { fontFamily: FB },
  hl: { backgroundColor: C.accent, color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center' },
  footer: { position: 'absolute', left: MARGIN, right: MARGIN, bottom: 22, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.muted },
  watermark: { position: 'absolute', top: 330, left: 90, fontFamily: FB, fontSize: 120, color: '#E9E7F7', transform: 'rotate(-30deg)' },
});

const EFFORT: Record<ActionItem['effort'], string> = { S: '15-30 min', M: '1-2 h', L: 'demi-journée' };
const IMPACT: Record<number, string> = { 1: 'Impact : modéré', 2: 'Impact : bon', 3: 'Impact : fort' };

/* ---------- briques communes ---------- */

function Footer({ r, total }: { r: AuditResult; total?: number }) {
  const url = `${siteUrl().replace(/^https?:\/\//, '')}/rapport/${r.id}`;
  return (
    <View style={s.footer} fixed>
      <Text>{`Repéré · référencement IA · ${formatDateFr(r.createdAt)}`}</Text>
      <Text render={({ pageNumber, totalPages }) => `Rapport en ligne : ${url} · page ${pageNumber}/${total ?? totalPages}`} />
    </View>
  );
}

function Top({ r }: { r: AuditResult }) {
  return (
    <>
      <View style={s.topBar}>
        <View>
          <Text style={s.brand}>Repéré</Text>
          <Text style={s.brandSub}>Le référencement IA clé en main</Text>
        </View>
        <Text style={s.dateTxt}>{`Audit du ${formatDateFr(r.createdAt)}`}</Text>
      </View>
      {r.demo ? <Text style={s.demoBanner}>RAPPORT DE DÉMONSTRATION : données simulées, pas une mesure réelle.</Text> : null}
    </>
  );
}

function Watermark({ r }: { r: AuditResult }) {
  return r.demo ? <Text style={s.watermark} fixed>DÉMO</Text> : null;
}

function Bar({ value, color, h = 7, track = C.line }: { value: number; color: string; h?: number; track?: string }) {
  const w = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height: h, backgroundColor: track, borderRadius: h / 2, flexGrow: 1 }}>
      <View style={{ height: h, width: `${w}%`, backgroundColor: color, borderRadius: h / 2 }} />
    </View>
  );
}

/** Jauge demi-circulaire en primitives Svg (statique). */
function Gauge({ score, range, color }: { score: number; range?: { low: number; high: number }; color: string }) {
  const W = 230, H = 140, cx = 115, cy = 115, r = 88, sw = 16;
  const pt = (t: number, rad: number) => {
    const a = Math.PI * (1 - Math.max(0, Math.min(1, t)));
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)] as const;
  };
  const arc = (t0: number, t1: number, rad: number) => {
    const [x0, y0] = pt(t0, rad); const [x1, y1] = pt(t1, rad);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${rad} ${rad} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const t = Math.max(0.004, Math.min(1, score / 100));
  const hasRange = range && Number.isFinite(range.low) && Number.isFinite(range.high) && range.high > range.low;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={arc(0, 1, r)} stroke={C.line} strokeWidth={sw} fill="none" strokeLinecap="round" />
      <Path d={arc(0, t, r)} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" />
      {hasRange ? <Path d={arc(Math.max(0, range!.low) / 100, Math.min(100, range!.high) / 100, r + 15)} stroke={C.muted} strokeWidth={3} fill="none" /> : null}
      {/* graduations 40 et 70 (limites des tranches) */}
      {[0.4, 0.7].map((g) => {
        const [x0, y0] = pt(g, r - sw / 2 - 3); const [x1, y1] = pt(g, r + sw / 2 + 3);
        return <Path key={g} d={`M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)}`} stroke={C.white} strokeWidth={2} />;
      })}
    </Svg>
  );
}

/* ---------- V2 : données dérivées (partagées avec le rapport web) ---------- */

type V2 = {
  summary: Summary;
  urls: CitedUrl[];
  seg: Segment;
  bench: ReturnType<typeof benchmarkOf>;
  shock: string;
  sources: SourcesView;
  perception: ReturnType<typeof perceptionOf>;
  fc: ReturnType<typeof factCheckOf>;
  gaps: CompetitorGap[];
  tasks: TaskPreview[];
  offers: SegmentOffer[];
  topic: string;
  market: string;
  unlocked: boolean;
};

/** Helvetica (WinAnsi) : pas d'exposants Unicode, d'étoiles ni de coches. */
export function pdfSafe(t: string): string {
  return String(t ?? '')
    .replace(/ᵉʳ/g, 'er').replace(/ᵉ/g, 'e')
    .replace(/[★]/g, '*').replace(/[☆]/g, '').replace(/[✓✔]/g, 'oui').replace(/[✗✘]/g, 'non')
    .replace(/[→]/g, '>').replace(/≈/g, '~').replace(/[  ]/g, ' ');
}

function buildV2(r: ReportResult, unlocked: boolean): V2 {
  const sources = sourcesOf(r);
  return {
    seg: segmentOf(r),
    bench: benchmarkOf(r),
    shock: shockLine(r),
    sources,
    perception: perceptionOf(r),
    fc: factCheckOf(r),
    gaps: gapsOf(r, sources).gaps,
    tasks: previewTasks(r, sources),
    offers: offersFor(segmentOf(r)),
    topic: topicOf(r),
    market: marketOf(r),
    unlocked,
    summary: summaryOf(r),
    urls: citedUrls(r, 5),
  };
}


function verdict(r: AuditResult, cited: number, total: number, leader?: string): string {
  const base = `Lors des interrogations du ${formatDateFr(r.createdAt)}, ${r.input.businessName} a été cité dans ${cited} réponse${cited > 1 ? 's' : ''} sur ${total}.`;
  if (r.score >= 70) return `${base} Les IA vous recommandent : voici comment garder l'avance.`;
  if (leader) return `${base} ${leader} est cité plus souvent. C'est un point de départ, et il existe des actions simples pour progresser.`;
  return `${base} C'est un point de départ, et il existe des actions simples pour progresser.`;
}

/* ---------- Page 1 : synthèse ---------- */

function Page1({ r, v2 }: { r: ReportResult; v2: V2 }) {
  const band = bandFor(r.score);
  // Même base que le rapport web (auditStats) et marge du moteur (computeMargins) : src/components/report/v3.ts.
  const { cited, answers: total, margin, action } = v2.summary;
  const leader = r.competitors.find((c) => !isDirectory(c.name) && !isPlatformName(c.name))?.name;
  const where = v2.seg === 'local'
    ? [r.input.trade, [r.input.district, r.input.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
    : [v2.topic, v2.market].filter(Boolean).join(' · ');
  const avgRank = r.avgRank != null ? `n° ${String(Math.round(r.avgRank * 10) / 10).replace('.', ',')}` : 'non classé';
  const ex = r.excerpts.slice(0, 2);
  return (
    <Page size="A4" style={s.page}>
      <Watermark r={r} />
      <Top r={r} />
      <Text style={s.h1}>{r.input.businessName}</Text>
      <Text style={s.sub}>{pdfSafe(where)}</Text>

      <View style={[s.row, { marginTop: 12, alignItems: 'flex-start' }]}>
        <View style={{ width: 230, height: 140 }}>
          <Gauge score={r.score} range={{ low: margin.low, high: margin.high }} color={band.color} />
          <View style={{ position: 'absolute', top: 62, left: 0, width: 230, alignItems: 'center' }}>
            <Text style={{ fontFamily: FB, fontSize: 40, color: band.color, lineHeight: 1 }}>{String(Math.round(r.score))}</Text>
            <Text style={{ fontSize: 10, color: C.muted }}>sur 100</Text>
          </View>
        </View>
        <View style={{ flexGrow: 1, flexShrink: 1, marginLeft: 16, paddingTop: 6 }}>
          <Text style={{ fontFamily: FB, fontSize: 12, color: band.ink, backgroundColor: band.bg, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 3, alignSelf: 'flex-start' }}>{band.label}</Text>
          {v2.bench.of > 1 ? (
            <View style={{ marginTop: 8, backgroundColor: C.primaryBg, borderRadius: 4, padding: 6 }}>
              <Text style={{ fontFamily: FB, fontSize: 16, color: C.primary, lineHeight: 1.25, marginBottom: 3 }}>{`${v2.bench.rank}${v2.bench.rank === 1 ? 'er' : 'e'} sur ${v2.bench.of}`}</Text>
              <Text style={{ fontSize: 8.5, color: C.ink }}>{pdfSafe(v2.bench.label)}</Text>
            </View>
          ) : null}
          <Text style={{ marginTop: 6 }}>{`Cité dans ${cited} réponse${cited > 1 ? 's' : ''} sur ${total} · rang moyen : ${avgRank}`}</Text>
          <Text>{`Score ${margin.short} · fiabilité : ${r.confidence}`}</Text>
          <Text style={s.small}>{pdfSafe(margin.long)}</Text>
        </View>
      </View>

      <Text style={{ marginTop: 8, fontFamily: FB, fontSize: 13, color: C.ink }}>{pdfSafe(v2.shock)}</Text>
      <Text style={{ marginTop: 6, fontSize: 10 }}>{verdict(r, cited, total, leader)}</Text>
      <View style={{ marginTop: 6, borderLeftWidth: 3, borderLeftColor: C.accent, backgroundColor: C.warningBg, paddingVertical: 4, paddingHorizontal: 7 }} wrap={false}>
        <Text style={{ fontFamily: FB, color: C.warningInk, fontSize: 8.5 }}>À FAIRE EN PREMIER</Text>
        <Text style={s.bold}>{pdfSafe(action.title)}</Text>
        <Text style={s.small}>{pdfSafe(action.why)}</Text>
      </View>
      <View style={s.rule} />

      <View style={s.section}>
        <Text style={s.h2}>CE QUE LES IA RÉPONDENT À VOS CLIENTS</Text>
        {ex.length === 0 ? <Text style={s.small}>Aucun extrait de réponse disponible pour cet audit.</Text> : null}
        {ex.map((e, i) => {
          const body = excerptAround(e.text, e.competitorsHighlighted ?? []);
          const segs = highlightSegments(body, e.competitorsHighlighted ?? []);
          return (
            <View key={i} style={s.card} wrap={false}>
              <Text style={s.small}>{`Question : « ${e.query} »`}</Text>
              <Text style={{ marginTop: 3 }}>
                <Text style={s.bold}>{`${PROVIDER_LABEL[e.provider]} : `}</Text>
                {segs.map((g, j) => <Text key={j} style={g.hl ? s.hl : undefined}>{g.text}</Text>)}
              </Text>
              <Text style={{ marginTop: 4, fontFamily: FB, color: e.mentioned ? C.successInk : C.dangerInk }}>
                {e.mentioned ? `${r.input.businessName} est cité dans cette réponse.` : `${r.input.businessName} n'apparaît pas dans cette réponse.`}
              </Text>
            </View>
          );
        })}
        <Text style={s.small}>{r.demo ? 'Extraits simulés pour illustrer le format. ' : ''}Noms surlignés : acteurs cités par les IA, sans appréciation de notre part.</Text>
      </View>
      <Footer r={r} />
    </Page>
  );
}

/* ---------- Page 2 : vérité et « pourquoi eux » ---------- */

function Page2({ r, v2 }: { r: ReportResult; v2: V2 }) {
  const comps = r.competitors.filter((c) => !isDirectory(c.name) && !isPlatformName(c.name)).slice(0, 4);
  const youShare = pct(r.shareOfVoice);
  const rows = [
    ...comps.map((c) => ({ name: c.name, v: pct(c.share), you: false })),
    { name: 'VOUS', v: youShare, you: true },
  ].sort((a, b) => b.v - a.v);
  const maxV = Math.max(1, ...rows.map((x) => x.v));
  const errors = v2.fc?.items.filter((i) => i.verdict === 'faux' || i.verdict === 'incomplet') ?? [];
  const claims = groupClaims(v2.perception.claims, 4);
  return (
    <Page size="A4" style={s.page}>
      <Watermark r={r} />
      <Top r={r} />
      <Text style={s.h2}>LES IA DISENT-ELLES DES CHOSES FAUSSES SUR VOUS ?</Text>
      {v2.fc ? (
        <Text style={{ marginBottom: 5, fontFamily: FB, color: v2.fc.errors ? C.dangerInk : C.successInk }}>
          {v2.fc.errors ? `${v2.fc.errors} information${v2.fc.errors > 1 ? 's' : ''} fausse${v2.fc.errors > 1 ? 's' : ''} repérée${v2.fc.errors > 1 ? 's' : ''} (détection sur échantillon, ${formatDateFr(v2.fc.checkedAt)}).` : `Aucune erreur sur les ${v2.fc.items.length} faits vérifiés.`}
        </Text>
      ) : (
        <Text style={[s.small, { marginBottom: 5 }]}>Affirmations factuelles relevées dans les réponses. Vous seul pouvez dire si elles sont justes.</Text>
      )}
      {errors.slice(0, 4).map((e, i) => (
        <View key={`e${i}`} style={[s.card, { borderColor: C.danger, backgroundColor: C.dangerBg }]} wrap={false}>
          <Text style={[s.bold, { color: C.dangerInk }]}>{`${FIELD_LABEL[e.field]} · ${e.verdict === 'faux' ? 'FAUX' : 'INCOMPLET'} selon ${PROVIDER_LABEL[e.provider]}`}</Text>
          <Text>{pdfSafe(`L'IA dit : ${e.stated}`)}</Text>
          <Text style={{ color: C.successInk, fontFamily: FB }}>{pdfSafe(`La bonne information : ${e.expected}`)}</Text>
        </View>
      ))}
      {!v2.fc && claims.map((c, i) => (
        <View key={`c${i}`} style={s.card} wrap={false}>
          <Text style={s.small}>{`${FIELD_LABEL[c.field].toUpperCase()} · À VÉRIFIER · selon ${c.providers.map((p) => PROVIDER_LABEL[p]).join(', ')}`}</Text>
          <Text style={s.bold}>{pdfSafe(c.value.slice(0, 160))}</Text>
        </View>
      ))}
      {!v2.fc && !claims.length ? <Text style={{ marginBottom: 4 }}>Les IA ne donnent presque aucun fait précis sur vous : c'est souvent le signe qu'elles manquent de sources fiables.</Text> : null}
      <Text style={[s.small, { marginTop: 2 }]}>Remplissez votre fiche de vérité dans votre espace Repéré : chaque réponse des IA est comparée avec elle, et toute erreur vous est signalée avec la correction à faire. Aucune correction par les IA n'est garantie.</Text>

      <View style={s.rule} />
      <View style={s.section}>
        <Text style={s.h2}>POURQUOI VOS CONCURRENTS PASSENT DEVANT</Text>
        {comps.length === 0 ? <Text style={[s.small, { marginBottom: 4 }]}>Les IA ne citent aucun acteur précis pour ces questions : la place est libre.</Text> : null}
        {rows.map((x, i) => (
          <View key={i} style={[s.row, { marginBottom: 4 }]}>
            <Text style={[x.you ? s.bold : {}, { width: 130, color: x.you ? C.primary : C.ink }]}>{x.you ? `VOUS (${r.input.businessName})`.slice(0, 24) : x.name.slice(0, 24)}</Text>
            <View style={{ flexGrow: 1, marginRight: 8 }}><Bar value={(x.v / maxV) * 100} color={x.you ? C.primary : C.muted} h={8} /></View>
            <Text style={[s.bold, { width: 36, textAlign: 'right' }]}>{`${x.v} %`}</Text>
          </View>
        ))}
        {v2.gaps.slice(0, 3).map((g) => (
          <View key={g.competitor} style={[s.card, { marginTop: 4 }]} wrap={false}>
            <Text style={[s.bold, { fontSize: 10.5 }]}>{g.competitor}</Text>
            {g.reasons.slice(0, 3).map((x, j) => <Text key={j} style={{ paddingLeft: 6 }}>{pdfSafe(`- ${x}`)}</Text>)}
          </View>
        ))}
        <Text style={s.small}>Faits relevés dans les réponses et les sources des IA ; ce n'est pas une évaluation de la qualité des acteurs cités.</Text>
      </View>
      <Footer r={r} />
    </Page>
  );
}

/* ---------- Page 3 : sources ---------- */

function Page3({ r, v2 }: { r: ReportResult; v2: V2 }) {
  // Une seule page A4 : 8 sources quand la liste des URL citées s'ajoute en bas.
  const cards = v2.sources.cards.slice(0, v2.urls.length ? 8 : 10);
  const presence = (p: string) => (p === 'present' ? 'Vous y êtes' : p === 'absent' ? 'Absent' : 'À vérifier');
  const presColor = (p: string) => (p === 'present' ? C.successInk : p === 'absent' ? C.dangerInk : C.muted);
  return (
    <Page size="A4" style={s.page}>
      <Watermark r={r} />
      <Top r={r} />
      <Text style={s.h2}>{`LES ${cards.length} SOURCES OÙ IL FAUT ÊTRE`}</Text>
      <Text style={[s.small, { marginBottom: 6 }]}>
        {v2.sources.groundedAnswers
          ? `Sites cités par les IA (${v2.sources.report.totalCitations} citations dans ${v2.sources.groundedAnswers} réponses), classés par opportunité pour vous.`
          : 'Sites de référence de votre secteur, classés par opportunité.'}
      </Text>
      {cards.map((c, i) => {
        const open = v2.unlocked || i < 3;
        // Une seule page A4 (rapport en 5 pages) : textes bornés quand les 10 cartes sont dépliées.
        const dense = v2.unlocked && cards.length > 5;
        const clip = (t: string, n: number) => (dense && t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
        return (
          <View key={c.domain} style={[s.card, dense ? { paddingVertical: 3, marginBottom: 3 } : { paddingVertical: 4, marginBottom: 4 }]} wrap={false}>
            <View style={s.row}>
              <Text style={{ fontFamily: FB, fontSize: 9.5, color: C.white, backgroundColor: C.primary, width: 16, textAlign: 'center', borderRadius: 8, marginRight: 6 }}>{String(i + 1)}</Text>
              <Text style={[s.bold, { flexGrow: 1, flexShrink: 1 }]}>{`${c.label} · ${CATEGORY_LABEL[c.category]}${c.reference ? ' · recommandée pour votre secteur' : ''}`}</Text>
              <Text style={{ fontFamily: FB, fontSize: 8.5, color: presColor(c.presence) }}>{dense && open && !c.competitorsPresent.length ? `impact ${c.impact}/3 · ${presence(c.presence)}` : presence(c.presence)}</Text>
            </View>
            {open ? (
              <>
                <Text style={{ marginTop: 1 }}>
                  <Text style={{ fontFamily: FB, color: C.primary }}>{pdfSafe(c.action)}</Text>
                  {pdfSafe(` : ${clip(c.why, 96)}`)}
                </Text>
                {dense && !c.competitorsPresent.length ? null : <Text style={s.small}>{pdfSafe([c.competitorsPresent.length ? `Concurrents présents : ${c.competitorsPresent.slice(0, 3).join(', ')}` : '', `impact ${c.impact}/3`, `effort ${c.effort === 'S' ? 'faible' : c.effort === 'M' ? 'moyen' : 'élevé'}`, dense ? '' : (c.howTo[0] ?? '')].filter(Boolean).join(' · '))}</Text>}
              </>
            ) : (
              <Text style={[s.small, { marginTop: 1 }]}>Pourquoi, qui y est, comment y entrer : réservé à l'offre complète.</Text>
            )}
          </View>
        );
      })}
      {v2.urls.length ? (
        <View style={{ marginTop: 4 }} wrap={false}>
          <Text style={s.h2}>{`LES ${v2.urls.length} PAGES LES PLUS CITÉES`}</Text>
          {(v2.unlocked ? v2.urls : v2.urls.slice(0, 2)).map((u, i) => (
            <Text key={u.url} style={{ fontSize: 8.5, marginBottom: 1.5 }}>
              <Text style={s.bold}>{`${i + 1}. ${pdfSafe(shortUrl(u.url, 70))}`}</Text>
              {pdfSafe(` · ${u.citations} citation${u.citations > 1 ? 's' : ''}${u.clientPresent ? ' · vous y figurez' : u.competitors.length ? ` · ${u.competitors.slice(0, 2).join(', ')}, pas vous` : ''}`)}
            </Text>
          ))}
          {!v2.unlocked && v2.urls.length > 2 ? <Text style={s.small}>{`Les ${v2.urls.length - 2} autres pages sont dans votre compte gratuit.`}</Text> : null}
        </View>
      ) : null}
      <Text style={[s.small, { marginTop: 2 }]}>
        Gemini : pas de sources via API (il sert à mesurer ce qu'il dit de vous). Sources relevées via les API de ChatGPT, Perplexity et Claude ; elles varient d'un mois à l'autre : un indicateur, pas une garantie.
      </Text>
      <Footer r={r} />
    </Page>
  );
}

/* ---------- Page 4 : par IA, matrice, perception ---------- */

function Page4({ r, v2 }: { r: ReportResult; v2: V2 }) {
  const providers = providersOf(r);
  const matrix = queryMatrix(r, providers);
  const qs = r.queries.slice(0, 10).map((q) => {
    const row = matrix.get(q.id);
    const hits = row ? Array.from(row.values()).filter((c) => c.mentioned).length : 0;
    return { q, row, hits };
  }).sort((a, b) => a.hits - b.hits);
  const queriesCited = r.queries.filter((q) => Array.from(matrix.get(q.id)?.values() ?? []).some((c) => c.mentioned)).length;
  const colW = Math.min(70, Math.floor(200 / Math.max(1, providers.length)));
  const p = v2.perception;
  const pc = (x: number) => Math.round(x * 100);
  const nRuns = r.mentions.length ? Math.max(...r.mentions.map((m) => m.run)) + (r.mentions.some((m) => m.run === 0) ? 1 : 0) : 0;
  const provs = providers.map((pp) => PROVIDER_LABEL[pp]).join(', ');
  return (
    <Page size="A4" style={s.page}>
      <Watermark r={r} />
      <Top r={r} />
      <Text style={s.h2}>LES IA, UNE PAR UNE</Text>
      {providers.map((pp) => {
        const sc = r.subScores[pp];
        const b = byProvider(r, pp);
        const band = bandFor(sc ?? 0);
        return (
          <View key={pp} style={[s.row, { marginBottom: 5 }]}>
            <Text style={[s.bold, { width: 70 }]}>{PROVIDER_LABEL[pp]}</Text>
            <View style={{ width: 140, marginRight: 8 }}><Bar value={sc ?? 0} color={band.color} h={8} /></View>
            <Text style={[s.bold, { width: 28, textAlign: 'right' }]}>{sc == null ? '-' : String(Math.round(sc))}</Text>
            <Text style={{ marginLeft: 10, flexGrow: 1 }}>{`cité ${b.cited}/${b.total} · rang moyen ${b.avgRank == null ? 'aucun' : String(b.avgRank).replace('.', ',')}`}</Text>
          </View>
        );
      })}

      <View style={s.rule} />
      <View style={s.section}>
        <Text style={s.h2}>QUESTION PAR QUESTION</Text>
        <View style={[s.row, { paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.line }]}>
          <Text style={[s.small, { flexGrow: 1 }]}>Requête</Text>
          {providers.map((pp) => <Text key={pp} style={[s.small, s.bold, { width: colW, textAlign: 'center' }]}>{PROVIDER_LABEL[pp]}</Text>)}
        </View>
        {qs.map(({ q, row }) => (
          <View key={q.id} style={[s.row, { paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: C.line }]} wrap={false}>
            <Text style={{ flexGrow: 1, flexShrink: 1, paddingRight: 6 }}>{q.text.slice(0, 70)}</Text>
            {providers.map((pp) => {
              const c = row?.get(pp);
              const txt = !c ? 'non testé' : c.mentioned ? `cité${c.bestRank ? ` n°${c.bestRank}` : ''}${c.n > 1 ? ` ${c.k}/${c.n}` : ''}` : 'absent';
              return <Text key={pp} style={{ width: colW, textAlign: 'center', fontSize: 8.5, fontFamily: c?.mentioned ? FB : F, color: !c ? C.muted : c.mentioned ? C.successInk : C.dangerInk }}>{txt}</Text>;
            })}
          </View>
        ))}
        <Text style={[s.bold, { marginTop: 5 }]}>{`Synthèse : cité sur ${queriesCited} requête${queriesCited > 1 ? 's' : ''} sur ${r.queries.length}`}</Text>
      </View>

      <View style={s.rule} />
      <View style={s.section}>
        <Text style={s.h2}>CE QUE LES IA DISENT DE VOUS</Text>
        {p.quotes.length ? (
          <>
            <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: C.line, marginBottom: 3 }}>
              <View style={{ width: `${pc(p.sentiment.positif)}%`, backgroundColor: C.success }} />
              <View style={{ width: `${pc(p.sentiment.neutre)}%`, backgroundColor: '#9AA3B5' }} />
              <View style={{ width: `${pc(p.sentiment.negatif)}%`, backgroundColor: C.danger }} />
            </View>
            <Text style={s.small}>{`Ton : positif ${pc(p.sentiment.positif)} % · neutre ${pc(p.sentiment.neutre)} % · négatif ${pc(p.sentiment.negatif)} %${p.themes.length ? ` · thèmes : ${p.themes.join(', ')}` : ''}`}</Text>
            {p.quotes.slice(0, 3).map((q, i) => (
              <Text key={i} style={{ marginTop: 3 }}>
                <Text style={s.bold}>{`${PROVIDER_LABEL[q.provider]} : `}</Text>
                {pdfSafe(`« ${q.text.slice(0, 220)} »`)}
              </Text>
            ))}
          </>
        ) : (
          <Text>Les IA ne parlent pas encore de vous dans les réponses analysées.</Text>
        )}
      </View>
      <View style={s.rule} />
      <View style={s.section} wrap={false}>
        <Text style={s.h2}>MÉTHODE ET LIMITES</Text>
        <Text>{`Nous avons posé ${r.queries.length} questions types${provs ? ` à ${provs}` : ''}${nRuns > 1 ? `, ${nRuns} fois chacune` : ''}, le ${formatDateFr(r.measuredAt || r.createdAt)}. Le score reflète la fréquence et la position de la citation. Le rang compte les citations de chaque acteur nommé. Niveau de confiance : ${r.confidence}. Marge d'erreur : ${v2.summary.margin.long}`}</Text>
        <Text style={{ marginTop: 3, color: C.muted, fontSize: 8 }}>
          Les réponses des IA varient d'une fois à l'autre : ce score est un instantané, pas une vérité. Il n'évalue pas la qualité de votre travail ni celle de vos concurrents, cités par les IA sans que nous les ayons évalués. Les IA peuvent se tromper. Gemini : pas de sources disponibles via API. Rapport produit avec l'aide de l'intelligence artificielle ; il ne constitue pas un conseil professionnel et aucun résultat n'est garanti.
          {r.demo ? ' Données de démonstration : exemples simulés, pas une mesure réelle.' : ''} Repéré n'est affilié ni à OpenAI, ni à Google, ni à Perplexity, ni à Anthropic.
        </Text>
      </View>

      <Footer r={r} />
    </Page>
  );
}

/* ---------- Page 5 : on le fait pour vous, méthode, offres ---------- */

function Page5({ r, v2 }: { r: ReportResult; v2: V2 }) {
  const leader = r.competitors.find((c) => !isDirectory(c.name) && !isPlatformName(c.name))?.name;
  return (
    <Page size="A4" style={s.page}>
      <Watermark r={r} />
      <Top r={r} />
      <Text style={s.h2}>CE QU'ON FAIT POUR VOUS : 3 TÂCHES PRÊTES</Text>
      {v2.tasks.map((t, i) => {
        const lines = t.deliverable.content.split('\n').map((l) => (l.length > 120 ? `${l.slice(0, 118)}…` : l));
        const shown = lines.slice(0, 12).join('\n') + (lines.length > 12 ? '\n…' : '');
        return (
          <View key={t.id} style={s.card} wrap={false}>
            <View style={s.row}>
              <Text style={{ fontFamily: FB, fontSize: 10, color: C.white, backgroundColor: C.primary, width: 16, textAlign: 'center', borderRadius: 8, marginRight: 6 }}>{String(i + 1)}</Text>
              <Text style={[s.bold, { fontSize: 10.5, flexGrow: 1, flexShrink: 1 }]}>{pdfSafe(t.title)}</Text>
              <Text style={s.small}>{`${AUTOMATION_LABEL[t.automation]} · ${t.minutes} min`}</Text>
            </View>
            <Text style={{ marginTop: 2 }}>{pdfSafe(t.why)}</Text>
            {t.deliverable.label ? <Text style={[s.small, { marginTop: 3, fontFamily: FB }]}>{pdfSafe(t.deliverable.label)}</Text> : null}
            <Text style={{ marginTop: 2, fontFamily: t.deliverable.type === 'jsonld' ? 'Courier' : F, fontSize: 8, backgroundColor: C.bg, padding: 5, borderRadius: 3 }}>{pdfSafe(shown)}</Text>
          </View>
        );
      })}

      <View style={{ marginTop: 8, backgroundColor: C.primary, borderRadius: 5, padding: 8 }} wrap={false}>
        <Text style={{ color: C.white, fontFamily: FB, fontSize: 12 }}>{leader && r.score < 70 ? `${leader} est cité plus souvent. On travaille pour que ce soit vous.` : 'Les IA recommandent. On travaille pour que ce soit vous.'}</Text>
        <Text style={{ color: C.white, marginTop: 3, fontFamily: FB }}>Découverte : 0 €, sans limite de durée  ·  suivi mensuel gratuit de ce score, 5 questions, 3 IA</Text>
        {[...v2.offers].sort((a, b) => offerRank(a) - offerRank(b)).map((o) => (
          <Text key={o.planId} style={{ color: C.white, marginTop: 3 }}>{`${o.name} : ${o.price} ${o.unit}  ·  ${o.pitch}`}</Text>
        ))}
        <Text style={{ color: C.white, marginTop: 4, fontSize: 8.5 }}>{`${siteUrl().replace(/^https?:\/\//, '')}/rapport/${r.id}  ·  Prix nets, TVA non applicable (art. 293 B du CGI)  ·  Rien n'est publié sans votre validation`}</Text>
      </View>
      <Footer r={r} />
    </Page>
  );
}

const offerRank = (o: SegmentOffer) => (/_essentiel_/.test(o.planId) ? 0 : /_accompagne_/.test(o.planId) ? 1 : 2);

function ReportDocument({ r, unlocked }: { r: ReportResult; unlocked: boolean }) {
  const v2 = buildV2(r, unlocked);
  return (
    <Document title={`Visibilité IA de ${r.input.businessName}`} author="Repéré" subject="Rapport de visibilité IA" language="fr">
      <Page1 r={r} v2={v2} />
      <Page2 r={r} v2={v2} />
      <Page3 r={r} v2={v2} />
      <Page4 r={r} v2={v2} />
      <Page5 r={r} v2={v2} />
    </Document>
  );
}

/** Rapport V2 : 5 pages A4 (synthèse, vérité et concurrents, sources, détail par IA, actions et offres).
 *  `unlocked` : sources 4 à 10 détaillées (plan payé ou compte démo) ; par défaut, seulement pour le compte démo. */
export async function renderReportPdf(r: AuditResult, opts: { unlocked?: boolean } = {}): Promise<Buffer> {
  const rr = r as ReportResult;
  const unlocked = opts.unlocked ?? isDemoAccountAudit(r.id);
  return renderToBuffer(<ReportDocument r={rr} unlocked={unlocked} />);
}

/* ---------- Plan d'action (149 €) ---------- */

function PlanDocument({ r, plan }: { r: AuditResult; plan: ActionItem[] }) {
  const band = bandFor(r.score);
  const ordered = [...plan].sort((a, b) => b.impact - a.impact || ('SML'.indexOf(a.effort) - 'SML'.indexOf(b.effort)));
  return (
    <Document title={`Plan d'action : ${r.input.businessName}`} author="Repéré" language="fr">
      <Page size="A4" style={s.page}>
        <Watermark r={r} />
        <Top r={r} />
        <Text style={s.h1}>Plan d'action</Text>
        <Text style={s.sub}>{`${r.input.businessName} · ${[r.input.trade, r.input.city].filter(Boolean).join(' · ')}`}</Text>
        <View style={[s.row, { marginTop: 10 }]}>
          <Text style={{ fontFamily: FB, fontSize: 28, color: band.color }}>{String(Math.round(r.score))}</Text>
          <Text style={{ marginLeft: 4, color: C.muted }}>/100</Text>
          <Text style={{ marginLeft: 10, fontFamily: FB, color: band.ink, backgroundColor: band.bg, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 3 }}>{band.label}</Text>
        </View>
        <Text style={{ marginTop: 8, color: C.muted }}>{`${ordered.length} actions classées par impact, des plus rapides aux plus longues. Cochez-les au fil de l'eau, puis refaites un audit pour mesurer l'effet.`}</Text>
        <View style={{ marginTop: 10 }}>
          {ordered.map((a, i) => (
            <View key={a.id} style={s.card} wrap={false}>
              <View style={s.row}>
                <Text style={{ fontFamily: FB, width: 22, color: C.primary }}>{`${i + 1}.`}</Text>
                <Text style={[s.bold, { fontSize: 10.5, flexGrow: 1, flexShrink: 1 }]}>{a.title}</Text>
              </View>
              <Text style={[s.small, { marginTop: 1 }]}>{`${EFFORT[a.effort]} · ${IMPACT[a.impact]}`}</Text>
              <Text style={{ marginTop: 3 }}><Text style={s.bold}>Pourquoi : </Text>{a.why}</Text>
              {a.how.map((h, j) => <Text key={j} style={{ marginTop: 1, paddingLeft: 8 }}>{`${j + 1}) ${h}`}</Text>)}
            </View>
          ))}
        </View>
        <Text style={[s.small, { marginTop: 6 }]}>
          Méthode et limites : ces actions sont des recommandations établies à partir d'un audit daté du {formatDateFr(r.createdAt)}. Les assistants IA sont des services tiers dont les réponses varient ; aucun classement, citation ou résultat n'est garanti. Document produit avec l'aide de l'intelligence artificielle ; il ne constitue pas un conseil juridique, financier ou professionnel.
        </Text>
        <Footer r={r} />
      </Page>
    </Document>
  );
}

export async function renderActionPlanPdf(r: AuditResult, plan: ActionItem[]): Promise<Buffer> {
  return renderToBuffer(<PlanDocument r={r} plan={plan} />);
}
