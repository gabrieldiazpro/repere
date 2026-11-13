'use client';

import { useState } from 'react';
import styles from './report.module.css';

export function useShare(title: string, text: string) {
  const [toast, setToast] = useState<string | null>(null);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('Lien copié');
    } catch {
      /* partage annulé */
    }
    setTimeout(() => setToast(null), 2000);
  };
  return { share, toast };
}

export function ShareButtons({ title, text, onDark = false }: { title: string; text: string; onDark?: boolean }) {
  const { share, toast } = useShare(title, text);
  const cls = onDark ? styles.btnOnDark : styles.btnSecondary;
  const wa = () => {
    const url = window.location.href;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
  };
  const mail = () => {
    const url = window.location.href;
    const body = `Bonjour,\n\nVoici le rapport de visibilité IA de mon commerce :\n${url}\n\nPouvez-vous y jeter un œil ?\n`;
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <>
      <button type="button" className={`${styles.btn} ${cls}`} onClick={wa}>
        Envoyer par WhatsApp
      </button>
      <button type="button" className={`${styles.btn} ${cls}`} onClick={mail}>
        Envoyer ce rapport à mon prestataire web
      </button>
      <button type="button" className={`${styles.btn} ${cls}`} onClick={share}>
        Copier / partager le lien
      </button>
      {toast && (
        <span className={styles.toast} role="status">
          {toast}
        </span>
      )}
    </>
  );
}
