/**
 * Rédaction des textes proposés (titres, méta-descriptions, textes alternatifs, réécritures).
 * - IA : extracteur JSON le moins cher configuré (src/lib/engine/providers → getExtractor) ;
 * - repli déterministe (règles) si aucune IA n'est configurée, si elle échoue ou si son texte est refusé ;
 * - garde-fou « aucun fait inventé » : tout nombre et tout nom propre du texte proposé doit figurer dans la source
 *   (texte de la page, titre, nom, ville). Sinon le texte est rejeté.
 */
import { getExtractor, type Extractor } from '@/lib/engine/providers';

export type WriteKind = 'meta.title' | 'meta.description' | 'image.alt' | 'rewrite' | 'gbp.description';

export interface WriteTask {
  kind: WriteKind;
  /** texte source (contenu de la page) : seule base factuelle autorisée */
  sourceText: string;
  pageTitle?: string;
  h1?: string;
  siteName?: string;
  city?: string;
  current?: string;
  imageSrc?: string;
  /** réécriture : passage à réécrire et consigne */
  passage?: string;
  instruction?: string;
}

export interface TextWriter {
  id: 'ai' | 'rules';
  write(task: WriteTask): Promise<string | null>;
}

export const LIMITS: Record<WriteKind, { min: number; max: number }> = {
  'meta.title': { min: 15, max: 60 },
  'meta.description': { min: 50, max: 158 },
  'image.alt': { min: 5, max: 125 },
  rewrite: { min: 20, max: 2000 },
  'gbp.description': { min: 50, max: 750 },
};

const STOP_CAPS = new Set(
  'le la les l un une des du de d au aux et ou en à a pour par sur avec sans chez votre vos notre nos nous vous ce cette ces il elle ils elles on qui que quoi dont découvrez trouvez contactez profitez bienvenue accueil page questions fréquentes faq tous toutes tout toute plus très bien oui non si est sont the and of'.split(' '),
);

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'");
}

