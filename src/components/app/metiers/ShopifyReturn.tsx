// Message de retour après l'autorisation Shopify (?shopify=connected|error).
import Link from 'next/link';

/** Lit le statut de retour de la connexion Shopify dans l'URL (valeurs inconnues ignorées). */
export function shopifyReturnStatus(v: unknown): 'connected' | 'error' | null {
  return v === 'connected' ? 'connected' : v === 'error' ? 'error' : null;
}

export function ShopifyReturnNotice({ status }: { status: 'connected' | 'error' }) {
  return status === 'connected' ? (
    <p role="status" className="rounded-xl bg-[var(--success-bg)] p-4 text-[14px] text-[var(--success-ink)]">
      <strong>Boutique Shopify connectée.</strong> Les commandes des 30 derniers jours sont désormais attribuées aux IA dans l’écran Ventes ; importez aussi votre catalogue depuis l’écran{' '}
      <Link href="/app/produits#ajout-h" className="rp-link">
        Produits
      </Link>
      .
    </p>
  ) : (
    <p role="alert" className="rounded-xl bg-[var(--danger-bg)] p-4 text-[14px] text-[var(--danger-ink)]">
      <strong>La connexion à Shopify n’a pas abouti.</strong> L’autorisation a été refusée, a expiré (10 minutes) ou a été ouverte dans un autre navigateur. Relancez-la ci-dessous.
    </p>
  );
}

