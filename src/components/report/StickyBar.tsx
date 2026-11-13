'use client';

import { useEffect, useState } from 'react';
import styles from './report.module.css';
import { useShare } from './ShareButtons';

export function StickyBar({ score, auditId, watchId, title, shareText, signupHref }: { score: number; auditId: string; watchId: string; title: string; shareText: string; signupHref?: string }) {
  const [on, setOn] = useState(false);
  const { share, toast } = useShare(title, shareText);

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setOn(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  return (
    <div className={`${styles.sticky} ${on ? styles.stickyOn : ''}`} aria-hidden={!on}>
      <div className={styles.stickyInner}>
        <span className={styles.stickyScore}>
          Votre score
          <strong>{score}/100</strong>
        </span>
        <span className={styles.stickyActions}>
          <a
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall} ${styles.iconBtn}`}
            href={`/api/report/${encodeURIComponent(auditId)}/pdf`}
            tabIndex={on ? 0 : -1}
            aria-label="Télécharger le PDF"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
            </svg>
            <span className={styles.iconLabel}>PDF</span>
          </a>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall} ${styles.iconBtn} ${styles.stickyHideSm}`}
            onClick={share}
            tabIndex={on ? 0 : -1}
          >
            Partager
          </button>
          <a className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`} href={signupHref ?? '#offres'} tabIndex={on ? 0 : -1}>
            {signupHref ? 'Créer mon espace gratuit' : <>Voir le plan d&apos;action</>}
          </a>
        </span>
      </div>
      {toast && (
        <span className={styles.toast} role="status">
          {toast}
        </span>
      )}
    </div>
  );
}
