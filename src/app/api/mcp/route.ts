/**
 * Serveur MCP en lecture (transport Streamable HTTP), authentifié par clé d'API : src/lib/publicapi/mcp.ts.
 * Documentation : /developpeurs#mcp.
 */
import { handleMcp } from '@/lib/publicapi/mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => handleMcp(req);
export const GET = (req: Request) => handleMcp(req);
export const DELETE = (req: Request) => handleMcp(req);
export const OPTIONS = (req: Request) => handleMcp(req);
