/**
 * PDF du guide 2027 (@react-pdf/renderer, déjà utilisé par src/lib/pdf). Polices intégrées (Helvetica) : aucune
 * requête réseau. Même contenu que la version HTML (src/lib/veille/guide2027.ts).
 */
import React from 'react';
import { Document, Font, Link, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { GUIDE_2027, GUIDE_2027_CHAPTERS, GUIDE_2027_SOURCES, type G27Block } from './guide2027';
import { frDate } from './index';

Font.registerHyphenationCallback((w) => [w]);

const C = { primary: '#3730A3', primaryBg: '#ECEBFA', accent: '#F5A524', ink: '#1B1F2E', muted: '#5A6275', line: '#D5D9E4' };
const F = 'Helvetica';
const FB = 'Helvetica-Bold';

const s = StyleSheet.create({
  page: { paddingTop: 52, paddingBottom: 60, paddingHorizontal: 54, fontFamily: F, fontSize: 10.5, color: C.ink, lineHeight: 1.5 },
  cover: { paddingTop: 140, paddingHorizontal: 60, fontFamily: F, color: C.ink },
  brand: { fontFamily: FB, fontSize: 16, color: C.primary, marginBottom: 40 },
  h1: { fontFamily: FB, fontSize: 32, lineHeight: 1.15, marginBottom: 18 },
  sub: { fontSize: 14, color: C.muted, lineHeight: 1.45, marginBottom: 30 },
  meta: { fontSize: 10, color: C.muted },
  rule: { height: 4, width: 80, backgroundColor: C.accent, marginBottom: 24 },
  h2: { fontFamily: FB, fontSize: 18, lineHeight: 1.25, marginBottom: 8 },
  lead: { fontSize: 11.5, color: C.muted, borderLeftWidth: 3, borderLeftColor: C.accent, paddingLeft: 9, marginBottom: 12 },
  h3: { fontFamily: FB, fontSize: 12, marginTop: 12, marginBottom: 4 },
  p: { marginBottom: 7 },
  li: { flexDirection: 'row', marginBottom: 4 },
  bullet: { width: 16 },
  liText: { flex: 1 },
  box: { width: 9, height: 9, borderWidth: 1.2, borderColor: C.muted, marginTop: 3, marginRight: 8 },
  note: { backgroundColor: C.primaryBg, padding: 9, borderRadius: 4, marginBottom: 9, fontFamily: FB, fontSize: 10.5 },
  table: { marginBottom: 10, borderTopWidth: 1.2, borderTopColor: C.ink },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: C.line },
  th: { fontFamily: FB, fontSize: 9, padding: 4 },
  td: { fontSize: 9, padding: 4, lineHeight: 1.35 },
  caption: { fontSize: 8.5, color: C.muted, marginBottom: 3 },
  footer: { position: 'absolute', bottom: 26, left: 54, right: 54, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: C.muted, borderTopWidth: 0.6, borderTopColor: C.line, paddingTop: 5 },
  toc: { marginBottom: 5, fontSize: 11 },
  src: { fontSize: 8.8, marginBottom: 5, lineHeight: 1.35 },
  srcUrl: { fontSize: 7.5, color: C.muted },
});

/** Texte à plat pour le PDF : [texte](/chemin) → texte ; les renvois [n] restent. */
export const plain = (t: string) => t.replace(/\[([^\]\n]+)\]\((\/[^)\s]*)\)/g, '$1');

function Items({ items, kind }: { items: string[]; kind: 'ul' | 'ol' | 'check' }) {
  return (
    <View style={{ marginBottom: 6 }}>
      {items.map((it, i) => (
        <View key={i} style={s.li} wrap={false}>
          {kind === 'check' ? <View style={s.box} /> : <Text style={s.bullet}>{kind === 'ol' ? `${i + 1}.` : '•'}</Text>}
          <Text style={s.liText}>{plain(it)}</Text>
        </View>
      ))}
    </View>
  );
}

