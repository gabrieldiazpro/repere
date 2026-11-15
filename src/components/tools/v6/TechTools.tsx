'use client';
/** Indexabilité, redirections, en-têtes HTTP, sitemap, hreflang : outils techniques « une adresse ». */
import type { CheckStatus, HeaderGroup, HeadersReport, HreflangReport, IndexReport, RedirectReport, SitemapReport, V6Check } from './types';
import { HttpCode, MiniTable, Stat, ToneIcon, UrlTool } from './ui';

/* ------------------------------------------------------------------ */
/* Indexabilité : les cinq portes                                      */
/* ------------------------------------------------------------------ */

const GATES: { ids: string[]; label: string }[] = [
  { ids: ['status'], label: 'Réponse HTTP' },
  { ids: ['redirect'], label: 'Redirection' },
  { ids: ['robots', 'robots.bing'], label: 'robots.txt' },
  { ids: ['meta-robots', 'x-robots', 'nofollow'], label: 'noindex' },
  { ids: ['canonical', 'type'], label: 'Canonical' },
];

function gateTone(checks: V6Check[], ids: string[]): CheckStatus {
  const cs = checks.filter((c) => ids.includes(c.id) && !c.informational);
  if (cs.some((c) => c.status === 'fail')) return 'fail';
  if (cs.some((c) => c.status === 'warn')) return 'warn';
  return 'ok';
}

const GATE_BG: Record<CheckStatus, string> = { ok: 'bg-success-bg text-success-ink', warn: 'bg-warning-bg text-warning-ink', fail: 'bg-danger-bg text-danger-ink' };

