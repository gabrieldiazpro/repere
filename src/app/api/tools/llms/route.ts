import { z } from 'zod';
import { generateLlms } from '@/lib/siteaudit/llms';
import { toolHandler } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({ url: z.string().trim().min(1).max(2048) });

/** POST /api/tools/llms — llms.txt proposé, validation de l'existant, et mention honnête sur son utilité réelle. */
export const POST = toolHandler(Body, { bucket: 'tools-llms' }, (b) => generateLlms(b.url));
