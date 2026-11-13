import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Link from 'next/link';
import { adaptTraffic } from '@/components/app/adapters';
import { copilotHref, loadActionContext } from '@/components/app/action/context';
import { SAMPLE_ROBOTS, SAMPLE_URL, sampleHtml } from '@/components/app/action/sample';
import { TechAudit, type ServedMarkup } from '@/components/app/action/TechAudit';
import { Icon } from '@/components/app/icons';
import { PageHeader } from '@/components/app/PageHeader';
import { jsonLdScriptTag, schemaForBusiness } from '@/lib/execution';
import { SITE_URL } from '@/lib/seo/site';
import { readinessFromSnapshot } from '@/lib/siteaudit/readiness';
import { robotsReportFromText } from '@/lib/siteaudit/robotsAudit';
import { listRuns, type SiteAuditRun } from '@/lib/siteaudit/runs';
import type { ReadinessReport } from '@/lib/siteaudit/types';

export const metadata = { title: 'Technique' };

function typesOf(data: Record<string, unknown> | null): string[] {
  if (!data) return [];
  const graph = Array.isArray(data['@graph']) ? (data['@graph'] as Record<string, unknown>[]) : [data];
  return [...new Set(graph.flatMap((n) => (Array.isArray(n['@type']) ? (n['@type'] as string[]) : n['@type'] ? [String(n['@type'])] : [])))];
}

/** Démo : analyse d'une page d'exemple, calculée sur place (aucun appel réseau), étiquetée comme telle à l'écran. */
function sampleReport(segment: Parameters<typeof sampleHtml>[0], name: string): ReadinessReport | null {
  try {
    const body = sampleHtml(segment, name);
    return readinessFromSnapshot(
      { url: SAMPLE_URL, finalUrl: SAMPLE_URL, status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body, bytes: body.length, truncated: false, responseMs: 240 },
      { robots: robotsReportFromText(SAMPLE_URL, SAMPLE_ROBOTS, 200), sitemap: { found: true, url: `${SAMPLE_URL}sitemap.xml` }, llms: { found: false, url: `${SAMPLE_URL}llms.txt` } },
    );
  } catch {
    return null;
  }
}

export default async function TechniquePage() {
  const { ws } = await loadActionContext();
  const id = ws.business.id;
  let runs: SiteAuditRun[] = [];
  if (!ws.demo) runs = (await listRuns(id, 50).catch(() => [])).filter((r) => r.readiness);
  const schema = await schemaForBusiness(id).catch(() => null);
  const traffic = await adaptTraffic(id, 90, ws.fb).catch(() => null);
  const botsSeen: Record<string, number> = {};
  for (const d of traffic?.days ?? []) for (const [k, v] of Object.entries(d.bots ?? {})) botsSeen[k] = (botsSeen[k] ?? 0) + v;
  const served: ServedMarkup = {
    published: Boolean(schema),
    types: typesOf(schema),
    scriptUrl: `${SITE_URL}/api/schema/${encodeURIComponent(id)}?format=script`,
    jsonUrl: `/api/schema/${encodeURIComponent(id)}`,
    block: schema ? jsonLdScriptTag(schema) : '',
  };
  let wpPlugin = false;
  try {
    wpPlugin = existsSync(join(process.cwd(), 'public', 'integrations', 'repere-ia-wordpress.zip'));
  } catch {
    wpPlugin = false;
  }
  const website = ws.business.website ? (/^https?:\/\//.test(ws.business.website) ? ws.business.website : `https://${ws.business.website}`) : '';
  const latest = runs[0]?.readiness ?? null;

  return (
    <>
      <PageHeader
        title="Technique"
        meta={<>Prêt pour les IA : score technique du site sur 100{ws.demo ? ' · démo' : ''}</>}
        result={
          latest
            ? latest.checks.filter((c) => c.status === 'fail' && !c.informational).length
              ? `${latest.checks.filter((c) => c.status === 'fail' && !c.informational).length} point${latest.checks.filter((c) => c.status === 'fail' && !c.informational).length > 1 ? 's' : ''} empêche${latest.checks.filter((c) => c.status === 'fail' && !c.informational).length > 1 ? 'nt' : ''} les IA de bien lire votre site`
              : `Votre site est lisible par les IA (${Math.round(latest.score)}/100)`
            : 'Votre site n’a pas encore été analysé'
        }
        resultTone={latest ? (latest.checks.some((c) => c.status === 'fail' && !c.informational) ? 'down' : 'up') : undefined}
        subtitle="Avant d’être cité, votre site doit être lisible par les robots des IA. Chaque point en échec propose un correctif prêt."
        actions={
          <Link href={copilotHref('technique', 'Quels robots des IA passent sur mon site ?')} className="rp-btn rp-btn-sm">
            <Icon name="spark" size={15} /> Demander au copilote
          </Link>
        }
      />
      <div className="rp-page">
        <TechAudit
          businessId={id}
          demo={ws.demo}
          website={website}
          initial={latest}
          history={runs.map((r) => ({ at: r.createdAt, score: r.readiness!.score }))}
          served={served}
          botsSeen={botsSeen}
          wpPlugin={wpPlugin}
          sample={ws.demo ? sampleReport(ws.segment, ws.business.name) : null}
        />
      </div>
    </>
  );
}
