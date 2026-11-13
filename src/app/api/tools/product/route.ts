import { z } from 'zod';
import { auditProduct } from '@/lib/siteaudit/product';
import { toolHandler } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({ url: z.string().trim().min(1).max(2048) });

/** POST /api/tools/product — audit de fiche produit /100. */
export const POST = toolHandler(Body, { bucket: 'tools-product' }, (b) => auditProduct(b.url));
