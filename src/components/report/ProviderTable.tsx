import styles from './report.module.css';
import { PROVIDER_META, bandFor, providersUsed, type ProviderStat } from './derive';
import type { AuditResult, ProviderId } from '@/lib/engine/types';

function verdictFor(s: ProviderStat) {
  if (s.total === 0) return { cls: styles.badgeMuted, icon: '–', text: 'Non testée' };
  const rate = s.cited / s.total;
  if (rate >= 0.5) return { cls: styles.badgeSuccess, icon: '✓', text: 'Vous recommande' };
  if (rate > 0) return { cls: styles.badgeWarning, icon: '~', text: 'Vous cite parfois' };
  return { cls: styles.badgeDanger, icon: '✗', text: 'Ne vous cite pas' };
}

function rankText(r: number | null) {
  return r == null ? '–' : `n° ${String(r).replace('.', ',')}`;
}

export function ProviderTable({ result, stats }: { result: AuditResult; stats: ProviderStat[] }) {
  const tested = stats.filter((s) => s.score !== null && s.total > 0);
  const weakest = tested.length > 1 ? [...tested].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0] : null;
  const used = providersUsed(result);
  const notUsed = (['chatgpt', 'perplexity', 'gemini'] as ProviderId[]).filter((p) => !used.includes(p));

  // Wow 2 : le n° 1 cité par chaque IA
  const leaders = stats.filter((s) => s.total > 0);
  const counts = new Map<string, number>();
  leaders.forEach((s) => s.leader && counts.set(s.leader, (counts.get(s.leader) ?? 0) + 1));
  const [topName, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const youCount = stats.filter((s) => s.cited > 0).length;

  return (
    <div>
      <div className={styles.provGrid} role="table" aria-label="Résultats par assistant IA">
        <div className={styles.provHeader} role="row">
          <span role="columnheader">IA</span>
          <span role="columnheader">Note /100</span>
          <span role="columnheader">Cité dans</span>
          <span role="columnheader">Rang moyen</span>
          <span role="columnheader">Verdict</span>
        </div>
        {stats.map((s) => {
          const meta = PROVIDER_META[s.provider];
          const v = verdictFor(s);
          const score = s.score ?? 0;
          const band = bandFor(score);
          const weak = weakest?.provider === s.provider;
          return (
            <div key={s.provider} className={`${styles.provRow} ${weak ? styles.provWeak : ''}`} role="row">
              <div className={styles.provName} role="cell">
                <span className={styles.pDot} style={{ background: meta.color }} aria-hidden="true">
                  {meta.short}
                </span>
                <span>
                  {meta.label}
                  <span className={styles.provAbout}>{meta.about}</span>
                </span>
              </div>
              <div className={styles.mini} role="cell" aria-label={`Note ${s.score ?? 'non disponible'} sur 100`}>
                <div className={styles.miniTrack}>
                  <div className={styles.miniFill} style={{ width: `${Math.max(score, 2)}%`, background: band.color }} />
                </div>
                <span className={styles.miniNum}>{s.score ?? '–'}</span>
              </div>
              <p className={styles.provMobileLine}>
                Cité dans {s.cited}/{s.total} réponses · Rang moyen {rankText(s.avgRank)}
                <span className={styles.srOnly}> (indicatif, {s.total} réponses)</span>
              </p>
              <span className={`${styles.provCell} ${styles.num}`} role="cell">
                {s.cited}/{s.total} réponses
              </span>
              <span className={`${styles.provCell} ${styles.num}`} role="cell">
                {rankText(s.avgRank)}
              </span>
              <span role="cell">
                <span className={`${styles.badge} ${v.cls}`}>
                  <span aria-hidden="true">{v.icon}</span> {v.text}
                </span>
              </span>
            </div>
          );
        })}
        {notUsed.map((p) => (
          <div key={p} className={styles.provRow} role="row" style={{ opacity: 0.6 }}>
            <div className={styles.provName} role="cell">
              <span className={styles.pDot} style={{ background: PROVIDER_META[p].color }} aria-hidden="true">
                {PROVIDER_META[p].short}
              </span>
              {PROVIDER_META[p].label}
            </div>
            <span role="cell" className={styles.caption}>
              Non testée lors de cet audit.
            </span>
          </div>
        ))}
      </div>

      {weakest && (weakest.score ?? 0) < 70 && (
        <p className={styles.weakNote}>
          Votre point faible : <strong>{PROVIDER_META[weakest.provider].label}</strong>. Les notes par IA sont indicatives (environ {weakest.total} réponses chacune).
        </p>
      )}

      {leaders.length > 1 && topName && (
        <>
          <div className={styles.leaders} aria-label="Le commerce cité en premier par chaque IA">
            {leaders.map((s) => {
              const youFirst = s.youFirst;
              return (
                <div key={s.provider} className={`${styles.leaderCard} ${youFirst ? styles.leaderYou : ''}`}>
                  <span className={styles.caption}>N° 1 sur {PROVIDER_META[s.provider].label}</span>
                  <strong>{youFirst ? 'Ici, c’est vous' : s.leader ?? 'Personne de précis'}</strong>
                </div>
              );
            })}
            <div className={`${styles.leaderCard} ${styles.leaderGhost}`}>
              <span className={styles.caption}>Vous</span>
              <strong>
                cité par {youCount} IA sur {leaders.length}
              </strong>
            </div>
          </div>
          {topCount >= 2 && (
            <p className={styles.leaderLine}>
              <mark className={styles.mark}>{topName}</mark> est cité en premier par {topCount} IA sur {leaders.length}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
