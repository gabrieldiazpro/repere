import '@/components/app/mesure/mesure.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Verdict } from '@/components/app/v4/Verdict';
import { fmtDate } from '@/components/app/tokens';
import { matchQuery } from '@/lib/prompts/history';
import { isBrandQuery } from '@/lib/engine/queries-v2';
import { buildHistory, demandContext, ensureInitialPrompts, listPrompts, quotaOf, toView } from '@/lib/prompts';
import { questionResult } from '@/components/app/mesure/derive';
import { loadMesure } from '@/components/app/mesure/server';
import { crossLink, str, type RawSearch } from '@/components/app/mesure/params';
import { ExportLink, MesureBar, PeriodNote } from '@/components/app/mesure/ui';
import { QuestionsManager, type QRow } from '@/components/app/mesure/QuestionsManager';
import Link from 'next/link';

export const metadata = { title: 'Questions suivies' };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const m = await loadMesure(searchParams);
  const { ws, business, ent, period, params, sp } = m;
  const providers = ws.latest?.providersUsed ?? ent.engines;

  let loadError = false;
  let prompts: Awaited<ReturnType<typeof listPrompts>> = [];
  try {
    if (!ws.demo) await ensureInitialPrompts(business);
    prompts = await listPrompts(business.id);
  } catch {
    loadError = true;
  }
  const ctx = demandContext({ name: ws.business.name, city: business.city, district: business.district }, ws.latest?.competitors.map((c) => c.name) ?? []);
  const quota = await quotaOf(business, prompts).catch(() => ({ limit: ent.prompts, used: prompts.filter((p) => p.active).length, remaining: 0 }));

  const rows: QRow[] = prompts.map((p) => {
    const v = toView(p, ctx);
    const res = questionResult(buildHistory(p, period.audits, { answers: false, provider: params.ia ?? undefined }), params.ia ? [params.ia] : providers);
    return {
      id: p.id,
      text: p.text,
      theme: p.theme,
      tags: p.tags,
      intentLabel: v.intentLabel,
      demand: v.demand.level,
      demandSignals: v.demand.signals,
      active: p.active,
      origin: p.origin,
      last: res.last,
      trend: res.trend,
      measured: res.measured,
      brand: !res.measured && period.audits.some((a) => isBrandQuery(matchQuery(p, a) ?? undefined)),
      href: crossLink(`/app/questions/${encodeURIComponent(p.id)}`, sp),
    };
  });

  const statut = str(sp, 'statut', 12);
  const measured = rows.filter((r) => r.active && r.measured && !r.brand);
  const nowhere = measured.filter((r) => r.last.length > 0 && r.last.every((x) => x.cited !== true));
  const everywhere = measured.filter((r) => r.last.length > 0 && r.last.every((x) => x.cited === true));
  const last = period.current;

  return (
    <>
      <PageHeader
        title="Questions suivies"
        meta={
          <>
            Les questions posées aux IA à chaque mesure{last ? ` · dernière mesure le ${fmtDate(last.measuredAt ?? last.createdAt, { day: 'numeric', month: 'long' })}` : ''}
            {ws.demo ? ' · démo' : ''}
          </>
        }
        dataDate={last ? (last.measuredAt ?? last.createdAt) : null}
      />
      <div className="rp-page">
        {measured.length > 0 && (
          <Verdict
            tone={nowhere.length === 0 ? 'good' : nowhere.length > measured.length / 2 ? 'bad' : 'warn'}
            title={
              nowhere.length === 0
                ? `Au moins une IA vous cite sur chacune de vos ${measured.length} questions`
                : `Aucune IA ne vous cite sur ${nowhere.length} question${nowhere.length > 1 ? 's' : ''} sur ${measured.length}`
            }
            lead={`${everywhere.length} question${everywhere.length > 1 ? 's' : ''} où toutes les IA vous citent. ${quota.used} question${quota.used > 1 ? 's' : ''} suivie${quota.used > 1 ? 's' : ''} sur ${quota.limit} avec votre offre.`}
            figure={{ value: nowhere.length, label: 'questions où vous êtes absent' }}
            action={nowhere[0]?.href ? { href: nowhere[0].href, label: `Ouvrir « ${nowhere[0].text.length > 42 ? `${nowhere[0].text.slice(0, 40)}…` : nowhere[0].text} »`, icon: 'eye' } : undefined}
            details={<p>Choisissez les questions que vos clients posent vraiment. L’indice de demande est une estimation (faible, moyenne, forte) tirée du type de question : jamais un volume de recherche.</p>}
          />
        )}
        <MesureBar path="/app/questions" sp={sp} params={params} providers={providers} compare={false} />
        <PeriodNote from={period.from} to={period.to} refDate={null} limitedByPlan={period.limitedByPlan} historyMonths={ent.historyMonths} />
        {loadError ? (
          <div className="rp-panel p-5 text-center">
            <p className="font-semibold">Vos questions n’ont pas pu être chargées</p>
            <p className="mt-1 text-[14px] text-[var(--muted)]">La base de données ne répond pas. Rechargez la page dans un instant.</p>
            <Link href="/app/questions" className="rp-btn rp-btn-primary mt-3">
              Réessayer
            </Link>
          </div>
        ) : (
          <QuestionsManager
            businessId={business.id}
            demo={ws.demo}
            rows={rows}
            quota={{ limit: quota.limit, used: quota.used }}
            providers={params.ia ? [params.ia] : providers}
            initial={{ q: params.q, tag: params.tag, theme: str(sp, 'theme', 40) || null, statut: statut === 'archivees' || statut === 'toutes' ? statut : 'actives' }}
            exportSlot={<ExportLink ent={ent} businessId={business.id} kind="questions" from={period.from} to={period.to} label="Exporter" />}
          />
        )}
        <p className="text-[13px] text-[var(--muted)]">
          Lire ce que les IA ont répondu :{' '}
          <Link href={crossLink('/app/reponses', sp)} className="rp-link">
            Réponses des IA
          </Link>
          {' · '}
          <Link href={crossLink('/app/reponses', sp, { nc: '1' })} className="rp-link">
            seulement celles où vous n’êtes pas cité
          </Link>
        </p>
      </div>
    </>
  );
}
