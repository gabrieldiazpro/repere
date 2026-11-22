'use client';
// File des propositions (pages manquantes, preuves à l'appui) et des contenus en cours.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/ui/toast';
import type { ContentDraft, ContentOpportunity } from '@/lib/content/types';
import { createDraftAction, dismissOpportunityAction } from '@/app/app/contenu/actions';
import { canEdit, fmtDate, hasTodo, nextStep, PAGE_TYPE_NAME, plural, SOURCE_NAME, STATUS_VIEW } from './model';
import { useContent } from './state';

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className="ct-chip" data-tone={tone}>
      {children}
    </span>
  );
}

export function DraftRows() {
  const c = useContent();
  const open = c.drafts.filter((d) => d.status !== 'rejected' && d.status !== 'removed');
  if (!open.length) return null;
  return (
    <>
      <h2 className="ct-h2">
        Vos contenus <small>{plural(open.length, 'contenu', 'contenus')}</small>
      </h2>
      <ul className="ag-list">
        {open.map((d) => (
          <DraftRow key={d.id} d={d} />
        ))}
      </ul>
    </>
  );
}

function DraftRow({ d }: { d: ContentDraft }) {
  const c = useContent();
  const st = STATUS_VIEW[d.status];
  const todos = d.missing.length;
  const step = nextStep(d, c.platforms);
  const risk = d.status === 'published' ? 'low' : todos ? 'medium' : 'low';
  return (
    <li>
      <Link href={`/app/contenu/${d.id}`} className="ag-row" data-risk={risk}>
        <div className="min-w-0">
          <div className="ag-row-t">{d.title}</div>
          <div className="ag-row-m">
            <span>{d.action === 'rewrite' ? 'Réécriture' : PAGE_TYPE_NAME[d.pageType]}</span>
            {d.status === 'published' && d.publishedAt ? <span>En ligne depuis le {fmtDate(d.publishedAt)}</span> : <span>Modifié le {fmtDate(d.updatedAt)}</span>}
            {d.status === 'draft' && todos > 0 && <span className="ag-todo px-1">{plural(todos, 'information à compléter', 'informations à compléter')}</span>}
            {d.effect?.d30 && <span>Mesure J+30 disponible</span>}
            {d.demo && <span className="ct-fic">Exemple fictif</span>}
          </div>
        </div>
        <div className="ag-row-side">
          <Chip tone={st.tone}>{st.label}</Chip>
          {step.id !== 'none' && <span className="text-[13px] text-[var(--muted)]">{step.label}</span>}
        </div>
      </Link>
    </li>
  );
}

export function OpportunityList() {
  const c = useContent();
  if (!c.opportunities.length) {
    return (
      <div className="ui-card mt-2">
        <div className="ui-card-body">
          <p className="m-0 text-[15px] font-semibold">Aucune page manquante repérée pour l’instant.</p>
          <p className="mt-1 mb-0 text-[14px] text-[var(--muted)]">
            {c.sources.audit || c.sources.crawl
              ? 'L’agent relit vos mesures après chaque analyse : une proposition apparaîtra dès qu’une question de vos clients reste sans réponse sur votre site.'
              : 'L’agent a besoin d’une mesure IA ou d’une exploration de votre site. Lancez l’analyse depuis « SEO et GEO ».'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      <h2 className="ct-h2">
        Pages à créer ou renforcer <small>{plural(c.opportunities.length, 'proposition', 'propositions')}, de la plus utile à la moins utile</small>
      </h2>
      <div>
        {c.opportunities.map((o) => (
          <Opportunity key={o.id} o={o} />
        ))}
      </div>
    </>
  );
}

function Opportunity({ o }: { o: ContentOpportunity }) {
  const c = useContent();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const allowed = canEdit(c.role);
  const write = async () => {
    setBusy(true);
    const r = await createDraftAction(c.businessId, o.id);
    setBusy(false);
    if (!r.ok) return toast({ text: r.error, tone: 'error' });
    c.putDraft(r.draft);
    toast({ text: r.draft.missing.length ? `Brouillon prêt : ${plural(r.draft.missing.length, 'information', 'informations')} à compléter.` : 'Brouillon prêt à relire.', tone: 'success' });
    router.push(`/app/contenu/${r.draft.id}`);
  };
  const dismiss = async () => {
    if (!c.demo) {
      const r = await dismissOpportunityAction(c.businessId, o.id);
      if (!r.ok) return toast({ text: r.error, tone: 'error' });
    }
    c.dismiss(o.id);
    toast({ text: 'Proposition écartée.', tone: 'success' });
  };
  return (
    <article className="ct-op" data-high={o.priority >= 7 ? '' : undefined} style={{ ['--p' as string]: o.priority }}>
      <div className="ct-op-head">
        <div className="min-w-0">
          <h3 className="ct-op-t">{o.title}</h3>
          <p className="ct-op-why">{o.why}</p>
          <div className="ct-meta">
            <span>{o.action === 'rewrite' ? 'Réécriture d’une page existante' : PAGE_TYPE_NAME[o.pageType]}</span>
            {o.existingUrl && <span>{o.existingUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>}
            <span>Faits utiles : {o.needs.filter((k) => !c.facts[k]).length ? `${o.needs.filter((k) => !c.facts[k]).length} manquant${o.needs.filter((k) => !c.facts[k]).length > 1 ? 's' : ''}` : 'tous renseignés'}</span>
            {o.demo && <span className="ct-fic">Démo</span>}
          </div>
        </div>
        <Chip tone={o.priority >= 7 ? 'brand' : 'neutral'}>Utilité {o.priority}/9</Chip>
      </div>
      <ul className="ct-ev" aria-label="Preuves">
        {o.evidence.slice(0, 4).map((e, i) => (
          <li key={i}>
            <span className="ct-ev-src">{SOURCE_NAME[e.source]}</span>
            {e.text} {e.at && <span className="ct-ev-at">· {fmtDate(e.at)}</span>}
          </li>
        ))}
      </ul>
      {allowed && (
        <div className="ct-op-actions">
          <button type="button" className="ui-btn" data-variant="primary" onClick={write} disabled={busy} aria-busy={busy}>
            {busy ? 'Rédaction…' : o.action === 'rewrite' ? 'Préparer la réécriture' : 'Rédiger le brouillon'}
          </button>
          <button type="button" className="ui-btn" data-variant="ghost" onClick={dismiss}>
            Écarter
          </button>
        </div>
      )}
    </article>
  );
}

export function FactsHint() {
  const c = useContent();
  const missing = c.essential.filter((k) => !c.facts[k]);
  if (missing.length <= 2) return null;
  return (
    <div className="ui-card mb-5" data-tone="warn">
      <div className="ui-card-body flex flex-wrap items-center gap-3">
        <p className="m-0 min-w-0 text-[14.5px]" style={{ flex: '1 1 260px' }}>
          <b>{plural(missing.length, 'fait essentiel manque', 'faits essentiels manquent')} à votre fiche.</b> L’agent n’invente rien : sans vos tarifs, délais ou
          garanties, il laisse des « [à compléter] » qui bloquent la publication.
        </p>
        <Link className="ui-btn" href="/app/contenu/faits">
          Compléter mes faits clés
        </Link>
      </div>
    </div>
  );
}

export function draftCountLabel(drafts: ContentDraft[]): string {
  const waiting = drafts.filter((d) => d.status === 'draft' && !hasTodo(d)).length;
  return waiting ? plural(waiting, 'brouillon attend votre validation', 'brouillons attendent votre validation') : '';
}
