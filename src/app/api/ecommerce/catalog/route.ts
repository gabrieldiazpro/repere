/**
 * Catalogue suivi.
 * GET    /api/ecommerce/catalog?businessId=…                         → { ok, catalog, demo, shopify }
 * POST   /api/ecommerce/catalog { businessId, product }              → ajout / mise à jour manuelle
 * POST   /api/ecommerce/catalog { businessId, import: 'urls'|'sitemap'|'products_json'|'shopify', urls?, site? }
 *                                                                     → { ok, catalog, added, updated, skipped, errors }
 * DELETE /api/ecommerce/catalog?businessId=…&productId=…            → retrait
 * Comptes démo : lecture seule.
 */
import { HttpError } from '@/lib/auth';
import {
  emptyCatalog,
  getCatalog,
  importFromProductsJson,
  importFromSitemap,
  importFromUrls,
  isDemoEcom,
  loadCatalog,
  mergeProducts,
  normalizeProduct,
  saveCatalog,
  type CatalogProduct,
  type ImportResult,
} from '@/lib/ecommerce';
import { businessIdOf, errorResponse, json, limit, readAccess, readJson, writeAccess } from '@/lib/ecommerce/http';
import { connectionStatus, fetchProducts } from '@/lib/ecommerce/shopify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    const { business } = await readAccess(req, businessId);
    const [catalog, shopify] = await Promise.all([getCatalog(business), connectionStatus(businessId)]);
    return json({ ok: true, catalog, demo: isDemoEcom(businessId), shopify });
  } catch (e) {
    return errorResponse(e, '/catalog');
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, 'catalog', 120);
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    const { business } = await writeAccess(req, businessId);
    const current = (await loadCatalog(businessId)) ?? emptyCatalog(businessId, business.name, business.website);
    let incoming: CatalogProduct[] = [];
    let errors: ImportResult['errors'] = [];
    if (body.product && typeof body.product === 'object') {
      const p = normalizeProduct(body.product as Record<string, unknown>, 'manual');
      if ('error' in p) throw new HttpError(400, p.error);
      incoming = [p];
    } else if (typeof body.import === 'string') {
      await limit(req, 'catalog-import', 20);
      let r: ImportResult;
      const site = typeof body.site === 'string' ? body.site : (business.website ?? '');
      switch (body.import) {
        case 'urls':
          r = await importFromUrls(Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string') : []);
          break;
        case 'sitemap':
          r = await importFromSitemap(site);
          break;
        case 'products_json':
          r = await importFromProductsJson(site);
          break;
        case 'shopify': {
          const ps = await fetchProducts(businessId);
          if (!ps) throw new HttpError(409, 'Boutique Shopify non connectée.', 'shopify_not_connected');
          r = { products: ps, errors: [] };
          break;
        }
        default:
          throw new HttpError(400, 'Import inconnu.');
      }
      incoming = r.products;
      errors = r.errors;
    } else throw new HttpError(400, 'Indiquez un produit ou un import.');
    const merged = mergeProducts(current.products, incoming);
    const catalog = await saveCatalog({ ...current, products: merged.products });
    return json({ ok: true, catalog, added: merged.added, updated: merged.updated, skipped: merged.skipped, errors });
  } catch (e) {
    return errorResponse(e, '/catalog');
  }
}

export async function DELETE(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const businessId = businessIdOf(sp.get('businessId'));
    const productId = sp.get('productId') ?? '';
    await writeAccess(req, businessId);
    const current = await loadCatalog(businessId);
    if (!current || !current.products.some((p) => p.id === productId)) throw new HttpError(404, 'Produit introuvable.');
    const catalog = await saveCatalog({ ...current, products: current.products.filter((p) => p.id !== productId) });
    return json({ ok: true, catalog });
  } catch (e) {
    return errorResponse(e, '/catalog');
  }
}
