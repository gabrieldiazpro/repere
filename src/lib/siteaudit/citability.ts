/**
 * Citabilité d'une page, par règles (sans IA) : la page contient-elle des passages qu'une IA peut reprendre ?
 * C'est une liste de bonnes pratiques, pas une mesure de ce que fait ChatGPT (l'audit Repéré mesure le réel).
 * Mode facultatif « avec IA » : réécriture du paragraphe d'ouverture (comptes connectés, clé présente).
 */
import { complete, llmAvailable, SYSTEM_FR } from '@/lib/execution/llm';
import { safeFetch, type SafeFetchOptions } from './fetch';
import { absUrl, parseHtml, sameSite, sentences, wordCount, type Block, type ParsedPage } from './html';
import { allNodes, typesOf, validateBlocks } from './jsonld';
import { finalize, mkCheck } from './readiness';
import type { Check, CitabilityReport, CitableExtract, RewriteSuggestion } from './types';

export const CITABILITY_DISCLAIMER =
  'Liste de bonnes pratiques de rédaction, pas une mesure de ce que font les IA : une page peut cocher toutes les cases sans être citée. L’audit Repéré mesure les réponses réelles.';

export const CITABILITY_WEIGHTS: Record<string, number> = {
  direct_answer: 10,
  question_headings: 6,
  heading_structure: 5,
  short_paragraphs: 5,
  lists: 4,
  tables: 4,
  numbers: 5,
  sourced: 6,
  date: 6,
  author: 6,
  definitions: 4,
  faq: 6,
  length: 6,
  internal_links: 4,
  entities: 4,
  contact: 4,
  jsonld: 4,
  readable_no_js: 4,
  title_match: 4,
  canonical: 3,
};

