/**
 * Modèles de page structurés (mode sans IA, et squelette imposé à l'IA) : chaque phrase est soit une formule neutre
 * de structure, soit un FAIT de la fiche du client recopié tel quel. Ce qui manque devient « [à compléter : …] ».
 * Les réponses commencent par le fait (réponse directe, nom de l'entreprise : critères de citabilité GEO).
 */
import { FACT_LABEL, factLines, factValue } from './facts';
import { todo } from './markdown';
import type { FactKey, FactSheet, InternalLink, PageFormat, PageType, PublicSource } from './types';

export interface TemplateInput {
  pageType: PageType;
  format: PageFormat;
  name: string;
  city?: string;
  target: string;
  /** titre de travail de la proposition (comparatif, service, article) */
  title?: string;
  facts: FactSheet;
  sources: PublicSource[];
  links: InternalLink[];
  /** réécriture : paragraphes de la page actuelle, conservés en tête */
  existingText?: string;
  now: Date;
}

export interface TemplateOutput {
  title: string;
  body: string;
  factsUsed: FactKey[];
  missing: string[];
}

const monthYear = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

class Builder {
  parts: string[] = [];
  used = new Set<FactKey>();
  missing = new Set<string>();
  constructor(
    private f: FactSheet,
    private name: string,
  ) {}

  h2(t: string) {
    this.parts.push(`## ${t}`);
  }
  h3(t: string) {
    this.parts.push(`### ${t}`);
  }
  p(t: string) {
    this.parts.push(t);
  }
  /** fait sur une ligne, ou marqueur */
  fact(k: FactKey, render: (v: string) => string, required = true): boolean {
    const v = factValue(this.f, k);
    if (v) {
      this.used.add(k);
      this.parts.push(render(v.replace(/\s*\n\s*/g, ' ; ')));
      return true;
    }
    if (required) {
      const label = FACT_LABEL[k].label.toLowerCase();
      this.missing.add(FACT_LABEL[k].label);
      this.parts.push(render(todo(label)));
    }
    return false;
  }
  /** fait multi-lignes en liste */
  list(k: FactKey, required = true, hint?: string): boolean {
    const lines = factLines(this.f, k);
    if (lines.length) {
      this.used.add(k);
      this.parts.push(lines.map((l) => `- ${l}`).join('\n'));
      return true;
    }
    if (required) {
      this.missing.add(FACT_LABEL[k].label);
      this.parts.push(`- ${todo(hint ?? `${FACT_LABEL[k].label.toLowerCase()}, un par ligne`)}`);
    }
    return false;
  }
  has(k: FactKey) {
    return !!factValue(this.f, k);
  }
  qa(question: string, k: FactKey, answer: (v: string) => string, required = false) {
    if (!this.has(k) && !required) return;
    this.h3(question);
    this.fact(k, answer, true);
  }
  get text() {
    return this.parts.join('\n\n');
  }
  get nameStr() {
    return this.name;
  }
}

function contactBlock(b: Builder, required: boolean) {
  const any = (['telephone', 'email', 'adresse'] as FactKey[]).some((k) => b.has(k));
  if (!any && !required) return;
  b.h2(`Contacter ${b.nameStr}`);
  if (!any) {
    b.fact('telephone', (v) => `Téléphone : ${v}.`);
    return;
  }
  if (b.has('telephone')) b.fact('telephone', (v) => `Téléphone : ${v}.`);
  if (b.has('email')) b.fact('email', (v) => `E-mail : ${v}.`);
  if (b.has('adresse')) b.fact('adresse', (v) => `Adresse : ${v}.`);
  if (b.has('horaires')) b.fact('horaires', (v) => `Horaires : ${v}.`, false);
}

function linksBlock(b: Builder, links: InternalLink[]) {
  const from = links.filter((l) => l.direction === 'depuis_brouillon').slice(0, 4);
  if (!from.length) return;
  b.h2('À lire aussi');
  b.p(from.map((l) => `- [${l.anchor}](${l.url})`).join('\n'));
}

function sourcesBlock(b: Builder, sources: PublicSource[], now: Date) {
  b.h2('Sources');
  const lines = [`- Informations fournies par ${b.nameStr}, à jour en ${monthYear(now)}.`];
  for (const s of sources) lines.push(`- [${s.n}] [${s.title}](${s.url}) — ${s.note}`);
  b.p(lines.join('\n'));
}

