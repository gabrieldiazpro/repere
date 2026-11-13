import Link from 'next/link';
import { copilotHref, loadActionContext } from '@/components/app/action/context';
import { PageAudit } from '@/components/app/action/PageAudit';
import { sampleHtml } from '@/components/app/action/sample';
import { Icon } from '@/components/app/icons';
import { PageHeader } from '@/components/app/PageHeader';
import { listRuns, type SiteAuditRun } from '@/lib/siteaudit/runs';

export const metadata = { title: 'Pages' };

export default async function PagesPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const sp = await searchParams;
  const { ws } = await loadActionContext();
  let runs: SiteAuditRun[] = [];
  let loadError = false;
  if (!ws.demo) {
    try {
      runs = (await listRuns(ws.business.id, 50)).filter((r) => r.citability);
    } catch {
      loadError = true;
    }
  }
  const website = ws.business.website ? (/^https?:\/\//.test(ws.business.website) ? ws.business.website : `https://${ws.business.website}`) : '';
  const best = runs.reduce<SiteAuditRun | null>((m, r) => (!m || (r.citability?.score ?? 0) > (m.citability?.score ?? 0) ? r : m), null);
  const bestScore = best?.citability ? Math.round(best.citability.score) : null;
  return (
    <>
      <PageHeader
        title="Pages"
        meta={<>Audit de citabilité, 20 règles{ws.demo ? ' · démo' : ''}</>}
        result={bestScore != null ? `Votre page la mieux préparée est citable à ${bestScore}/100` : 'Aucune page analysée pour l’instant'}
        resultTone={bestScore == null ? undefined : bestScore >= 70 ? 'up' : bestScore < 40 ? 'down' : 'warn'}
        subtitle="Une IA cite une page quand elle y trouve vite une réponse claire, datée et vérifiable. Saisissez une adresse : score, passages déjà citables et corrections."
        actions={
          <Link href={copilotHref('pages', 'Quelle page de mon site devrais-je rendre citable en premier ?')} className="rp-btn rp-btn-sm">
            <Icon name="spark" size={15} /> Demander au copilote
          </Link>
        }
      />
      <div className="rp-page">
        {loadError && (
          <p role="status" className="mb-3 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning-ink)]">
            L’historique des pages n’a pas pu être chargé. Vous pouvez tout de même lancer une analyse ; rechargez la page pour réessayer.
          </p>
        )}
        <PageAudit
          businessId={ws.business.id}
          demo={ws.demo}
          website={website}
          initialUrl={sp.url && /^https?:\/\//.test(sp.url) ? sp.url : undefined}
          runs={runs}
          sampleHtml={sampleHtml(ws.segment, ws.business.name)}
        />
      </div>
    </>
  );
}
