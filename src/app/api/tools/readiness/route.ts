import { z } from 'zod';
import { auditReadiness } from '@/lib/siteaudit/readiness';
import { toolHandler } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({ url: z.string().trim().min(1).max(2048) });

/** POST /api/tools/readiness — score « prêt pour les IA » /100 et contrôles {id, label, status, detail, fix}. */
export const POST = toolHandler(Body, { bucket: 'tools-readiness' }, (b) => auditReadiness(b.url));
