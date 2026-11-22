'use client';
// Titre-résultat et action principale de l'écran Contenus (recalculés après chaque action, y compris simulée).
import Link from 'next/link';
import { Disclosure } from '@/components/ui/Disclosure';
import { hasTodo, plural } from './model';
import { useContent } from './state';

export function ContentResult() {
  const c = useContent();
  const waiting = c.drafts.filter((d) => d.status === 'draft' && !hasTodo(d)).length;
  const remote = c.drafts.filter((d) => d.status === 'remote_draft').length;
  if (waiting) return <>{plural(waiting, 'brouillon attend votre validation', 'brouillons attendent votre validation')}</>;
  if (remote) return <>{plural(remote, 'brouillon est prêt sur votre site', 'brouillons sont prêts sur votre site')}</>;
  if (c.opportunities.length) return <>{plural(c.opportunities.length, 'page à créer ou renforcer', 'pages à créer ou renforcer')}, preuves à l’appui</>;
  return <>Aucune page manquante pour l’instant</>;
}

export function ContentPrimary() {
  const c = useContent();
  const d = c.drafts.find((x) => x.status === 'draft' && !hasTodo(x)) ?? c.drafts.find((x) => x.status === 'remote_draft') ?? c.drafts.find((x) => x.status === 'draft');
  if (d) {
    return (
      <Link className="ui-btn" data-variant="primary" href={`/app/contenu/${d.id}`}>
        {d.status === 'remote_draft' ? 'Relire et mettre en ligne' : hasTodo(d) ? 'Compléter le brouillon' : 'Relire et valider'}
      </Link>
    );
  }
  return null;
}

export function Guardrails() {
  return (
    <div className="mt-8">
      <Disclosure title="Pourquoi pas 30 articles par mois, publiés seuls ?" summary="Les garde-fous de l’agent">
        <ul className="m-0 flex flex-col gap-2 pl-5 text-[14px] leading-relaxed text-[var(--muted)]">
          <li>
            Google pénalise les contenus produits en masse surtout pour se classer (« scaled content abuse », politique anti-spam de mars 2024). Un plafond
            de quelques pages par mois, chacune utile et relue, vous en tient loin.
          </li>
          <li>Chaque proposition part d’un manque mesuré : une question où les IA citent un concurrent, une requête Google sans page, une page trop mince.</li>
          <li>Les textes ne contiennent que vos faits. Ce qui manque reste « [à compléter] » et bloque la publication.</li>
          <li>Rien n’est publié sans la validation d’un administrateur ; la page est créée en brouillon sur votre site, puis mise en ligne par vous. Tout se retire.</li>
          <li>Pas d’échange de liens : l’agent liste les sites que les IA citent vraiment, avec un message que vous envoyez vous-même.</li>
          <li>L’effet est mesuré à J+30 et J+90 (citations IA avec marge d’erreur, Search Console, positions), sans promesse de résultat.</li>
        </ul>
      </Disclosure>
    </div>
  );
}
