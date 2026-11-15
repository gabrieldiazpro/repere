// Monogramme ou logo de l'agence (composant serveur ou client).
import { initialsOf } from '@/lib/agency/brand';

export function BrandMark({ name, logoUrl, size = 40 }: { name: string; logoUrl?: string | null; size?: number }) {
  return (
    <span className="ag-mark" style={{ width: size, height: size }} aria-hidden="true">
      {/* Logo externe en https, choisi par l'agence ; pas de next/image (domaine inconnu à l'avance). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logoUrl ? <img src={logoUrl} alt="" referrerPolicy="no-referrer" /> : initialsOf(name)}
    </span>
  );
}
