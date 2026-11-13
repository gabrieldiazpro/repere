/**
 * POST /api/ecommerce/deliverables { businessId, kind: 'faq'|'guide'|'jsonld', productId?, category?, llm? }
 * → faq    : { ok, faq: ProductFaq }            (FAQ produit + FAQPage JSON-LD, manques marqués « à compléter »)
 * → guide  : { ok, guide: BuyingGuide }         (guide d'achat de la catégorie, brouillon Markdown)
 * → jsonld : { ok, jsonld, warnings }           (JSON-LD Product complet)
 * Gabarits sans clé ; `llm: true` = reformulation (offre avec exécution, jamais sur les comptes démo).
 */
import { HttpError } from '@/lib/auth';
import { assertEntitled, getEntitlements } from '@/lib/entitlements';
import {
  buildBuyingGuide,
  buildProductFaq,
  buildProductJsonLd,
  buildProductTracking,
  deliverableCtx,
  isDemoEcom,
  loadContext,
  productJsonLdWarnings,
} from '@/lib/ecommerce';
import { businessIdOf, errorResponse, json, limit, readAccess, readJson, writeAccess } from '@/lib/ecommerce/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await limit(req, 'deliverables', 120);
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    const llm = body.llm === true && !isDemoEcom(businessId);
    // F6 : un lecteur ne déclenche pas d'appel LLM (coût) ; écriture (membre) exigée quand llm est demandé.
    const { business } = llm ? await writeAccess(req, businessId) : await readAccess(req, businessId);
    if (llm) {
      assertEntitled(getEntitlements(business), 'execution');
      await limit(req, 'deliverables-llm', 30);
    }
    const c = await loadContext(business);
    const ctx = await deliverableCtx(business, c.catalog);
    const product = typeof body.productId === 'string' ? c.catalog.products.find((p) => p.id === body.productId) : undefined;
    switch (body.kind) {
      case 'jsonld': {
        if (!product) throw new HttpError(404, 'Produit introuvable dans le catalogue.');
        const jsonld = buildProductJsonLd(product, ctx);
        return json({ ok: true, jsonld, warnings: productJsonLdWarnings(jsonld), demo: c.demo });
      }
      case 'faq': {
        if (!product) throw new HttpError(404, 'Produit introuvable dans le catalogue.');
        const tracking = buildProductTracking(c.audit, c.catalog, { demo: c.demo });
        return json({ ok: true, faq: await buildProductFaq(product, ctx, tracking, { llm }), demo: c.demo });
      }
      case 'guide': {
        const category = typeof body.category === 'string' ? body.category.trim().toLowerCase().slice(0, 60) : '';
        if (!category) throw new HttpError(400, 'Indiquez une catégorie.');
        const tracking = buildProductTracking(c.audit, c.catalog, { demo: c.demo });
        return json({ ok: true, guide: await buildBuyingGuide(category, c.catalog.products, ctx, tracking, { llm }), demo: c.demo });
      }
      default:
        throw new HttpError(400, 'Livrable inconnu (faq, guide ou jsonld).');
    }
  } catch (e) {
    return errorResponse(e, '/deliverables');
  }
}
