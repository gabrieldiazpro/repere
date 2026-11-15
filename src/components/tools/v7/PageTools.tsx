'use client';
/**
 * Outils V7 qui lisent une adresse : structure des titres, images et alt, poids de la page, mobile, HTTPS, fraîcheur,
 * résultats enrichis (avec mode « coller du code » calculé dans le navigateur), contenu dupliqué (deux adresses).
 * Même gabarit que les outils V6 (UrlTool : verdict, état d'accès, exemple fictif, erreurs, pont vers /analyse).
 */
import { useId, useMemo, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { callTool, hostOf, normalizeUrl } from '../api';
import { AuditBridge, CheckList, EmailCapture, ErrorBox, ExampleNote, Loading, ResultHeader, Scope, ShareLink, StatusPill, UrlField, useShareParams, useToolRun } from '../ui';
import { AccessNote, HttpCode, MiniTable, Stat, UrlTool, VerdictBanner } from '../v6/ui';
import { parseJsonLdInput, richResults } from './pure';
import type { DuplicateReport, FreshnessReport, HeadingsReport, HttpsReport, ImagesReport, MobileReport, ResourceKind, RichItem, RichReport, RichStatus, WeightReport } from './types';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);
const fileOf = (u: string) => {
  try {
    const x = new URL(u);
    return decodeURIComponent(x.pathname.split('/').filter(Boolean).pop() || x.hostname);
  } catch {
    return u;
  }
};

/* ------------------------------------------------------------------ */
/* Structure des titres                                                */
/* ------------------------------------------------------------------ */

