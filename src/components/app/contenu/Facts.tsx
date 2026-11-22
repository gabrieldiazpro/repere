'use client';
// Fiche « faits clés » (base unique des brouillons) et réglages de création.
import Link from 'next/link';
import { useState } from 'react';
import { toast } from '@/components/ui/toast';
import { FACT_LABEL } from '@/lib/content/facts';
import type { ContentSettings, FactKey } from '@/lib/content/types';
import { saveFactsAction, saveSettingsAction } from '@/app/app/contenu/actions';
import { canEdit, canValidate, FACT_ORDER, PLATFORM_NAME, plural } from './model';
import { useContent } from './state';

export function FactsForm() {
  const c = useContent();
  const initial = Object.fromEntries(FACT_ORDER.map((k) => [k, c.clientFacts[k] ?? ''])) as Record<FactKey, string>;
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const editable = canEdit(c.role);
  const dirty = FACT_ORDER.some((k) => (v[k] ?? '') !== (initial[k] ?? ''));
  const filled = c.essential.filter((k) => v[k]?.trim() || c.facts[k]?.origin === 'verite').length;
  const order = [...c.essential, ...FACT_ORDER.filter((k) => !c.essential.includes(k))];
  const save = async () => {
    if (c.demo) return toast({ text: 'Démo : les faits ne sont pas enregistrés. En compte réel, chaque brouillon les reprend aussitôt.', tone: 'info' });
    setBusy(true);
    const r = await saveFactsAction(c.businessId, v);
    setBusy(false);
    if (!r.ok) return toast({ text: r.error, tone: 'error' });
    toast({ text: 'Faits enregistrés. Les prochains brouillons les reprendront.', tone: 'success' });
    c.refresh();
  };
  return (
    <section aria-labelledby="ct-facts-h">
      <h2 id="ct-facts-h" className="ct-h2">
        Vos faits <small>{plural(filled, 'fait essentiel renseigné', 'faits essentiels renseignés')} sur {c.essential.length}</small>
      </h2>
      <div className="ct-facts">
        {order.map((k) => {
          const meta = FACT_LABEL[k];
          const fromVerite = !v[k]?.trim() && c.facts[k]?.origin === 'verite' ? c.facts[k]!.value : null;
          return (
            <label key={k} className="ct-field" data-long={meta.long ? '' : undefined}>
              <span>
                <b className="font-semibold text-[var(--ink)]">
                  {meta.label}
                  {c.essential.includes(k) ? ' *' : ''}
                </b>
                {fromVerite ? <span className="ct-origin" data-v="">Repris de votre fiche Vérité</span> : <span className="ct-origin">{meta.help}</span>}
              </span>
              <textarea value={v[k] ?? ''} placeholder={fromVerite ?? (meta.example || '')} readOnly={!editable} onChange={(e) => setV({ ...v, [k]: e.target.value })} rows={meta.long ? 4 : 2} />
            </label>
          );
        })}
      </div>
      <p className="mt-1 text-[13px] text-[var(--muted)]">* Essentiels pour votre type d’activité. N’indiquez que ce qui est vrai et que vous acceptez de voir cité.</p>
      {editable && (
        <div className="ct-bar">
          <p className="ct-bar-msg m-0">{dirty ? 'Modifications non enregistrées.' : 'Vos faits sont à jour.'}</p>
          <button type="button" className="ui-btn" data-variant="primary" disabled={!dirty || busy} onClick={save}>
            {busy ? 'Enregistrement…' : 'Enregistrer mes faits'}
          </button>
        </div>
      )}
    </section>
  );
}

export function SettingsForm() {
  const c = useContent();
  const [s, setS] = useState<ContentSettings>(c.settings);
  if (!canValidate(c.role)) return null;
  const save = async () => {
    if (c.demo) return toast({ text: 'Démo : réglage non enregistré.', tone: 'info' });
    const r = await saveSettingsAction(c.businessId, s);
    if (!r.ok) return toast({ text: r.error, tone: 'error' });
    toast({ text: 'Réglages enregistrés.', tone: 'success' });
    c.refresh();
  };
  const has = (p: string) => c.platforms.some((x) => x.platform === p);
  return (
    <section className="mt-10" aria-labelledby="ct-set-h">
      <h2 id="ct-set-h" className="ct-h2">
        Où créer vos contenus
      </h2>
      {c.platforms.length ? (
        <div className="ct-pane ct-pane-b">
          <label className="ct-field">
            <span>Plateforme</span>
            <select className="ct-select" value={s.platform ?? ''} onChange={(e) => setS({ ...s, platform: (e.target.value || undefined) as ContentSettings['platform'] })}>
              <option value="">Automatique (première connexion compatible)</option>
              {c.platforms.map((p) => (
                <option key={p.platform} value={p.platform}>
                  {PLATFORM_NAME[p.platform]} — {[p.page && 'pages', p.article && 'articles'].filter(Boolean).join(' et ')}
                </option>
              ))}
            </select>
          </label>
          {has('webflow') && (
            <label className="ct-field">
              <span>Webflow : identifiant de la collection CMS des articles (24 caractères)</span>
              <input value={s.webflowCollectionId ?? ''} onChange={(e) => setS({ ...s, webflowCollectionId: e.target.value })} />
            </label>
          )}
          {has('wix') && (
            <label className="ct-field">
              <span>Wix : identifiant du membre auteur (sinon le premier membre du site)</span>
              <input value={s.wixMemberId ?? ''} onChange={(e) => setS({ ...s, wixMemberId: e.target.value })} />
            </label>
          )}
          {has('prestashop') && (
            <label className="ct-field">
              <span>PrestaShop : catégorie CMS (numéro, 1 par défaut)</span>
              <input value={s.prestashopCategoryId ?? ''} onChange={(e) => setS({ ...s, prestashopCategoryId: e.target.value })} />
            </label>
          )}
          <button type="button" className="ui-btn" onClick={save}>
            Enregistrer les réglages
          </button>
        </div>
      ) : (
        <p className="text-[14px] text-[var(--muted)]">
          Aucune connexion ne sait créer de pages : les contenus validés s’exportent en HTML et Markdown. Connectez WordPress, Shopify, Webflow, Wix ou PrestaShop depuis{' '}
          <Link className="underline underline-offset-2" href="/app/agent/connexions">
            Agent › Connexions
          </Link>
          .
        </p>
      )}
    </section>
  );
}