function Block({ b }: { b: G27Block }) {
  const cols = b.table?.head.length ?? 1;
  return (
    <View>
      {b.h3 ? <Text style={s.h3} minPresenceAhead={40}>{b.h3}</Text> : null}
      {b.paras?.map((p, i) => <Text key={i} style={s.p}>{plain(p)}</Text>)}
      {b.list ? <Items items={b.list} kind="ul" /> : null}
      {b.steps ? <Items items={b.steps} kind="ol" /> : null}
      {b.checklist ? <Items items={b.checklist} kind="check" /> : null}
      {b.table ? (
        <View style={s.table}>
          {b.table.caption ? <Text style={s.caption}>{b.table.caption}</Text> : null}
          <View style={s.tr} fixed={false}>
            {b.table.head.map((h) => <Text key={h} style={[s.th, { width: `${100 / cols}%` }]}>{h}</Text>)}
          </View>
          {b.table.rows.map((r, i) => (
            <View key={i} style={s.tr} wrap={false}>
              {r.map((c, j) => <Text key={j} style={[s.td, { width: `${100 / cols}%` }]}>{plain(c)}</Text>)}
            </View>
          ))}
        </View>
      ) : null}
      {b.note ? <Text style={s.note} wrap={false}>{plain(b.note)}</Text> : null}
    </View>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>{`Repéré · ${GUIDE_2027.title}`}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function Guide2027Document({ email }: { email?: string }) {
  return (
    <Document title={GUIDE_2027.title} author="Repéré" language="fr-FR" subject={GUIDE_2027.subtitle}>
      <Page size="A4" style={s.cover}>
        <Text style={s.brand}>Repéré</Text>
        <View style={s.rule} />
        <Text style={s.h1}>{GUIDE_2027.title}</Text>
        <Text style={s.sub}>{GUIDE_2027.subtitle}</Text>
        <Text style={s.meta}>{`${GUIDE_2027.edition} · sources relues le ${frDate(GUIDE_2027.updated)}`}</Text>
        {email ? <Text style={[s.meta, { marginTop: 4 }]}>{`Exemplaire de ${email}`}</Text> : null}
      </Page>
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Sommaire</Text>
        {GUIDE_2027_CHAPTERS.map((c) => <Text key={c.id} style={s.toc}>{c.title}</Text>)}
        <Text style={s.toc}>Sources</Text>
        <Footer />
      </Page>
      {GUIDE_2027_CHAPTERS.map((c) => (
        <Page key={c.id} size="A4" style={s.page}>
          <Text style={s.h2}>{c.title}</Text>
          <Text style={s.lead}>{c.lead}</Text>
          {c.blocks.map((b, i) => <Block key={i} b={b} />)}
          <Footer />
        </Page>
      ))}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Sources</Text>
        <Text style={s.lead}>{`Relues le ${frDate(GUIDE_2027.updated)}. Primaire : texte officiel ou documentation de l'éditeur ; secondaire : presse ou cabinet.`}</Text>
        {GUIDE_2027_SOURCES.map((x, i) => (
          <View key={x.url} style={s.src} wrap={false}>
            <Text>{`${i + 1}. ${x.label} — ${x.publisher}${x.published ? `, ${frDate(x.published)}` : ''} (${x.primary ? 'primaire' : 'secondaire'})`}</Text>
            <Link src={x.url} style={s.srcUrl}>{x.url}</Link>
          </View>
        ))}
        <Text style={[s.meta, { marginTop: 12 }]}>
          Ce guide informe et ne constitue pas un conseil juridique. Aucune position dans Google ou dans un assistant IA ne peut être garantie.
        </Text>
        <Footer />
      </Page>
    </Document>
  );
}

export async function renderGuide2027Pdf(email?: string): Promise<Buffer> {
  return renderToBuffer(<Guide2027Document email={email} />);
}
