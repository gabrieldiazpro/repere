'use client';

import { useEffect } from 'react';
import { reportClientError } from './client';

/**
 * Erreurs JavaScript non attrapées et promesses rejetées sans gestionnaire → /api/ops/errors.
 * À placer une fois dans le layout racine (demande à SITE-SEO-90). N'affiche rien.
 * Les erreurs de scripts tiers (« Script error. », extensions du navigateur) sont ignorées.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      if (!ev.error && (!ev.message || ev.message === 'Script error.')) return;
      if (ev.filename && !ev.filename.startsWith(location.origin)) return;
      reportClientError(ev.error ?? ev.message, { kind: 'unhandled' });
    };
    const onRejection = (ev: PromiseRejectionEvent) => reportClientError(ev.reason, { kind: 'rejection' });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}

export default ClientErrorReporter;
