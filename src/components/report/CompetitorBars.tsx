import styles from './report.module.css';
import { pct, type CompetitorRow } from './derive';

export function CompetitorBars({
  rows,
  directories,
  leader,
  youShare,
  answers,
}: {
  rows: CompetitorRow[];
  directories: CompetitorRow[];
  leader: CompetitorRow | null;
  youShare: number;
  /** réponses exploitables (base du « N réponses sur M ») */
  answers?: number;
}) {
  const others = rows.filter((r) => !r.isYou);
  if (!others.length) {
    return (
      <p className={styles.hook}>
        Les IA ne citent aucun acteur précis pour ces questions. La place est libre : c&apos;est une belle occasion d&apos;être le premier nommé.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => pct(r.share)), 1);
  const you = pct(youShare);
  const youRow = rows.find((r) => r.isYou);

  return (
    <div>
      {leader && (
        <p className={styles.hook}>
          {answers ? (
            <>
              <strong>{leader.name}</strong> apparaît dans <strong>{leader.mentions} réponses sur {answers}</strong> ; vous, dans <strong>{youRow?.mentions ?? 0}</strong>. Part de voix : <strong>{pct(leader.share)} %</strong> des citations contre <strong>{you} %</strong> pour vous.
            </>
          ) : (
            <>
              Part de voix : <strong>{leader.name}</strong> pèse <strong>{pct(leader.share)} %</strong> des citations. Vous : <strong>{you} %</strong>.
            </>
          )}
        </p>
      )}
      <ol className={styles.bars}>
        {rows.map((r, i) => {
          const p = pct(r.share);
          const isLeader = !r.isYou && leader?.name === r.name;
          const zero = r.isYou && p === 0;
          return (
            <li key={`${r.name}-${i}`} className={`${styles.barItem} ${r.isYou ? styles.barYou : ''} ${zero ? styles.barZero : ''}`}>
              <div className={styles.barTop}>
                <span className={styles.barName}>
                  {r.isYou ? <strong>Vous</strong> : r.name}
                  {r.isYou && <span className={styles.caption}>({r.name})</span>}
                  {isLeader && <span className={`${styles.badge} ${styles.badgeWarning}`}>👑 n° 1</span>}
                  {zero && (
                    <span className={styles.hereArrow} aria-hidden="true">
                      ← Vous êtes ici
                    </span>
                  )}
                </span>
                <span className={styles.barPct}>
                  {p} % des citations
                  {answers ? <span className={styles.caption}> · dans {r.mentions} réponses sur {answers}</span> : null}
                </span>
              </div>
              <div className={styles.barTrack} aria-hidden="true">
                <div className={styles.barFill} style={{ width: `${Math.max((p / max) * 100, zero ? 0 : 2)}%`, animationDelay: `${i * 90}ms` }} />
              </div>
            </li>
          );
        })}
      </ol>
      <p className={styles.note}>
        Les noms sont ceux cités par les assistants IA lors de nos mesures, pas une appréciation de notre part. Il peut s&apos;agir d&apos;annuaires ou de plateformes.
      </p>
      {directories.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className={styles.caption}>Sites et plateformes également cités :</p>
          <div className={styles.chips}>
            {directories.slice(0, 8).map((d) => (
              <span key={d.name} className={`${styles.badge} ${styles.badgeMuted}`}>
                {d.name} · {pct(d.share)} %
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