function Outline({ r }: { r: HeadingsReport }) {
  if (!r.headings.length) return <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted">Aucune balise de titre (H1 à H6) dans le HTML de la page.</p>;
  return (
    <ol className="overflow-hidden rounded-xl border border-line bg-white" aria-label="Plan de la page">
      {r.headings.slice(0, 120).map((h, i) => (
        <li key={i} className={`flex min-w-0 items-start gap-2 border-b border-line px-3 py-2 last:border-0 ${h.skipped || h.empty ? 'bg-warning-bg/50' : ''}`} style={{ paddingLeft: `${0.75 + Math.min(h.level - 1, 4) * 0.9}rem` }}>
          <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${h.level === 1 ? 'bg-primary text-white' : 'bg-canvas text-ink'}`}>H{h.level}</span>
          <span className={`min-w-0 break-words text-[0.95rem] ${h.empty ? 'italic text-muted' : 'text-ink'}`}>
            {h.empty ? '(titre vide)' : h.text}
            {h.skipped && <span className="ml-2 whitespace-nowrap text-xs font-semibold text-warning-ink">niveau sauté</span>}
            {h.question && <span className="ml-2 whitespace-nowrap text-xs font-semibold text-success-ink">question</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function HeadingsTool({ example }: { example: HeadingsReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/titres"
      example={example}
      exampleWhat="page de service d’une plomberie imaginaire : logo balisé en H1 vide, niveau sauté, intertitre vide."
      label="Adresse de la page"
      submitLabel="Voir le plan"
      steps={['Lecture de la page…', 'Reconstruction du plan H1 à H6…']}
      toolName="Structure des titres"
      bridgeText="L’analyse vérifie le plan de toutes vos pages et repère les passages que les IA peuvent citer."
      render={(r) => (
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {r.counts.map((c, i) => (
              <Stat key={i} value={c} label={`H${i + 1}`} tone={i === 0 && c !== 1 ? (c === 0 ? 'fail' : 'warn') : undefined} />
            ))}
          </div>
          <Outline r={r} />
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Images et textes alternatifs                                        */
/* ------------------------------------------------------------------ */

const ALT_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'fail' }> = {
  ok: { label: 'Décrite', tone: 'ok' },
  empty: { label: 'Décorative (alt vide)', tone: 'ok' },
  missing: { label: 'Sans alt', tone: 'fail' },
  filename: { label: 'Nom de fichier', tone: 'warn' },
  generic: { label: 'Trop générique', tone: 'warn' },
  long: { label: 'Trop long', tone: 'warn' },
  duplicate: { label: 'Répété', tone: 'warn' },
};

export function ImagesTool({ example }: { example: ImagesReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/images"
      example={example}
      exampleWhat="page d’une plomberie imaginaire : images sans alt, une image cassée, un lien-image muet."
      label="Adresse de la page"
      submitLabel="Vérifier les images"
      steps={['Lecture de la page…', 'Relevé des images et de leur texte alternatif…', 'Vérification des images (20 au plus)…']}
      toolName="Images et textes alternatifs"
      bridgeText="L’analyse vérifie les images de toutes vos pages, et ce que Google et les IA comprennent de votre site."
      render={(r) => (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={r.total} label="Images" />
            <Stat value={r.missing} label="Sans alt" tone={r.missing ? 'fail' : undefined} />
            <Stat value={r.weak} label="Alt peu utiles" tone={r.weak ? 'warn' : undefined} />
            <Stat value={r.broken} label={`Cassées (sur ${r.checked} vérifiées)`} tone={r.broken ? 'fail' : undefined} />
          </div>
          {r.images.length > 0 && (
            <MiniTable
              label="Images de la page"
              head={['Image', 'Texte alternatif', 'État']}
              rows={r.images.slice(0, 60).map((im) => [
                <span key="f" className="break-all font-mono text-xs" title={im.src}>
                  {fileOf(im.src)}
                  {im.linked && <span className="ml-1 font-sans font-semibold text-muted">(lien)</span>}
                </span>,
                im.alt === null ? <span key="a" className="text-sm italic text-muted">aucun</span> : im.alt === '' ? <span key="a" className="font-mono text-xs text-muted">alt=""</span> : <span key="a" className="text-sm">« {im.alt} »</span>,
                <span key="s" className="flex flex-wrap items-center gap-1.5">
                  <StatusPill status={ALT_LABEL[im.kind].tone} label={ALT_LABEL[im.kind].label} />
                  {im.status !== undefined && !im.error?.startsWith('non vérifié') && <HttpCode status={im.status} />}
                </span>,
              ])}
            />
          )}
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Poids de la page                                                    */
/* ------------------------------------------------------------------ */

const KIND_LABEL: Record<ResourceKind, string> = { html: 'HTML', image: 'Images', script: 'Scripts', style: 'Styles', font: 'Polices', media: 'Vidéo et son', autre: 'Autres' };

export function WeightTool({ example }: { example: WeightReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/poids"
      example={example}
      exampleWhat="page d’une plomberie imaginaire alourdie par une photo de 2,4 Mo."
      label="Adresse de la page"
      submitLabel="Peser la page"
      steps={['Lecture de la page…', 'Relevé des fichiers appelés…', 'Taille annoncée de 30 fichiers au plus…']}
      toolName="Poids de la page"
      bridgeText="L’analyse mesure toutes vos pages et ce que les robots de Google et des IA en récupèrent."
      render={(r) => {
        const max = Math.max(1, ...r.byKind.map((k) => k.bytes));
        return (
          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat value={kb(r.totalKnown)} label="Poids mesuré (minimum)" tone={r.totalKnown > 6 * 1024 * 1024 ? 'fail' : r.totalKnown > 3 * 1024 * 1024 ? 'warn' : undefined} />
              <Stat value={r.requests} label="Fichiers appelés" />
              <Stat value={kb(r.htmlBytes)} label={`HTML${r.compressed ? ` (${r.compressed})` : ' non compressé'}`} />
              <Stat value={r.unknown} label="Tailles inconnues" />
            </div>
            <ul className="grid gap-2 rounded-xl border border-line bg-white p-4" aria-label="Poids par type de fichier">
              {r.byKind.map((k) => (
                <li key={k.kind} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                  <span className="text-muted">
                    {KIND_LABEL[k.kind]} <span className="tabular-nums">({k.count})</span>
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-line/60">
                    <span className="rt-bar block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round((k.bytes / max) * 100))}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums text-ink">{k.bytes ? kb(k.bytes) : '–'}</span>
                </li>
              ))}
            </ul>
            {r.heaviest.length > 0 && (
              <MiniTable
                label="Fichiers les plus lourds"
                head={['Fichier', 'Type', 'Poids']}
                rows={r.heaviest.map((x) => [
                  <span key="f" className="break-all font-mono text-xs" title={x.url}>
                    {fileOf(x.url)}
                    {x.external && <span className="ml-1 font-sans text-muted">({hostOf(x.url)})</span>}
                  </span>,
                  <span key="k" className="text-sm">{KIND_LABEL[x.kind]}</span>,
                  <span key="b" className={`font-semibold tabular-nums ${(x.bytes ?? 0) > 1024 * 1024 ? 'text-danger-ink' : (x.bytes ?? 0) > 300 * 1024 ? 'text-warning-ink' : 'text-ink'}`}>{kb(x.bytes ?? 0)}</span>,
                ])}
              />
            )}
          </div>
        );
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Mobile                                                              */
/* ------------------------------------------------------------------ */

export function MobileTool({ example }: { example: MobileReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/mobile"
      example={example}
      exampleWhat="page d’une plomberie imaginaire : zoom bloqué, tableau trop large, numéro non cliquable."
      label="Adresse de la page"
      submitLabel="Tester sur mobile"
      steps={['Lecture de la page comme un téléphone…', 'Contrôle du viewport, des largeurs et des liens…']}
      toolName="Compatibilité mobile"
      bridgeText="L’analyse passe toutes vos pages en revue, pour Google (qui explore en mobile) et pour les IA."
      render={(r) => (
        <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {r.signals.map((s) => (
            <div key={s.label} className="min-w-0 bg-white px-3 py-2.5">
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="mt-0.5 break-words font-mono text-sm text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* HTTPS et contenu mixte                                              */
/* ------------------------------------------------------------------ */

export function HttpsTool({ example }: { example: HttpsReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/https"
      example={example}
      exampleWhat="page d’une plomberie imaginaire en https, avec un script et une image encore appelés en http."
      label="Adresse de la page"
      submitLabel="Vérifier HTTPS"
      steps={['Lecture de la page en https…', 'Test de la version http…', 'Recherche du contenu mixte…']}
      toolName="HTTPS et contenu mixte"
      bridgeText="L’analyse vérifie la sécurité et l’indexabilité de toutes vos pages."
      render={(r) => (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={r.https ? 'Oui' : 'Non'} label="Page en HTTPS" tone={r.https ? undefined : 'fail'} />
            <Stat value={r.httpRedirect ? (r.httpRedirect.toHttps ? 'Oui' : r.httpRedirect.error ? '?' : 'Non') : '–'} label="http → https" tone={r.httpRedirect && !r.httpRedirect.toHttps && !r.httpRedirect.error ? 'warn' : undefined} />
            <Stat value={r.hsts ? 'Oui' : 'Non'} label="HSTS" tone={r.https && !r.hsts ? 'warn' : undefined} />
            <Stat value={r.mixed.length} label="Ressources en http" tone={r.mixed.some((m) => m.active) ? 'fail' : r.mixed.length ? 'warn' : undefined} />
          </div>
          {r.mixed.length > 0 && (
            <MiniTable
              label="Contenu mixte"
              head={['Adresse en http', 'Balise', 'Effet']}
              rows={r.mixed.slice(0, 40).map((m) => [
                <span key="u" className="break-all font-mono text-xs">{m.url}</span>,
                <span key="t" className="font-mono text-xs">{m.tag.replace('link:', 'link ')}</span>,
                <StatusPill key="e" status={m.active ? 'fail' : 'warn'} label={m.active ? 'Bloqué' : 'Tenté en https'} />,
              ])}
            />
          )}
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Fraîcheur                                                           */
/* ------------------------------------------------------------------ */

export function FreshnessTool({ example }: { example: FreshnessReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/fraicheur"
      example={example}
      exampleWhat="page de tarifs d’un salon de thé imaginaire, dont les dates se contredisent."
      label="Adresse de la page"
      submitLabel="Lire les dates"
      steps={['Lecture de la page…', 'Relevé des dates (texte, JSON-LD, balises, en-têtes)…']}
      toolName="Fraîcheur"
      bridgeText="L’analyse vérifie la fraîcheur de toutes vos pages et ce que les IA en reprennent."
      render={(r) => (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat value={r.latest ?? '–'} label="Date la plus récente" />
            <Stat value={r.ageDays === null ? '–' : r.ageDays > 365 ? `${Math.floor(r.ageDays / 365)} an${r.ageDays >= 730 ? 's' : ''}` : `${r.ageDays} j`} label="Ancienneté" tone={r.ageDays !== null && r.ageDays > 730 ? 'warn' : undefined} />
          </div>
          {r.dates.length > 0 ? (
            <MiniTable label="Dates relevées" head={['Source', 'Valeur lue', 'Date']} rows={r.dates.map((d) => [<span key="s" className="text-sm">{d.source}</span>, <span key="v" className="break-all font-mono text-xs">{d.value}</span>, <span key="d" className="font-mono text-xs">{d.iso ?? 'illisible'}</span>])} />
          ) : (
            <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted">Aucune date trouvée dans la page ni dans ses en-têtes.</p>
          )}
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Résultats enrichis                                                  */
/* ------------------------------------------------------------------ */

const RICH_LABEL: Record<RichStatus, { label: string; tone: 'ok' | 'warn' | 'fail' }> = {
  eligible: { label: 'Éligible', tone: 'ok' },
  incomplete: { label: 'Incomplet', tone: 'fail' },
  invalid: { label: 'Mal formé', tone: 'fail' },
  deprecated: { label: 'Plus affiché', tone: 'warn' },
  none: { label: 'Sans affichage', tone: 'ok' },
};

function RichItems({ items }: { items: RichItem[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.slice(0, 24).map((it) => (
        <li key={it.type} className="min-w-0 rounded-xl border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 break-words font-mono text-sm font-semibold text-ink">{it.type}</p>
            <StatusPill status={RICH_LABEL[it.status].tone} label={RICH_LABEL[it.status].label} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {it.doc ? (
              <a href={it.doc} className="underline underline-offset-2" rel="noopener noreferrer" target="_blank">
                {it.feature}
              </a>
            ) : (
              it.feature
            )}
          </p>
          {it.required.length > 0 && <p className="mt-1.5 break-words text-sm text-danger-ink">Obligatoire : {it.required.join(', ')}</p>}
          {it.invalid.length > 0 && <p className="mt-1.5 break-words text-sm text-danger-ink">{it.invalid[0]}</p>}
          {it.recommended.length > 0 && it.status !== 'deprecated' && <p className="mt-1.5 break-words text-sm text-warning-ink">Recommandé : {it.recommended.join(', ')}</p>}
        </li>
      ))}
    </ul>
  );
}

function RichPaste({ sample }: { sample: string }) {
  const id = useId();
  const [code, setCode] = useState('');
  const parsed = useMemo(() => parseJsonLdInput(code), [code]);
  const r = useMemo(() => (code.trim() ? richResults(parsed.values, parsed.errors) : null), [code, parsed]);
  return (
    <div>
      <label htmlFor={`${id}-code`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
        Votre code JSON-LD
      </label>
      <textarea id={`${id}-code`} className="rt-field !min-h-44 font-mono text-sm" value={code} onChange={(e) => setCode(e.target.value)} placeholder={'<script type="application/ld+json">{ "@context": "https://schema.org", … }</script>'} maxLength={200_000} spellCheck={false} />
      <p className="mt-2 text-sm text-muted">
        Calculé dans votre navigateur : rien n’est envoyé.{' '}
        <button type="button" className="font-semibold text-primary underline underline-offset-2 hover:no-underline" onClick={() => setCode(sample)}>
          Essayer avec un exemple
        </button>
      </p>
      {r && (
        <div className="mt-6 rt-fade" aria-live="polite">
          {code === sample && <ExampleNote what="fiche produit d’une boutique imaginaire, au prix mal formé." />}
          <VerdictBanner verdict={r.verdict} />
          <RichItems items={r.items} />
          <h3 className="mb-3 mt-6 font-semibold text-ink">Le détail des contrôles</h3>
          <CheckList checks={r.checks} />
        </div>
      )}
    </div>
  );
}

export function RichTool({ example, sample }: { example: RichReport; sample: string }) {
  const [mode, setMode] = useState<'url' | 'code'>('url');
  const tabs: ['url' | 'code', string][] = [
    ['url', 'Lire une page'],
    ['code', 'Coller du code'],
  ];
  return (
    <>
      <div role="tablist" aria-label="Mode" className="mb-4 inline-flex rounded-full bg-white p-1 ring-1 ring-line">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${mode === k ? 'bg-primary text-white' : 'text-ink hover:bg-canvas'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'url' ? (
        <UrlTool
          endpoint="/outils/api/resultats-enrichis"
          example={example}
          exampleWhat="fiche produit d’une boutique imaginaire : prix mal formé, image absente, FAQ plus affichée."
          label="Adresse de la page"
          submitLabel="Tester la page"
          steps={['Lecture de la page…', 'Lecture des blocs JSON-LD…', 'Comparaison aux exigences de Google…']}
          toolName="Résultats enrichis"
          bridgeText="L’analyse vérifie le balisage de toutes vos pages et ce que les IA comprennent de votre activité."
          render={(r) => (
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat value={r.blocks} label="Blocs JSON-LD" />
                <Stat value={r.items.filter((i) => i.status === 'eligible').length} label="Éligibles" />
                <Stat value={r.items.filter((i) => i.status === 'incomplete' || i.status === 'invalid').length} label="À corriger" tone={r.items.some((i) => i.status === 'incomplete' || i.status === 'invalid') ? 'fail' : undefined} />
              </div>
              <RichItems items={r.items} />
            </div>
          )}
        />
      ) : (
        <Scope>
          <RichPaste sample={sample} />
        </Scope>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Contenu dupliqué (deux adresses)                                    */
/* ------------------------------------------------------------------ */

function DupResult({ r, example }: { r: DuplicateReport; example: boolean }) {
  const rows: [string, (s: DuplicateReport['a']) => string][] = [
    ['Title', (s) => s.title ?? '(absent)'],
    ['Meta description', (s) => s.description ?? '(absente)'],
    ['H1', (s) => s.h1 ?? '(absent)'],
    ['Canonical', (s) => s.canonical ?? '(absente)'],
    ['Mots', (s) => String(s.words)],
  ];
  const tone = r.similarity >= 85 ? 'bg-danger' : r.similarity >= 50 ? 'bg-warning' : 'bg-success';
  return (
    <div className="mt-6 rt-fade">
      {example && <ExampleNote what="deux pages « ville » d’une plomberie imaginaire, presque identiques." />}
      <ResultHeader title={`${hostOf(r.a.finalUrl)} : deux pages comparées`} actions={!example ? <ShareLink params={{ url: r.a.url, url2: r.b.url }} /> : undefined} />
      <VerdictBanner verdict={r.verdict} />
      {r.access && <AccessNote access={r.access} />}
      {!r.access?.blocked && (
        <>
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted">Texte en commun</p>
              <p className="text-3xl font-bold tabular-nums text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                {r.similarity} %
              </p>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-line/60" role="img" aria-label={`${r.similarity} % de texte en commun`}>
              <div className={`rt-bar h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, r.similarity)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">Repères : moins de 50 % distinct, 50 à 85 % proche, 85 % et plus quasi identique.</p>
          </div>
          <div className="mt-4">
            <MiniTable label="Comparaison des balises" head={['', 'Page 1', 'Page 2']} rows={rows.map(([k, f]) => [<span key="k" className="text-sm font-semibold">{k}</span>, <span key="a" className="break-words text-sm">{f(r.a)}</span>, <span key="b" className="break-words text-sm">{f(r.b)}</span>])} />
          </div>
          {r.shared.length > 0 && (
            <section className="mt-5">
              <h3 className="mb-2 font-semibold text-ink">Phrases identiques sur les deux pages</h3>
              <ul className="grid gap-2">
                {r.shared.map((s, i) => (
                  <li key={i} className="rounded-xl border border-line bg-white px-3 py-2 text-[0.95rem] leading-relaxed">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <h3 className="mb-3 mt-6 font-semibold text-ink">Le détail des contrôles</h3>
          <CheckList checks={r.checks} />
        </>
      )}
    </div>
  );
}

export function DuplicateTool({ example }: { example: DuplicateReport }) {
  const id = useId();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [msg, setMsg] = useState('');
  const { state, run, showExample } = useToolRun<DuplicateReport>();
  const busy = state.phase === 'loading';
  const go = (x: string, y: string) => {
    setA(x);
    setB(y);
    run((signal) => callTool('/outils/api/doublons', { url: x, url2: y }, { signal }));
  };
  useShareParams((p) => p.url && p.url2 && go(p.url, p.url2));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const x = normalizeUrl(a);
    if (!x.ok) return setMsg(`Page 1 : ${x.message}`);
    const y = normalizeUrl(b);
    if (!y.ok) return setMsg(`Page 2 : ${y.message}`);
    if (x.url === y.url) return setMsg('Indiquez deux adresses différentes.');
    setMsg('');
    go(x.url, y.url);
  };
  return (
    <>
      <Scope busy={busy}>
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <div className="grid gap-3 sm:grid-cols-2">
            <UrlField id={`${id}-a`} label="Page 1" value={a} onChange={setA} invalid={msg.startsWith('Page 1')} placeholder="votre-site.fr/plombier-lyon" />
            <UrlField id={`${id}-b`} label="Page 2" value={b} onChange={setB} invalid={msg.startsWith('Page 2')} placeholder="votre-site.fr/plombier-bron" />
          </div>
          {msg && (
            <p role="alert" className="mt-2 text-sm font-medium text-danger-ink">
              {msg}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClasses()} disabled={busy}>
              {busy ? 'Comparaison en cours…' : 'Comparer les deux pages'}
            </button>
            <button type="button" onClick={() => showExample(example)} className="text-sm font-semibold text-primary underline underline-offset-2 hover:no-underline" disabled={busy}>
              Voir un exemple (données fictives)
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">10 comparaisons par heure. Deux pages publiques, lues par notre robot déclaré.</p>
        </form>
        {busy && <Loading steps={['Lecture des deux pages…', 'Extraction du texte principal…', 'Calcul de la part commune…']} />}
        {state.phase === 'error' && <ErrorBox error={state.error} onRetry={() => a && b && go(a, b)} />}
        {state.phase === 'done' && <DupResult r={state.data} example={state.example} />}
      </Scope>
      {state.phase === 'done' && !state.example && <EmailCapture tool="Contenu dupliqué" url={state.data.a.url} />}
      <AuditBridge to="analyse" done={state.phase === 'done'} url={state.phase === 'done' && !state.example ? state.data.a.finalUrl : null} text="Deux pages comparées ici ; l’analyse complète repère les doublons sur tout votre site." />
    </>
  );
}
