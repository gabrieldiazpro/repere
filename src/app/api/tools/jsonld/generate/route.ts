import { z } from 'zod';
import { generateJsonLd } from '@/lib/siteaudit/jsonld';
import { toolHandler } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const s = (n = 300) => z.string().trim().max(n).optional();
const Fields = z.object({
  name: s(150), trade: s(80), schemaType: z.string().regex(/^[A-Z][A-Za-z]{2,40}$/).optional(), url: s(500), description: s(1000),
  telephone: s(40), address: s(300), city: s(100), openingHours: s(300), priceRange: s(100), areaServed: s(300), services: s(1000),
  foundingYear: s(20), founder: s(120), logo: s(500), sameAs: z.array(z.string().trim().max(500)).max(20).optional(),
  brand: s(120), image: s(500), sku: s(80), gtin: s(20), category: s(150), price: s(30), currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  availability: z.enum(['InStock', 'OutOfStock', 'PreOrder']).optional(), ratingValue: s(10), reviewCount: s(10),
  faq: z.array(z.object({ q: z.string().trim().min(1).max(300), a: z.string().trim().min(1).max(2000) })).max(30).optional(),
});
const Body = z.object({ type: z.enum(['LocalBusiness', 'Organization', 'Product', 'FAQPage']), fields: Fields });

/** POST /api/tools/jsonld/generate — JSON-LD prêt à coller (aucune valeur inventée). */
export const POST = toolHandler(Body, { bucket: 'tools-jsonld-generate', perHour: 120 }, async (b) => generateJsonLd(b.type, b.fields));
