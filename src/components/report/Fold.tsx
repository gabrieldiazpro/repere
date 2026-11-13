'use client';

import { useEffect, useState } from 'react';
import v3 from './v3.module.css';

/**
 * Bouton « replier / déplier » d'une section du rapport (tous écrans, V4).
 * Le contenu est rendu par le serveur (lisible sans JavaScript) ; on ne replie qu'après montage
 * les sections secondaires (`folded`). Une ancre vers la section la déplie.
 */
export function FoldToggle({ sectionId, bodyId, folded = false, title }: { sectionId: string; bodyId: string; folded?: boolean; title: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const startClosed = folded && window.location.hash !== `#${sectionId}`;
    if (startClosed) setOpen(false);
    const onHash = () => {
      if (window.location.hash === `#${sectionId}`) setOpen(true);
    };
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail === sectionId) setOpen(true);
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('rapport:open', onOpen as EventListener);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('rapport:open', onOpen as EventListener);
    };
  }, [sectionId, folded]);

  useEffect(() => {
    const el = document.getElementById(sectionId);
    if (el) el.dataset.folded = open ? 'false' : 'true';
  }, [open, sectionId]);

  return (
    <button
      type="button"
      className={v3.foldBtn}
      aria-expanded={open}
      aria-controls={bodyId}
      onClick={() => setOpen((o) => !o)}
    >
      <span className={v3.foldBtnTxt} aria-hidden="true">{open ? 'Replier' : 'Afficher'}</span>
      <span className={v3.srOnly}>{open ? 'Replier' : 'Déplier'} la section « {title} »</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={open ? v3.chevOpen : v3.chev}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}
