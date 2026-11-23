/**
 * Encart « Faits vérifiés » à poser sur le site du client, en trois formes au choix :
 * - script léger (/encart/<slug>/e.js) : aucune dépendance, aucun cookie, aucun stockage, aucune requête de plus, aucun
 *   traceur ; rendu dans un Shadow DOM (n'hérite pas des styles du site) ; injecte le JSON-LD si le client l'a activé ;
 * - cadre (iframe /encart/<slug>) : HTML statique servi par Repéré ;
 * - HTML statique à copier (le plus lisible par les robots, JSON-LD inclus si souhaité).
 * Budget : < 5 Ko pour le script, données comprises (vérifié par les tests).
 * + export pour l'agent de publication : blocs « À propos » et « Contact » (Markdown et HTML) et JSON-LD.
 */
import { credentialLine, priceLabel, type PublicFiche } from './model';
import { exceptionLine, frDate, verificationLine } from './markdown';
import { escapeHtml } from '../util';
import { FICHE_FIELDS } from './model';

export const EMBED_MAX_BYTES = 5 * 1024;

export interface EmbedData {
  /** nom */
  n: string;
  /** lien vers la fiche officielle */
  u: string;
  /** horaires */
  h?: string;
  /** prochaines fermetures ou horaires exceptionnels (2 au plus) */
  x?: string[];
  /** services clés (4 au plus) : nom et prix « à partir de » */
  s?: [string, string][];
  /** téléphone */
  t?: string;
  /** ligne de vérification */
  v: string;
  /** démo */
  d?: 1;
}

export function embedData(f: PublicFiche, name: string, pageUrl: string): EmbedData {
  const d: EmbedData = { n: (f.text.nom || name).slice(0, 80), u: pageUrl, v: f.confirmedAt ? `Vérifié par l’entreprise le ${frDate(f.confirmedAt)}` : verificationLine(f).replace(/\.$/, '') };
  if (f.text.horaires) d.h = f.text.horaires.slice(0, 160);
  if (f.exceptions.length) d.x = f.exceptions.slice(0, 2).map((e) => exceptionLine(e).slice(0, 90));
  if (f.services.length) d.s = f.services.slice(0, 4).map((s) => [s.name.slice(0, 60), priceLabel(s)]);
  if (f.text.telephone) d.t = f.text.telephone;
  if (f.demo) d.d = 1;
  return d;
}

/** JSON sûr dans un <script> : « < », U+2028 et U+2029 échappés. */
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/**
 * Script de l'encart. Uniquement textContent (jamais innerHTML avec des données), aucune requête réseau, aucun accès
 * à document.cookie ni au stockage. Placement : dans <div data-repere-fiche> s'il existe, sinon juste avant le script.
 */
export function embedScript(data: EmbedData, jsonld: Record<string, unknown> | null): string {
  const css =
    ':host{all:initial;display:block}' +
    '.b{font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1f2e;background:#fff;border:1px solid #d5d9e4;border-radius:12px;padding:14px 16px;max-width:420px}' +
    '.k{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:.04em}' +
    '.n{font-size:16px;font-weight:700;margin:4px 0 8px}.r{margin:4px 0}.m{color:#5a6275;font-size:12.5px}' +
    'ul{margin:6px 0;padding-left:18px}a{color:#3730a3}' +
    '@media(prefers-color-scheme:dark){.b{background:#151826;color:#e7e9f2;border-color:#2c3147}.k{color:#86efac}.m{color:#a4abc0}a{color:#a5b4fc}}';
  return `(function(){var D=${safeJson(data)},L=${jsonld ? safeJson(jsonld) : 'null'},s=document.currentScript,d=document;
function e(t,c,x){var n=d.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n}
var h=d.querySelector('[data-repere-fiche]')||e('div');if(!h.parentNode&&s&&s.parentNode)s.parentNode.insertBefore(h,s);
var r=h.attachShadow?h.attachShadow({mode:'open'}):h,st=e('style',0,${safeJson(css)});r.appendChild(st);
var b=e('section','b');b.setAttribute('aria-label','Faits vérifiés : '+D.n);
b.appendChild(e('div','k','\\u2713 Faits vérifiés'+(D.d?' · démo':'')));b.appendChild(e('div','n',D.n));
if(D.h)b.appendChild(e('p','r','Horaires : '+D.h));
(D.x||[]).forEach(function(x){b.appendChild(e('p','r',x))});
if(D.s){var u=e('ul');D.s.forEach(function(x){u.appendChild(e('li',0,x[0]+(x[1]?' : '+x[1]:'')))});b.appendChild(u)}
if(D.t){var p=e('p','r','Téléphone : '),a=e('a',0,D.t);a.href='tel:'+D.t.replace(/[^\\d+]/g,'');p.appendChild(a);b.appendChild(p)}
var f=e('p','m',D.v+' · '),l=e('a',0,'Fiche officielle');l.href=D.u;l.rel='noopener';f.appendChild(l);b.appendChild(f);r.appendChild(b);
if(L&&!d.querySelector('script[data-repere-jsonld]')){var j=e('script',0,JSON.stringify(L));j.type='application/ld+json';j.setAttribute('data-repere-jsonld','');d.head.appendChild(j)}})();\n`;
}

