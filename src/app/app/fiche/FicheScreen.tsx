'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CopyButton } from '@/components/app/CopyButton';
import { Icon } from '@/components/app/icons';
import { toast } from '@/components/app/shell/client';
import type { FicheScreenData } from '@/app/api/fiche/_shared';
import { ESSENTIAL, FICHE_FIELDS } from '@/lib/execution/fiche/labels';
import type { Credential, FicheAlert, HoursException, ServiceItem, TextFact, TextKey } from '@/lib/execution/fiche/types';

type Block = { title: string; markdown: string; html: string };

const GROUPS: { id: string; title: string; keys: TextKey[] }[] = [
  { id: 'identite', title: 'Identité', keys: ['nom', 'activite', 'site', 'creation', 'dirigeant'] },
  { id: 'coordonnees', title: 'Coordonnées', keys: ['adresse', 'zone', 'telephone', 'email'] },
  { id: 'horaires', title: 'Horaires', keys: ['horaires'] },
  { id: 'offre', title: 'Services et prix', keys: ['prix', 'delais', 'produits'] },
  { id: 'conditions', title: 'Conditions', keys: ['garanties', 'livraison', 'retours', 'paiement', 'langues'] },
];
const MORE: TextKey[] = ['equipe', 'histoire', 'difference', 'clients', 'ingredients', 'avis', 'statut'];

const SOURCE: Record<string, string> = { client: 'Saisi par vous', site: 'Lu sur votre site', google: 'Lu sur votre fiche Google' };
const FROM: Record<string, string> = { 'facts.brand': 'Repris de Vérité', 'content.facts': 'Repris des faits clés', 'exec.settings': 'Repris des réglages', business: 'Repris de votre compte' };
const SEV = { haute: { label: 'Important', cls: 'rp-chip-danger' }, moyenne: { label: 'À surveiller', cls: 'rp-chip-warning' }, basse: { label: 'Mineur', cls: '' } } as const;

const textOf = (f: FicheScreenData['fiche']) => Object.fromEntries(Object.entries(f.text).map(([k, v]) => [k, (v as TextFact).value])) as Partial<Record<TextKey, string>>;

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }) : '');

function FactMeta({ f }: { f?: { source: string; at: string; verified: boolean; verifiedAt?: string; from?: string } }) {
  if (!f) return <span className="fo-meta">Non renseigné</span>;
  const origin = f.from && f.source === 'client' && !f.verified ? FROM[f.from] ?? SOURCE[f.source] : SOURCE[f.source];
  return (
    <span className="fo-meta">
      {origin}
      {f.at > '1971' ? `, ${day(f.at)}` : ''}
      {f.verified ? (
        <span className="fo-ok">
          <Icon name="check" size={12} /> vérifié{f.verifiedAt ? ` le ${day(f.verifiedAt)}` : ''}
        </span>
      ) : (
        <span className="fo-todo">à confirmer</span>
      )}
    </span>
  );
}

