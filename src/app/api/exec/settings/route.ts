import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SlugTakenError, clearSchemaCache, getSettings, hostedPageUrl, reviewKit, saveSettings } from '@/lib/execution';
import { canEditBusiness } from '@/lib/execution/auth';
import { getBusiness } from '@/lib/db';
import { botKeyFor } from '@/lib/tracking';
import { DEMO_READ_ONLY } from '@/lib/demo-v2';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://repere-ia.fr').replace(/\/$/, '');

/** GET /api/exec/settings?businessId — réglages d'exécution + kit avis + liens d'installation. */
export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId');
  if (!businessId) return NextResponse.json({ error: 'businessId manquant.' }, { status: 400 });
  const auth = await canEditBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });
  const business = await getBusiness(businessId);
  if (!business) return NextResponse.json({ error: 'Commerce introuvable.' }, { status: 404 });
  const settings = await getSettings(businessId, business.name);
  return NextResponse.json({
    settings,
    hostedPage: hostedPageUrl(settings.slug),
    schema: {
      json: `${SITE}/api/schema/${businessId}`,
      script: `${SITE}/api/schema/${businessId}?format=script`,
      wordpressPlugin: `${SITE}/integrations/repere-ia-wordpress.zip`,
      // Clé du relais robots du plugin WordPress (M5) : propriétaire seulement, jamais pour un compte démo.
      botRelayKey: auth.demo ? null : botKeyFor(businessId),
    },
    reviewKit: reviewKit(business, settings),
  });
}

const Body = z.object({
  businessId: z.string().min(1).max(100),
  settings: z
    .object({
      slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/i),
      placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/),
      reviewUrl: z.string().url().max(300).startsWith('https://'),
      brandColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      logoUrl: z.string().url().max(500).startsWith('https://'),
      schemaType: z.string().regex(/^[A-Z][A-Za-z]{2,40}$/),
      sameAs: z.array(z.string().url().max(300).regex(/^https:\/\//)).max(12),
      published: z.boolean(),
      segment: z.enum(['local', 'pme', 'ecommerce']),
      products: z
        .array(
          z.object({
            name: z.string().min(1).max(160),
            description: z.string().max(1000).optional(),
            url: z.string().url().max(500).regex(/^https:\/\//).optional(), // F5 : jamais javascript: ni data:
            image: z.string().url().max(500).regex(/^https:\/\//).optional(),
            sku: z.string().max(60).optional(),
            gtin: z.string().regex(/^\d{8,14}$/).optional(),
            brand: z.string().max(80).optional(),
            price: z.number().min(0).max(1_000_000).optional(),
            currency: z.string().length(3).optional(),
            availability: z.enum(['InStock', 'OutOfStock', 'PreOrder']).optional(),
            category: z.string().max(120).optional(),
          }),
        )
        .max(50),
    })
    .partial(),
});

/** POST /api/exec/settings — { businessId, settings: {slug?, placeId?, brandColor?…} } */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const rl = await rateLimit('exec-settings', getClientIp(req), 60, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  const { businessId, settings } = parsed.data;
  const auth = await canEditBusiness(req, businessId, { write: true });
  if (!auth.ok) return NextResponse.json({ error: auth.demo ? DEMO_READ_ONLY : 'Accès refusé.', demo: auth.demo ?? false }, { status: auth.status });
  try {
    const next = await saveSettings(businessId, settings);
    clearSchemaCache(businessId);
    return NextResponse.json({ ok: true, settings: next, hostedPage: hostedPageUrl(next.slug) });
  } catch (e) {
    if (e instanceof SlugTakenError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error('[api/exec/settings]', e);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
}
