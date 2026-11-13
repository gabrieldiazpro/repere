import Link from 'next/link';
import { PageHeader } from '@/components/app/PageHeader';
import { etapeAssistant, etapesDemarrage, progression } from '@/components/app/shell/demarrage';
import { Onboarding } from '@/components/app/shell/Onboarding';
import { loadEntitlements, loadSignaux } from '@/components/app/shell/server';
import { StartList } from '@/components/app/shell/StartList';
import { loadWorkspace } from '@/components/app/workspace';
import { listPrompts } from '@/lib/prompts';

export const metadata = { title: 'Bien démarrer' };

type SP = Record<string, string | string[] | undefined>;

/** Onboarding guidé : première valeur en moins de 5 minutes (docs/v3/09-audit-app.md § 5). */
export default async function BienvenuePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ws = await loadWorkspace();
  const [signaux, ent, prompts] = await Promise.all([loadSignaux(), loadEntitlements(), listPrompts(ws.business.id).catch(() => [])]);
  const etapes = etapesDemarrage(signaux);
  const p = progression(etapes);
  const etape = etapeAssistant(typeof sp.etape === 'string' ? sp.etape : null, etapes);
  const active = prompts.filter((q) => q.active).map((q) => q.text);

  const measured = ws.audits.length > 0;
  const last = ws.audits.at(-1);
  const restantes = etapes.filter((e) => !e.done && ['site', 'questions', 'mesure'].includes(e.id)).length;

  return (
    <>
      <PageHeader
        title="Bien démarrer"
        meta={
          <>
            {ws.business.name}, liste de démarrage : {p.label} faites
            {ws.demo ? ', démo' : ''}
          </>
        }
        back={{ href: '/app', label: 'Lundi' }}
        result={measured ? 'Votre premier résultat est prêt' : `Votre premier résultat en ${restantes || 3} étape${restantes > 1 || !restantes ? 's' : ''}`}
        resultTone={measured ? 'up' : undefined}
        subtitle={measured ? 'Il vous attend sur Lundi. Vous pouvez revoir chaque étape ci-dessous.' : 'Une question à la fois, environ 3 minutes. L’aperçu à droite se remplit avec vos réponses.'}
      />
      <div className="rp-page">
        <Onboarding
          businessId={ws.business.id}
          businessName={ws.business.name}
          website={ws.business.website}
          demo={ws.demo}
          initial={etape}
          questions={active}
          limit={ent.prompts}
          audits={ws.audits.length}
          segment={ws.segment}
          lastScore={last ? last.score : null}
          aside={
            <>
              <StartList businessId={ws.business.id} signaux={signaux} demo={ws.demo} />
              <p className="px-1 text-[13.5px] text-[var(--muted)]">
                Besoin d’un coup de main ? Suivez la{' '}
                <Link href={`/app?visite=1&segment=${ws.segment}`} className="rp-link">
                  visite guidée
                </Link>{' '}
                (2 minutes) ou demandez au{' '}
                <Link href="/app/copilote?context=demarrage" className="rp-link">
                  copilote
                </Link>
                .
              </p>
            </>
          }
        />
      </div>
    </>
  );
}
