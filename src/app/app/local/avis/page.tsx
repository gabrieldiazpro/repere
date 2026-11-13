import { Verdict } from '@/components/app/v4/Verdict';
import { CopyButton } from '@/components/app/CopyButton';
import { PageHeader, Panel } from '@/components/app/PageHeader';
import { loadMetier } from '@/components/app/metiers/context';
import { copilotHref } from '@/components/app/metiers/logic';
import { PostsCalendar } from '@/components/app/metiers/PostsCalendar';
import { ReviewLinkForm } from '@/components/app/metiers/ReviewLinkForm';
import { ReviewsClient } from '@/components/app/metiers/ReviewsClient';
import { LOCAL_TABS, LoadError, NextSteps, ParcoursGate, SubNav } from '@/components/app/metiers/ui';
import { Verrou } from '@/components/app/shell/Verrou';
import { getSettings, reviewKit, type ExecSettings } from '@/lib/execution';
import { buildLocalDemo, type LocalPost, type ReviewThemesReport } from '@/lib/local';
import { getLocalSettings, latestThemes, listPosts } from '@/lib/local/repo';

export const metadata = { title: 'Avis et posts' };
export const dynamic = 'force-dynamic';

export default async function AvisPage({ searchParams }: { searchParams: Promise<{ post?: string }> }) {
  const sp = await searchParams;
  const ctx = await loadMetier('local');
  const header = (
    <PageHeader
      title="Avis et posts"
      meta={<>{ctx.ws.business.name}{ctx.demo ? ' · démo' : ''}</>}
    />
  );
  if (!ctx.inParcours) return <>{header}<ParcoursGate parcours="local" demo={ctx.demo} /></>;

  const b = ctx.business;
  let themes: ReviewThemesReport | null = null;
  let posts: LocalPost[] = [];
  let exec: Partial<ExecSettings> = {};
  let failed = false;
  try {
    if (ctx.demo) {
      const d = await buildLocalDemo(b.id);
      themes = d?.themes ?? null;
      posts = d?.posts ?? [];
      exec = await getSettings(b.id).catch(() => ({}));
    } else {
      const [t, p, s, l] = await Promise.all([latestThemes(b.id), listPosts(b.id), getSettings(b.id).catch(() => ({}) as Partial<ExecSettings>), getLocalSettings(b.id)]);
      themes = t;
      posts = p;
      exec = { ...s, placeId: s.placeId ?? l.placeId };
    }
  } catch (e) {
    console.error('[app/local/avis]', (e as Error).message);
    failed = true;
  }
  const kit = reviewKit(b, exec);
  const focus = typeof sp.post === 'string' && /^[A-Za-z0-9_:-]{1,80}$/.test(sp.post) ? sp.post : null;

  return (
    <>
      {header}
      <div className="rp-page">
        <SubNav tabs={LOCAL_TABS} current="/app/local/avis" label="Parcours local" />
        {failed && <LoadError what="vos avis et vos posts" />}
        <Verdict
          tone={themes ? (themes.weaknesses.length ? 'warn' : 'good') : 'brand'}
          title={
            themes && themes.analyzed
              ? themes.weaknesses.length
                ? `Vos avis reprochent surtout : ${themes.weaknesses[0]}`
                : `Vos ${themes.analyzed} derniers avis sont positifs`
              : 'Des avis récents donnent aux IA une raison de vous recommander'
          }
          lead={kit.reviewUrl ? 'Votre lien d’avis est prêt : e-mail, SMS et QR code à copier ci-dessous.' : 'Enregistrez votre lien d’avis : e-mail, SMS et QR code se préparent tout seuls.'}
          figure={themes?.averageRating != null ? { value: themes.averageRating, decimals: 1, suffix: '/5', label: `note moyenne, ${themes.analyzed} avis lus` } : null}
          action={{ href: '#kit-h', label: kit.reviewUrl ? 'Demander des avis' : 'Créer mon lien d’avis', icon: 'star' }}
          details={<p>Des avis récents et une fiche qui vit (posts réguliers) sont deux signaux que les IA reprennent quand elles recommandent un commerce de proximité.</p>}
          detailsLabel="Pourquoi c’est important"
        />

        <Panel id="kit-h" title="Demander des avis" aside={kit.reviewUrl ? 'lien prêt' : 'lien à renseigner'}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex min-w-0 flex-col gap-4">
              {kit.reviewUrl ? (
                <div>
                  <p className="text-[13px] font-semibold">Votre lien d’avis</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="rp-code min-w-0 flex-1 truncate">{kit.reviewUrl}</code>
                    <CopyButton text={kit.reviewUrl} label="Copier le lien" />
                  </div>
                </div>
              ) : (
                <>
                  <ol className="list-decimal pl-5 text-[14px]">
                    {kit.instructions.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ol>
                  <ReviewLinkForm businessId={b.id} demo={ctx.demo} />
                </>
              )}
              <details className="rounded-lg border border-[var(--hair)] p-3" open>
                <summary className="cursor-pointer font-semibold">E-mail à vos clients</summary>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[13px] text-[var(--muted)]">Objet : {kit.email.subject}</p>
                  <CopyButton text={`${kit.email.subject}\n\n${kit.email.body}`} />
                </div>
                <pre className="rp-code mt-2 whitespace-pre-wrap">{kit.email.body}</pre>
              </details>
              <details className="rounded-lg border border-[var(--hair)] p-3">
                <summary className="cursor-pointer font-semibold">SMS</summary>
                <div className="mt-2 flex justify-end">
                  <CopyButton text={kit.sms} />
                </div>
                <pre className="rp-code mt-2 whitespace-pre-wrap">{kit.sms}</pre>
              </details>
              <div className="rounded-lg bg-[var(--bg)] p-3 text-[13px]">
                <p className="font-semibold">Règles à respecter (droit de la consommation et règles Google)</p>
                <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
                  {kit.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
            <figure className="m-0 flex flex-col items-center gap-2 lg:items-stretch">
              {kit.qrSvg ? (
                <div className="w-[200px] rounded-xl p-3" style={{ background: '#fff' /* QR : fond blanc indispensable à la lecture, même en mode sombre */ }} role="img" aria-label="QR code vers votre page d’avis Google" dangerouslySetInnerHTML={{ __html: kit.qrSvg }} />
              ) : (
                <div className="flex h-[200px] w-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--line)] p-4 text-center text-[13px] text-[var(--muted)]">Le QR code apparaît dès que votre lien d’avis est enregistré.</div>
              )}
              <figcaption className="whitespace-pre-line text-center text-[12px] text-[var(--muted)]">{kit.qrSvg ? 'À imprimer : comptoir, devis, factures, camionnette.' : ''}</figcaption>
              {kit.qrSvg && <CopyButton text={kit.poster} label="Copier le texte de l’affiche" />}
            </figure>
          </div>
        </Panel>

        <Panel id="themes-h" title="Ce que disent vos avis">
          <ReviewsClient
            businessId={b.id}
            demo={ctx.demo}
            initial={themes}
            llmAllowed={ctx.ent.execution && !ctx.demo}
            llmLock={!ctx.ent.execution ? <Verrou ent={ctx.ent} feature="execution" titre="Synthèse des avis rédigée par IA" compact /> : undefined}
          />
          <div className="mt-5">
            <NextSteps
              steps={[
                ...(themes?.weaknesses.length ? [{ href: copilotHref(`Mes avis reprochent : ${themes.weaknesses.join(', ')}. Comment y répondre et corriger ?`), label: 'Traiter les reproches avec le copilote', primary: true }] : []),
                { href: '/app/local/fiche-google', label: 'Voir le score de ma fiche' },
                { href: '/app/taches', label: 'Tâches avis' },
              ]}
            />
          </div>
        </Panel>

        <Panel id="posts" title="Calendrier de posts Google" aside={`${posts.filter((p) => p.status === 'planned').length} prévus`}>
          <PostsCalendar businessId={b.id} demo={ctx.demo} initial={posts} focus={focus} />
        </Panel>
      </div>
    </>
  );
}
