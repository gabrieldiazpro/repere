'use client';

// Rendu markdown minimal maison (sans dépendance, sans HTML brut) :
// titres ###, listes - et 1., paragraphes, tableaux | a | b |, **gras**, *italique* et _italique_, `code`, [lien](url), blocs ``` copiables.
import { CopyButton } from './CopyButton';

function safeHref(u: string) {
  return /^(https?:\/\/|\/(?!\/)|mailto:)/i.test(u) ? u : null;
}

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*|(?<![\p{L}\p{N}])_([^_\n]+?)_(?![\p{L}\p{N}]))/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[3]) out.push(<code key={k}>{m[3]}</code>);
    else if (m[4]) {
      const href = safeHref(m[5]);
      out.push(
        href ? (
          <a key={k} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
            {m[4]}
          </a>
        ) : (
          m[4]
        ),
      );
    } else if (m[6]) out.push(<em key={k}>{m[6]}</em>);
    else if (m[7]) out.push(<em key={k}>{inline(m[7], k)}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```\s*([\w-]*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const code = buf.join('\n');
      blocks.push(
        <div key={b++} className="my-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[12px] font-medium text-[var(--muted)]">{lang ? lang.toUpperCase() === 'JSON' ? 'JSON-LD' : lang.toUpperCase() : 'Code'}</span>
            <CopyButton text={code} />
          </div>
          <pre className="rp-code">{code}</pre>
        </div>,
      );
      continue;
    }
    // Tableau : | a | b | suivi de |---|---| (rendu en <table>, jamais sur une ligne)
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(cells(lines[i++]));
      blocks.push(
        <div key={b++} className="rp-scroll my-2">
          <table className="rp-table">
            <thead>
              <tr>
                {head.map((c, k) => (
                  <th key={k} scope="col">
                    {inline(c, `th${b}-${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, x) => (
                <tr key={x}>
                  {r.map((c, k) => (k === 0 ? <th key={k} scope="row">{inline(c, `td${b}-${x}-${k}`)}</th> : <td key={k}>{inline(c, `td${b}-${x}-${k}`)}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(<h3 key={b++}>{inline(h[1], `h${b}`)}</h3>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      blocks.push(
        <ul key={b++}>
          {items.map((it, k) => (
            <li key={k}>{inline(it, `u${b}-${k}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push(
        <ol key={b++}>
          {items.map((it, k) => (
            <li key={k}>{inline(it, `o${b}-${k}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*[-*]\s+|\s*\d+[.)]\s+|\s*\|.*\|\s*$)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={b++}>{inline(para.join(' '), `p${b}`)}</p>);
  }
  return <div className="rp-md">{blocks}</div>;
}
