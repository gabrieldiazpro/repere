import { z } from 'zod';
import { auditCitability } from '@/lib/siteaudit/citability';
import { toolHandler } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z
  .object({
    url: z.string().trim().min(1).max(2048).optional(),
    html: z.string().min(1).max(500_000).optional(),
    question: z.string().trim().max(200).optional(),
  })
  .refine((b) => !!b.url !== !!b.html, { message: 'indiquez soit url, soit html' });

/** POST /api/tools/citability — score /100, règles et extraits citables. Jamais d'IA en accès anonyme. */
export const POST = toolHandler(Body, { bucket: 'tools-citability' }, (b) => auditCitability({ url: b.url, html: b.html, question: b.question, ai: false }));
