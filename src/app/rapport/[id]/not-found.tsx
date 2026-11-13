import styles from '@/components/report/report.module.css';

export default function RapportIntrouvable() {
  return (
    <div className={styles.root}>
      <main className={styles.wrap}>
        <section className={`${styles.card} ${styles.center}`}>
          <span className={styles.eyebrow}>Rapport introuvable</span>
          <h1 style={{ fontSize: 28 }}>Ce rapport n&apos;existe pas ou plus</h1>
          <p style={{ color: 'var(--r-muted)', maxWidth: 520 }}>
            Le lien est peut-être incomplet, ou le rapport a été supprimé (nous conservons les audits gratuits 12 mois). Vous pouvez relancer un audit gratuit : le formulaire prend une minute, le résultat arrive en quelques minutes.
          </p>
          <a className={`${styles.btn} ${styles.btnPrimary}`} href="/audit">
            Lancer un nouvel audit
          </a>
        </section>
      </main>
    </div>
  );
}
