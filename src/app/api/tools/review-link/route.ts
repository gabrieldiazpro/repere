import { z } from 'zod';
import { buildReviewLink } from '@/lib/siteaudit/reviewLink';
import { toolHandler } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    /** Place ID ou lien Google Maps qui le contient. */
    placeId: z.string().trim().max(2048).optional(),
    name: z.string().trim().max(120).optional(),
    city: z.string().trim().max(100).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .refine((b) => !!b.placeId || (!!b.name && !!b.city), { message: 'indiquez placeId, ou name et city' });

/** POST /api/tools/review-link — lien d'avis Google + QR SVG + modèles (kit avis conforme). */
export const POST = toolHandler(Body, { bucket: 'tools-review-link', perHour: 60 }, async (b) => buildReviewLink(b));
