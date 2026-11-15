'use client';
/** Testeur Open Graph (aperçu de partage) et analyseur de liens d'une page. */
import { useState } from 'react';
import type { LinkRow, LinksReport, OgReport } from './types';
import { HttpCode, MiniTable, Stat, UrlTool } from './ui';

/* ------------------------------------------------------------------ */
/* Open Graph                                                          */
/* ------------------------------------------------------------------ */

function ShareCard({ r, compact = false }: { r: OgReport; compact?: boolean }) {
  const p = r.preview;
  const [broken, setBroken] = useState(false);
  const img = p.image && !broken && !(r.image && (r.image.error || r.image.status >= 400));
  return (
    <figure className={`m-0 overflow-hidden rounded-xl border border-line bg-white ${compact ? 'flex' : ''}`} aria-label={compact ? 'Aperçu en vignette (messageries)' : 'Aperçu en grand format (LinkedIn, Facebook, X)'}>
      <div className={`${compact ? 'w-28 shrink-0' : 'aspect-[1.91/1] w-full'} grid place-items-center overflow-hidden bg-canvas`}>
        {img ? (
          // Image du site analysé, affichée telle quelle (aucun proxy) ; sans référent.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image!} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <span className="px-3 text-center text-xs font-semibold text-muted">{p.image ? 'Image injoignable' : 'Aucune image'}</span>
        )}
      </div>
      <figcaption className="min-w-0 p-3">
        <p className="truncate text-xs uppercase tracking-wide text-muted">{p.host}</p>
        <p className="mt-0.5 line-clamp-2 font-semibold leading-snug text-ink">{p.title}</p>
        {!compact && p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}
      </figcaption>
    </figure>
  );
}

export function OgTool({ example }: { example: OgReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/open-graph"
      example={example}
      exampleWhat="page d’un salon de thé imaginaire, sans image de partage."
      label="Adresse de la page"
      submitLabel="Voir l’aperçu"
      steps={['Lecture des balises Open Graph…', 'Vérification de l’image…']}
      toolName="Open Graph"
      bridgeText="L’analyse vérifie les balises de partage de toutes vos pages, et ce que Google et les IA en lisent."
      render={(r) => {
        const tags = [...Object.entries(r.og), ...Object.entries(r.twitter)];
        return (
          <div className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start">
              <ShareCard r={r} />
              <div className="grid gap-2">
                <ShareCard r={r} compact />
                <p className="text-xs text-muted">Aperçu indicatif : chaque réseau recadre à sa façon et garde l’aperçu en mémoire plusieurs jours.</p>
              </div>
            </div>
            {tags.length > 0 ? (
              <MiniTable
                label="Balises lues"
                head={['Balise', 'Valeur']}
                rows={tags.map(([k, v]) => [<code key="k" className="font-mono text-[0.8rem] font-semibold">{k}</code>, <span key="v" className="break-words text-[0.85rem]">{v}</span>])}
              />
            ) : (
              <p className="text-sm text-muted">Aucune balise og:* ni twitter:* trouvée dans le HTML de la page.</p>
            )}
          </div>
        );
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Liens                                                               */
/* ------------------------------------------------------------------ */

type Filter = 'tous' | 'internes' | 'externes' | 'casses' | 'nofollow';
const FILTERS: [Filter, string][] = [
  ['tous', 'Tous'],
  ['casses', 'Cassés'],
  ['internes', 'Internes'],
  ['externes', 'Externes'],
  ['nofollow', 'nofollow, sponsored, ugc'],
];
const isBroken = (l: LinkRow) => l.status === 0 || (l.status ?? 0) >= 400;
const keep = (f: Filter) => (l: LinkRow) =>
  f === 'tous' ? true : f === 'internes' ? l.internal : f === 'externes' ? !l.internal : f === 'casses' ? l.status !== undefined && isBroken(l) : l.rel.some((x) => x === 'nofollow' || x === 'sponsored' || x === 'ugc');

function LinkList({ r }: { r: LinksReport }) {
  const [f, setF] = useState<Filter>(r.broken ? 'casses' : 'tous');
  const [all, setAll] = useState(false);
  const list = r.links.filter(keep(f));
  const shown = all ? list : list.slice(0, 40);
  return (
    <div>
      <div role="group" aria-label="Filtrer les liens" className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => {
          const n = r.links.filter(keep(k)).length;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={f === k}
              onClick={() => (setF(k), setAll(false))}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition-colors ${f === k ? 'bg-primary text-white ring-primary' : 'bg-white text-ink ring-line hover:ring-primary'}`}
            >
              {label} <span className="tabular-nums opacity-80">({n})</span>
            </button>
          );
        })}
      </div>
      {list.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white text-sm" aria-live="polite">
          {shown.map((l, i) => (
            <li key={`${l.href}-${i}`} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{l.anchor || <em className="text-warning-ink">sans texte</em>}</p>
                <p className="break-all font-mono text-[0.78rem] text-muted">{l.href}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted ring-1 ring-line">{l.internal ? 'interne' : 'externe'}</span>
                {l.rel.filter((x) => ['nofollow', 'sponsored', 'ugc'].includes(x)).map((x) => (
                  <span key={x} className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-ink">{x}</span>
                ))}
                {l.status !== undefined ? <HttpCode status={l.status} /> : <span className="text-xs text-muted">non testé</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted">Aucun lien dans cette catégorie.</p>
      )}
      {!all && list.length > shown.length && (
        <button type="button" onClick={() => setAll(true)} className="mt-2 text-sm font-semibold text-primary underline underline-offset-2">
          Afficher les {list.length - shown.length} autres liens
        </button>
      )}
    </div>
  );
}

export function LinksTool({ example }: { example: LinksReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/liens"
      example={example}
      exampleWhat="page d’accueil d’une plomberie imaginaire, avec un lien cassé et une ancre vague."
      label="Adresse de la page"
      submitLabel="Analyser les liens"
      steps={['Lecture des liens de la page…', 'Test des 30 premières adresses…', 'Classement…']}
      toolName="Liens d’une page"
      bridgeText="L’analyse vérifie les liens de tout le site, les pages orphelines et la profondeur de clic."
      render={(r) => (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat value={r.total} label="Liens" />
            <Stat value={r.internal} label="Internes" />
            <Stat value={r.external} label="Externes" />
            <Stat value={r.nofollow + r.sponsored + r.ugc} label="nofollow, sponsored, ugc" />
            <Stat value={`${r.broken} / ${r.checked}`} tone={r.broken ? 'fail' : undefined} label="Cassés / testés" />
          </div>
          <LinkList r={r} />
        </div>
      )}
    />
  );
}
