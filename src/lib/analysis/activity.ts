/**
 * Activité d'un site en français correct (TESTS-REELS, nov. 2026). Cas réel : lepetitballon.com, H1 « Les box de vins
 * du Petit Ballon - Abonnement et cadeau » donnait l'activité « les box de vins du petit » et la question « Quel les box
 * de vins du petit me recommandez-vous à Paris ? ».
 *
 * 1. `cleanActivity` : un segment de titre ou de H1 → un groupe nominal sans la marque, sans article, sans slogan.
 * 2. `nounPhrase` : nature (métier ou établissement / produits au pluriel / prestation), genre et nombre, articles.
 * Fonctions pures, testées sur des titres de vrais sites (analysis/__tests__/activity.test.ts).
 */

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const DETERMINERS =
  /^(?:(?:tous|toutes)\s+(?:les|nos|vos)\s+|(?:les|le|la|des|du|un|une|nos|vos|votre|notre|mon|ma|mes|ton|ta|tes|son|sa|ses|leur|leurs|ce|cet|cette|ces)\s+|l['’]\s*|d['’]\s*)/i;
/** Mots qui trahissent un slogan, une phrase ou une page technique plutôt qu'une activité. */
const SLOGAN =
  /(?:^|\s)(?:bienvenue|découvrez|decouvrez|trouvez|commandez|achetez|profitez|offrez|réservez|reservez|rejoignez|contactez|cliquez|accueil|home|page|site officiel|officiel|welcome|shop now|vous|votre|vos|nous|notre|nos|je|j['’]|on|ici|depuis|plus de|n°|numéro 1|leader|meilleur|meilleure|meilleurs|meilleures|connexion|panier|menu|cookies?|standard|référence|reference|avenir|futur|expérience|experience|univers|monde|histoire|passion|aventure|prêt|prête|faire|passez|passer|échangeons|echangeons|changez|venez|vivez|osez|créez|simplifiez|gérez|gerez|pilotez|boostez|libérez|gagnez|économisez|dites|faites|laissez|sauvez|index of|not found|erreur|error|loading|chargement|un instant|il|ils|elle|elles|est|sont|c['’]est|n['’]est|ce sont)(?=\s|$|[,.!?:])/i;
/** Segment en anglais (sites bilingues, slogans) : pas une activité à mettre dans une question en français. */
const ENGLISH = /(?:^|\s)(?:the|of|your|our|and|with|for|let['’]s|we|you|best|is|are|to|in|by|software|services|online|shop|store|resources|human['’]s)(?=\s|$|[,.!?:])|['’]s(?:\s|$)/i;
/** Fins publicitaires sans information (« de qualité », « haut de gamme »). */
const MARKETING_TAIL = /\s+(?:de\s+(?:grande\s+)?qualité|d['’]exception|haut de gamme|premium|pas cher(?:e|s|es)?|au meilleur prix|en ligne|livrés?(?:\s+chez vous)?|depuis\s+\d{4}|made in france|100\s*%.*)$/i;
/** Tête de groupe qui désigne une prestation (singulier non dénombrable : « la location de… »). */
const SERVICE_HEAD =
  /^(?:abonnement|location|vente|achat|livraison|réparation|reparation|dépannage|depannage|entretien|installation|rénovation|renovation|création|creation|conception|fabrication|formation|conseil|accompagnement|gestion|nettoyage|transport|déménagement|demenagement|traduction|recrutement|maintenance|développement|developpement|distribution|organisation|production|impression|construction|aménagement|amenagement|expertise|audit|coaching|cours|soutien|assurance|financement|hébergement|hebergement|stockage|logistique|restauration|traiteur à domicile|garde|aide|soin|soins|massage|épilation|epilation|coiffure|coupe|réservation|reservation|cuisine|décoration|decoration|photographie|communication|comptabilité|comptabilite|paie|sécurité|securite|surveillance|plomberie|électricité|electricite|menuiserie|maçonnerie|maconnerie|couverture|peinture|serrurerie|chauffage|climatisation|isolation|jardinage|paysagisme|élagage|elagage)$/i;
/** Singuliers terminés par s / x / z (« des bois », « un prix »). */
const SINGULAR_SXZ =
  /^(?:bois|prix|fils|tapis|repas|relais|palais|vis|cours|corps|temps|pays|gaz|nez|choix|voix|croix|taux|jus|tennis|fitness|business|bus|dos|mas|anis|cassis|ananas|campus|virus|abus|lys|riz|quartz|jazz|puzzle|sas|bras|matelas|cabas|plexiglas|verglas|ascenseurs?)$/i;
/** Têtes invariables mais pluriel d'usage (« des box », « des kits ») : on les traite comme des produits. */
const PRODUCT_HEAD = /^(?:box|coffrets?|kits?|paniers?|packs?|lots?)$/i;

const FEM_HEAD =
  /^(?:agence|entreprise|boutique|salle|clinique|pharmacie|auto-école|école|ecole|crèche|creche|onglerie|épicerie|epicerie|brasserie|pizzeria|crêperie|creperie|fromagerie|poissonnerie|boucherie|charcuterie|pâtisserie|patisserie|boulangerie|librairie|cave|société|societe|marque|maison|imprimerie|blanchisserie|laverie|carrosserie|menuiserie|serrurerie|plomberie|conciergerie|banque|assurance|mutuelle|ferme|chambre|vente|location|livraison|réparation|reparation|installation|rénovation|renovation|création|creation|conception|fabrication|formation|gestion|distribution|organisation|production|impression|construction|expertise|garde|aide|épilation|epilation|coiffure|coupe|réservation|reservation|cuisine|décoration|decoration|photographie|communication|comptabilité|comptabilite|paie|sécurité|securite|surveillance|électricité|electricite|maçonnerie|maconnerie|couverture|peinture|climatisation|isolation|plateforme|solution|application|banque|néobanque|neobanque|cantine|table|guinguette|chocolaterie|confiserie|biscuiterie|savonnerie|parfumerie|bijouterie|horlogerie|lunetterie|droguerie|quincaillerie|jardinerie|animalerie|mercerie|papeterie|cordonnerie|bagagerie|literie|miellerie|distillerie|brûlerie|brulerie|torréfaction|torrefaction|tisanerie|herboristerie|maroquinerie|lingerie|friperie|ressourcerie|régie|regie|start-up|startup|marketplace|place de marché)$/i;
const MASC_HEAD =
  /^(?:commerce|garage|salon|cabinet|restaurant|hôtel|hotel|institut|magasin|atelier|traiteur|bar|café|cafe|spa|bistrot|bouillon|caviste|fleuriste|coiffeur|plombier|électricien|electricien|chauffagiste|serrurier|couvreur|peintre|menuisier|maçon|macon|architecte|avocat|notaire|comptable|expert-comptable|photographe|logiciel|service|site|studio|centre|cabinet|groupe|réseau|reseau|fournisseur|prestataire|artisan|domaine|vignoble|château|chateau|torréfacteur|torrefacteur|chocolatier|pâtissier|patissier|boulanger|boucher|fromager|opticien|dentiste|médecin|medecin|vétérinaire|veterinaire|kinésithérapeute|ostéopathe|osteopathe|abonnement|achat|dépannage|depannage|entretien|conseil|accompagnement|nettoyage|transport|déménagement|demenagement|recrutement|développement|developpement|aménagement|amenagement|audit|coaching|soutien|financement|hébergement|hebergement|stockage|soin|massage|chauffage|jardinage|paysagisme|élagage|elagage|e-commerce|marchand|grossiste|distributeur|fabricant|créateur|createur|éditeur|editeur|intégrateur|integrateur|organisme|bureau|traducteur|agent|courtier|concessionnaire|loueur|vendeur)$/i;

export type PhraseKind = 'trade' | 'products' | 'service';

export interface NounPhrase {
  /** groupe nominal sans article (« box de vins », « plombier », « location de voitures ») */
  text: string;
  kind: PhraseKind;
  feminine: boolean;
  plural: boolean;
}

const startsVowel = (s: string) => /^[aeiouyàâäéèêëîïôöûùüœæh]/i.test(s.trim()) && !/^h(?:aricot|amac|ache|aie|all|amburger|angar|ar|ernie|éros|eros|être|etre|ibou|ockey|ollandais|omard|onte|ors|ublot|uit|aut)/i.test(s.trim());

function headWord(text: string): string {
  return text.trim().split(/[\s,]+/)[0] ?? '';
}

export function isFeminineHead(text: string): boolean {
  const h = headWord(text).toLowerCase();
  if (FEM_HEAD.test(h)) return true;
  if (MASC_HEAD.test(h)) return false;
  const sing = h.replace(/[sx]$/, '');
  if (FEM_HEAD.test(sing)) return true;
  if (MASC_HEAD.test(sing)) return false;
  return /(?:erie|rie|ique|ance|ence|tion|sion|aison|ure|ette|ade|ée|ière|esse|ente|ine|elle|eille|euse|trice|ise)$/.test(sing);
}

export function isPluralHead(text: string): boolean {
  const h = headWord(text).toLowerCase();
  if (PRODUCT_HEAD.test(h)) return true;
  return h.length > 3 && /[sx]$/.test(h) && !SINGULAR_SXZ.test(h);
}

/** Groupe nominal → nature, genre et nombre. */
export function nounPhrase(raw: string): NounPhrase {
  const text = raw.trim().replace(DETERMINERS, '').trim();
  const head = headWord(text).toLowerCase();
  const plural = isPluralHead(text);
  // Pratiques et disciplines (« biorésonance », « naturopathie », « yoga ») : des prestations, pas des métiers.
  const practice = /(?:thérapie|therapie|logie|pathie|sonance|nutrition|diététique|dietetique|yoga|pilates|méditation|meditation|hypnose|acupuncture|massage)$/.test(head);
  const kind: PhraseKind = plural ? 'products' : SERVICE_HEAD.test(head) || practice ? 'service' : 'trade';
  return { text, kind, feminine: isFeminineHead(text), plural };
}

/** « le / la / l' / les » + groupe. */
export function withDefinite(p: NounPhrase): string {
  if (p.plural) return `les ${p.text}`;
  if (startsVowel(p.text)) return `l’${p.text}`;
  return `${p.feminine ? 'la' : 'le'} ${p.text}`;
}

/** « un / une / des » + groupe. */
export function withIndefinite(p: NounPhrase): string {
  if (p.plural) return `des ${p.text}`;
  return `${p.feminine ? 'une' : 'un'} ${p.text}`;
}

/** « de / d' » devant un mot (« besoin d’un… », « spécialiste d’huiles »). */
export function de(word: string): string {
  return startsVowel(word) ? `d’${word}` : `de ${word}`;
}

/** Pluriel simple du premier mot (« boulangerie » → « boulangeries », « bureau » → « bureaux », « box » → « box »). */
export function pluralOf(p: NounPhrase): string {
  if (p.plural) return p.text;
  const [head, ...rest] = p.text.split(' ');
  const pl = /[sxz]$/i.test(head)
    ? head
    : /(eau|au|eu)$/i.test(head)
      ? `${head}x`
      : /al$/i.test(head) && !/(bal|carnaval|festival|régal)$/i.test(head)
        ? `${head.slice(0, -2)}aux`
        : `${head}s`;
  // « restaurant italien » → « restaurants italiens » : l'adjectif qui suit s'accorde aussi.
  const adj = rest.length === 1 && /(?:ien|ienne|ais|aise|ois|oise|al|el|elle|if|ive|ique|é|ée|ant|ante|ent|ente|aire|ier|ière|in|ine|on|onne|ard|arde|eur|euse|ste)$/.test(rest[0]) && !/[sx]$/.test(rest[0]) ? [/al$/.test(rest[0]) ? `${rest[0].slice(0, -2)}aux` : `${rest[0]}s`] : rest;
  return [pl, ...adj].join(' ');
}

/** Coupe `s` à la mention de la marque `b` (forme repliée) et aux prépositions qui l'introduisent. */
function cutBrand(s: string, b: string): string {
  const words = s.split(' ');
  const foldedWords = words.map((w) => fold(w).replace(/[^a-z0-9]+/g, ''));
  const bw = b.split(' ');
  for (let i = 0; i < foldedWords.length; i++) {
    if (bw.every((x, k) => foldedWords[i + k] === x)) {
      let cut = i;
      while (cut > 0 && /^(?:de|du|des|d|chez|par|by|le|la|les|l|avec|selon|signe|signee)$/.test(foldedWords[cut - 1])) cut--;
      return words.slice(0, cut).join(' ').trim();
    }
    if (/^(?:d|l)['’]/i.test(words[i]) && bw[0] === fold(words[i].slice(2)).replace(/[^a-z0-9]+/g, '') && bw.slice(1).every((x, k) => foldedWords[i + 1 + k] === x)) {
      let cut = i;
      while (cut > 0 && /^(?:de|du|des|chez|par|by)$/.test(foldedWords[cut - 1])) cut--;
      return words.slice(0, cut).join(' ').trim();
    }
  }
  return s;
}

const STOP_TAIL = /\s+(?:à|a|au|aux|sur|en|dans|pour|depuis|avec|et|-)$/i;

/**
 * Segment de titre / H1 → activité propre, ou undefined si ce n'est pas une activité (slogan, phrase, marque seule).
 * Retire : la marque et ce qui la précède (« du Petit Ballon »), la ville (« à Lyon »), les articles, la ponctuation.
 */
export function cleanActivity(raw: string | undefined, brand: string): string | undefined {
  if (!raw) return undefined;
  let s = raw
    .replace(/[«»"“”]/g, ' ')
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Premier membre d'un titre à séparateurs (« Box de vins - Abonnement et cadeau »).
  s = s.split(/\s+[|·•–—-]\s+|\s*[|·•:]\s+|[!?.]\s/)[0]?.trim() ?? '';
  if (!s) return undefined;
  // Marque (insensible aux accents et à son article) : on coupe à la préposition qui l'introduit.
  const b = fold(brand)
    .replace(/^(?:(?:le|la|les)\s+|l')/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  // Marque entière, puis sans ses premiers mots (« La Savonnerie Marius Fabre » → « Marius Fabre »).
  const brandForms = (() => {
    const bwAll = b.split(' ').filter(Boolean);
    const forms: string[] = [];
    for (let k = 0; k < bwAll.length; k++) {
      const f = bwAll.slice(k).join(' ');
      if (f.replace(/ /g, '').length >= 5 || k === 0) forms.push(f);
    }
    // … et sans ses derniers mots (« Pierre Hermé Paris » → « Pierre Hermé »).
    for (let k = bwAll.length - 1; k >= 2; k--) forms.push(bwAll.slice(0, k).join(' '));
    return forms;
  })();
  for (const form of b.length >= 2 ? brandForms : []) {
    const before = s;
    s = cutBrand(s, form);
    if (s !== before) break;
  }
  // Décorations (« . x x Septime x x ») et lettres espacées (« f l e u r s ») : pas une activité.
  if ((s.match(/(?:^|\s)\p{L}(?=\s|$)/gu) ?? []).length >= 2) return undefined;
  s = s
    .replace(/^[^\p{L}\d]+|[^\p{L}\d)]+$/gu, '')
    .replace(/\s+(?:qui|que|qu['’]|dont|où|ou vous|pour vous)(?:\s.*)?$/i, '')
    .replace(MARKETING_TAIL, '')
    .replace(MARKETING_TAIL, '')
    .replace(/[,;].*$/, '')
    .replace(/\s+(?:à|a|au|aux|sur|en|dans)\s+[A-ZÉÈÀÂÎÔ][\p{L}'’-]*(?:\s.*)?$/u, '')
    .replace(/\s+(?:depuis|since)\s+\d{4}.*$/i, '')
    .replace(STOP_TAIL, '')
    .trim();
  s = s.replace(DETERMINERS, '').replace(DETERMINERS, '').trim();
  if (!s) return undefined;
  if (SLOGAN.test(s) || ENGLISH.test(s)) return undefined;
  // Un verbe seul (« nourrir », « échanger ») : pas une activité.
  if (/^\p{L}+(?:ir|er)$/u.test(s) && !/^(?:comptoir|saphir|désir|loisir|plaisir|avenir|souvenir|élixir|elixir|boucher|boulanger|traiteur|plombier|menuisier|serrurier|carrossier|cuisinier|pâtissier|patissier|chocolatier|fromager|caviste|tapissier|horloger|joaillier|bijoutier|épicier|epicier|coutelier|sellier|maroquinier|barbier|glacier|teinturier|potier|vannier|charpentier|couvreur|ferronnier|métallier|metallier|vitrier|jardinier|fleuriste|hôtelier|hotelier|conseiller|courtier|banquier|assureur|avocat|notaire|huissier|géomètre|architecte|designer|manager|cluster|sneaker|poster|atelier|cahier|panier|papier|grenier|cellier|bar|cuir|soir|noir|miroir|tiroir|rasoir|séchoir|sechoir|pressoir|laminoir|parloir|boudoir|lavoir|abreuvoir|terroir)$/i.test(s)) return undefined;
  // Trop long : on garde le cœur (« Logiciel de paie et RH pour PME » → « logiciel de paie »).
  if (s.split(/\s+/).length > 5) s = s.replace(/\s+(?:et|pour|avec|&|ou)\s+.*$/i, '').trim();
  const words = s.split(/\s+/);
  if (words.length > 6 || s.length > 55 || s.length < 3) return undefined;
  if (!/\p{L}{3,}/u.test(s)) return undefined;
  // Un mot générique seul (« Maison Pierre Hermé » → « maison ») ne dit pas l'activité.
  if (/^(?:maison|groupe|société|societe|entreprise|atelier|studio|accueil|home|boutique|shop|store|site|bienvenue|collection|collections|nouveautés|nouveautes|marque|officiel|instant|patienter|attente|vérification|verification|le|la|les)$/i.test(s)) return undefined;
  // Un nom de domaine (« LDLC.com ») n'est pas une activité.
  if (/[\p{L}\d-]\.(?:com|fr|net|org|eu|shop|store|io|co|paris|bzh)\b/iu.test(s)) return undefined;
  const allCaps = s === s.toUpperCase();
  const titleCase = words.length >= 2 && words.every((w) => /^[A-ZÉÈÀÂÎÔ0-9]/.test(w));
  if (titleCase && !allCaps) {
    // « Abonnement De Box De Vin » (casse de titre) : une activité ; « Maison Kayser Paris » : un nom propre.
    const fn = words.some((w) => /^(?:De|Du|Des|Et|En|Pour|Le|La|Les|Au|Aux|À|D['’].*|L['’].*)$/.test(w));
    const head = fold(words[0]);
    if (!fn && !(FEM_HEAD.test(head) || MASC_HEAD.test(head) || SERVICE_HEAD.test(head) || PRODUCT_HEAD.test(head) || isPluralHead(words[0]))) return undefined;
  }
  // Casse : tout en minuscules si le segment était en capitales ou en casse de titre ; sinon seul le premier mot
  // (« vins de Bourgogne » garde sa majuscule).
  // Majuscules de titre sur tous les mots porteurs (« Thés et Infusions Bio ») : minuscules, sauf les sigles (« RH »).
  const content = words.filter((w) => !/^(?:de|du|des|et|en|pour|le|la|les|au|aux|à|d['’].*|l['’].*|&)$/i.test(w));
  const headline = content.length >= 3 && content.every((w) => /^\p{Lu}/u.test(w));
  const lower = (w: string) => (/^\p{Lu}{2,5}$/u.test(w) && words.length > 1 && !allCaps ? w : w.toLowerCase());
  const out = (allCaps || titleCase || headline ? words.map(lower).join(' ') : s.replace(/^\p{Lu}(?=\p{Ll})/u, (c) => c.toLowerCase())).replace(/\s+/g, ' ').trim();
  // Le reste est-il encore la marque (ou un morceau) ? Pas une activité.
  const fo = fold(out).replace(/[^a-z0-9]+/g, ' ').trim();
  if (b && (fo === b || b.includes(fo))) return undefined;
  return out;
}

/** Métiers sans ambiguïté qui ouvrent souvent un nom d'enseigne (« Coiffeur Jean Louis David », « Boulangerie Paul »). */
const BRAND_TRADE =
  /^(?:coiffeur|coiffeuse|coiffure|boulangerie|pâtisserie|patisserie|restaurant|brasserie|bistrot|pizzeria|crêperie|creperie|garage|plomberie|plombier|électricien|electricien|pharmacie|hôtel|hotel|fleuriste|boucherie|charcuterie|fromagerie|poissonnerie|librairie|caviste|opticien|optique|chocolaterie|confiserie|auto-école|serrurerie|serrurier|menuiserie|carrosserie|traiteur|épicerie|epicerie|torréfacteur|torrefacteur|bijouterie|parfumerie|onglerie|barbier|cordonnerie|pressing|laverie|imprimerie|quincaillerie|jardinerie|animalerie|vétérinaire|veterinaire|ostéopathe|osteopathe|dentiste|kinésithérapeute)$/i;

/** Métier lu au début du nom de l'enseigne, ou undefined. */
export function tradeFromBrand(brand: string): string | undefined {
  const first = brand.trim().replace(/^(?:le|la|les|l['’])\s*/i, '').split(/\s+/)[0] ?? '';
  return BRAND_TRADE.test(first) && brand.trim().split(/\s+/).length >= 2 ? first.toLowerCase() : undefined;
}

/**
 * Ce que vend une boutique en ligne, sans le « qui » : « créateur de sacs à dos » → « sacs à dos »,
 * « spécialiste des thés » → « thés ». Le reste est rendu tel quel.
 */
export function productFocus(activity: string): string {
  const m = /^(?:créateur|créatrice|createur|creatrice|fabricant|fabricante|spécialiste|specialiste|marque|boutique|vente|e-shop|eshop|magasin|artisan|maison|atelier|distributeur|vendeur|expert|experte)(?:\s+(?:français|française|francais|francaise|en ligne))?\s+(?:de\s+la\s+|de\s+l['’]\s*|du\s+|des\s+|de\s+|d['’]\s*|en\s+)(.{3,})$/i.exec(activity.trim());
  const out = m ? m[1].trim() : activity.trim();
  return out.replace(/^\p{Lu}(?=\p{Ll})/u, (c) => c.toLowerCase());
}
