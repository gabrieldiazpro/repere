'use client';
// Bandeau démo, onglets et rythme du mois, communs aux écrans /app/contenu/**.
import { Tabs } from '@/components/ui/Tabs';
import { fmtDate } from './model';
import { useContent } from './state';

export type ContentTab = 'propositions' | 'mentions' | 'faits' | 'journal';

export function SimBand() {
  const c = useContent();
  if (!c.demo) return null;
  return (
    <div className="ag-sim" role="note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 4 21 19.5H3z" />
        <path d="M12 10v4.5M12 17.2v.3" />
      </svg>
      <p className="m-0 min-w-0 flex-1">
        <b>Démo simulée.</b> Les propositions viennent des mesures de démonstration ; les brouillons et contenus sont des exemples fictifs. Ce que
        vous validez ici reste dans votre navigateur : rien n’est publié.
        {c.simulated && (
          <>
            {' '}
            <button type="button" className="underline underline-offset-2" onClick={c.resetSimulation}>
              Remettre la démo à zéro
            </button>
          </>
        )}
      </p>
    </div>
  );
}

export function ContentTabs({ current }: { current: ContentTab }) {
  const c = useContent();
  const todo = c.mentions.filter((m) => !c.tracking.some((t) => t.id === m.id && t.status !== 'a_faire')).length;
  return (
    <Tabs
      label="Sections de l’agent de contenu"
      value={current}
      idBase="contenu"
      className="mb-5"
      items={[
        { id: 'propositions', label: 'Pages', count: c.opportunities.length + c.drafts.filter((d) => ['draft', 'validated', 'remote_draft', 'exported'].includes(d.status)).length || undefined, href: '/app/contenu' },
        { id: 'mentions', label: 'Mentions à obtenir', count: todo || undefined, href: '/app/contenu/mentions' },
        { id: 'faits', label: 'Faits clés', href: '/app/contenu/faits' },
        { id: 'journal', label: 'Journal', href: '/app/contenu/journal' },
      ]}
    />
  );
}

/** Un emplacement par contenu du mois : le plafond se voit. */
export function QuotaSlots() {
  const c = useContent();
  const { limit, used, resetsAt } = c.quota;
  const slots = Math.max(limit, used);
  return (
    <section className="ct-slots" aria-label="Rythme de publication du mois">
      {slots > 0 ? (
        <div className="ct-slots-row" role="img" aria-label={`${used} contenu${used > 1 ? 's' : ''} utilisé${used > 1 ? 's' : ''} sur ${limit} ce mois-ci`}>
          {Array.from({ length: slots }, (_, i) => (
            <span key={i} className="ct-slot" data-used={i < used ? '' : undefined} />
          ))}
        </div>
      ) : null}
      <p className="ct-slots-t m-0">
        <b>
          {limit === 0
            ? 'Publication incluse à partir de l’offre Essentiel'
            : c.quota.left > 0
              ? `${c.quota.left} contenu${c.quota.left > 1 ? 's' : ''} possible${c.quota.left > 1 ? 's' : ''} ce mois-ci, sur ${limit}`
              : `Les ${limit} contenus du mois sont utilisés`}
        </b>
        Un rythme humain, chaque page relue et validée par vous. Compteur remis à zéro le {fmtDate(resetsAt)}.
      </p>
    </section>
  );
}
