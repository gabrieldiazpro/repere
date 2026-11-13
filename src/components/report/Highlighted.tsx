// Surlignage sûr : le texte des IA est découpé en segments React (jamais d'HTML injecté).
import styles from './report.module.css';
import type { Segment } from './derive';

export function Highlighted({ segments, limit }: { segments: Segment[]; limit?: number }) {
  let left = limit ?? Infinity;
  const out: React.ReactNode[] = [];
  segments.forEach((s, i) => {
    if (left <= 0) return;
    const text = s.text.length > left ? s.text.slice(0, left) : s.text;
    const complete = text.length === s.text.length;
    left -= text.length;
    if (s.kind === 'plain' || !complete) {
      out.push(<span key={i}>{text}</span>);
    } else if (s.kind === 'you') {
      out.push(
        <mark key={i} className={styles.markYou}>
          {text}
          <span className={styles.srOnly}> (vous)</span>
        </mark>,
      );
    } else {
      out.push(
        <mark key={i} className={styles.mark}>
          {text}
          {s.rank ? (
            <span className={styles.rankPill} aria-label={`cité en position ${s.rank}`}>
              {s.rank}
            </span>
          ) : null}
        </mark>,
      );
    }
  });
  return <>{out}</>;
}