const STYLE = {
  box: 'font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1f2e;background:#fff;border:1px solid #d5d9e4;border-radius:12px;padding:14px 16px;max-width:420px',
  kicker: 'font-size:12px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:.04em;margin:0',
  name: 'font-size:16px;font-weight:700;margin:4px 0 8px',
  row: 'margin:4px 0',
  muted: 'color:#5a6275;font-size:12.5px;margin:8px 0 0',
};

/** Bloc HTML de l'encart (sans script) : sert au cadre et au code statique à copier. */
export function embedHtml(data: EmbedData): string {
  const e = escapeHtml;
  const rows: string[] = [];
  if (data.h) rows.push(`<p style="${STYLE.row}">Horaires : ${e(data.h)}</p>`);
  for (const x of data.x ?? []) rows.push(`<p style="${STYLE.row}">${e(x)}</p>`);
  if (data.s?.length) rows.push(`<ul style="margin:6px 0;padding-left:18px">${data.s.map(([n, p]) => `<li>${e(n)}${p ? ` : ${e(p)}` : ''}</li>`).join('')}</ul>`);
  if (data.t) rows.push(`<p style="${STYLE.row}">Téléphone : <a href="tel:${e(data.t.replace(/[^\d+]/g, ''))}" style="color:#3730a3">${e(data.t)}</a></p>`);
  return [
    `<section aria-label="Faits vérifiés : ${e(data.n)}" style="${STYLE.box}">`,
    `<p style="${STYLE.kicker}">✓ Faits vérifiés${data.d ? ' · démo' : ''}</p>`,
    `<p style="${STYLE.name}">${e(data.n)}</p>`,
    ...rows,
    `<p style="${STYLE.muted}">${e(data.v)} · <a href="${e(data.u)}" rel="noopener" style="color:#3730a3">Fiche officielle</a></p>`,
    '</section>',
  ].join('\n');
}

/** Code statique à copier (HTML + JSON-LD facultatif). */
export function embedStaticSnippet(data: EmbedData, jsonld: Record<string, unknown> | null): string {
  const ld = jsonld ? `\n<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2).replace(/</g, '\\u003c')}\n</script>` : '';
  return `<!-- Faits vérifiés : ${data.n.replace(/--/g, '-')} (fiche officielle Repéré) -->\n${embedHtml(data)}${ld}\n`;
}

export function embedScriptSnippet(scriptUrl: string): string {
  return `<div data-repere-fiche></div>\n<script src="${escapeHtml(scriptUrl)}" async></script>`;
}

export function embedIframeSnippet(frameUrl: string, name: string): string {
  return `<iframe src="${escapeHtml(frameUrl)}" title="Faits vérifiés : ${escapeHtml(name)}" loading="lazy" style="border:0;width:100%;max-width:440px;height:300px"></iframe>`;
}

