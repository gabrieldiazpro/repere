'use client';
import { Icon } from '../icons';

/** Imprimer ou enregistrer en PDF (boîte de dialogue du navigateur). */
export function PrintButton() {
  return (
    <button type="button" className="rp-btn rp-btn-primary" onClick={() => window.print()}>
      <Icon name="download" size={16} /> Imprimer ou enregistrer en PDF
    </button>
  );
}
