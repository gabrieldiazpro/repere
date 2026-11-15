'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/ops/client';

/**
 * Page de secours quand le layout racine lui-même échoue (Next remplace alors tout le document : pas de CSS du site,
 * styles en ligne). L'erreur est remontée à /api/ops/errors (OPS, V6). Sobre, en français, sans détail technique.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error, { boundary: 'global' }), [error]);
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F7F7FB', color: '#1B1F2E', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <main style={{ maxWidth: 480, padding: '32px 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 26, lineHeight: 1.2, margin: '0 0 12px' }}>Une erreur est survenue</h1>
          <p style={{ margin: '0 0 24px', lineHeight: 1.55, color: '#4B5168' }}>
            La page n’a pas pu s’afficher. L’incident nous a été signalé ; vous pouvez réessayer tout de suite.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => reset()} style={{ minHeight: 44, padding: '0 20px', borderRadius: 10, border: 0, background: '#3730A3', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              Réessayer
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- le routeur peut être hors service ici : rechargement complet voulu */}
            <a href="/" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 20px', borderRadius: 10, border: '1px solid #D5D9E4', color: '#3730A3', fontWeight: 600, textDecoration: 'none' }}>
              Retour à l’accueil
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
