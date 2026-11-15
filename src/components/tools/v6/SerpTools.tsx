'use client';
/** Aperçu Google (calcul dans le navigateur) et vérificateur de title / meta description d'une URL. */
import { useId, useMemo, useState } from 'react';
import { callTool, normalizeUrl } from '../api';
import { AuditBridge, CheckList, ErrorBox, ExampleNote, Scope, useShareParams } from '../ui';
import { buttonClasses } from '@/components/ui/Button';
import { SERP, serpPreview, titleDescriptionChecks, worst } from './pure';
import type { MetaReport, SerpLine, SerpPreview, Verdict } from './types';
import { MiniTable, UrlTool, VerdictBanner } from './ui';
import type { ToolError } from '../api';

function Meter({ line, label }: { line: SerpLine; label: string }) {
  const pct = Math.min(100, Math.round((line.width / line.limit) * 100));
  const over = line.width > line.limit;
  return (
    <div className="text-xs">
      <div className="flex justify-between gap-2 text-muted">
        <span>{label}</span>
        <span className={`tabular-nums ${over ? 'font-semibold text-warning-ink' : ''}`}>
          {line.chars} car. · {line.width} / {line.limit} px{over ? ' : coupé' : ''}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`rt-bar h-full rounded-full ${over ? 'bg-warning' : 'bg-success'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Rendu inspiré d'une page de résultats (sans logo ni marque) : police Arial, tailles réelles. */
function SerpCard({ p, device }: { p: SerpPreview; device: 'desktop' | 'mobile' }) {
  const desc = device === 'desktop' ? p.descDesktop : p.descMobile;
  const mobile = device === 'mobile';
  return (
    <figure className={`m-0 min-w-0 rounded-xl border border-line bg-white p-4 ${mobile ? 'max-w-[360px]' : ''}`} aria-label={`Aperçu ${mobile ? 'mobile' : 'ordinateur'}`}>
      <figcaption className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
        <span aria-hidden>{mobile ? '▯' : '▭'}</span>
        {mobile ? 'Sur mobile' : 'Sur ordinateur'}
      </figcaption>
      <div style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-canvas text-xs font-bold text-muted ring-1 ring-line" aria-hidden>
            {(p.host[0] ?? '?').toUpperCase()}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[14px] text-[#202124]">{p.host || 'votre-site.fr'}</span>
            <span className="block truncate text-[12px] text-[#4d5156]">{p.breadcrumb}</span>
          </span>
        </div>
        {/* Bureau : une seule ligne, comme dans Google (défilement interne si l'écran est étroit). */}
        <div className={mobile ? '' : 'max-w-full overflow-x-auto'}>
          <p className={`mt-1.5 text-[#1a0dab] ${mobile ? 'break-words text-[18px] leading-[1.3]' : 'whitespace-nowrap text-[20px] leading-[1.3]'}`}>
            {p.title.shown || <span className="italic text-[#70757a]">(titre absent : Google en fabriquera un)</span>}
          </p>
        </div>
        <p className="mt-1 break-words text-[14px] leading-[1.58] text-[#4d5156]" style={{ maxWidth: mobile ? undefined : 600 }}>
          {desc.shown || <span className="italic">(description absente : Google choisira un extrait de la page)</span>}
        </p>
      </div>
    </figure>
  );
}

export function SerpPreviews({ p }: { p: SerpPreview }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <SerpCard p={p} device="desktop" />
        <SerpCard p={p} device="mobile" />
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-3">
        <Meter line={p.title} label="Titre" />
        <Meter line={p.descDesktop} label="Description, ordinateur" />
        <Meter line={p.descMobile} label="Description, mobile" />
      </div>
      {p.descriptionFromPage && <p className="text-sm text-muted">Pas de meta description : nous montrons le début du texte de la page, comme Google pourrait le faire.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aperçu Google                                                       */
/* ------------------------------------------------------------------ */

const field = 'rt-field';

export function SerpTool({ example }: { example: { title: string; description: string; url: string } }) {
  const id = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [isExample, setIsExample] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ToolError | null>(null);
  const preview = useMemo(() => serpPreview({ title, description, url: normalizeUrl(url).ok ? (normalizeUrl(url) as { url: string }).url : 'https://votre-site.fr/' }), [title, description, url]);
  const checks = useMemo(() => (title || description ? titleDescriptionChecks(title, description) : []), [title, description]);
  const tone = worst(checks);
  const verdict: Verdict = {
    tone,
    title: tone === 'ok' ? 'Titre et description s’affichent en entier' : checks.some((c) => c.id === 'title.long' || c.id === 'desc.long') ? 'Google coupera une partie de votre texte' : 'Titre ou description à retoucher',
    text: `Titre : ${preview.title.width} px sur ${SERP.titlePx}. Description : ${preview.descDesktop.width} px sur ${SERP.descDesktopPx} en bureau.`,
  };
  const readPage = async (target: string) => {
    const n = normalizeUrl(target);
    if (!n.ok) return setError({ kind: 'invalid', message: n.message, hint: 'Exemple attendu : https://votre-commerce.fr/services' });
    setError(null);
    setLoading(true);
    const r = await callTool('/outils/api/meta', { url: n.url });
    setLoading(false);
    if (!r.ok) return setError(r.error);
    setTitle(r.data.title ?? '');
    setDescription(r.data.description ?? '');
    setUrl(r.data.finalUrl);
    setIsExample(false);
  };
  useShareParams((p) => {
    if (p.titre || p.description) {
      setTitle(p.titre ?? '');
      setDescription(p.description ?? '');
      if (p.url) setUrl(p.url);
    } else if (p.url) {
      setUrl(p.url);
      void readPage(p.url);
    }
  });
  return (
    <>
      <Scope busy={loading}>
        <div className="grid gap-4">
          <div>
            <label htmlFor={`${id}-t`} className="mb-1.5 flex justify-between gap-2 text-[0.95rem] font-semibold text-ink">
              Titre (balise title) <span className="font-normal tabular-nums text-muted">{[...title].length} car.</span>
            </label>
            <input id={`${id}-t`} className={field} value={title} onChange={(e) => (setTitle(e.target.value), setIsExample(false))} placeholder="Plombier à Lyon 3 : dépannage en 2 h | Plomberie Martin" maxLength={300} />
          </div>
          <div>
            <label htmlFor={`${id}-d`} className="mb-1.5 flex justify-between gap-2 text-[0.95rem] font-semibold text-ink">
              Meta description <span className="font-normal tabular-nums text-muted">{[...description].length} car.</span>
            </label>
            <textarea id={`${id}-d`} className={`${field} !min-h-24`} value={description} onChange={(e) => (setDescription(e.target.value), setIsExample(false))} placeholder="Fuite, chauffe-eau, débouchage : intervention en 2 heures à Lyon et Villeurbanne. Devis écrit avant travaux." maxLength={1000} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${id}-u`} className="mb-1.5 block text-[0.95rem] font-semibold text-ink">
                Adresse de la page <span className="font-normal text-muted">(facultatif)</span>
              </label>
              <input id={`${id}-u`} className={field} inputMode="url" autoComplete="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="votre-commerce.fr/services" />
            </div>
            <button type="button" className={buttonClasses({ variant: 'secondary', size: 'md' })} onClick={() => readPage(url)} disabled={loading || !url.trim()}>
              {loading ? 'Lecture…' : 'Lire titre et description de la page'}
            </button>
          </div>
          <p className="text-sm text-muted">
            Pas d’idée ?{' '}
            <button
              type="button"
              className="font-semibold text-primary underline underline-offset-2 hover:no-underline"
              onClick={() => {
                setTitle(example.title);
                setDescription(example.description);
                setUrl(example.url);
                setIsExample(true);
                setError(null);
              }}
            >
              Voir un exemple
            </button>{' '}
            (données fictives). L’aperçu se met à jour pendant que vous tapez.
          </p>
        </div>
        {error && <ErrorBox error={error} onRetry={error.kind !== 'invalid' ? () => readPage(url) : undefined} />}
        <div className="mt-6" aria-live="polite">
          {isExample && <ExampleNote what="titre et description d’une plomberie imaginaire." />}
          {checks.length > 0 && <VerdictBanner verdict={verdict} />}
          <SerpPreviews p={preview} />
          {checks.length > 0 && (
            <div className="mt-6">
              <CheckList checks={checks} />
            </div>
          )}
        </div>
      </Scope>
      <AuditBridge to="analyse" done={checks.length > 0} url={!isExample && normalizeUrl(url).ok ? (normalizeUrl(url) as { url: string }).url : null} text="L’analyse vérifie le titre et la description de toutes vos pages, les doublons, et ce que les IA lisent de votre site." />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Vérificateur de title et meta description                           */
/* ------------------------------------------------------------------ */

export function MetaTool({ example }: { example: MetaReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/meta"
      example={example}
      exampleWhat="page d’accueil d’une plomberie imaginaire, titre trop long et description absente."
      label="Adresse de la page"
      submitLabel="Vérifier"
      steps={['Lecture de la page…', 'Lecture du title, de la description et du H1…', 'Mesure en pixels…']}
      toolName="Title et meta description"
      bridgeText="L’analyse vérifie les titres et descriptions de toutes vos pages, repère les doublons et propose des corrections."
      render={(r) => (
        <div className="grid gap-5">
          <SerpPreviews p={r.serp} />
          <MiniTable
            label="Balises lues dans la page"
            head={['Balise', 'Contenu lu']}
            rows={[
              ['title', r.title ? `${r.title}${r.titleCount > 1 ? ` (+${r.titleCount - 1} autre)` : ''}` : <em key="t" className="text-danger-ink">absente</em>],
              ['meta description', r.description ?? <em key="d" className="text-warning-ink">absente</em>],
              ['h1', r.h1.length ? r.h1.slice(0, 3).join(' · ') : <em key="h" className="text-warning-ink">absent</em>],
              ['langue', r.lang ?? 'non déclarée'],
            ]}
          />
        </div>
      )}
    />
  );
}