const QUESTION_START = /^(comment|pourquoi|quel(le)?s?|combien|qu['’]est-ce|que |quand|où|ou trouver|faut-il|peut-on|est-ce|dois-je|qui |à quoi|a quoi|how|what|why|when|where|which|can |is |do |does )/i;
const isQuestion = (s: string) => /\?\s*$/.test(s) || QUESTION_START.test(s.trim());
const FLUFF_START = /^(bienvenue|découvrez|decouvrez|vous cherchez|vous recherchez|depuis toujours|n['’]hésitez|nous sommes heureux|chez nous|lorem ipsum)/i;
const PRONOUN_START = /^(il|elle|ils|elles|cela|ceci|ça|ce|cette|ces|celui-ci|celle-ci|on)\b/i;
const NUMBER_FACT = /\b\d[\d\s.,]*\s?(%|€|euros?|eur\b|km|m²|m2|kg|g\b|ans?\b|mois\b|jours?\b|heures?\b|h\b|min\b|clients?|personnes|avis|étoiles|°|cm|mm|l\b|litres?)|\b(19|20)\d{2}\b|\b\d+[.,]\d+\b/gi;
const MONTHS = 'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre';
const DATE_RE = new RegExp(`\\b\\d{1,2}(er)?\\s+(${MONTHS})\\s+(19|20)\\d{2}\\b|\\b\\d{1,2}/\\d{1,2}/(19|20)\\d{2}\\b|\\b(19|20)\\d{2}-\\d{2}-\\d{2}\\b|\\b(${MONTHS})\\s+(19|20)\\d{2}\\b`, 'i');
const UPDATED_RE = /(mis à jour|mise à jour|actualisé|publié|updated|published)\s*(le|:)?/i;
const DEFINITION_RE = /^[A-ZÀ-Ý«“"][^.?!]{2,80}?\s(est|sont|désigne|désignent|signifie|correspond à|consiste à|se définit comme)\s(un|une|le|la|les|l['’]|des|du|de)\b/;
const SOCIAL = /(facebook|instagram|twitter|x\.com|linkedin|youtube|tiktok|pinterest|whatsapp|google\.[a-z.]+\/maps|goo\.gl|wa\.me)/i;
const PHONE_RE = /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/;
const POSTCODE_RE = /\b\d{5}\s+[A-ZÀ-Ý][\p{L}' -]{2,}/u;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;

const STOP = new Set('le la les un une des de du d et à a au aux en pour par sur dans avec sans ou où que qui quoi est sont votre vos nos notre mon ma mes ce cet cette ces se sa son ses l plus très comment pourquoi quel quelle quels quelles combien'.split(' '));
function keywords(s: string): string[] {
  return [...new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)))];
}
function overlap(a: string, b: string): number {
  const ka = keywords(a);
  if (!ka.length) return 0;
  const kb = new Set(keywords(b));
  return ka.filter((w) => kb.has(w)).length / ka.length;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export interface CitabilityOptions {
  url?: string | null;
  /** Question visée (ex. « plombier chauffagiste Lyon 3 »). */
  question?: string;
}

function firstParagraph(blocks: Block[]): Block | null {
  return blocks.find((b) => (b.tag === 'p' || b.tag === 'dd' || b.tag === 'blockquote') && wordCount(b.text) >= 12) ?? null;
}

/** Contrôles de citabilité (purs). */
export function citabilityChecks(page: ParsedPage, opts: CitabilityOptions = {}): { checks: Check[]; extracts: CitableExtract[]; suggestions: RewriteSuggestion[] } {
  const W = CITABILITY_WEIGHTS;
  const checks: Check[] = [];
  const suggestions: RewriteSuggestion[] = [];
  const main = page.mainText;
  const words = wordCount(main);
  const paragraphs = page.blocks.filter((b) => b.tag === 'p');
  const pWords = paragraphs.map((p) => wordCount(p.text)).filter((n) => n > 0);
  const h2h3 = page.headings.filter((h) => h.level === 2 || h.level === 3);
  const h1 = page.headings.find((h) => h.level === 1)?.text ?? '';
  const subject = page.og['og:site_name'] || h1 || page.title.split(/[|–—-]/)[0].trim();
  const nodes = page.jsonLdRaw.flatMap((r) => {
    try {
      return allNodes(JSON.parse(r));
    } catch {
      return [];
    }
  });
  const ldTypes = nodes.flatMap(typesOf);
  const base = opts.url ?? 'https://exemple.invalid/';

  // 1. Réponse directe en tête
  const fp = firstParagraph(page.blocks);
  const first100 = main.split(/\s+/).slice(0, 100).join(' ');
  const fpWords = fp ? wordCount(fp.text) : 0;
  const fpFirst = fp ? (sentences(fp.text)[0] ?? fp.text) : '';
  const questionOk = opts.question ? overlap(opts.question, first100) >= 0.5 : true;
  let daStatus: Check['status'] = 'ok';
  let daDetail = '';
  if (!fp) {
    daStatus = 'fail';
    daDetail = 'Aucun paragraphe d’ouverture trouvé dans le contenu principal.';
  } else if (FLUFF_START.test(fp.text) || fpWords > 90 || !questionOk) {
    daStatus = 'warn';
    daDetail = FLUFF_START.test(fp.text)
      ? `Le premier paragraphe commence par une formule d’accueil (« ${clip(fp.text, 80)} ») au lieu d’une réponse.`
      : fpWords > 90
        ? `Premier paragraphe long (${fpWords} mots) : la réponse est noyée.`
        : `Les mots de la question visée (« ${opts.question} ») sont absents des 100 premiers mots.`;
  } else {
    daDetail = `Ouverture de ${fpWords} mots : « ${clip(fpFirst, 140)} »`;
  }
  checks.push(mkCheck('direct_answer', 'Réponse directe en tête', daStatus, daDetail, 'Ouvrez par une phrase qui répond seule à la question principale (qui, quoi, où, combien), en moins de 60 mots.', W.direct_answer, { task: 'content' }));
  if (daStatus !== 'ok' && fp) {
    suggestions.push({
      rule: 'direct_answer',
      before: clip(fp.text, 300),
      after: `${subject ? `${subject} : ` : ''}[réponse en une phrase à « ${opts.question || h1 || 'la question principale'} », avec un fait vérifiable : prix, délai, zone, chiffre]. ${clip(fpFirst, 160)}`,
      why: 'Les IA reprennent volontiers une phrase autonome placée en tête, qui répond sans contexte.',
    });
  }

  // 2. Titres en questions
  const qh = h2h3.filter((h) => isQuestion(h.text));
  checks.push(
    qh.length >= 2
      ? mkCheck('question_headings', 'Titres en forme de questions', 'ok', `${qh.length} intertitre(s) en question, ex. « ${clip(qh[0].text, 80)} ».`, '', W.question_headings)
      : mkCheck('question_headings', 'Titres en forme de questions', qh.length ? 'warn' : 'fail', qh.length ? 'Un seul intertitre en question.' : 'Aucun intertitre formulé comme une question.', 'Reformulez des intertitres comme les questions que posent vos clients (« Combien coûte… ? », « Quel délai pour… ? »).', W.question_headings, { task: 'content' }),
  );
  const nonQ = h2h3.find((h) => !isQuestion(h.text) && h.text.length > 3 && h.text.length < 80);
  if (qh.length < 2 && nonQ) {
    const t = nonQ.text.replace(/^(nos|notre|mes|nos)\s+/i, '');
    const lower = t.charAt(0).toLowerCase() + t.slice(1);
    const after = /tarif|prix|co[uû]t/i.test(t) ? `Combien coûte ${lower.replace(/^(les |le |la )?(tarifs?|prix|co[uû]ts?)\s*/i, '') || 'la prestation'} ?` : /d[ée]lai|horaire/i.test(t) ? `Quels sont les ${lower} ?` : /zone|secteur|ville/i.test(t) ? `Dans quelle zone intervenez-vous ?` : `Que faut-il savoir sur ${lower} ?`;
    suggestions.push({ rule: 'question_headings', before: nonQ.text, after, why: 'Un intertitre en question correspond mot pour mot à ce que les gens demandent aux IA.' });
  }

  // 3. Structure en intertitres
  checks.push(
    h2h3.length >= 3
      ? mkCheck('heading_structure', 'Structure en intertitres', 'ok', `${h2h3.length} intertitres H2/H3.`, '', W.heading_structure)
      : mkCheck('heading_structure', 'Structure en intertitres', h2h3.length ? 'warn' : 'fail', `${h2h3.length} intertitre(s) H2/H3.`, 'Découpez la page en sections courtes, chacune annoncée par un intertitre H2 ou H3.', W.heading_structure),
  );

  // 4. Paragraphes courts
  const med = median(pWords);
  const longP = paragraphs.filter((p) => wordCount(p.text) > 120);
  checks.push(
    !pWords.length
      ? mkCheck('short_paragraphs', 'Paragraphes courts', 'fail', 'Aucun paragraphe dans le contenu principal.', 'Rédigez le contenu en paragraphes de 2 à 4 phrases.', W.short_paragraphs)
      : med <= 80 && longP.length <= Math.max(1, pWords.length * 0.2)
        ? mkCheck('short_paragraphs', 'Paragraphes courts', 'ok', `Paragraphes de ${med} mots en médiane.`, '', W.short_paragraphs)
        : mkCheck('short_paragraphs', 'Paragraphes courts', 'warn', `${longP.length} paragraphe(s) de plus de 120 mots ; médiane ${med} mots.`, 'Coupez les paragraphes longs : une idée, 2 à 4 phrases.', W.short_paragraphs, { task: 'content' }),
  );
  if (longP.length) {
    const lp = longP.sort((a, b) => wordCount(b.text) - wordCount(a.text))[0];
    const ss = sentences(lp.text);
    if (ss.length >= 3) suggestions.push({ rule: 'short_paragraphs', before: clip(lp.text, 400), after: [ss[0], '', ...ss.slice(1, 6).map((s) => `- ${s}`)].join('\n'), why: 'Une phrase d’idée suivie d’une liste est plus facile à extraire qu’un bloc compact.' });
  }

  // 5. Listes
  const li = page.blocks.filter((b) => b.tag === 'li').length;
  checks.push(li >= 3 ? mkCheck('lists', 'Listes', 'ok', `${li} éléments de liste dans le contenu.`, '', W.lists) : mkCheck('lists', 'Listes', 'warn', 'Peu ou pas de listes dans le contenu principal.', 'Présentez étapes, critères ou services sous forme de listes.', W.lists));

  // 6. Tableaux
  const tables = (page.clean.match(/<table\b/gi) ?? []).length;
  const ths = page.blocks.filter((b) => b.tag === 'th').length;
  checks.push(
    tables && ths
      ? mkCheck('tables', 'Tableaux comparatifs', 'ok', `${tables} tableau(x) avec en-têtes.`, '', W.tables)
      : mkCheck('tables', 'Tableaux comparatifs', 'warn', tables ? 'Tableau sans cellules d’en-tête (<th>).' : 'Aucun tableau.', 'Si la page compare des offres, des prix ou des délais, mettez-les dans un tableau HTML avec en-têtes.', W.tables),
  );

  // 7. Chiffres
  const nums = main.match(NUMBER_FACT) ?? [];
  checks.push(
    nums.length >= 3
      ? mkCheck('numbers', 'Chiffres précis', 'ok', `${nums.length} chiffres ou valeurs précises (ex. « ${(nums[0] ?? "").trim()} »).`, '', W.numbers)
      : mkCheck('numbers', 'Chiffres précis', nums.length ? 'warn' : 'fail', `${nums.length} chiffre(s) précis.`, 'Donnez des faits chiffrés vérifiables : prix, délais, zone, années d’expérience, nombre de clients (réels).', W.numbers),
  );

  // 8. Sources (liens sortants)
  const external = page.links
    .map((l) => ({ ...l, abs: absUrl(l.href, base) }))
    .filter((l) => l.abs && opts.url && !sameSite(l.abs, opts.url) && !SOCIAL.test(l.abs) && !/nofollow sponsored/.test(l.rel));
  const extHosts = [...new Set(external.map((l) => new URL(l.abs as string).hostname))];
  checks.push(
    !opts.url
      ? mkCheck('sourced', 'Chiffres sourcés (liens sortants)', external.length || page.links.some((l) => /^https?:/.test(l.href)) ? 'ok' : 'warn', 'Contenu collé : liens sortants évalués sans connaître le domaine.', 'Citez vos sources par des liens vers des références (études, textes officiels, fabricants).', W.sourced)
      : extHosts.length >= 2
        ? mkCheck('sourced', 'Chiffres sourcés (liens sortants)', 'ok', `Liens vers ${extHosts.length} sources externes (${extHosts.slice(0, 3).join(', ')}).`, '', W.sourced)
        : mkCheck('sourced', 'Chiffres sourcés (liens sortants)', extHosts.length ? 'warn' : 'fail', extHosts.length ? `Une seule source externe (${extHosts[0]}).` : 'Aucun lien vers une source externe.', 'Appuyez vos chiffres sur des sources liées (textes officiels, études, fabricants).', W.sourced),
  );

  // 9. Date visible
  const metaDate = page.og['article:modified_time'] || page.og['article:published_time'] || (nodes.find((n) => n.dateModified || n.datePublished) as Record<string, unknown> | undefined)?.dateModified;
  const visibleDate = DATE_RE.exec(page.bodyText);
  const updated = UPDATED_RE.test(page.bodyText) && !!visibleDate;
  checks.push(
    visibleDate
      ? mkCheck('date', 'Date visible', 'ok', `Date visible : « ${visibleDate[0]} »${updated ? ' (mention de mise à jour)' : ''}.`, '', W.date)
      : mkCheck('date', 'Date visible', metaDate ? 'warn' : 'fail', metaDate ? 'Date présente dans les métadonnées, mais pas affichée sur la page.' : 'Aucune date de publication ou de mise à jour.', 'Affichez « Mis à jour le [date] » près du titre et tenez-le à jour.', W.date),
  );

  // 10. Auteur
  const authorLd = nodes.some((n) => n.author);
  const authorRel = page.links.some((l) => l.rel.split(/\s+/).includes('author')) || /<meta[^>]+name=["']author["']/i.test(page.raw);
  const byline = /\b(par|rédigé par|écrit par|auteur\s*:|by)\s+[A-ZÀ-Ý][\p{L}-]+(\s+[A-ZÀ-Ý][\p{L}-]+)?/u.exec(page.bodyText);
  checks.push(
    byline || authorLd
      ? mkCheck('author', 'Auteur identifié', 'ok', byline ? `Signature : « ${byline[0]} ».` : 'Auteur déclaré dans les données structurées.', '', W.author)
      : mkCheck('author', 'Auteur identifié', authorRel ? 'warn' : 'fail', authorRel ? 'Auteur dans les métadonnées seulement.' : 'Aucun auteur identifié.', 'Signez la page (nom, fonction, expérience) : une source identifiée inspire davantage confiance.', W.author),
  );

  // 11. Définitions
  const allSent = page.blocks.filter((b) => b.tag === 'p' || b.tag === 'li' || b.tag === 'dd').flatMap((b) => sentences(b.text));
  const defs = allSent.filter((s) => DEFINITION_RE.test(s));
  const hasDl = /<dl\b|<dfn\b/i.test(page.clean);
  checks.push(
    defs.length || hasDl
      ? mkCheck('definitions', 'Définitions claires', 'ok', defs.length ? `Définition : « ${clip(defs[0], 120)} »` : 'Liste de définitions (<dl>/<dfn>).', '', W.definitions)
      : mkCheck('definitions', 'Définitions claires', 'warn', 'Aucune phrase de définition (« X est un… »).', 'Définissez en une phrase votre activité ou le terme clé de la page (« Un ramoneur certifié est… »).', W.definitions),
  );

  // 12. FAQ
  const faqHeading = page.headings.some((h) => /faq|questions? (fréquentes|frequentes|courantes)|vos questions/i.test(h.text));
  const faqLd = ldTypes.includes('FAQPage');
  const details = (page.clean.match(/<summary\b/gi) ?? []).length;
  checks.push(
    faqHeading || faqLd || details >= 2
      ? mkCheck('faq', 'Questions fréquentes', 'ok', faqLd ? 'FAQ balisée (FAQPage).' : 'Section de questions fréquentes trouvée.', '', W.faq)
      : mkCheck('faq', 'Questions fréquentes', 'fail', 'Aucune section de questions fréquentes.', 'Ajoutez 5 à 10 questions réelles de vos clients avec des réponses courtes (Repéré peut publier cette page pour vous).', W.faq, { task: 'faq_page' }),
  );

  // 13. Longueur
  checks.push(
    words >= 300 && words <= 5000
      ? mkCheck('length', 'Longueur du contenu', 'ok', `${words} mots dans le contenu principal.`, '', W.length)
      : words > 5000
        ? mkCheck('length', 'Longueur du contenu', 'warn', `${words} mots : page très longue.`, 'Scindez en pages thématiques reliées entre elles.', W.length)
        : mkCheck('length', 'Longueur du contenu', words >= 150 ? 'warn' : 'fail', `${words} mots dans le contenu principal.`, 'Visez au moins 300 mots utiles : réponses, détails, exemples, chiffres.', W.length, { task: 'content' }),
  );

  // 14. Liens internes
  const internal = opts.url ? page.links.filter((l) => { const a = absUrl(l.href, base); return !!a && sameSite(a, opts.url as string) && !/#/.test(l.href.slice(0, 1)); }) : page.links.filter((l) => l.href.startsWith('/'));
  checks.push(
    internal.length >= 3
      ? mkCheck('internal_links', 'Liens internes', 'ok', `${internal.length} liens vers d’autres pages du site.`, '', W.internal_links)
      : mkCheck('internal_links', 'Liens internes', 'warn', `${internal.length} lien(s) interne(s).`, 'Reliez la page à vos pages de services, tarifs et contact avec des liens explicites.', W.internal_links),
  );

  // 15. Entités nommées
  const caps = new Set((main.match(/(?<![.!?]\s)\b[A-ZÀ-Ý][\p{L}'’-]{2,}(?:\s+[A-ZÀ-Ý][\p{L}'’-]{2,})*/gu) ?? []).map((s) => s.trim()));
  const entityLd = ldTypes.some((t) => /Organization|Business|Store|Person|Place|Product|Brand/.test(t) || /Plumber|Restaurant|Bakery|Electrician/.test(t));
  checks.push(
    caps.size >= 5 || (entityLd && caps.size >= 2)
      ? mkCheck('entities', 'Entités nommées', 'ok', `${caps.size} noms propres (marque, lieux, personnes, produits).`, '', W.entities)
      : mkCheck('entities', 'Entités nommées', 'warn', `${caps.size} nom(s) propre(s) dans le contenu.`, 'Nommez précisément : votre marque, votre ville et vos quartiers, vos marques et certifications. Évitez « nous » et « ici » sans référent.', W.entities),
  );
  const pron = allSent.find((s) => PRONOUN_START.test(s) && wordCount(s) >= 8);
  if (pron && subject) suggestions.push({ rule: 'entities', before: clip(pron, 200), after: clip(pron.replace(PRONOUN_START, subject), 200), why: 'Une phrase extraite seule doit nommer son sujet : un pronom sans référent la rend inutilisable.' });

  // 16. Coordonnées
  const contact = [PHONE_RE.test(page.bodyText) && 'téléphone', POSTCODE_RE.test(page.bodyText) && 'adresse', EMAIL_RE.test(page.bodyText) && 'e-mail'].filter(Boolean) as string[];
  checks.push(
    contact.length
      ? mkCheck('contact', 'Coordonnées visibles', 'ok', `Visibles : ${contact.join(', ')}.`, '', W.contact)
      : mkCheck('contact', 'Coordonnées visibles', 'warn', 'Aucun téléphone, adresse ni e-mail dans le texte.', 'Affichez vos coordonnées en texte (pas seulement en image ou dans un formulaire).', W.contact),
  );

  // 17. JSON-LD
  const v = validateBlocks(page.jsonLdRaw, page);
  checks.push(
    v.blocks.length && !v.errors.length
      ? mkCheck('jsonld', 'Données structurées cohérentes', 'ok', `Types : ${[...new Set(v.blocks.flatMap((b) => b.types))].slice(0, 6).join(', ')}.`, '', W.jsonld)
      : mkCheck('jsonld', 'Données structurées cohérentes', v.blocks.length ? 'warn' : 'fail', v.blocks.length ? `${v.errors.length} erreur(s) : ${v.errors[0]}` : 'Aucun JSON-LD.', 'Ajoutez un JSON-LD qui reprend les informations visibles (générateur Repéré).', W.jsonld, { task: 'jsonld' }),
  );

  // 18. Lisible sans JS
  const bodyWords = wordCount(page.bodyText);
  checks.push(
    bodyWords >= 200
      ? mkCheck('readable_no_js', 'Lisible sans JavaScript', 'ok', `${bodyWords} mots dans le HTML initial.`, '', W.readable_no_js)
      : mkCheck('readable_no_js', 'Lisible sans JavaScript', bodyWords >= 50 ? 'warn' : 'fail', `${bodyWords} mots dans le HTML initial.`, 'Servez le texte dans le HTML initial (rendu serveur).', W.readable_no_js, { task: 'faq_page' }),
  );

  // 19. Titre aligné sur le sujet
  const target = opts.question || h1;
  const tm = target && page.title ? overlap(target, `${page.title} ${h1}`) : 0;
  checks.push(
    !page.title
      ? mkCheck('title_match', opts.question ? 'Titre aligné sur la question' : 'Titre et H1 cohérents', 'fail', 'Pas de balise title.', 'Ajoutez un titre qui reprend le sujet exact de la page.', W.title_match)
      : tm >= 0.5
        ? mkCheck('title_match', opts.question ? 'Titre aligné sur la question' : 'Titre et H1 cohérents', 'ok', `« ${clip(page.title, 90)} »`, '', W.title_match)
        : mkCheck('title_match', opts.question ? 'Titre aligné sur la question' : 'Titre et H1 cohérents', 'warn', opts.question ? `Le titre reprend peu les mots de « ${opts.question} ».` : 'Le titre et le H1 parlent peu du même sujet.', 'Reprenez dans le title et le H1 les mots que vos clients utilisent pour la question visée.', W.title_match),
  );

  // 20. Canonique
  checks.push(
    page.canonical
      ? mkCheck('canonical', 'Adresse canonique', 'ok', `Canonique : ${clip(page.canonical, 100)}.`, '', W.canonical)
      : mkCheck('canonical', 'Adresse canonique', 'warn', 'Pas de balise canonical.', 'Déclarez l’adresse de référence de la page (<link rel="canonical">).', W.canonical),
  );

  return { checks, extracts: citableExtracts(page, subject), suggestions: suggestions.slice(0, 6) };
}

/** Phrases autonomes qu'une IA pourrait reprendre telles quelles. */
export function citableExtracts(page: ParsedPage, subject = ''): CitableExtract[] {
  const out: (CitableExtract & { s: number })[] = [];
  const seen = new Set<string>();
  page.blocks
    .filter((b) => ['p', 'li', 'dd', 'td', 'blockquote'].includes(b.tag))
    .forEach((b, bi) => {
      for (const s of sentences(b.text)) {
        const w = wordCount(s);
        if (w < 10 || w > 45 || seen.has(s) || PRONOUN_START.test(s) || /\?$/.test(s)) continue;
        seen.add(s);
        const reasons: string[] = [];
        let score = 0;
        if (DEFINITION_RE.test(s)) { score += 3; reasons.push('définition'); }
        const n = s.match(NUMBER_FACT);
        if (n) { score += 2; reasons.push('chiffre précis'); }
        if (subject && s.toLowerCase().includes(subject.toLowerCase().slice(0, 30))) { score += 1; reasons.push('nomme le sujet'); }
        if (bi < 3) { score += 1; reasons.push('en tête de page'); }
        if (score >= 2) out.push({ text: s, reason: `Phrase autonome (${reasons.join(', ')}).`, s: score });
      }
    });
  return out.sort((a, b) => b.s - a.s).slice(0, 5).map(({ text, reason }) => ({ text, reason }));
}

/** Rapport de citabilité d'un HTML (pur, sans IA). */
export function citabilityFromHtml(html: string, opts: CitabilityOptions = {}): CitabilityReport {
  const page = parseHtml(html);
  const { checks, extracts, suggestions } = citabilityChecks(page, opts);
  const scored = finalize(checks);
  return {
    ...scored,
    url: opts.url ?? null,
    title: page.title,
    words: wordCount(page.mainText),
    passed: checks.filter((c) => c.status === 'ok').length,
    total: checks.length,
    extracts,
    suggestions,
    aiRewrite: null,
    disclaimer: CITABILITY_DISCLAIMER,
  };
}

/** Réécriture du paragraphe d'ouverture par IA (facultatif). Renvoie le rapport inchangé sans clé. */
export async function withAiRewrite(report: CitabilityReport, html: string, question?: string): Promise<CitabilityReport> {
  if (!llmAvailable()) return { ...report, aiNote: 'Mode « avec IA » indisponible : aucune clé configurée. Les suggestions par règles restent valables.' };
  const page = parseHtml(html);
  const fp = firstParagraph(page.blocks);
  if (!fp) return { ...report, aiNote: 'Pas de paragraphe d’ouverture à réécrire.' };
  const text = await complete({
    system: SYSTEM_FR,
    prompt: [
      'Réécris ce paragraphe d’ouverture pour qu’il réponde directement à la question principale de la page, en 2 ou 3 phrases (60 mots maximum), vouvoiement.',
      'Règle absolue : n’ajoute AUCUN fait, chiffre, prix ou promesse absent du texte source. Si une information manque, écris [à compléter].',
      `Titre de la page : ${page.title}`,
      question ? `Question visée : ${question}` : '',
      `Paragraphe : ${fp.text.slice(0, 1500)}`,
    ].filter(Boolean).join('\n'),
    maxTokens: 300,
  }).catch(() => null);
  return text ? { ...report, aiRewrite: { text: text.trim(), model: 'llm' }, aiNote: 'Proposition générée par IA, à relire : aucun fait ne doit être ajouté.' } : { ...report, aiNote: 'La réécriture par IA a échoué ; réessayez plus tard.' };
}

/** Citabilité d'une URL (ou d'un HTML fourni). `ai` : uniquement pour les comptes connectés. */
export async function auditCitability(input: { url?: string; html?: string; question?: string; ai?: boolean }, opts: SafeFetchOptions = {}): Promise<CitabilityReport> {
  let html = input.html ?? '';
  let url: string | null = null;
  if (input.url) {
    const res = await safeFetch(input.url, opts);
    html = res.body;
    url = res.finalUrl;
  }
  const report = citabilityFromHtml(html, { url, question: input.question });
  return input.ai ? withAiRewrite(report, html, input.question) : report;
}
