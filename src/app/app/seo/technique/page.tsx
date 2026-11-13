import Link from 'next/link';
import '@/components/app/seo/seo.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Icon } from '@/components/app/icons';
import { Surface } from '@/components/ui/Surface';
import { EmptyState } from '@/components/ui/EmptyState';
import { KeyFigure } from '@/components/ui/KeyFigure';
import { loadSeoSuite } from '@/components/app/seo/data';
import { allFindings, fmtInt, nextCrawlAllowed } from '@/components/app/seo/model';
import { SeoNav, Source } from '@/components/app/seo/parts';
import { CrawlButton } from '@/components/app/seo/controls';
import { AuditExplorer } from '@/components/app/seo/AuditExplorer';

export const metadata = { title: 'Audit SEO du site' };
export const maxDuration = 60;

export default async function SeoTechniquePage({ searchParams }: { searchParams: Promise<{ constat?: string }> }) {
  const sp = await searchParams;
  const s = await loadSeoSuite();
  const { latest, demo, runs } = s;
  const next = demo ? null : nextCrawlAllowed(s.rights, runs.filter((r) => r.trigger === 'manual').map((r) => r.at));
  const crawlBtn = (primary: boolean) => <CrawlButton demo={demo} allowed={!next} rightsLabel={s.rights.label} nextAt={next?.toISOString()} primary={primary} />;

  if (!latest) {
    return (
      <>
        <PageHeader title="Audit du site" result="Votre site n’a pas encore été exploré" subtitle="Repéré vérifie 185 points Google sur vos pages : indexation, balises, liens, images, données structurées, vitesse." primary={crawlBtn(true)} />
        <div className="rp-page">
          <SeoNav active="technique" />
          <EmptyState title="Lancez l’exploration" icon={<Icon name="search" />} action={crawlBtn(false)}>
            {s.website ? `RepereBot lira jusqu’à ${fmtInt(s.rights.maxPages)} pages de ${s.website.replace(/^https?:\/\//, '')} en respectant votre robots.txt.` : 'Renseignez d’abord l’adresse de votre site dans les réglages.'}
          </EmptyState>
        </div>
      </>
    );
  }

  const findings = allFindings(latest.seo, null).filter((f) => f.severity !== 'info' || f.affectedCount > 0);
  const important = findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
  const affectedPages = new Set(findings.flatMap((f) => f.affected.map((a) => a.url))).size;
  const st = latest.seo.stats;
  const sections = latest.seo.sections.map((x) => ({ id: x.id, label: x.label, score: x.score, applicable: x.applicable, count: x.findings.filter((f) => f.severity !== 'info').length }));
  const day = new Date(latest.at).toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Audit du site"
        meta={<>Exploration du {new Date(latest.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })}{demo ? ' (démo)' : ''}</>}
        result={important.length ? `${important.length} point${important.length > 1 ? 's' : ''} important${important.length > 1 ? 's' : ''} freine${important.length > 1 ? 'nt' : ''} votre site sur Google` : findings.length ? 'Rien de bloquant : il reste des améliorations' : 'Aucun défaut détecté'}
        resultTone={important.length ? 'down' : 'up'}
        subtitle={`${fmtInt(findings.length)} constats sur ${fmtInt(affectedPages)} pages, issus de ${fmtInt(st.checksRun)} contrôles. Chaque constat dit pourquoi il compte et quoi faire.`}
        primary={crawlBtn(true)}
        secondary={
          <Link href="/app/seo/geo" className="rp-link text-[14px]">
            Voir aussi la lisibilité par les IA
          </Link>
        }
      />
      <div className="rp-page">
        <SeoNav active="technique" />
        <div className="seo-grid seo-grid-3 mb-4">
          <Surface title="Score Google" id="t-score" elevation="raised">
            <KeyFigure label={latest.seo.grade === 'bon' ? 'Bon niveau' : latest.seo.grade === 'moyen' ? 'Niveau moyen' : 'Niveau faible'} value={latest.seo.score} unit="/100" trend={runs.length > 1 ? runs.map((r) => r.seo.score) : undefined} trendLabel="Évolution du score Google" margin="Arrondi à 5 points" size="md" />
          </Surface>
          <Surface title="Pages lues" id="t-pages">
            <KeyFigure label={`dont ${fmtInt(st.indexablePages)} indexables par Google`} value={st.pagesCrawled} size="md" foot={latest.truncated ? <span className="ui-caption">Plafond de votre offre atteint : {s.rights.label.toLowerCase()}.</span> : <span className="ui-caption">{fmtInt(st.sitemapUrls)} adresses déclarées dans le plan du site</span>} />
          </Surface>
          <Surface title="Corrigeables par Repéré" id="t-auto">
            <KeyFigure label="constats que l’agent peut préparer pour vous" value={findings.filter((f) => f.autoFix).length} size="md" foot={<Link href="/app/agent" className="rp-link text-[13px]">Ouvrir l’agent</Link>} />
          </Surface>
        </div>
        <AuditExplorer findings={findings} sections={sections} fileName={`audit-seo-${latest.url.replace(/^https?:\/\//, '').replace(/\W+/g, '-').replace(/-$/, '')}-${day}.csv`} initial={sp.constat ?? null} />
        <Source provider="repere" demo={latest.demo} at={latest.at} note={demo ? latest.seo.method : `${latest.seo.method} Votre offre : ${s.rights.label.toLowerCase()}.`} />
      </div>
    </>
  );
}
