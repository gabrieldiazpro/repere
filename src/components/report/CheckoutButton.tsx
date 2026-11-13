'use client';

import { useState } from 'react';
import styles from './report.module.css';

export function CheckoutButton({
  planId,
  auditId,
  children,
  variant = 'primary',
  block = false,
  className = '',
  fallbackHref,
}: {
  planId: string;
  auditId: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'onDark';
  block?: boolean;
  className?: string;
  /** lien de repli affiché si le paiement ne démarre pas (jamais de bouton mort) */
  fallbackHref?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, auditId }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'checkout');
      window.location.assign(data.url);
    } catch {
      setError('Le paiement n’a pas pu démarrer.');
      setLoading(false);
    }
  };

  const v = variant === 'primary' ? styles.btnPrimary : variant === 'secondary' ? styles.btnSecondary : styles.btnOnDark;
  return (
    <span style={{ display: block ? 'grid' : 'inline-grid', gap: 6 }} className={className}>
      <button type="button" className={`${styles.btn} ${v} ${block ? styles.btnBlock : ''}`} onClick={go} disabled={loading} aria-busy={loading}>
        {loading ? 'Redirection vers le paiement sécurisé…' : children}
      </button>
      {error && (
        <span className={styles.error} role="alert">
          {error}{' '}
          {fallbackHref ? <a href={fallbackHref}>Voir l’offre sur la page Tarifs</a> : 'Réessayez dans un instant.'}
        </span>
      )}
    </span>
  );
}
