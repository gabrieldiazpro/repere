import { PageHeader } from '@/components/app/PageHeader';
import { loadWorkspace } from '@/components/app/workspace';
import { checkFicheReminder, daysSince, frDate, loadPublicFicheByBusiness, publicationExport, reminderDue } from '@/lib/execution/fiche';
import { ficheScreenData } from '@/app/api/fiche/_shared';
import { FicheDocument } from '@/app/p/[slug]/FicheDocument';
import { FicheScreen } from './FicheScreen';
import './fiche-app.css';

export const metadata = { title: 'Fiche officielle' };
export const dynamic = 'force-dynamic';

export default async function FichePage() {
  const ws = await loadWorkspace();
  const id = ws.business.id;
  const now = new Date();
  const [data, pub] = await Promise.all([ficheScreenData(id, now), loadPublicFicheByBusiness(id, now)]);
  if (!data) {
    return (
      <>
        <PageHeader title="Fiche officielle" />
        <div className="rp-page">
          <p className="text-[14px] text-[var(--muted)]">Fiche indisponible pour le moment. Rechargez la page.</p>
        </div>
      </>
    );
  }
  // Rappel des 90 jours : aussi posé à l'ouverture de l'écran (en plus de la tâche planifiée /api/fiche/rappels).
  if (!ws.demo) await checkFicheReminder(id, now, data.fiche).catch(() => false);
  const exp = pub ? publicationExport(pub.view, pub.name, pub.pageUrl, null) : null;
  const strong = data.alerts.filter((a) => a.severity === 'haute').length;
  const due = reminderDue(data.fiche, now);
  const age = daysSince(data.fiche.confirmedAt, now);
  const result = strong
    ? `${strong} information${strong > 1 ? 's' : ''} importante${strong > 1 ? 's' : ''} ne concorde${strong > 1 ? 'nt' : ''} pas avec votre fiche`
    : !data.fiche.confirmedAt
      ? 'Relisez votre fiche, puis confirmez qu’elle est à jour'
      : due
        ? `Vérifiée il y a ${age} jours : il est temps de la relire`
        : `Fiche vérifiée le ${frDate(data.fiche.confirmedAt)}`;

  return (
    <>
      <PageHeader
        title="Fiche officielle"
        meta={ws.demo ? 'Démo simulée : rien n’est enregistré' : undefined}
        result={result}
        resultTone={strong ? 'down' : due ? 'warn' : 'up'}
        subtitle="Une seule source pour vos informations : votre page officielle, l’encart de votre site, vos pages et les vérifications des IA partent d’ici."
      />
      <div className="rp-page">
        <FicheScreen
          businessId={id}
          demo={ws.demo}
          initial={data}
          exportBlocks={exp ? { about: exp.about, contact: exp.contact } : null}
          preview={pub ? <FicheDocument p={pub} preview /> : null}
        />
      </div>
    </>
  );
}
