import { CORS, handleBot } from '@/lib/tracking/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => handleBot(req);
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
