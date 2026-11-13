import styles from '@/components/report/report.module.css';

export default function Loading() {
  return (
    <div className={styles.root} aria-busy="true" aria-live="polite">
      <main className={styles.wrap}>
        <span className={styles.srOnly}>Chargement de votre rapport…</span>
        <section className={`${styles.card} ${styles.cover}`}>
          <div className={styles.coverHead} style={{ gap: 10 }}>
            <div className={styles.skel} style={{ height: 14, width: 180 }} />
            <div className={styles.skel} style={{ height: 34, width: '80%' }} />
            <div className={styles.skel} style={{ height: 16, width: '55%' }} />
          </div>
          <div className={styles.coverGauge}>
            <div className={styles.skel} style={{ width: 200, height: 170, borderRadius: '100px 100px 24px 24px' }} />
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className={styles.skel} style={{ height: 18 }} />
            <div className={styles.skel} style={{ height: 18, width: '85%' }} />
            <div className={styles.stats}>
              <div className={styles.skel} style={{ height: 64 }} />
              <div className={styles.skel} style={{ height: 64 }} />
              <div className={styles.skel} style={{ height: 64 }} />
            </div>
          </div>
        </section>
        {[0, 1].map((i) => (
          <section key={i} className={styles.card} style={{ display: 'grid', gap: 12 }}>
            <div className={styles.skel} style={{ height: 24, width: '60%' }} />
            <div className={styles.skel} style={{ height: 120 }} />
          </section>
        ))}
      </main>
    </div>
  );
}
