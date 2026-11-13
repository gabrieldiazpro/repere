/**
 * Rapports planifiés par e-mail.
 * GET  /api/alerts/reports?businessId=  → { schedule, maxRecipients }
 * POST /api/alerts/reports { businessId, active?, frequency?, day?, hour?, recipients?: string[], includeShareLink?, branding? }
 *      → enregistre côté serveur, envoie les e-mails de confirmation (double opt-in), planifie `report.scheduled`.
 */
import { getSchedule, saveSchedule } from '@/lib/notify';
import { maxRecipients, type SchedulePatch } from '@/lib/notify/reports';
import { sanitizeBranding } from '@/lib/share';
import type { BusinessRecord } from '@/lib/db';
import { getEntitlements, requireBusiness } from '@/lib/notify/platform';
import { businessIdOf, handle, jsonOk, limit, readJson } from '@/lib/notify/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle('alerts/reports', async () => {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    const { business } = await requireBusiness(req, businessId);
    const e = getEntitlements(business);
    return jsonOk({ schedule: await getSchedule(businessId), maxRecipients: maxRecipients(e), whiteLabel: e.whiteLabel });
  });
}

export async function POST(req: Request) {
  return handle('alerts/reports', async () => {
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    await limit(req, 'reports', 30);
    const { business } = await requireBusiness(req, businessId, { write: true, minRole: 'admin' });
    const e = getEntitlements(business);
    const patch: SchedulePatch = {
      ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
      ...(body.frequency === 'weekly' || body.frequency === 'monthly' ? { frequency: body.frequency } : {}),
      ...(typeof body.day === 'number' ? { day: body.day } : {}),
      ...(typeof body.hour === 'number' ? { hour: body.hour } : {}),
      ...(Array.isArray(body.recipients) ? { recipients: body.recipients.filter((x): x is string => typeof x === 'string').slice(0, 50) } : {}),
      ...(typeof body.includeShareLink === 'boolean' ? { includeShareLink: body.includeShareLink } : {}),
      ...(body.branding !== undefined ? { branding: sanitizeBranding(body.branding as never, e.whiteLabel) } : {}),
    };
    return jsonOk({ schedule: await saveSchedule(business as BusinessRecord, patch) });
  });
}
