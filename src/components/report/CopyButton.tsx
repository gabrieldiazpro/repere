'use client';

import { useState } from 'react';
import styles from './report.module.css';

/** Bouton « Copier » pour un livrable prêt à coller. */
export function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [done, setDone] = useState<'ok' | 'ko' | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone('ok');
    } catch {
      setDone('ko');
    }
    setTimeout(() => setDone(null), 2200);
  };
  return (
    <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`} onClick={copy} style={{ justifySelf: 'start' }}>
      {done === 'ok' ? 'Copié ✓' : done === 'ko' ? 'Sélectionnez le texte pour le copier' : label}
      <span className={styles.srOnly} role="status">{done === 'ok' ? 'Texte copié' : ''}</span>
    </button>
  );
}
