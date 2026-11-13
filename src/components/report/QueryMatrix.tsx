import styles from './report.module.css';
import { Highlighted } from './Highlighted';
import {
  INTENT_LABEL,
  PROVIDER_META,
  answerFor,
  competitorsFor,
  excerptAround,
  segmentText,
  type Cell,
  type MatrixRow,
} from './derive';
import type { AuditResult, ProviderId } from '@/lib/engine/types';

function CellBadge({ p, c }: { p: ProviderId; c: Cell }) {
  const meta = PROVIDER_META[p];
  if (!c.tested) {
    return (
      <span className={`${styles.cell} ${styles.cellNa}`} title={`${meta.label} : non testé`}>
        <span className={styles.cellP}>{meta.short}</span> – <span className={styles.srOnly}>{meta.label} non testé</span>
      </span>
    );
  }
  const multi = c.n > 1;
  if (c.mentioned) {
    return (
      <span className={`${styles.cell} ${styles.cellYes}`}>
        <span className={styles.cellP}>{meta.short}</span>
        <span aria-hidden="true">✓</span>
        <span className={styles.srOnly}>{meta.label} : cité</span>
        {c.bestRank != null && <span>n° {c.bestRank}</span>}
        {multi && <span className={styles.num}>· {c.k}/{c.n}</span>}
      </span>
    );
  }
  return (
    <span className={`${styles.cell} ${styles.cellNo}`}>
      <span className={styles.cellP}>{meta.short}</span>
      <span aria-hidden="true">✗</span>
      <span className={styles.srOnly}>{meta.label} : non cité</span>
      {multi && <span className={styles.num}>0/{c.n}</span>}
    </span>
  );
}

export function QueryMatrix({ result, rows, providers }: { result: AuditResult; rows: MatrixRow[]; providers: ProviderId[] }) {
  const cited = rows.filter((r) => r.citedCount > 0).length;
  return (
    <div>
      <div className={styles.legend} aria-hidden="true">
        {providers.map((p) => (
          <span key={p}>
            <strong>{PROVIDER_META[p].short}</strong> = {PROVIDER_META[p].label}
          </span>
        ))}
        <span>✓ cité (n° = place)</span>
        <span>✗ non cité</span>
        <span>– non testé</span>
      </div>
      <div className={styles.qList}>
        {rows.map((row) => (
          <details key={row.query.id} className={styles.qRow}>
            <summary>
              <span className={styles.qText}>
                <span className={styles.intent}>{INTENT_LABEL[row.query.intent] ?? row.query.intent}</span>
                <span>« {row.query.text} »</span>
              </span>
              <span className={styles.cells}>
                {providers.map((p) => (
                  <CellBadge key={p} p={p} c={row.cells[p]} />
                ))}
              </span>
            </summary>
            <div className={styles.qBody}>
              {providers.map((p) => {
                const a = answerFor(result, row.query.id, p);
                const comps = competitorsFor(result, row.query.id, p);
                if (!a) return null;
                const text = a.error ? '' : excerptAround(a.text, [...comps, result.input.businessName], 700);
                return (
                  <div key={p} className={styles.qAnswer}>
                    <div className={styles.aHead}>
                      <span className={styles.pDot} style={{ background: PROVIDER_META[p].color }} aria-hidden="true">
                        {PROVIDER_META[p].short}
                      </span>
                      {PROVIDER_META[p].label}
                      {a.demo && <span className={`${styles.badge} ${styles.badgeDemo}`}>Exemple simulé</span>}
                    </div>
                    {a.error ? (
                      <p className={styles.caption}>Cette IA n&apos;a pas répondu à temps pour cette question.</p>
                    ) : (
                      <p className={styles.qAnswerText}>
                        <Highlighted segments={segmentText(text, comps, result.input.businessName)} />
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
      <p className={styles.summaryLine}>
        Cité sur {cited} question{cited > 1 ? 's' : ''} sur {rows.length}. Touchez une question pour lire les réponses.
      </p>
    </div>
  );
}
