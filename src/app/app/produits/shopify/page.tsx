import Link from 'next/link';
import { PageHeader } from '@/components/app/PageHeader';
import { ShopifyReturnNotice, shopifyReturnStatus } from '@/components/app/metiers/ShopifyReturn';

export const metadata = { title: 'Connexion Shopify' };
export const dynamic = 'force-dynamic';

/**
 * Page de retour après l'autorisation Shopify (journal ECOMMERCE) : /app/produits/shopify?shopify=connected|error.
 * Sans statut lisible, renvoie vers l'écran Ventes où se trouve la connexion.
 */
export default async function ShopifyRetour({ searchParams }: { searchParams: Promise<{ shopify?: string; statut?: string }> }) {
  const sp = await searchParams;
  const status = shopifyReturnStatus(sp.shopify ?? sp.statut);
  return (
    <>
      <PageHeader title="Connexion Shopify" back={{ href: '/app/produits/ventes', label: 'Ventes' }} />
      <div className="rp-page">
        {status ? (
          <ShopifyReturnNotice status={status} />
        ) : (
          <p className="rounded-xl bg-[var(--primary-bg)] p-4 text-[14px] text-[var(--primary)]">Aucune connexion en cours. La connexion à Shopify se fait depuis l’écran Ventes.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href="/app/produits/ventes" className="rp-btn rp-btn-primary">
            {status === 'error' ? 'Réessayer depuis l’écran Ventes' : 'Voir les ventes venues des IA'}
          </Link>
          {status === 'connected' && (
            <Link href="/app/produits#ajout-h" className="rp-btn">
              Importer mon catalogue
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
