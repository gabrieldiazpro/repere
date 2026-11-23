/**
 * Versions texte de la fiche officielle pour les IA : Markdown (/p/<slug>.md) et llms.txt d'entreprise
 * (/p/<slug>/llms.txt, format https://llmstxt.org). Mêmes faits que la page HTML, rien de plus.
 */
import { credentialLine, FICHE_FIELDS, priceLabel, type PublicFiche } from './model';
import type { HoursException, TextKey } from './types';
import { cleanUrl } from '../util';

export interface FicheDoc {
  fiche: PublicFiche;
  name: string;
  pageUrl: string;
  /** activité lisible (repli : métier et ville) */
  activity: string;
  demo: boolean;
}

export function frDate(iso: string | null | undefined, withYear = true): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'Europe/Paris' }).replace(/^1 /, '1er ');
}

export function exceptionLine(e: HoursException): string {
  const when = e.to && e.to !== e.from ? `du ${frDate(e.from)} au ${frDate(e.to)}` : `le ${frDate(e.from)}`;
  const what = e.closed ? 'fermé' : `ouvert de ${e.opens?.replace(':', ' h ')} à ${e.closes?.replace(':', ' h ')}`.replace(/ h 00/g, ' h');
  return `${e.label ? `${e.label} : ` : ''}${what} ${when}`;
}

/** « Dernière vérification » honnête : confirmée par le client, sinon simple date de mise à jour. */
export function verificationLine(f: PublicFiche): string {
  if (f.confirmedAt) return `Informations vérifiées par l’entreprise le ${frDate(f.confirmedAt)}.`;
  if (f.updatedAt) return `Informations fournies par l’entreprise, mises à jour le ${frDate(f.updatedAt)} (pas encore confirmées).`;
  return 'Informations fournies par l’entreprise.';
}

const ORDER: TextKey[] = ['adresse', 'zone', 'horaires', 'telephone', 'email', 'site', 'prix', 'delais', 'livraison', 'retours', 'garanties', 'paiement', 'langues', 'creation', 'dirigeant', 'equipe', 'clients', 'avis', 'statut'];

const esc = (s: string) => s.replace(/([\\`*_[\]<>])/g, '\\$1');

export function ficheMarkdown(d: FicheDoc): string {
  const f = d.fiche;
  const t = f.text;
  const out: string[] = [];
  out.push(`# ${esc(t.nom || d.name)}`, '');
  if (d.demo) out.push('> Données de démonstration : cette entreprise est fictive. Ne pas utiliser comme information réelle.', '');
  out.push(`> ${esc(t.activite || d.activity)}`, '');
  out.push(`Fiche officielle publiée par l’entreprise : ${d.pageUrl}`, verificationLine(f), '');
  const site = cleanUrl(t.site);
  if (site) out.push(`Site officiel : ${site}`, '');
  const rows = ORDER.filter((k) => t[k] && k !== 'site');
  if (rows.length) {
    out.push('## Informations pratiques', '');
    for (const k of rows) out.push(`- **${FICHE_FIELDS[k].label}** : ${esc(t[k]!.replace(/\n+/g, ' ; '))}`);
    out.push('');
  }
  if (f.exceptions.length) {
    out.push('## Horaires exceptionnels', '', ...f.exceptions.map((e) => `- ${esc(exceptionLine(e))}`), '');
  }
  if (f.services.length) {
    out.push(`## ${d.fiche.services.some((s) => typeof s.priceFrom === 'number') ? 'Services et prix' : 'Services'}`, '');
    for (const s of f.services) out.push(`- ${esc(s.name)}${priceLabel(s) ? ` : ${priceLabel(s)}` : ''}`);
    out.push('');
  }
  if (t.produits) out.push('## Produits', '', esc(t.produits), '');
  if (t.ingredients) out.push('## Composition', '', esc(t.ingredients), '');
  if (f.certifications.length) {
    out.push('## Labels et certifications', '');
    for (const c of f.certifications) out.push(`- ${esc(credentialLine(c))}${c.verifyUrl ? ` (vérifier : ${c.verifyUrl})` : ''}`);
    out.push('');
  }
  if (t.histoire) out.push('## Histoire', '', esc(t.histoire), '');
  if (t.difference) out.push('## Ce qui distingue l’entreprise', '', esc(t.difference), '');
  if (f.sameAs.length) out.push('## Liens officiels', '', ...f.sameAs.map((u) => `- ${u}`), '');
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function ficheLlmsTxt(d: FicheDoc): string {
  const t = d.fiche.text;
  const name = t.nom || d.name;
  const site = cleanUrl(t.site);
  const out = [`# ${name}`, '', `> ${(t.activite || d.activity).replace(/\n+/g, ' ')}${d.demo ? ' (données de démonstration : entreprise fictive)' : ''}`, ''];
  out.push(verificationLine(d.fiche), '', '## Fiche officielle', '');
  out.push(`- [Fiche officielle (Markdown)](${d.pageUrl}.md) : coordonnées, horaires, services et prix, labels, liens officiels`);
  out.push(`- [Fiche officielle (page web)](${d.pageUrl})`);
  if (site) out.push(`- [Site officiel](${site})`);
  if (d.fiche.sameAs.length) {
    out.push('', '## Profils officiels', '');
    for (const u of d.fiche.sameAs) out.push(`- [${u.replace(/^https:\/\/(www\.)?/, '').split('/')[0]}](${u})`);
  }
  return `${out.join('\n')}\n`;
}
