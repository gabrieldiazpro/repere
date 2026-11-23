/** Rendu HTML du guide 2027 (lecture en ligne et impression). Serveur uniquement. */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { GUIDE_2027, GUIDE_2027_CHAPTERS, GUIDE_2027_SOURCES, type G27Block } from '@/lib/veille/guide2027';
import { frDate } from '@/lib/veille';

/** Renvois [n] → lien vers la source ; [texte](/chemin) → lien interne. */
export function rich(text: string): ReactNode {
  return text.split(/(\[\d+\]|\[[^\]\n]+\]\(\/[^)\s]*\))/g).map((p, i) => {
    const m = /^\[(\d+)\]$/.exec(p);
    if (m) return <sup key={i}><a href={`#g27-source-${m[1]}`} className="g27-ref" aria-label={`Source ${m[1]}`}>{m[1]}</a></sup>;
    const l = /^\[([^\]\n]+)\]\((\/[^)\s]*)\)$/.exec(p);
    if (l && !l[2].startsWith('//')) return <Link key={i} href={l[2]} className="g27-link">{l[1]}</Link>;
    return <span key={i}>{p}</span>;
  });
}

function Block({ b }: { b: G27Block }) {
  return (
    <>
      {b.h3 ? <h3>{b.h3}</h3> : null}
      {b.paras?.map((p, i) => <p key={i}>{rich(p)}</p>)}
      {b.list ? <ul>{b.list.map((l, i) => <li key={i}>{rich(l)}</li>)}</ul> : null}
      {b.steps ? <ol>{b.steps.map((l, i) => <li key={i}>{rich(l)}</li>)}</ol> : null}
      {b.checklist ? (
        <ul className="g27-check">
          {b.checklist.map((l, i) => <li key={i}><span aria-hidden className="g27-box" />{rich(l)}</li>)}
        </ul>
      ) : null}
      {b.table ? (
        <div className="g27-table">
          <table>
            {b.table.caption ? <caption>{b.table.caption}</caption> : null}
            <thead><tr>{b.table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{b.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{rich(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : null}
      {b.note ? <p className="g27-note">{rich(b.note)}</p> : null}
    </>
  );
}

export function GuideCover({ email }: { email?: string }) {
  return (
    <header className="g27-cover">
      <p className="g27-brand"><span aria-hidden className="g27-dot" />Repéré</p>
      <h1>{GUIDE_2027.title}</h1>
      <p className="g27-sub">{GUIDE_2027.subtitle}</p>
      <p className="g27-meta">
        {GUIDE_2027.edition} · sources relues le {frDate(GUIDE_2027.updated)}
        {email ? <> · exemplaire de {email}</> : null}
      </p>
    </header>
  );
}

export function GuideToc() {
  return (
    <nav className="g27-toc" aria-label="Sommaire">
      <h2>Sommaire</h2>
      <ol>
        {GUIDE_2027_CHAPTERS.map((c) => <li key={c.id}><a href={`#g27-${c.id}`}>{c.title}</a></li>)}
        <li><a href="#g27-sources">Sources</a></li>
      </ol>
    </nav>
  );
}

export function GuideChapters() {
  return (
    <>
      {GUIDE_2027_CHAPTERS.map((c) => (
        <section key={c.id} id={`g27-${c.id}`} className="g27-chapter">
          <h2>{c.title}</h2>
          <p className="g27-lead">{c.lead}</p>
          {c.blocks.map((b, i) => <Block key={i} b={b} />)}
        </section>
      ))}
      <section id="g27-sources" className="g27-chapter">
        <h2>Sources</h2>
        <p className="g27-lead">Relues le {frDate(GUIDE_2027.updated)}. « Primaire » : texte officiel ou documentation de l’éditeur ; « secondaire » : presse ou cabinet.</p>
        <ol className="g27-sources">
          {GUIDE_2027_SOURCES.map((s, i) => (
            <li key={s.url} id={`g27-source-${i + 1}`}>
              <a href={s.url} rel="noopener">{s.label}</a> — {s.publisher}
              {s.published ? `, ${frDate(s.published)}` : ''} ({s.primary ? 'primaire' : 'secondaire'}). <span className="g27-url">{s.url}</span>
            </li>
          ))}
        </ol>
        <p className="g27-legal">
          Ce guide informe et ne constitue pas un conseil juridique. Aucune position dans Google ou dans un assistant IA ne peut
          être garantie. © Repéré, {GUIDE_2027.updated.slice(0, 4)}. Reproduction autorisée pour un usage interne, avec mention de la source.
        </p>
      </section>
    </>
  );
}

/** Feuille de style du guide (écran + impression A4). */
export const GUIDE_CSS = `
.g27{max-width:46rem;margin:0 auto;padding:2rem 1rem 4rem;color:var(--ink);font-size:1.0625rem;line-height:1.65}
.g27 h1{font-family:var(--font-display,"Bricolage Grotesque",sans-serif);font-size:2.4rem;line-height:1.1;font-weight:600;margin:.5rem 0 1rem}
.g27 h2{font-family:var(--font-display,"Bricolage Grotesque",sans-serif);font-size:1.6rem;line-height:1.2;font-weight:600;margin:0 0 .5rem}
.g27 h3{font-size:1.15rem;font-weight:600;margin:1.6rem 0 .4rem}
.g27 p{margin:0 0 .8rem}
.g27 ul,.g27 ol{margin:0 0 1rem;padding-left:1.4rem}
.g27 ul{list-style:disc}.g27 ol{list-style:decimal}
.g27 li{margin:0 0 .4rem}
.g27-cover{padding:2.5rem 0 2rem;border-bottom:3px solid var(--primary);margin-bottom:2rem}
.g27-brand{font-weight:700;color:var(--primary);display:flex;align-items:center;gap:.5rem}
.g27-dot{display:inline-block;width:.7rem;height:.7rem;border-radius:50%;background:var(--accent)}
.g27-sub{font-size:1.25rem;color:var(--muted);max-width:38rem}
.g27-meta{font-size:.9rem;color:var(--muted)}
.g27-toc{margin:0 0 2.5rem}
.g27-toc h2{font-size:1.3rem}
.g27 .g27-toc ol{list-style:none;padding-left:0}
.g27-toc a{text-decoration:none;color:var(--ink)}.g27-toc a:hover{text-decoration:underline}
.g27-chapter{margin-top:3rem;scroll-margin-top:1rem}
.g27-lead{font-size:1.15rem;color:var(--muted);border-left:3px solid var(--accent);padding-left:.9rem;margin-bottom:1.2rem}
.g27-note{background:var(--primary-bg);border-radius:.75rem;padding:.9rem 1rem;font-weight:500}
.g27-check{list-style:none!important;padding-left:0!important}
.g27-check li{display:flex;gap:.6rem;align-items:flex-start}
.g27-box{flex:none;width:1rem;height:1rem;border:2px solid var(--muted);border-radius:3px;margin-top:.3rem}
.g27-table{overflow-x:auto;margin:0 0 1.2rem}
.g27 table{width:100%;border-collapse:collapse;font-size:.92rem;line-height:1.45}
.g27 caption{text-align:left;color:var(--muted);font-size:.85rem;padding-bottom:.4rem}
.g27 th{text-align:left;font-weight:600;border-bottom:2px solid var(--ink);padding:.4rem .5rem;vertical-align:bottom}
.g27 td{border-bottom:1px solid var(--line);padding:.45rem .5rem;vertical-align:top}
.g27-ref{color:var(--primary);text-decoration:none;padding:0 .1rem}
.g27-link{color:var(--primary);text-decoration:underline;text-underline-offset:2px}
.g27-sources{font-size:.9rem}
.g27-sources a{color:var(--primary)}
.g27-url{display:none}
.g27-legal{font-size:.85rem;color:var(--muted);margin-top:1.5rem}
.g27-bar{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}
.g27-bar-in{max-width:46rem;margin:0 auto;padding:.6rem 1rem;display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;font-size:.95rem}
@media print{
  @page{size:A4;margin:18mm 17mm 20mm}
  html,body{background:#fff!important}
  .g27{max-width:none;padding:0;font-size:10.5pt;line-height:1.5}
  .g27 h1{font-size:30pt}
  .g27 h2{font-size:17pt}
  .g27 h3{font-size:12pt;break-after:avoid}
  .g27-cover{min-height:240mm;display:flex;flex-direction:column;justify-content:center;border:0}
  .g27-toc{break-after:page}
  .g27-chapter{break-before:page;margin-top:0}
  .g27 table,.g27-note,.g27-check li{break-inside:avoid}
  .g27-bar,.no-print{display:none!important}
  .g27-url{display:block;color:#555;font-size:8pt;word-break:break-all}
  .g27 a{color:inherit;text-decoration:none}
}
`;
