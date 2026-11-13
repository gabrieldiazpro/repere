import { z } from 'zod';
import { validateJsonLdText, validateJsonLdUrl, validateJsonLdValue } from '@/lib/siteaudit/jsonld';
import { toolHandler } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z
  .object({
    url: z.string().trim().min(1).max(2048).optional(),
    /** Bloc collé (JSON ou HTML avec balises script) ou objet déjà analysé. */
    jsonld: z.union([z.string().min(1).max(200_000), z.record(z.string(), z.unknown()), z.array(z.unknown()).max(50)]).optional(),
  })
  .refine((b) => !!b.url !== (b.jsonld !== undefined), { message: 'indiquez soit url, soit jsonld' });

/** POST /api/tools/jsonld/validate — blocs trouvés, erreurs, champs manquants. */
export const POST = toolHandler(Body, { bucket: 'tools-jsonld-validate', perHour: 30 }, async (b) => {
  if (b.url) return validateJsonLdUrl(b.url);
  return typeof b.jsonld === 'string' ? validateJsonLdText(b.jsonld) : validateJsonLdValue(b.jsonld);
});