export function FicheScreen({ businessId, demo, initial, exportBlocks, preview }: { businessId: string; demo: boolean; initial: FicheScreenData; exportBlocks: { about: Block; contact: Block } | null; preview: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  useEffect(() => setData(initial), [initial]);
  const fiche = data.fiche;
  const [text, setText] = useState(() => textOf(fiche));
  const [services, setServices] = useState<ServiceItem[]>(fiche.services?.value ?? []);
  const [certs, setCerts] = useState<Credential[]>(fiche.certifications?.value ?? []);
  const [exc, setExc] = useState<HoursException[]>(fiche.exceptions?.value ?? []);
  const [sameAs, setSameAs] = useState<string[]>(fiche.sameAs?.value ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<'script' | 'iframe' | 'html'>('script');
  const [simConfirmed, setSimConfirmed] = useState<string | null>(null);

  useEffect(() => {
    setText(textOf(fiche));
    setServices(fiche.services?.value ?? []);
    setCerts(fiche.certifications?.value ?? []);
    setExc(fiche.exceptions?.value ?? []);
    setSameAs(fiche.sameAs?.value ?? []);
  }, [fiche]);

  const dirty = useMemo(() => {
    const t0 = textOf(fiche);
    const keys = new Set([...Object.keys(t0), ...Object.keys(text)]);
    for (const k of keys) if ((t0[k as TextKey] ?? '') !== (text[k as TextKey] ?? '')) return true;
    return (
      JSON.stringify(services) !== JSON.stringify(fiche.services?.value ?? []) ||
      JSON.stringify(certs) !== JSON.stringify(fiche.certifications?.value ?? []) ||
      JSON.stringify(exc) !== JSON.stringify(fiche.exceptions?.value ?? []) ||
      JSON.stringify(sameAs) !== JSON.stringify(fiche.sameAs?.value ?? [])
    );
  }, [fiche, text, services, certs, exc, sameAs]);

  async function call(path: string, body: Record<string, unknown>, ok: string): Promise<boolean> {
    if (demo) {
      toast({ text: 'Démo : rien n’est enregistré. Sur votre compte, cette action est appliquée tout de suite.', tone: 'info' });
      return false;
    }
    setBusy(path);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId, ...body }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.errors) setErrors(j.errors);
        toast({ text: j.error ?? 'Enregistrement impossible.', tone: 'error' });
        return false;
      }
      setErrors({});
      setData(j as FicheScreenData);
      toast({ text: j.warnings?.length ? `${ok} ${j.warnings.join(' ')}` : ok, tone: 'success' });
      router.refresh();
      return true;
    } catch {
      toast({ text: 'Connexion impossible. Réessayez.', tone: 'error' });
      return false;
    } finally {
      setBusy(null);
    }
  }

  const save = () => {
    const t0 = textOf(fiche);
    const changed: Partial<Record<TextKey, string>> = {};
    for (const k of new Set([...Object.keys(t0), ...Object.keys(text)]) as Set<TextKey>) if ((t0[k] ?? '') !== (text[k] ?? '')) changed[k] = text[k] ?? '';
    return call('/api/fiche', { text: changed, services, certifications: certs, exceptions: exc, sameAs }, 'Fiche enregistrée.');
  };
  const accept = (key: TextKey, value: string, source: string) => {
    if (demo) setText((t) => ({ ...t, [key]: value }));
    return call('/api/fiche', { accept: [{ key, value, source }] }, 'Valeur reprise dans votre fiche.');
  };
  const confirm = async () => {
    if (dirty && !demo) {
      const ok = await save();
      if (!ok) return;
    }
    if (demo) setSimConfirmed(new Date().toISOString());
    await call('/api/fiche/confirmer', {}, 'Merci : fiche confirmée. Prochain rappel dans 90 jours.');
  };

  const segKeys = new Set(ESSENTIAL[data.segment]);
  const shown = (k: TextKey) => segKeys.has(k) || !!text[k] || !FICHE_FIELDS[k].segments || FICHE_FIELDS[k].segments!.includes(data.segment);
  const confirmedAt = simConfirmed ?? fiche.confirmedAt;
  const c = data.completeness;

  return (
    <div className="fo">
      <section className="fo-confirm" aria-labelledby="fo-confirm-h">
        <div>
          <h2 id="fo-confirm-h" className="fo-confirm-title">
            {confirmedAt ? <>Dernière vérification le {day(confirmedAt)}</> : 'Jamais confirmée'}
          </h2>
          <p className="fo-confirm-sub">
            {c.filled} faits essentiels sur {c.total} renseignés, {c.verified} vérifiés. {data.nextCheck && !simConfirmed ? `Prochain rappel le ${day(data.nextCheck)}.` : 'Un rappel vous sera envoyé dans 90 jours.'}
          </p>
        </div>
        <button type="button" className="rp-btn rp-btn-primary v4-press" onClick={() => void confirm()} disabled={!!busy}>
          <Icon name="check" size={16} /> Je confirme que c’est à jour
        </button>
      </section>

      {(data.alerts.length > 0 || data.suggestions.length > 0) && (
        <section className="rp-panel" aria-labelledby="fo-alerts-h">
          <div className="rp-panel-head">
            <h2 id="fo-alerts-h" className="rp-h2">
              {data.alerts.length ? `${data.alerts.length} écart${data.alerts.length > 1 ? 's' : ''} entre votre fiche, votre site, Google et les IA` : 'Informations trouvées ailleurs'}
            </h2>
          </div>
          <div className="rp-panel-body">
            {data.alerts.length > 0 && (
              <ul className="fo-alerts">
                {data.alerts.map((a: FicheAlert) => (
                  <li key={a.id} className={a.severity === 'haute' ? 'is-high' : ''}>
                    <div className="fo-alert-top">
                      <span className={`rp-chip ${SEV[a.severity].cls}`}>{SEV[a.severity].label}</span>
                      <strong>{a.label}</strong>
                      <span className="fo-meta">
                        {a.whereLabel}
                        {a.at ? `, ${day(a.at)}` : ''}
                      </span>
                    </div>
                    <dl className="fo-compare">
                      <div>
                        <dt>{a.where === 'ia' ? `${a.whereLabel} affirme` : `Sur ${a.whereLabel}`}</dt>
                        <dd className="fo-found">{a.found}</dd>
                      </div>
                      <div>
                        <dt>Votre fiche</dt>
                        <dd>{a.expected ?? 'Non renseigné'}</dd>
                      </div>
                    </dl>
                    <p className="fo-fix">{a.fix}</p>
                    <div className="fo-actions">
                      {a.where !== 'ia' && a.field !== 'sameAs' && a.field !== 'services' && (
                        <button type="button" className="rp-btn rp-btn-sm" onClick={() => void accept(a.field as TextKey, a.found, a.where)} disabled={!!busy}>
                          Prendre cette valeur
                        </button>
                      )}
                      {a.field === 'sameAs' && (
                        <button type="button" className="rp-btn rp-btn-sm" onClick={() => setSameAs((s) => [...new Set([...s, a.found])])}>
                          Ajouter aux liens officiels
                        </button>
                      )}
                      {a.href && (
                        <Link href={a.href} className="rp-btn rp-btn-sm rp-btn-ghost">
                          {a.where === 'google' ? 'Ouvrir Fiche Google' : a.where === 'ia' ? 'Voir dans Vérité' : 'Voir l’analyse du site'}
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {data.suggestions.length > 0 && (
              <div className="fo-sugg">
                <h3 className="fo-h3">Absent de votre fiche, trouvé ailleurs</h3>
                <ul>
                  {data.suggestions.map((s) => (
                    <li key={s.key}>
                      <span>
                        <strong>{FICHE_FIELDS[s.key].label}</strong> : {s.value} <span className="fo-meta">({SOURCE[s.source].toLowerCase()})</span>
                      </span>
                      <button type="button" className="rp-btn rp-btn-sm" onClick={() => void accept(s.key, s.value, s.source)} disabled={!!busy}>
                        <Icon name="plus" size={14} /> Ajouter
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="fo-note">
              Sources : {data.observations.site ? `votre site lu le ${day(data.observations.site.at)}` : 'site pas encore relu'} · {data.observations.google ? `fiche Google saisie le ${day(data.observations.google.at)}` : 'fiche Google non renseignée'} · {data.observations.iaCheckedAt ? `réponses des IA du ${day(data.observations.iaCheckedAt)} (sur échantillon)` : 'pas encore de mesure IA'}.
            </p>
          </div>
        </section>
      )}

      <div className="fo-grid">
        <form
          className="rp-panel fo-form"
          aria-labelledby="fo-form-h"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="rp-panel-head">
            <h2 id="fo-form-h" className="rp-h2">
              Vos faits
            </h2>
            <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" onClick={() => void call('/api/fiche/lire-site', {}, 'Site relu : écarts mis à jour.')} disabled={!!busy}>
              <Icon name="search" size={14} /> {busy === '/api/fiche/lire-site' ? 'Lecture…' : 'Relire mon site'}
            </button>
          </div>
          <div className="rp-panel-body">
            {GROUPS.map((g) => {
              const keys = g.keys.filter(shown);
              const extra = g.id === 'horaires' || g.id === 'offre';
              if (!keys.length && !extra) return null;
              return (
                <fieldset key={g.id} className="fo-group">
                  <legend>{g.title}</legend>
                  {keys.map((k) => (
                    <Field key={k} k={k} value={text[k] ?? ''} meta={fiche.text[k]} error={errors[k]} onChange={(v) => setText((t) => ({ ...t, [k]: v }))} />
                  ))}
                  {g.id === 'horaires' && <Exceptions list={exc} onChange={setExc} errors={errors} />}
                  {g.id === 'offre' && <Services list={services} onChange={setServices} errors={errors} segment={data.segment} meta={fiche.services} />}
                </fieldset>
              );
            })}
            <fieldset className="fo-group">
              <legend>Labels et certifications</legend>
              <Credentials list={certs} onChange={setCerts} errors={errors} />
            </fieldset>
            <fieldset className="fo-group">
              <legend>Liens officiels</legend>
              <p className="fo-help">Vos profils (réseaux sociaux, annuaires professionnels, fiche Google). Repris dans le balisage sameAs.</p>
              <ListOfUrls list={sameAs} onChange={setSameAs} errors={errors} />
            </fieldset>
            <details className="fo-more">
              <summary>
                <Icon name="chevron" size={14} className="rp-chevron" /> Plus d’informations (équipe, histoire, clients…)
              </summary>
              {MORE.filter((k) => shown(k) || k === 'equipe' || k === 'histoire' || k === 'difference').map((k) => (
                <Field key={k} k={k} value={text[k] ?? ''} meta={fiche.text[k]} error={errors[k]} onChange={(v) => setText((t) => ({ ...t, [k]: v }))} />
              ))}
            </details>
            <div className="fo-savebar">
              <button type="submit" className="rp-btn rp-btn-primary" disabled={!dirty || !!busy}>
                {busy === '/api/fiche' ? 'Enregistrement…' : 'Enregistrer la fiche'}
              </button>
              <span className="fo-meta">{dirty ? 'Modifications non enregistrées.' : 'Tout est enregistré.'} Ce que vous enregistrez est marqué « vérifié » et repris dans Vérité et les faits clés de l’agent de contenu.</span>
            </div>
          </div>
        </form>

        <aside className="fo-side">
          <section className="rp-panel" aria-labelledby="fo-pub-h">
            <div className="rp-panel-head">
              <h2 id="fo-pub-h" className="rp-h2">
                Page publique
              </h2>
              <a href={data.pageUrl} target="_blank" rel="noopener" className="rp-link text-[13px]">
                Ouvrir <Icon name="external" size={12} />
              </a>
            </div>
            <div className="rp-panel-body">
              <div className="fo-preview" aria-label="Aperçu de la page publique">
                {preview ?? <p className="fo-meta">Page dépubliée dans vos réglages.</p>}
              </div>
              <label className="fo-switch">
                <input type="checkbox" className="rp-switch" checked={fiche.publication.indexable} disabled={demo || !!busy} onChange={(e) => void call('/api/fiche/publication', { indexable: e.target.checked }, e.target.checked ? 'Page indexable : Google pourra l’afficher.' : 'Page retirée de l’indexation.')} />
                <span>
                  <strong>Autoriser Google et les moteurs à indexer la page</strong>
                  <span className="fo-help">{demo ? 'Une page de démonstration n’est jamais indexée.' : 'Désactivé par défaut. À activer quand vos faits sont vérifiés.'}</span>
                </span>
              </label>
              <p className="fo-help">
                Pour les IA : <a href={data.markdownUrl} target="_blank" rel="noopener" className="rp-link">version Markdown</a> · <a href={data.llmsUrl} target="_blank" rel="noopener" className="rp-link">llms.txt</a>
                {data.hasJsonLd ? ' · balisage schema.org inclus' : demo ? ' · pas de balisage schema.org (démo)' : ''}
              </p>
            </div>
          </section>

          <section className="rp-panel" aria-labelledby="fo-embed-h">
            <div className="rp-panel-head">
              <h2 id="fo-embed-h" className="rp-h2">
                Encart pour votre site
              </h2>
            </div>
            <div className="rp-panel-body">
              <div className="fo-embed-preview" dangerouslySetInnerHTML={{ __html: data.embed.previewHtml }} />
              <div className="rp-seg mt-3" role="radiogroup" aria-label="Forme de l’encart">
                {(
                  [
                    ['script', 'Script léger'],
                    ['iframe', 'Cadre'],
                    ['html', 'HTML à copier'],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={tab === k} className="rp-seg-btn" onClick={() => setTab(k)}>
                    {l}
                  </button>
                ))}
              </div>
              <p className="fo-help">
                {tab === 'script'
                  ? 'Moins de 5 Ko, sans cookie ni traceur. Se met à jour tout seul quand vous modifiez la fiche.'
                  : tab === 'iframe'
                    ? 'Aucun script sur votre site. Se met à jour tout seul. Moins lisible par les robots.'
                    : 'Le plus lisible par Google et les IA. À recopier après chaque modification.'}
              </p>
              <pre className="rp-code fo-code">{data.embed[tab]}</pre>
              <CopyButton text={data.embed[tab]} label="Copier le code" />
              <label className="fo-switch">
                <input type="checkbox" className="rp-switch" checked={fiche.publication.embedJsonLd} disabled={demo || !!busy} onChange={(e) => void call('/api/fiche/publication', { embedJsonLd: e.target.checked }, e.target.checked ? 'Le balisage sera ajouté par l’encart.' : 'Balisage retiré de l’encart.')} />
                <span>
                  <strong>Ajouter aussi le balisage schema.org sur la page</strong>
                  <span className="fo-help">{demo ? 'Jamais pour une démo.' : 'Script et HTML à copier. Désactivez-le si votre site a déjà son propre balisage d’entreprise.'}</span>
                </span>
              </label>
            </div>
          </section>

          {exportBlocks && (
            <section className="rp-panel" aria-labelledby="fo-export-h">
              <div className="rp-panel-head">
                <h2 id="fo-export-h" className="rp-h2">
                  Pages « À propos » et « Contact »
                </h2>
              </div>
              <div className="rp-panel-body">
                <p className="fo-help">Textes tirés de vos seuls faits, à coller sur votre site ou à confier à l’agent de publication.</p>
                {(['about', 'contact'] as const).map((k) => (
                  <div key={k} className="fo-export">
                    <span>{exportBlocks[k].title}</span>
                    <span className="flex gap-2">
                      <CopyButton text={exportBlocks[k].markdown} label="Markdown" />
                      <CopyButton text={exportBlocks[k].html} label="HTML" />
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ k, value, meta, error, onChange }: { k: TextKey; value: string; meta?: TextFact; error?: string; onChange: (v: string) => void }) {
  const def = FICHE_FIELDS[k];
  const id = `fo-${k}`;
  return (
    <div className="fo-field">
      <div className="fo-field-head">
        <label htmlFor={id}>{def.label}</label>
        <FactMeta f={meta} />
      </div>
      {def.long ? (
        <textarea id={id} className="rp-input" rows={3} value={value} maxLength={def.max} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={`${id}-h`} />
      ) : (
        <input id={id} className="rp-input" value={value} maxLength={def.max} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={`${id}-h`} />
      )}
      <p id={`${id}-h`} className={error ? 'fo-err' : 'fo-help'}>
        {error ?? def.help}
      </p>
    </div>
  );
}

function Services({ list, onChange, errors, segment, meta }: { list: ServiceItem[]; onChange: (l: ServiceItem[]) => void; errors: Record<string, string>; segment: string; meta?: { source: string; at: string; verified: boolean; verifiedAt?: string; from?: string } }) {
  const set = (i: number, p: Partial<ServiceItem>) => onChange(list.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="fo-field">
      <div className="fo-field-head">
        <span className="fo-label">{segment === 'ecommerce' ? 'Produits phares' : 'Services'} et prix « à partir de »</span>
        <FactMeta f={list.length ? meta : undefined} />
      </div>
      <ul className="fo-rows">
        {list.map((s, i) => (
          <li key={i} className="fo-row-svc">
            <input className="rp-input" aria-label="Nom" value={s.name} maxLength={160} onChange={(e) => set(i, { name: e.target.value })} />
            <input className="rp-input" aria-label="À partir de (€)" inputMode="decimal" placeholder="à partir de €" value={s.priceFrom ?? ''} onChange={(e) => set(i, { priceFrom: e.target.value === '' ? undefined : (e.target.value.replace(',', '.') as unknown as number) })} />
            <input className="rp-input" aria-label="Précision" placeholder="TTC, HT/mois…" value={s.unit ?? ''} maxLength={40} onChange={(e) => set(i, { unit: e.target.value || undefined })} />
            <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" aria-label={`Retirer ${s.name || 'ce service'}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
              <Icon name="close" size={14} />
            </button>
            {errors[`services.${i}`] && <p className="fo-err">{errors[`services.${i}`]}</p>}
          </li>
        ))}
      </ul>
      <button type="button" className="rp-btn rp-btn-sm" onClick={() => onChange([...list, { name: '' }])} disabled={list.length >= 30}>
        <Icon name="plus" size={14} /> Ajouter
      </button>
    </div>
  );
}

function Credentials({ list, onChange, errors }: { list: Credential[]; onChange: (l: Credential[]) => void; errors: Record<string, string> }) {
  const set = (i: number, p: Partial<Credential>) => onChange(list.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="fo-field">
      <p className="fo-help">Seulement ceux que vous détenez, avec le numéro et le lien de vérification de l’organisme : ils sont repris tels quels sur votre page.</p>
      <ul className="fo-rows">
        {list.map((c, i) => (
          <li key={i} className="fo-row-cred">
            <input className="rp-input" aria-label="Label" placeholder="RGE Qualibat" value={c.name} maxLength={160} onChange={(e) => set(i, { name: e.target.value })} />
            <input className="rp-input" aria-label="Numéro" placeholder="n°" value={c.number ?? ''} maxLength={60} onChange={(e) => set(i, { number: e.target.value || undefined })} />
            <input className="rp-input" aria-label="Lien de vérification" placeholder="https://…" value={c.verifyUrl ?? ''} maxLength={300} onChange={(e) => set(i, { verifyUrl: e.target.value || undefined })} />
            <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" aria-label={`Retirer ${c.name || 'ce label'}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
              <Icon name="close" size={14} />
            </button>
            {errors[`certifications.${i}`] && <p className="fo-err">{errors[`certifications.${i}`]}</p>}
          </li>
        ))}
      </ul>
      <button type="button" className="rp-btn rp-btn-sm" onClick={() => onChange([...list, { name: '' }])} disabled={list.length >= 20}>
        <Icon name="plus" size={14} /> Ajouter un label
      </button>
    </div>
  );
}

function Exceptions({ list, onChange, errors }: { list: HoursException[]; onChange: (l: HoursException[]) => void; errors: Record<string, string> }) {
  const set = (i: number, p: Partial<HoursException>) => onChange(list.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="fo-field">
      <span className="fo-label">Fermetures et horaires exceptionnels</span>
      <ul className="fo-rows">
        {list.map((x, i) => (
          <li key={i} className="fo-row-exc">
            <input className="rp-input" aria-label="Motif" placeholder="Noël, congés…" value={x.label ?? ''} maxLength={80} onChange={(e) => set(i, { label: e.target.value || undefined })} />
            <input className="rp-input" type="date" aria-label="Du" value={x.from} onChange={(e) => set(i, { from: e.target.value })} />
            <input className="rp-input" type="date" aria-label="Au (facultatif)" value={x.to ?? ''} onChange={(e) => set(i, { to: e.target.value || undefined })} />
            <select className="rp-input" aria-label="Fermé ou ouvert" value={x.closed ? 'f' : 'o'} onChange={(e) => set(i, e.target.value === 'f' ? { closed: true, opens: undefined, closes: undefined } : { closed: false, opens: '09:00', closes: '12:00' })}>
              <option value="f">Fermé</option>
              <option value="o">Ouvert</option>
            </select>
            {!x.closed && (
              <>
                <input className="rp-input" type="time" aria-label="Ouverture" value={x.opens ?? ''} onChange={(e) => set(i, { opens: e.target.value })} />
                <input className="rp-input" type="time" aria-label="Fermeture" value={x.closes ?? ''} onChange={(e) => set(i, { closes: e.target.value })} />
              </>
            )}
            <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" aria-label="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>
              <Icon name="close" size={14} />
            </button>
            {errors[`exceptions.${i}`] && <p className="fo-err">{errors[`exceptions.${i}`]}</p>}
          </li>
        ))}
      </ul>
      <button type="button" className="rp-btn rp-btn-sm" onClick={() => onChange([...list, { from: new Date().toISOString().slice(0, 10), closed: true }])} disabled={list.length >= 40}>
        <Icon name="plus" size={14} /> Ajouter une date
      </button>
    </div>
  );
}

function ListOfUrls({ list, onChange, errors }: { list: string[]; onChange: (l: string[]) => void; errors: Record<string, string> }) {
  return (
    <div className="fo-field">
      <ul className="fo-rows">
        {list.map((u, i) => (
          <li key={i} className="fo-row-url">
            <input className="rp-input" aria-label="Lien" placeholder="https://…" value={u} maxLength={300} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" aria-label="Retirer ce lien" onClick={() => onChange(list.filter((_, j) => j !== i))}>
              <Icon name="close" size={14} />
            </button>
            {errors[`sameAs.${i}`] && <p className="fo-err">{errors[`sameAs.${i}`]}</p>}
          </li>
        ))}
      </ul>
      <button type="button" className="rp-btn rp-btn-sm" onClick={() => onChange([...list, ''])} disabled={list.length >= 12}>
        <Icon name="plus" size={14} /> Ajouter un lien
      </button>
    </div>
  );
}
