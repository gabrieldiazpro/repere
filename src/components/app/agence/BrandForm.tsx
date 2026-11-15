'use client';
// Marque de l'agence et domaine d'envoi (V6). Aperçu en direct du rapport et de l'e-mail.
import { useState, useTransition } from 'react';
import type { AgencyProfile, SenderDomain } from '@/lib/agency/profile';
import { DEFAULT_AGENCY_COLOR } from '@/lib/agency/brand';
import { checkDomainAction, registerDomainAction, removeDomainAction, saveBrandAction } from '@/app/app/agence/actions';
import { toast } from '../shell/client';
import { BrandMark } from './BrandMark';

const DEMO_NOTE = 'Démo : rien n’est enregistré. Sur votre compte Agence, cette action fonctionne telle quelle.';

const STATUS_FR: Record<SenderDomain['status'], { label: string; tone: string }> = {
  verified: { label: 'Vérifié : vos rapports partent de ce domaine', tone: 'up' },
  pending: { label: 'En attente : ajoutez les enregistrements DNS ci-dessous', tone: 'warn' },
  not_started: { label: 'À vérifier : ajoutez les enregistrements DNS ci-dessous', tone: 'warn' },
  failed: { label: 'Échec de la vérification : contrôlez les enregistrements', tone: 'down' },
  unavailable: { label: 'Noté : la vérification ouvrira à la mise en ligne', tone: 'neutral' },
};

