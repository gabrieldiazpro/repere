import { PageHeader, Panel } from '@/components/app/PageHeader';
import { fmtDate } from '@/components/app/tokens';
import { loadMetier } from '@/components/app/metiers/context';
import { copilotHref } from '@/components/app/metiers/logic';
import { NapBoard } from '@/components/app/metiers/NapBoard';
import { KeyFigures, LOCAL_TABS, LoadError, NextSteps, ParcoursGate, SourceNote, SubNav } from '@/components/app/metiers/ui';
import { buildLocalDemo, directoriesFor, type NapAudit, type NapEntryInput } from '@/lib/local';
import { getLocalSettings, latestNap } from '@/lib/local/repo';
import { Verdict } from '@/components/app/v4/Verdict';

export const metadata = { title: 'Annuaires' };
export const dynamic = 'force-dynamic';

export default async function AnnuairesPage() {
  const ctx = await loadMetier('local');
  const header = (
    <PageHeader
      title="Annuaires"
      meta={<>{ctx.ws.business.name}{ctx.demo ? ' · démo' : ''}</>}
    />
  );
  if (!ctx.inParcours) return <>{header}<ParcoursGate parcours="local" demo={ctx.demo} /></>;

  const b = ctx.business;
  const directories = directoriesFor(b.trade, b.id);
  let audit: NapAudit | null = null;
  let entries: NapEntryInput[] = [];
  let failed = false;
  try {
    if (ctx.demo) audit = (await buildLocalDemo(b.id))?.nap ?? null;
    else {
      const [a, s] = await Promise.all([latestNap(b.id), getLocalSettings(b.id)]);
      audit = a;
      entries = s.napEntries ?? [];
    }
  } catch (e) {
    console.error('[app/local/annuaires]', (e as Error).message);
    failed = true;
  }

  return (
    <>
      {header}
      <div className="rp-page">
        <SubNav tabs={LOCAL_TABS} current="/app/local/annuaires" label="Parcours local" />
        {failed ? (
          <LoadError what="vos annuaires" />
        ) : (
          <>
            {audit ? (
              <>
              <Verdict
                tone={audit.issues.length || audit.counts.absent ? (audit.score < 50 ? 'bad' : 'warn') : 'good'}
                title={audit.issues.length ? `${audit.issues.length} annuaire${audit.issues.length > 1 ? 's' : ''} donne${audit.issues.length > 1 ? 'nt' : ''} des coordonnées différentes des vôtres` : audit.counts.absent ? `Vous manquez sur ${audit.counts.absent} annuaire${audit.counts.absent > 1 ? 's' : ''} que lisent les IA` : 'Présent partout, identique partout'}
                lead="Les IA recoupent vos nom, adresse et téléphone d’un annuaire à l’autre."
                figure={{ value: audit.score, suffix: '/100', label: 'score de présence' }}
                action={{ href: '#annuaires-h', label: audit.issues.length ? 'Voir les incohérences' : 'Voir les annuaires', icon: 'globe' }}
              />
              <KeyFigures
                items={[
                  { k: 'Score de présence', v: `${audit.score}/100` },
                  { k: 'Présences vérifiées', v: audit.counts.verified, extra: `+ ${audit.counts.declared} déclarée${audit.counts.declared > 1 ? 's' : ''}` },
                  { k: 'Annuaires manquants', v: audit.counts.absent, extra: audit.counts.unknown ? `${audit.counts.unknown} à renseigner` : undefined },
                  { k: 'Incohérences', v: audit.issues.length, extra: 'nom, adresse, téléphone' },
                ]}
              />
              </>
            ) : (
              <p className="rounded-xl bg-[var(--primary-bg)] p-4 text-[14px] text-[var(--primary)]">
                Commencez par dire où vous êtes inscrit, annuaire par annuaire. Ajoutez l’adresse de chaque fiche : nous la lisons pour vérifier vos coordonnées.
              </p>
            )}

            <Panel id="annuaires-h" title={`${directories.length} annuaires prioritaires pour votre métier`} aside={audit ? `vérifié le ${fmtDate(audit.createdAt, { day: 'numeric', month: 'long' })}` : undefined}>
              <div className="mb-4">
                <SourceNote
                  label={audit?.demo ? 'Démo' : 'Vos déclarations et la lecture des pages fournies'}
                  detail={`Référence : ${[audit?.reference.name ?? b.name, audit?.reference.address, audit?.reference.phone].filter(Boolean).join(', ')} (votre fiche de vérité).`}
                  demo={audit?.demo}
                />
              </div>
              <NapBoard businessId={b.id} demo={ctx.demo} directories={directories} audit={audit} entries={entries} />
              <div className="mt-5">
                <NextSteps
                  steps={[
                    { href: '/app/verite', label: 'Vérifier ma fiche de vérité', primary: true },
                    { href: '/app/taches', label: 'Tâches d’inscription' },
                    { href: copilotHref(`Annuaires : ${audit ? `${audit.counts.absent} absents, ${audit.issues.length} incohérences` : 'pas encore audités'}. Par où commencer ?`), label: 'Demander au copilote' },
                  ]}
                />
              </div>
            </Panel>
            <p className="text-[12px] text-[var(--muted)]">
              Listes issues de la pratique du référencement local en France, 10 annuaires au plus : au-delà, l’effort ne se voit plus. « Vérifié » signifie que nous avons lu la page et retrouvé votre nom ou votre téléphone ; certains sites bloquent les robots, la fiche reste alors « déclarée ».
            </p>
          </>
        )}
      </div>
    </>
  );
}