export function IndexTool({ example }: { example: IndexReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/indexabilite"
      example={example}
      exampleWhat="page de service d’une plomberie imaginaire, oubliée en noindex après la mise en ligne."
      label="Adresse de la page"
      submitLabel="Tester"
      steps={['Lecture de la page et des redirections…', 'Lecture du robots.txt…', 'Recherche de noindex et de la canonical…']}
      toolName="Indexabilité"
      bridgeText="L’analyse teste l’indexabilité de toutes vos pages et repère celles que Google ne peut pas afficher."
      render={(r) => (
        <ol className="rt-cascade grid gap-2 sm:grid-cols-5" aria-label="Les cinq conditions d’indexation">
          {GATES.map((g, i) => {
            const t = gateTone(r.checks, g.ids);
            const c = r.checks.find((x) => g.ids.includes(x.id));
            return (
              <li key={g.label} style={{ ['--i' as string]: i }} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 sm:flex-col sm:items-start ${GATE_BG[t]}`}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <ToneIcon tone={t} size={16} />
                  {g.label}
                </span>
                <span className="min-w-0 truncate text-xs opacity-90 sm:whitespace-normal">{c ? c.label : g.label === 'Redirection' ? 'Aucune' : '—'}</span>
              </li>
            );
          })}
        </ol>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Redirections                                                        */
/* ------------------------------------------------------------------ */

export function RedirectTool({ example }: { example: RedirectReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/redirections"
      example={example}
      exampleWhat="ancienne adresse d’une plomberie imaginaire, redirigée deux fois dont une en 302."
      label="Adresse à suivre"
      submitLabel="Suivre"
      steps={['Suivi de l’adresse saut par saut…', 'Test des variantes http, https, www…']}
      toolName="Redirections"
      titleOf={(r) => `Chaîne de redirection de ${r.url}`}
      bridgeText="L’analyse repère toutes les redirections et les liens cassés de votre site, et propose les corrections."
      render={(r) => (
        <div className="grid gap-5">
          <ol className="rt-cascade relative grid gap-2" aria-label="Chaîne de redirection">
            {[...r.chain, r.final].map((h, i, all) => (
              <li key={`${h.url}-${i}`} style={{ ['--i' as string]: i }} className="flex items-start gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-bg text-xs font-bold text-primary" aria-hidden>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-[0.85rem] text-ink">{h.url}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <HttpCode status={h.status} />
                    {i < all.length - 1 ? (h.status === 301 || h.status === 308 ? 'Redirection définitive' : 'Redirection temporaire') : r.loop ? 'Boucle : la chaîne revient sur ses pas' : r.error ? r.error : 'Page finale'}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {r.variants.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold text-ink">Les variantes de l’adresse</h3>
              <MiniTable
                label="Variantes de l’adresse"
                head={['Variante', 'Aboutit à', 'Statut']}
                rows={r.variants.map((v) => [
                  <span key="s" className="break-all font-mono text-[0.8rem]">{v.start}</span>,
                  <span key="f" className="break-all font-mono text-[0.8rem]">{v.error ? v.error : v.final}</span>,
                  <span key="c" className="inline-flex items-center gap-2">
                    <HttpCode status={v.error ? 0 : v.status} />
                    <span className="text-xs text-muted">{pl(v.hops)}</span>
                  </span>,
                ])}
              />
            </div>
          )}
        </div>
      )}
    />
  );
}
const pl = (n: number) => (n === 0 ? 'directe' : n === 1 ? '1 saut' : `${n} sauts`);

/* ------------------------------------------------------------------ */
/* En-têtes HTTP                                                       */
/* ------------------------------------------------------------------ */

const GROUP_LABEL: Record<HeaderGroup, string> = {
  indexation: 'Indexation',
  cache: 'Cache',
  securite: 'Sécurité',
  contenu: 'Contenu',
  serveur: 'Serveur et CDN',
  autre: 'Autres',
};

export function HeadersTool({ example }: { example: HeadersReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/en-tetes"
      example={example}
      exampleWhat="en-têtes d’un site vitrine imaginaire, sans compression ni protections de base."
      label="Adresse de la page"
      submitLabel="Lire les en-têtes"
      steps={['Connexion au serveur…', 'Lecture et classement des en-têtes…']}
      toolName="En-têtes HTTP"
      bridgeText="L’analyse vérifie aussi la vitesse, l’indexation et la lisibilité pour les IA de toutes vos pages."
      render={(r) => {
        const groups = [...new Set(r.headers.map((h) => h.group))];
        return (
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat value={<span className="inline-flex items-center gap-2"><HttpCode status={r.status} /></span>} label="Statut final" />
              <Stat value={r.headers.length} label="En-têtes reçus" />
              <Stat value={`${r.fetchMs} ms`} label="Réponse du serveur" />
            </div>
            {groups.map((g) => (
              <details key={g} className="rt-details overflow-hidden rounded-xl border border-line bg-white" open={g === 'indexation' || g === 'securite'}>
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2.5 font-semibold text-ink hover:bg-canvas focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary">
                  <span>
                    {GROUP_LABEL[g]} <span className="font-normal text-muted">({r.headers.filter((h) => h.group === g).length})</span>
                  </span>
                  <svg className="rt-chevron shrink-0 text-muted" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <dl className="rt-details-body divide-y divide-line border-t border-line text-sm">
                  {r.headers
                    .filter((h) => h.group === g)
                    .map((h) => (
                      <div key={h.name} className="grid gap-0.5 px-4 py-2 sm:grid-cols-[14rem_1fr] sm:gap-4">
                        <dt className="font-mono text-[0.8rem] font-semibold text-ink">{h.name}</dt>
                        <dd className="min-w-0 break-all font-mono text-[0.8rem] text-muted">{h.value}</dd>
                      </div>
                    ))}
                </dl>
              </details>
            ))}
          </div>
        );
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Sitemap                                                             */
/* ------------------------------------------------------------------ */

const SOURCE: Record<SitemapReport['source'], string> = { given: 'adresse fournie', robots: 'trouvé dans le robots.txt', default: 'adresse habituelle' };

export function SitemapTool({ example }: { example: SitemapReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/sitemap"
      example={example}
      exampleWhat="sitemap d’une boutique imaginaire, avec une page supprimée et une date dans le futur."
      label="Votre site ou l’adresse du sitemap"
      submitLabel="Valider"
      placeholder="votre-site.fr ou votre-site.fr/sitemap.xml"
      steps={['Recherche du sitemap (robots.txt, /sitemap.xml)…', 'Lecture et contrôle du fichier…', 'Test d’un échantillon d’adresses…']}
      toolName="Validateur de sitemap"
      titleOf={(r) => `Sitemap ${SOURCE[r.source]}`}
      bridgeText="L’analyse compare votre sitemap aux pages réellement liées et repère les pages oubliées ou en trop."
      render={(r) => (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={r.urlCount.toLocaleString('fr-FR')} label={r.kind === 'index' ? 'Adresses (3 premiers fichiers)' : 'Adresses déclarées'} />
            <Stat value={r.kind === 'index' ? r.children.length : r.lastmodCount.toLocaleString('fr-FR')} label={r.kind === 'index' ? 'Fichiers dans l’index' : 'Avec date lastmod'} />
            <Stat value={`${Math.max(1, Math.round(r.bytes / 1024)).toLocaleString('fr-FR')} Ko`} label={r.truncated ? 'Lus (fichier tronqué)' : 'Taille lue'} />
            <Stat value={r.declaredInRobots ? 'Oui' : 'Non'} tone={r.declaredInRobots ? undefined : 'warn'} label="Déclaré au robots.txt" />
          </div>
          {r.children.length > 0 && (
            <MiniTable
              label="Fichiers de l’index"
              head={['Fichier', 'Adresses']}
              rows={r.children.slice(0, 12).map((c) => [<span key="u" className="break-all font-mono text-[0.8rem]">{c.url}</span>, c.urlCount !== undefined ? c.urlCount.toLocaleString('fr-FR') : 'non ouvert'])}
            />
          )}
          {r.sample.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold text-ink">Échantillon testé ({r.sample.length} adresses)</h3>
              <MiniTable
                label="Adresses testées"
                head={['Adresse', 'Statut']}
                rows={r.sample.map((s) => [
                  <span key="u" className="break-all font-mono text-[0.8rem]">{s.url}{s.finalUrl ? ` → ${s.finalUrl}` : ''}</span>,
                  <span key="s" className="inline-flex items-center gap-2"><HttpCode status={s.status} />{s.error && <span className="text-xs text-muted">{s.error}</span>}</span>,
                ])}
              />
            </div>
          )}
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* hreflang                                                            */
/* ------------------------------------------------------------------ */

export function HreflangTool({ example }: { example: HreflangReport }) {
  return (
    <UrlTool
      endpoint="/outils/api/hreflang"
      example={example}
      exampleWhat="page d’une boutique imaginaire en français, belge et anglais, avec un code erroné et un retour manquant."
      label="Adresse d’une version de la page"
      submitLabel="Vérifier"
      steps={['Lecture des balises hreflang…', 'Ouverture des versions alternatives…', 'Vérification des liens de retour…']}
      toolName="hreflang"
      bridgeText="L’analyse contrôle les hreflang de toutes vos pages et la cohérence de vos versions linguistiques."
      render={(r) =>
        r.entries.length ? (
          <MiniTable
            label="Versions déclarées"
            head={['Code', 'Adresse', 'Code valide', 'Retour vers cette page']}
            rows={r.entries.map((e) => [
              <code key="c" className="rounded bg-canvas px-1.5 py-0.5 text-[0.85rem] font-semibold">{e.lang}</code>,
              <span key="h" className="break-all font-mono text-[0.8rem]">{e.href}</span>,
              <span key="v" className={`inline-flex items-center gap-1 text-sm ${e.valid ? 'text-success-ink' : 'text-danger-ink'}`} title={e.issue}>
                <ToneIcon tone={e.valid ? 'ok' : 'fail'} size={14} />
                {e.valid ? 'Oui' : e.issue ?? 'Non'}
              </span>,
              <span key="r" className={`inline-flex items-center gap-1 text-sm ${e.returnLink === false ? 'text-danger-ink' : e.returnLink ? 'text-success-ink' : 'text-muted'}`}>
                {e.returnLink !== null && <ToneIcon tone={e.returnLink ? 'ok' : 'fail'} size={14} />}
                {e.returnLink === null ? 'non vérifié' : e.returnLink ? 'Oui' : `Non${e.targetStatus && e.targetStatus >= 300 ? ` (${e.targetStatus})` : ''}`}
              </span>,
            ])}
          />
        ) : null
      }
    />
  );
}
