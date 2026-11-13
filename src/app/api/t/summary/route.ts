import { handleSummary } from '@/lib/tracking/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => handleSummary(req);
