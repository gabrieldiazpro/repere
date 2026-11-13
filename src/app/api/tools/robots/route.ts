import { z } from 'zod';
import { analyzeRobots } from '@/lib/siteaudit/robotsAudit';
import { toolHandler } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({
  url: z.string().trim().min(1).max(2048),
  /** Chemin supplémentaire à tester (ex. « /tarifs »). */
  path: z.string().trim().regex(/^\//).max(512).optional(),
});

/** POST /api/tools/robots — verdict robot par robot (autorisé / bloqué / non mentionné), ligne, recommandation. */
export const POST = toolHandler(Body, { bucket: 'tools-robots', perHour: 20 }, (b) => analyzeRobots(b.url, { extraPath: b.path ?? '/tarifs' }));
