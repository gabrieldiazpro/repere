/**
 * V8 (TEST-MARQUE) — « Pourquoi lui ? » : pour chaque question où un concurrent est cité à votre place, ce que les
 * IA ont lu (sources de leurs réponses, où il est nommé et vous non), ce que sa page d'accueil montre et que votre
 * site ne montre pas (signaux relevés pour de vrai), et vos 3 premières actions, en disant lesquelles Repéré prépare.
 *
 * Règles : rien d'inventé. Un écart n'est affiché que s'il est relevé sur la page du concurrent ET absent de toutes
 * vos pages lues. En démonstration, aucun site concurrent n'est lu (noms simulés) : on le dit.
 */
import { classifyDomain, CATEGORY_LABEL } from '@/lib/engine/sources/classify';
import { registrableDomain } from '@/lib/engine/detect';
import type { AuditResult } from '@/lib/engine/types';
import { competitorSite, competitorsByQuestion } from './brandtest';
import { SIGNAL_LABEL, type SignalMap } from './signals';
import type { BrandTest, CompetitorWhy, FullAnalysis, SiteSignalId, SiteType, WhyAction } from './types';

export const WHY_MAX = 3;

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function names(text: string, name: string): boolean {
  const n = fold(name).trim();
  return n.length >= 3 && fold(text).includes(n);
}

/**
 * Brouillons « pourquoi lui » à partir de l'audit brut (sources avec titre et extrait). Les écarts de site et les
 * actions sont ajoutés à la synthèse (`finalizeWhy`), quand votre exploration est terminée.
 */