/** Nombres et noms propres du texte, absents de la source → liste des intrus (vide = texte acceptable). */
export function unsupportedFacts(text: string, source: string): string[] {
  const src = fold(source);
  const srcDigits = src.replace(/[\s.,  ]/g, '');
  const out: string[] = [];
  for (const m of text.matchAll(/\d[\d\s.,  ]*\d|\d/g)) {
    const n = m[0].replace(/[\s.,  ]/g, '');
    if (!srcDigits.includes(n)) out.push(m[0].trim());
  }
  // Mots à majuscule (noms propres, marques, villes — et, par prudence, tout mot en tête de phrase) : ils doivent
  // figurer dans la source, sauf mots-outils.
  for (const w of text.matchAll(/(?<![\p{L}\d])[A-ZÀ-ÖØ-Þ][\p{L}’'-]+/gu)) {
    const word = w[0].replace(/[’'-]+$/, '');
    const f = fold(word).replace(/^(l|d|qu)'/, '');
    if (STOP_CAPS.has(fold(word)) || STOP_CAPS.has(f)) continue;
    if (!src.includes(f)) out.push(word);
  }
  return [...new Set(out)];
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : t.slice(0, max)).replace(/[\s,;:–—|-]+$/, '');
}

function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9«"])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 300);
}

const FILE_NOISE = new Set(['img', 'image', 'images', 'dsc', 'dscn', 'pxl', 'photo', 'pic', 'screenshot', 'capture', 'copy', 'copie', 'final', 'scaled', 'rotated', 'edited', 'web', 'min', 'large', 'small', 'thumb', 'thumbnail', 'whatsapp', 'jpeg', 'jpg', 'png', 'webp']);

/** Mots porteurs de sens d'un nom de fichier d'image (« boulangerie-pain-au-levain.jpg » → pain au levain…). */
export function filenameWords(src: string): string[] {
  let name = src;
  try {
    name = new URL(src, 'https://x.invalid').pathname.split('/').pop() ?? '';
  } catch {
    /* tel quel */
  }
  name = decodeURIComponent(name).replace(/\.[a-z0-9]+$/i, '').replace(/-(\d+x\d+|scaled|rotated|e\d{10,})$/i, '');
  return name
    .split(/[-_\s.]+/)
    .filter((w) => /^[\p{L}]{2,}$/u.test(w) && !FILE_NOISE.has(w.toLowerCase()));
}

/** Rédacteur déterministe : n'utilise que des éléments présents (titre H1, nom, phrases de la page, nom de fichier). */
export const rulesWriter: TextWriter = {
  id: 'rules',
  async write(t) {
    switch (t.kind) {
      case 'meta.title': {
        const base = (t.h1 || t.pageTitle || '').replace(/\s+/g, ' ').trim();
        if (!base) return t.siteName ? clip(t.siteName, LIMITS['meta.title'].max) : null;
        const withName = t.siteName && !fold(base).includes(fold(t.siteName)) ? `${base} | ${t.siteName}` : base;
        return clip(withName.length <= 60 ? withName : base, 60);
      }
      case 'meta.description': {
        const ss = sentencesOf(t.sourceText);
        let out = '';
        for (const s of ss) {
          if ((out ? `${out} ${s}` : s).length > LIMITS['meta.description'].max) break;
          out = out ? `${out} ${s}` : s;
        }
        if (!out && ss[0]) out = clip(ss[0], LIMITS['meta.description'].max - 1) + '…';
        return out.length >= LIMITS['meta.description'].min ? out : null;
      }
      case 'image.alt': {
        const w = filenameWords(t.imageSrc ?? '');
        if (w.length < 2) return null; // impossible de décrire l'image sans la voir
        const s = w.join(' ').toLowerCase();
        return clip(s.charAt(0).toUpperCase() + s.slice(1), LIMITS['image.alt'].max);
      }
      case 'gbp.description': {
        const ss = sentencesOf(t.sourceText);
        let out = '';
        for (const s of ss) {
          if ((out ? `${out} ${s}` : s).length > LIMITS['gbp.description'].max) break;
          out = out ? `${out} ${s}` : s;
        }
        return out.length >= LIMITS['gbp.description'].min ? out : null;
      }
      case 'rewrite':
        return null; // pas de réécriture sans IA (ni sans texte fourni)
    }
  },
};

const PROMPTS: Record<WriteKind, string> = {
  'meta.title': 'Rédige le titre de page (balise <title>) en français, 30 à 60 caractères, qui dit clairement ce que propose la page et, si présents dans la source, le lieu et le nom.',
  'meta.description': 'Rédige la méta-description en français, 120 à 155 caractères, phrase complète, utile, sans superlatif creux.',
  'image.alt': 'Rédige un texte alternatif (attribut alt) en français, moins de 125 caractères, qui décrit ce que montre probablement l’image d’après son nom de fichier et le contexte. Si c’est impossible sans voir l’image, réponds une chaîne vide.',
  rewrite: 'Réécris le passage en français selon la consigne, en gardant le même sens et le même niveau de détail ; phrases courtes, réponse directe en premier.',
  'gbp.description': 'Rédige la description de la fiche d’établissement en français, 250 à 750 caractères, factuelle, sans URL, sans promotion ni superlatif.',
};

export function createAiWriter(extractor: Extractor): TextWriter {
  return {
    id: 'ai',
    async write(t) {
      const system = [
        'Tu rédiges des textes SEO pour le site d’un professionnel.',
        'RÈGLE ABSOLUE : n’utilise que les faits présents dans SOURCE. N’invente ni chiffre, ni prix, ni ville, ni marque, ni récompense, ni avis.',
        PROMPTS[t.kind],
        'Réponds en JSON : {"text": "..."}',
      ].join('\n');
      const user = JSON.stringify({
        SOURCE: t.sourceText.slice(0, 6000),
        titre_actuel: t.pageTitle ?? null,
        h1: t.h1 ?? null,
        nom: t.siteName ?? null,
        ville: t.city ?? null,
        valeur_actuelle: t.current ?? null,
        image: t.imageSrc ?? null,
        passage: t.passage ?? null,
        consigne: t.instruction ?? null,
      });
      const raw = await extractor.completeJson(system, user);
      const text = (JSON.parse(raw) as { text?: unknown }).text;
      return typeof text === 'string' && text.trim() ? text.trim() : null;
    },
  };
}

/** Rédacteur par défaut : IA si configurée, sinon règles. */
export function defaultWriter(): TextWriter {
  const ex = getExtractor();
  return ex ? createAiWriter(ex) : rulesWriter;
}

export interface Written {
  value: string;
  by: 'ai' | 'rules';
}

function sourceOf(t: WriteTask): string {
  return [t.sourceText, t.pageTitle, t.h1, t.siteName, t.city, t.current, t.passage, filenameWords(t.imageSrc ?? '').join(' ')].filter(Boolean).join('\n');
}

function acceptable(t: WriteTask, text: string | null): text is string {
  if (!text) return false;
  const { min, max } = LIMITS[t.kind];
  if (text.length < min || text.length > max) return false;
  if (/https?:\/\/|<[^>]+>|\{\{|\[\[/.test(text) && t.kind !== 'rewrite') return false;
  if (t.current && fold(text) === fold(t.current)) return false;
  return unsupportedFacts(text, sourceOf(t)).length === 0;
}

/** Rédige avec l'IA puis, à défaut, avec les règles ; null si aucun texte sûr n'est possible. */
export async function writeText(t: WriteTask, writer: TextWriter = defaultWriter()): Promise<Written | null> {
  if (writer.id === 'ai') {
    try {
      const v = await writer.write(t);
      if (acceptable(t, v)) return { value: v, by: 'ai' };
    } catch {
      /* repli */
    }
  }
  const r = await rulesWriter.write(t);
  return acceptable(t, r) ? { value: r, by: 'rules' } : null;
}
