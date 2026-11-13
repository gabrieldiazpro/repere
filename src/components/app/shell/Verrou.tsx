// Composant de verrouillage par offre, utilisable dans un composant serveur ou client (aucun hook).
//
//   <Verrou ent={ent} feature="exports">{bouton d'export}</Verrou>
//   <Verrou ent={ent} feature="execution" apercu>{livrable}</Verrou>   → contenu flouté et inerte derrière le cadre
//   <VerrouBouton ent={ent} feature="exports" label="Exporter en CSV">{bouton réel}</VerrouBouton>
import Link from 'next/link';
import type { Entitlements } from '@/lib/entitlements';
import { Icon } from '../icons';
import { verrou, type VerrouFeature } from './verrou';

export function Verrou({
  ent,
  feature,
  titre,
  apercu = false,
  compact = false,
  children,
}: {
  ent: Entitlements | null | undefined;
  feature: VerrouFeature;
  /** nom de la fonction (« Exports CSV ») ; par défaut : le bénéfice seul */
  titre?: string;
  /** affiche le contenu flouté et inerte derrière le cadre */
  apercu?: boolean;
  /** version une ligne */
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const v = verrou(ent, feature);
  if (!v.locked) return <>{children}</>;
  const cadre = compact ? (
    <p className="rp-verrou rp-verrou-compact" data-verrou={feature}>
      <Icon name="lock" size={16} />
      <span className="min-w-0 flex-1">
        {titre ? <strong className="font-semibold">{titre} : </strong> : null}
        offre {v.offre}.
      </span>
      <Link href={v.href} className="rp-link whitespace-nowrap">
        Voir les offres
      </Link>
    </p>
  ) : (
    <div className="rp-verrou" data-verrou={feature} role="group" aria-label={`${titre ?? 'Fonction'} verrouillée`}>
      <span className="rp-verrou-ico" aria-hidden="true">
        <Icon name="lock" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{titre ?? 'Fonction non incluse dans votre offre'}</p>
        <p className="mt-0.5 text-[14px] text-[var(--muted)]">{v.benefice}</p>
        <p className="mt-1 text-[13px]">
          Disponible avec l’offre <strong className="font-semibold">{v.offre}</strong>.
        </p>
      </div>
      <Link href={v.href} className="rp-btn rp-btn-primary rp-btn-sm self-center">
        Voir les offres
      </Link>
    </div>
  );
  if (!apercu || !children) return cadre;
  return (
    <div className="rp-verrou-wrap">
      <div className="rp-verrou-apercu" aria-hidden="true" inert>
        {children}
      </div>
      <div className="rp-verrou-over">{cadre}</div>
    </div>
  );
}

/** Variante bouton : remplace un bouton d'action par un lien « verrouillé » vers les offres. */
export function VerrouBouton({
  ent,
  feature,
  label,
  children,
}: {
  ent: Entitlements | null | undefined;
  feature: VerrouFeature;
  label: string;
  children?: React.ReactNode;
}) {
  const v = verrou(ent, feature);
  if (!v.locked) return <>{children}</>;
  return (
    <Link href={v.href} className="rp-btn rp-btn-sm rp-btn-locked" title={`Disponible avec l’offre ${v.offre}`} data-verrou={feature}>
      <Icon name="lock" size={15} />
      {label}
      <span className="sr-only"> : disponible avec l’offre {v.offre}, voir les offres</span>
    </Link>
  );
}