export function draftWhy(t: BrandTest, r: AuditResult, clientUrl: string): CompetitorWhy[] {
  const clientDomain = (() => {
    try {
      return registrableDomain(new URL(clientUrl).hostname);
    } catch {
      return '';
    }
  })();
  const out: CompetitorWhy[] = [];
  const seen = new Set<string>();
  for (const c of competitorsByQuestion(t)) {
    if (out.length >= WHY_MAX) break;
    // Un concurrent déjà expliqué sur une autre question : on passe à la suivante (variété des explications).
    if (seen.has(fold(c.competitor))) continue;
    seen.add(fold(c.competitor));
    const answers = r.answers.filter((a) => a.queryId === c.questionId && !a.error && a.text);
    const raw: { url: string; title?: string; snippet?: string }[] = answers.flatMap((a): { url: string; title?: string; snippet?: string }[] =>
      a.sources?.length ? a.sources : a.citations.map((url) => ({ url })),
    );
    const byUrl = new Map<string, CompetitorWhy['sources'][number]>();
    for (const s of raw) {
      if (!/^https?:\/\//i.test(s.url) || byUrl.has(s.url)) continue;
      const txt = `${s.title ?? ''} ${s.snippet ?? ''}`;
      const cls = classifyDomain(s.url, { clientDomain, competitors: [c.competitor], title: s.title, snippet: s.snippet });
      byUrl.set(s.url, {
        domain: cls.domain,
        url: s.url,
        ...(s.title ? { title: s.title.slice(0, 140) } : {}),
        category: cls.category,
        categoryLabel: CATEGORY_LABEL[cls.category] ?? 'Autre',
        them: names(txt, c.competitor) || cls.competitor === c.competitor,
        you: cls.category === 'client' || names(txt, t.brand),
      });
    }
    const sources = [...byUrl.values()].sort((a, b) => Number(b.them) - Number(a.them)).slice(0, 6);
    const site = competitorSite(c.competitor, answers, clientDomain ? [clientDomain] : []);
    out.push({
      questionId: c.questionId,
      question: c.question,
      competitor: c.competitor,
      providers: c.providers,
      site: site ? { url: site, read: false } : null,
      sources,
      gaps: [],
      strengths: [],
      actions: [],
      basis: '',
    });
  }
  return out;
}

/** Signaux comparés selon le type de site (les horaires n'ont pas de sens pour une boutique en ligne). */
const RELEVANT: Record<SiteType, SiteSignalId[]> = {
  local: ['entity', 'rating', 'address', 'phone', 'hours', 'city', 'faq', 'sameas', 'prices', 'content'],
  pme: ['entity', 'rating', 'faq', 'sameas', 'content', 'prices', 'phone', 'address'],
  ecommerce: ['entity', 'rating', 'faq', 'prices', 'sameas', 'content'],
};

/** Ce que Repéré sait préparer lui-même (correctifs de l'agent de publication), selon les constats de l'analyse. */
const REPERE_KINDS: Partial<Record<SiteSignalId, string[]>> = {
  entity: ['jsonld'],
  address: ['jsonld'],
  phone: ['jsonld'],
  hours: ['jsonld'],
  sameas: ['jsonld'],
  city: ['meta.title'],
  faq: ['jsonld', 'rewrite'],
};

const ACTION_COPY: Record<SiteSignalId, { title: string; how: string }> = {
  entity: { title: 'Publier la fiche d’identité de votre entreprise en données structurées', how: 'Nom, activité, adresse, téléphone, zone servie et liens vers vos profils, en JSON-LD sur la page d’accueil : c’est ce que les IA lisent en premier pour vous reconnaître.' },
  rating: { title: 'Afficher vos avis clients sur votre site', how: 'Montrez votre note et quelques avis récents (Google, plateforme d’avis), avec un lien vers la source. N’inventez ni ne recopiez d’avis : seulement les vrais, et balisés seulement s’ils sont publiés sur votre site.' },
  faq: { title: 'Répondre aux questions de vos clients sur une page FAQ', how: 'Reprenez les questions posées aux IA (prix, délais, zone, garanties) et répondez en 2 à 4 phrases chacune, avec vos vraies informations.' },
  address: { title: 'Écrire votre adresse complète sur le site', how: 'Numéro, rue, code postal et ville, en texte (pas seulement dans une image ou une carte), identiques à votre fiche Google.' },
  phone: { title: 'Rendre votre téléphone visible et cliquable', how: 'Dans l’en-tête ou le pied de page, au format cliquable (lien « tel: »), identique à vos fiches.' },
  hours: { title: 'Indiquer vos horaires d’ouverture', how: 'En texte sur la page d’accueil ou la page contact, et en données structurées (openingHours), identiques à votre fiche Google.' },
  city: { title: 'Mettre votre ville dans le titre de la page d’accueil', how: 'Par exemple « Activité à Ville | Nom » : les IA associent ainsi votre nom au lieu que vos clients demandent.' },
  prices: { title: 'Afficher des prix ou des fourchettes de prix', how: 'Une grille ou des « à partir de » vérifiables : les IA citent volontiers ce qui répond à « combien ça coûte ».' },
  sameas: { title: 'Relier votre site à vos profils publics', how: 'Ajoutez dans vos données structurées les liens vers votre fiche Google, vos annuaires et réseaux (sameAs) : les IA recoupent ces sources.' },
  content: { title: 'Développer le texte de présentation de la page d’accueil', how: 'Qui vous êtes, ce que vous faites, pour qui, où, depuis quand : 300 mots utiles, avec des faits vérifiables.' },
};

/**
 * Termine les explications : écarts de site (concurrent lu vs vos pages), points forts, 3 premières actions.
 * `competitorPages` : URL → signaux de sa page d'accueil (null = page non lue, avec la raison si connue).
 */
export function finalizeWhy(
  drafts: CompetitorWhy[],
  ctx: {
    ours: SignalMap;
    competitorPages: Map<string, { signals: SignalMap | null; note?: string; finalUrl?: string }>;
    siteType: SiteType;
    autoFixes: FullAnalysis['autoFixes'];
    demo: boolean;
    measuredAt: string;
  },
): CompetitorWhy[] {
  const relevant = RELEVANT[ctx.siteType] ?? RELEVANT.local;
  const kinds = new Set(ctx.autoFixes.map((f) => f.kind));
  return drafts.map((d) => {
    const page = d.site ? ctx.competitorPages.get(d.site.url) : undefined;
    const theirs = page?.signals ?? null;
    const site = d.site
      ? { url: page?.finalUrl ?? d.site.url, read: !!theirs, ...(theirs ? {} : { note: page?.note ?? (ctx.demo ? 'Démonstration : nom simulé, aucun site lu.' : 'Page non lue dans le temps imparti.') }) }
      : null;
    const gaps = theirs ? relevant.filter((id) => theirs[id] && !ctx.ours[id]).map((id) => ({ id, label: SIGNAL_LABEL[id], evidence: theirs[id] })) : [];
    const strengths = theirs ? relevant.filter((id) => ctx.ours[id] && !theirs[id]).map((id) => ({ id, label: SIGNAL_LABEL[id] })).slice(0, 3) : [];
    const actions: WhyAction[] = [];
    // 1. Une source lue par l'IA qui nomme le concurrent et pas vous : la présence sur cette source.
    const src = d.sources.find((s) => s.them && !s.you && s.category !== 'concurrent' && s.category !== 'client');
    if (src) {
      const cls = classifyDomain(src.url);
      actions.push({
        title: `Être présent sur ${src.domain}`,
        how: `${cls.howTo ?? `Les IA y ont lu ${d.competitor}, pas vous : créez ou complétez votre fiche, avec les mêmes nom, adresse et téléphone que sur votre site.`} Repéré vous guide ; nous ne créons jamais de faux compte ni d’avis.`,
        by: 'vous',
        from: 'source',
      });
    }
    // 2. Écarts de site, ceux que Repéré prépare d'abord (correctif disponible dans votre analyse).
    const gapIds = gaps.map((g) => g.id);
    const ordered = [...gapIds.filter((id) => (REPERE_KINDS[id] ?? []).some((k) => kinds.has(k))), ...gapIds.filter((id) => !(REPERE_KINDS[id] ?? []).some((k) => kinds.has(k)))];
    for (const id of ordered) {
      if (actions.length >= 3) break;
      const repere = (REPERE_KINDS[id] ?? []).some((k) => kinds.has(k)) || ((id === 'entity' || id === 'sameas') && !ctx.ours.entity);
      actions.push({ ...ACTION_COPY[id], by: repere ? 'repere' : 'vous', from: id });
    }
    // 3. Site du concurrent non lu : les manques de VOTRE site parmi les signaux utiles (sans rien prêter au concurrent).
    if (!theirs) {
      for (const id of relevant) {
        if (actions.length >= 3) break;
        if (ctx.ours[id] || actions.some((a) => a.from === id)) continue;
        const repere = (REPERE_KINDS[id] ?? []).some((k) => kinds.has(k)) || id === 'entity';
        actions.push({ ...ACTION_COPY[id], by: repere ? 'repere' : 'vous', from: id });
      }
    }
    const when = new Date(ctx.measuredAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
    const basis = theirs
      ? `Page d’accueil de ${d.competitor} lue le ${when}, comparée aux pages de votre site lues par l’analyse ; sources telles que renvoyées par les IA.`
      : `Sources telles que renvoyées par les IA le ${when}. ${site?.note ?? 'Site de ce concurrent non repéré dans les réponses : pas de comparaison de site.'} Les actions portent sur ce qui manque à votre site.`;
    return { ...d, site, gaps, strengths, actions: actions.slice(0, 3), basis };
  });
}