/** Page complète du cadre (iframe) : HTML statique, sans aucun script. */
export function embedFramePage(data: EmbedData): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Faits vérifiés : ${escapeHtml(data.n)}</title><style>html,body{margin:0;padding:0;background:transparent}@media(prefers-color-scheme:dark){section{background:#151826!important;color:#e7e9f2!important;border-color:#2c3147!important}a{color:#a5b4fc!important}}</style><base target="_blank"></head><body>${embedHtml(data)}</body></html>`;
}

// ---------------------------------------------------------------------------
// Export pour l'agent de publication (pages « À propos » et « Contact »)
// ---------------------------------------------------------------------------
export interface PublicationBlock {
  title: string;
  markdown: string;
  html: string;
}
export interface PublicationExport {
  about: PublicationBlock;
  contact: PublicationBlock;
  /** JSON-LD à placer dans le <head> (null pour un compte démo) */
  jsonld: Record<string, unknown> | null;
  pageUrl: string;
  confirmedAt: string | null;
}

export function publicationExport(f: PublicFiche, name: string, pageUrl: string, jsonld: Record<string, unknown> | null): PublicationExport {
  const t = f.text;
  const nom = t.nom || name;
  const e = escapeHtml;
  const md: string[] = [];
  const html: string[] = [];
  const para = (s: string | undefined) => {
    if (!s) return;
    md.push(s, '');
    html.push(`<p>${e(s)}</p>`);
  };
  const h2 = (s: string) => {
    md.push(`## ${s}`, '');
    html.push(`<h2>${e(s)}</h2>`);
  };
  para(t.activite);
  para(t.histoire);
  if (t.difference) {
    h2('Ce qui nous distingue');
    para(t.difference);
  }
  if (f.services.length) {
    h2(f.services.some((s) => typeof s.priceFrom === 'number') ? 'Nos services et prix' : 'Nos services');
    md.push(...f.services.map((s) => `- ${s.name}${priceLabel(s) ? ` : ${priceLabel(s)}` : ''}`), '');
    html.push(`<ul>${f.services.map((s) => `<li>${e(s.name)}${priceLabel(s) ? ` : ${e(priceLabel(s))}` : ''}</li>`).join('')}</ul>`);
  }
  if (t.garanties) {
    h2('Garanties');
    para(t.garanties);
  }
  if (f.certifications.length) {
    h2('Labels et certifications');
    md.push(...f.certifications.map((c) => `- ${credentialLine(c)}${c.verifyUrl ? ` ([vérifier](${c.verifyUrl}))` : ''}`), '');
    html.push(`<ul>${f.certifications.map((c) => `<li>${e(credentialLine(c))}${c.verifyUrl ? ` (<a href="${e(c.verifyUrl)}" rel="noopener">vérifier</a>)` : ''}</li>`).join('')}</ul>`);
  }
  const facts: [string, string | undefined][] = [
    ['creation', t.creation],
    ['dirigeant', t.dirigeant],
    ['equipe', t.equipe],
  ];
  const known = facts.filter(([, v]) => v);
  if (known.length) {
    h2('En bref');
    md.push(...known.map(([k, v]) => `- ${FICHE_FIELDS[k as 'creation'].label} : ${v}`), '');
    html.push(`<ul>${known.map(([k, v]) => `<li>${e(FICHE_FIELDS[k as 'creation'].label)} : ${e(v!)}</li>`).join('')}</ul>`);
  }
  const source = `Informations vérifiées : [fiche officielle de ${nom}](${pageUrl}).`;
  md.push(source);
  html.push(`<p>Informations vérifiées : <a href="${e(pageUrl)}">fiche officielle de ${e(nom)}</a>.</p>`);
  const about = { title: `À propos de ${nom}`, markdown: md.join('\n').trim() + '\n', html: html.join('\n') };

  const cmd: string[] = [];
  const chtml: string[] = [];
  const row = (label: string, v: string | undefined, href?: string) => {
    if (!v) return;
    cmd.push(`- **${label}** : ${href ? `[${v}](${href})` : v}`);
    chtml.push(`<li><strong>${e(label)}</strong> : ${href ? `<a href="${e(href)}">${e(v)}</a>` : e(v)}</li>`);
  };
  row('Téléphone', t.telephone, t.telephone ? `tel:${t.telephone.replace(/[^\d+]/g, '')}` : undefined);
  row('E-mail', t.email, t.email ? `mailto:${t.email}` : undefined);
  row('Adresse', t.adresse);
  row('Zone', t.zone);
  row('Horaires', t.horaires);
  for (const x of f.exceptions) row('Horaires exceptionnels', exceptionLine(x));
  row('Moyens de paiement', t.paiement);
  row('Langues parlées', t.langues);
  for (const u of f.sameAs) row('Profil officiel', u.replace(/^https:\/\/(www\.)?/, ''), u);
  const contact = {
    title: `Contacter ${nom}`,
    markdown: `${cmd.join('\n')}\n\n${verificationLine(f)} [Fiche officielle](${pageUrl}).\n`,
    html: `<ul>${chtml.join('')}</ul>\n<p>${e(verificationLine(f))} <a href="${e(pageUrl)}">Fiche officielle</a>.</p>`,
  };
  return { about, contact, jsonld, pageUrl, confirmedAt: f.confirmedAt };
}