export function buildTemplate(i: TemplateInput): TemplateOutput {
  const b = new Builder(i.facts, i.name);
  const where = i.city ? ` à ${i.city}` : '';
  let title = i.target;

  if (i.existingText) {
    // Réécriture : le texte actuel est conservé, les sections manquantes sont ajoutées à partir des faits.
    for (const para of i.existingText.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).slice(0, 12)) b.p(para);
  }

  switch (i.pageType) {
    case 'tarifs': {
      title = `Tarifs de ${i.name}${where}`;
      if (!i.existingText) b.p(`Cette page présente les tarifs pratiqués par ${i.name}${where}, tels qu’indiqués par l’entreprise en ${monthYear(i.now)}.`);
      b.h2('Nos tarifs');
      b.list('prix', true, 'vos tarifs réels, un par ligne, avec ce qui est compris (TVA, déplacement…)');
      b.h2('Ce qui est concerné');
      b.list('services');
      b.h2('Délais');
      b.fact('delais', (v) => `Délais annoncés par ${i.name} : ${v}.`);
      b.h2('Moyens de paiement');
      b.fact('paiement', (v) => `${i.name} accepte : ${v}.`);
      if (b.has('garanties')) {
        b.h2('Garanties');
        b.fact('garanties', (v) => v.endsWith('.') ? v : `${v}.`);
      }
      contactBlock(b, false);
      break;
    }
    case 'faq': {
      title = `Questions fréquentes — ${i.name}`;
      if (!i.existingText) b.p(`Les réponses ci-dessous sont celles de ${i.name}${where} aux questions les plus posées par ses clients.`);
      b.qa('Quels services proposez-vous ?', 'services', (v) => `${i.name} propose : ${v}.`, true);
      b.qa('Où intervenez-vous ?', 'zone', (v) => `${i.name} intervient ou livre : ${v}.`, true);
      b.qa('Quels sont vos horaires ?', 'horaires', (v) => `Horaires de ${i.name} : ${v}.`, true);
      b.qa('Combien cela coûte-t-il ?', 'prix', (v) => `Tarifs indiqués par ${i.name} : ${v}.`, true);
      b.qa('Quels sont vos délais ?', 'delais', (v) => `Délais annoncés par ${i.name} : ${v}.`, true);
      b.qa('Quelles garanties offrez-vous ?', 'garanties', (v) => `${i.name} indique les garanties suivantes : ${v}.`, true);
      b.qa('Comment payer ?', 'paiement', (v) => `Moyens de paiement acceptés : ${v}.`);
      b.qa('Quels sont les délais et frais de livraison ?', 'livraison', (v) => `Livraison : ${v}.`);
      b.qa('Comment retourner un produit ?', 'retours', (v) => `Retours : ${v}.`);
      b.qa('Avez-vous des labels ou certifications ?', 'certifications', (v) => `${i.name} détient : ${v}.`);
      contactBlock(b, false);
      break;
    }
    case 'zone': {
      title = i.city ? `${i.name} : zone d’intervention autour de ${i.city}` : `Zone d’intervention de ${i.name}`;
      b.fact('zone', (v) => `${i.name} intervient : ${v}.`);
      b.h2('Ce que nous faisons sur place');
      b.list('services');
      b.h2('Délais d’intervention');
      b.fact('delais', (v) => `Délais annoncés par ${i.name} : ${v}.`);
      if (b.has('horaires')) {
        b.h2('Horaires');
        b.fact('horaires', (v) => `Horaires : ${v}.`);
      }
      contactBlock(b, true);
      break;
    }
    case 'comparatif': {
      title = i.title ?? (/^comment choisir/i.test(i.target) ? i.target : `Comment choisir : ${i.target.replace(/\?+$/, '')}`);
      b.p(`Cette page aide à comparer les solutions sur des critères vérifiables. ${i.name} ne cite pas d’autre entreprise sans source publique vérifiable.`);
      b.h2('Les critères à comparer');
      b.p(['- Le prix total et ce qu’il comprend', '- Les délais', '- Les garanties écrites', '- La zone ou les conditions de service'].join('\n'));
      b.h2(`Ce que propose ${i.name}`);
      b.list('services');
      b.fact('prix', (v) => `Tarifs : ${v}.`);
      b.fact('garanties', (v) => `Garanties : ${v}.`);
      b.fact('difference', (v) => `Ce qui distingue ${i.name}, selon l’entreprise : ${v}`);
      b.h2('Les autres solutions');
      b.p(todo('points de comparaison vérifiables avec les autres solutions, chacun avec sa source publique'));
      b.missing.add('Comparaison sourcée');
      break;
    }
    case 'a-propos': {
      title = `À propos de ${i.name}`;
      b.fact('activite', (v) => `${i.name} : ${v.charAt(0).toLowerCase()}${v.slice(1)}${where && !v.includes(i.city ?? '§') ? `, ${where.trim()}` : ''}.`);
      b.h2('Notre histoire');
      b.fact('histoire', (v) => v);
      if (b.has('creation')) b.fact('creation', (v) => `Création : ${v}.`);
      b.h2('L’équipe');
      b.fact('dirigeant', (v) => `Direction : ${v}.`, false);
      b.fact('equipe', (v) => `Équipe : ${v}.`);
      if (b.has('certifications')) {
        b.h2('Labels et certifications');
        b.fact('certifications', (v) => `${i.name} détient : ${v}.`);
      }
      if (b.has('difference')) {
        b.h2('Ce qui nous distingue');
        b.fact('difference', (v) => v);
      }
      if (b.has('avis')) {
        b.h2('Avis clients');
        b.fact('avis', (v) => `Avis : ${v}.`);
      }
      contactBlock(b, false);
      break;
    }
    case 'garanties': {
      title = `Garanties de ${i.name}`;
      b.fact('garanties', (v) => `${i.name} indique les garanties suivantes : ${v}.`);
      if (b.has('certifications')) {
        b.h2('Labels et certifications');
        b.fact('certifications', (v) => v);
      }
      if (b.has('retours')) {
        b.h2('Retours et remboursements');
        b.fact('retours', (v) => v);
      }
      if (b.has('livraison')) {
        b.h2('Livraison');
        b.fact('livraison', (v) => v);
      }
      contactBlock(b, false);
      break;
    }
    case 'contact': {
      title = `Contacter ${i.name}`;
      b.fact('telephone', (v) => `Téléphone : ${v}.`);
      b.fact('adresse', (v) => `Adresse : ${v}.`);
      b.fact('email', (v) => `E-mail : ${v}.`, false);
      b.fact('horaires', (v) => `Horaires : ${v}.`);
      if (b.has('zone')) b.fact('zone', (v) => `Zone d’intervention : ${v}.`);
      break;
    }
    case 'article': {
      title = i.title ?? i.target.trim().replace(/\s*\?+$/, ' ?');
      b.h2('La réponse courte');
      b.p(todo('votre réponse en deux phrases, avec un chiffre, un délai ou une condition précise'));
      b.h2('En détail');
      b.p(todo('les explications que vous donnez à vos clients, étape par étape'));
      b.missing.add('Réponse de l’expert');
      b.h2(`Ce que propose ${i.name}`);
      b.list('services');
      if (b.has('zone')) b.fact('zone', (v) => `Zone : ${v}.`);
      break;
    }
    default: {
      title = i.title ?? i.target.charAt(0).toUpperCase() + i.target.slice(1).replace(/\?+$/, '');
      b.fact('activite', (v) => `${i.name} : ${v.charAt(0).toLowerCase()}${v.slice(1)}${where ? `, ${where.trim()}` : ''}.`);
      b.h2('Ce qui est compris');
      b.list('services');
      b.h2('Tarifs');
      b.fact('prix', (v) => `Tarifs indiqués par ${i.name} : ${v}.`);
      b.h2('Délais');
      b.fact('delais', (v) => `Délais annoncés : ${v}.`);
      b.h2('Zone');
      b.fact('zone', (v) => `${i.name} intervient : ${v}.`);
      if (b.has('garanties')) {
        b.h2('Garanties');
        b.fact('garanties', (v) => v);
      }
      contactBlock(b, false);
    }
  }
  linksBlock(b, i.links);
  sourcesBlock(b, i.sources, i.now);
  return { title: title.slice(0, 120), body: b.text, factsUsed: [...b.used], missing: [...b.missing] };
}
