/**
 * Fiche de vérité — GET/POST /api/facts?businessId=…
 * POST : { facts: { telephone: '01 …', … }, replace?: boolean } (ou les champs à plat). Chaîne vide = champ effacé.
 * Après sauvegarde, le contrôle d'exactitude du dernier audit est relancé et renvoyé.
 */
import { NextResponse } from 'next/server';
import { canAccessBusiness } from '@/lib/db';
import { DEMO_READ_ONLY, isDemoBusinessId } from '@/lib/demo-v2';
import { createFactFixTask } from '@/lib/execution';
import { FACT_FIELDS, FACT_LABELS, FactsValidationError, getFacts, getLatestFactCheck, refreshFactCheck, runFactCheck, saveFacts, validateFacts } from '@/lib/facts';
import { getLatestAuditForBusiness } from '@/lib/db';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

function businessIdOf(req: Request): string | null {
  const id = new URL(req.url).searchParams.get('businessId');
  return id && ID_RE.test(id) ? id : null;
}

export async function GET(req: Request) {
  const businessId = businessIdOf(req);
  if (!businessId) return NextResponse.json({ error: 'businessId manquant ou invalide.' }, { status: 400 });
  const auth = await canAccessBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });
  const [facts, check] = await Promise.all([getFacts(businessId), getLatestFactCheck(businessId)]);
  return NextResponse.json({ facts, check, fields: FACT_FIELDS, labels: FACT_LABELS });
}

export async function POST(req: Request) {
  const businessId = businessIdOf(req);
  if (!businessId) return NextResponse.json({ error: 'businessId manquant ou invalide.' }, { status: 400 });

  const rl = await rateLimit('facts', getClientIp(req), 120, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });

  const auth = await canAccessBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  const replace = body.replace === true;
  const patch = body.facts && typeof body.facts === 'object' ? body.facts : Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'replace'));

  // Comptes démo publics : lecture seule côté serveur (qa/v2/securite-v2.md E1) ; l'UI garde la saisie sur l'appareil.
  // On valide quand même et on renvoie la revérification immédiate (rien n'est enregistré).
  if (isDemoBusinessId(businessId)) {
    const v = validateFacts(patch);
    if (!v.ok) return NextResponse.json({ error: 'Certains champs sont invalides.', errors: v.errors, demo: true }, { status: 400 });
    const current = await getFacts(businessId);
    const merged = { ...current, facts: { ...current.facts } };
    for (const [k, val] of Object.entries(v.data)) {
      if (val) (merged.facts as Record<string, string>)[k] = val;
      else delete (merged.facts as Record<string, string>)[k];
    }
    const audit = await getLatestAuditForBusiness(businessId).catch(() => null);
    const preview = audit ? runFactCheck(audit as Parameters<typeof runFactCheck>[0], merged) : null;
    return NextResponse.json({ error: DEMO_READ_ONLY, demo: true, preview }, { status: 403 });
  }

  try {
    const facts = await saveFacts(businessId, patch, { replace });
    const check = await refreshFactCheck(businessId, facts);
    // Chaque information fausse détectée devient (ou met à jour) une tâche « corriger » (fact_fix), 3 au plus.
    const tasks: string[] = [];
    for (const item of (check?.report.items ?? []).filter((i) => i.verdict === 'faux').slice(0, 3)) {
      const t = await createFactFixTask(businessId, item).catch((e) => {
        console.warn('[api/facts] fact_fix', e);
        return null;
      });
      if (t) tasks.push(t.id);
    }
    return NextResponse.json({ ok: true, facts, check, factFixTasks: tasks });
  } catch (e) {
    if (e instanceof FactsValidationError) {
      return NextResponse.json({ error: 'Certains champs sont invalides.', errors: e.errors }, { status: 400 });
    }
    console.error('[api/facts]', e);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
}
