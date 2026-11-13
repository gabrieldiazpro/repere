import { z } from 'zod';
import { compareSites } from '@/lib/siteaudit/compare';
import { toolHandler } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({ url: z.string().trim().min(1).max(2048), competitorUrl: z.string().trim().min(1).max(2048) });

/** POST /api/tools/compare — signaux techniques des deux pages côte à côte (budget 15 s, 5 par heure). */
export const POST = toolHandler(Body, { bucket: 'tools-compare', perHour: 5 }, (b) => compareSites(b.url, b.competitorUrl));
