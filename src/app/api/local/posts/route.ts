/**
 * GET   /api/local/posts?businessId=…  → { ok, data: { posts } } (calendrier, du plus proche au plus lointain)
 * POST  /api/local/posts { businessId, count?, weekday?, llm? } → { ok, data: { posts } } (planifie N posts + rappels)
 * PATCH /api/local/posts { businessId, postId, status?, text?, title? } → { ok, data: { post } }
 *   Publication MANUELLE (pas d'API Business Profile) : texte prêt à coller, rappel le jour J. Comptes démo : calendrier
 *   de démonstration, aucune écriture.
 */
import { buildLocalDemo, planPosts, POST_MAX } from '@/lib/local';
import { errorResponse, HttpError } from '@/lib/local/auth';
import { access, businessIdFrom, limit, ok, readJson } from '@/lib/local/http';
import { assertEntitled, getEntitlements } from '@/lib/entitlements';
import { listPosts, savePosts, updatePost } from '@/lib/local/repo';
import { factsOf } from '@/lib/local/service';
import type { LocalPost } from '@/lib/local/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const businessId = businessIdFrom(new URL(req.url).searchParams.get('businessId'));
    const { demo } = await access(req, businessId, 'read');
    if (demo) return ok({ posts: (await buildLocalDemo(businessId))?.posts ?? [] }, { demo: true });
    return ok({ posts: await listPosts(businessId) });
  } catch (e) {
    return errorResponse(e, 'posts');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const businessId = businessIdFrom(body.businessId);
    const { business, demo } = await access(req, businessId, 'compute');
    if (demo) return ok({ posts: (await buildLocalDemo(businessId))?.posts ?? [], saved: false }, { demo: true });
    const llm = body.llm === true;
    if (llm) assertEntitled(getEntitlements(business), 'execution'); // rédaction LLM : offre Essentiel et plus
    if (llm) await limit(req, 'posts', businessId, 10);
    const facts = await factsOf(business);
    const { posts, reminders } = await planPosts(
      { businessId, businessName: business.name, trade: business.trade, city: business.city, services: facts.services, zone: facts.zone, phone: facts.telephone },
      { count: typeof body.count === 'number' ? body.count : undefined, weekday: typeof body.weekday === 'number' ? body.weekday : undefined, llm },
    );
    // Ne pas écraser un post déjà publié ou ignoré à la même date.
    const existing = new Map((await listPosts(businessId)).map((p) => [p.id, p]));
    const fresh = posts.filter((p) => !existing.has(p.id) || existing.get(p.id)!.status === 'planned');
    await savePosts(fresh, reminders.filter((r) => fresh.some((p) => p.id === r.postId)));
    return ok({ posts: await listPosts(businessId), saved: true });
  } catch (e) {
    return errorResponse(e, 'posts');
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await readJson(req);
    const businessId = businessIdFrom(body.businessId);
    await access(req, businessId, 'write');
    const postId = typeof body.postId === 'string' ? body.postId.slice(0, 80) : '';
    const patch: Partial<Pick<LocalPost, 'status' | 'text' | 'title' | 'publishedAt'>> = {};
    if (body.status === 'planned' || body.status === 'published' || body.status === 'skipped') {
      patch.status = body.status;
      if (body.status === 'published') patch.publishedAt = new Date().toISOString();
    }
    if (typeof body.text === 'string') patch.text = body.text.slice(0, POST_MAX);
    if (typeof body.title === 'string') patch.title = body.title.slice(0, 120);
    if (!Object.keys(patch).length) throw new HttpError(400, 'Rien à modifier.');
    const post = await updatePost(businessId, postId, patch);
    if (!post) throw new HttpError(404, 'Post introuvable.');
    return ok({ post });
  } catch (e) {
    return errorResponse(e, 'posts');
  }
}