export function BrandForm({ initial, demo, clientExample }: { initial: AgencyProfile | null; demo: boolean; clientExample: string }) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    logoUrl: initial?.logoUrl ?? '',
    color: initial?.color ?? DEFAULT_AGENCY_COLOR,
    senderName: initial?.senderName ?? '',
    replyTo: initial?.replyTo ?? '',
    footer: initial?.footer ?? '',
    hideRepere: initial?.hideRepere ?? false,
  });
  const [domain, setDomain] = useState<SenderDomain | null>(initial?.senderDomain ?? null);
  const [domainInput, setDomainInput] = useState(initial?.senderDomain?.name ?? '');
  const [local, setLocal] = useState(initial?.senderDomain?.localPart ?? 'rapports');
  const [msg, setMsg] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: k === 'hideRepere' ? e.target.checked : e.target.value }));
  const name = f.name.trim() || 'Votre agence';
  const sender = domain?.status === 'verified' ? `${local}@${domain.name}` : 'l’adresse d’envoi de Repéré';

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (demo) return setMsg({ text: DEMO_NOTE, tone: 'info' });
    start(async () => {
      const r = await saveBrandAction(f);
      if (r.ok) {
        setMsg(null);
        toast({ text: 'Marque enregistrée', tone: 'success' });
      } else setMsg({ text: r.error, tone: 'error' });
    });
  };
  const run = (fn: () => Promise<{ ok: true; data: AgencyProfile } | { ok: false; error: string }>) => {
    if (demo) return setMsg({ text: DEMO_NOTE, tone: 'info' });
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setDomain(r.data.senderDomain ?? null);
        setMsg(null);
      } else setMsg({ text: r.error, tone: 'error' });
    });
  };

  return (
    <div className="ag-split" style={{ ['--ag-color' as string]: /^#[0-9a-f]{6}$/i.test(f.color) ? f.color : DEFAULT_AGENCY_COLOR }}>
      <div className="flex flex-col gap-4">
        <form className="rp-panel p-5" onSubmit={save} aria-labelledby="ag-brand-h">
          <h2 id="ag-brand-h" className="rp-display text-[19px]">
            Votre marque sur les rapports
          </h2>
          <p className="mb-4 mt-1 text-[14px] text-[var(--muted)]">Appliquée à tous vos clients : rapport mensuel, page partagée, e-mails programmés.</p>
          <label className="ag-field">
            Nom de l’agence
            <input className="rp-input mt-1" required minLength={2} maxLength={60} value={f.name} onChange={set('name')} />
          </label>
          <label className="ag-field">
            Logo (adresse https)
            <input className="rp-input mt-1" type="url" inputMode="url" placeholder="https://www.votre-agence.fr/logo.png" value={f.logoUrl} onChange={set('logoUrl')} />
            <span className="ag-hint">Un logo dont vous avez les droits. Sans logo, vos initiales s’affichent.</span>
          </label>
          <label className="ag-field">
            Couleur
            <span className="ag-color mt-1">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(f.color) ? f.color : DEFAULT_AGENCY_COLOR} onChange={set('color')} aria-label="Choisir la couleur" />
              <input className="rp-input" value={f.color} onChange={set('color')} pattern="#[0-9a-fA-F]{6}" maxLength={7} aria-label="Couleur au format #RRGGBB" />
            </span>
          </label>
          <label className="ag-field">
            Nom d’expéditeur des e-mails
            <input className="rp-input mt-1" maxLength={60} placeholder={name} value={f.senderName} onChange={set('senderName')} />
          </label>
          <label className="ag-field">
            Adresse de réponse
            <input className="rp-input mt-1" type="email" placeholder="contact@votre-agence.fr" value={f.replyTo} onChange={set('replyTo')} />
            <span className="ag-hint">Vos clients vous répondent directement.</span>
          </label>
          <label className="ag-field">
            Pied de rapport
            <input className="rp-input mt-1" maxLength={140} placeholder="Votre agence, 01 23 45 67 89, votre-agence.fr" value={f.footer} onChange={set('footer')} />
          </label>
          <label className="mt-4 flex items-start gap-2 text-[14px]">
            <input type="checkbox" className="mt-1" checked={f.hideRepere} onChange={set('hideRepere')} />
            <span>
              Ne pas mentionner Repéré
              <span className="ag-hint">Retire « rapport produit avec Repéré » des rapports et des e-mails.</span>
            </span>
          </label>
          {msg && (
            <p className={`mt-4 text-[13px] ${msg.tone === 'error' ? 'text-[var(--danger-ink)]' : 'text-[var(--warning-ink)]'}`} role="status">
              {msg.text}
            </p>
          )}
          <div className="mt-5 flex justify-end">
            <button className="rp-btn rp-btn-primary" type="submit" disabled={pending} aria-busy={pending}>
              Enregistrer la marque
            </button>
          </div>
        </form>

        <section className="rp-panel p-5" aria-labelledby="ag-dom-h">
          <h2 id="ag-dom-h" className="rp-display text-[19px]">
            Domaine d’envoi
          </h2>
          <p className="mb-4 mt-1 text-[14px] text-[var(--muted)]">
            Pour que vos rapports partent de votre adresse (par exemple rapports@votre-agence.fr). Tant que le domaine n’est pas vérifié, ils partent avec le nom de votre agence et l’adresse de Repéré.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="ag-field" style={{ flex: '0 1 140px' }}>
              Adresse
              <input className="rp-input mt-1" value={local} onChange={(e) => setLocal(e.target.value)} maxLength={40} />
            </label>
            <span className="pb-2 text-[15px]">@</span>
            <label className="ag-field" style={{ flex: '1 1 200px', marginTop: 0 }}>
              Domaine
              <input className="rp-input mt-1" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="votre-agence.fr" />
            </label>
            <button type="button" className="rp-btn" disabled={pending || !domainInput.trim()} onClick={() => run(() => registerDomainAction({ domain: domainInput, localPart: local }))}>
              {domain ? 'Mettre à jour' : 'Ajouter le domaine'}
            </button>
          </div>
          {domain && (
            <div className="mt-4">
              <p className="flex flex-wrap items-center gap-2 text-[14px]">
                <span className="ag-status" data-tone={STATUS_FR[domain.status].tone} style={{ marginTop: 0 }} aria-hidden="true" />
                <strong>{domain.name}</strong> {STATUS_FR[domain.status].label}
              </p>
              {domain.error && <p className="mt-1 text-[13px] text-[var(--danger-ink)]">{domain.error}</p>}
              {domain.records.length > 0 && (
                <div className="rp-scroll mt-3">
                  <table className="ag-dns">
                    <thead>
                      <tr>
                        <th scope="col">Type</th>
                        <th scope="col">Nom</th>
                        <th scope="col">Valeur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domain.records.map((r, i) => (
                        <tr key={i}>
                          <td>
                            {r.type}
                            <span className="block text-[11px] text-[var(--muted)]">{r.record}</span>
                          </td>
                          <td>
                            <code>{r.name}</code>
                          </td>
                          <td>
                            <code>{r.value}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {domain.status !== 'verified' && domain.status !== 'unavailable' && (
                  <button type="button" className="rp-btn rp-btn-sm" disabled={pending} onClick={() => run(checkDomainAction)}>
                    Vérifier maintenant
                  </button>
                )}
                <button type="button" className="rp-btn rp-btn-sm" disabled={pending} onClick={() => run(removeDomainAction)}>
                  Retirer le domaine
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <aside aria-label="Aperçu" className="flex flex-col gap-3 lg:sticky lg:top-4">
        <p className="text-[13px] font-semibold text-[var(--muted)]">Aperçu du rapport de {clientExample}</p>
        <div className="ag-preview">
          <div className="ag-preview-top">
            <BrandMark name={name} logoUrl={/^https:\/\//.test(f.logoUrl) ? f.logoUrl : null} size={34} />
            <div>
              <p style={{ fontWeight: 700 }}>{name}</p>
              <p style={{ fontSize: 12, color: '#5a6275' }}>Rapport mensuel de {clientExample}</p>
            </div>
          </div>
          <div className="ag-preview-body">
            <p style={{ fontSize: 34, fontWeight: 750, color: 'var(--ag-color)', lineHeight: 1 }}>
              61<span style={{ fontSize: 15, color: '#5a6275', fontWeight: 500 }}>/100</span>
            </p>
            <p style={{ fontSize: 12, color: '#5a6275', marginTop: 4 }}>Visibilité dans les IA (chiffre d’exemple)</p>
            <span style={{ display: 'inline-block', marginTop: 12, padding: '8px 14px', borderRadius: 9, background: 'var(--ag-color)', color: '#fff', fontWeight: 600, fontSize: 13 }}>Voir le rapport complet</span>
          </div>
          <div className="ag-preview-foot">{f.footer.trim() || name}{f.hideRepere ? '' : ' · rapport produit avec Repéré'}</div>
        </div>
        <div className="rp-panel p-4 text-[13px]">
          <p className="font-semibold">E-mail reçu par votre client</p>
          <p className="mt-2">
            De : <strong>{f.senderName.trim() || name}</strong> &lt;{sender}&gt;
          </p>
          {f.replyTo.trim() && <p>Réponse à : {f.replyTo.trim()}</p>}
          <p className="mt-1 text-[var(--muted)]">Objet : Visibilité dans les IA de {clientExample} : 61/100 (rapport mensuel)</p>
        </div>
      </aside>
    </div>
  );
}
