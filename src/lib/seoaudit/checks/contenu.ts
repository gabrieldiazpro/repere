/** Section « Balises et contenu » : titres, descriptions, Hn, contenu, langue, partage, pages de confiance. */
import { proposeDescription, proposeTitle } from '../autofix';
import { SRC } from '../sources';
import type { AuditCtx, CheckDef, CrawledPage } from '../types';
import { headOf, pl } from '../util';
import { hitPages, hitSite } from './helpers';

const sec = 'contenu' as const;

const GENERIC_TITLE = /^(accueil|home|homepage|page d['’]accueil|untitled|sans titre|nouvelle page|new page|page d['’]exemple|sample page|mon site|my site|site web|website|document|index|bienvenue|welcome|just another wordpress site|un site utilisant wordpress)$/i;

function titleItems(ctx: AuditCtx, ps: CrawledPage[]) {
  return ps.map((p) => ({ url: p.finalUrl, value: proposeTitle(p, ctx.siteName), review: true }));
}
function descItems(ctx: AuditCtx, ps: CrawledPage[]) {
  return ps.map((p) => ({ url: p.finalUrl, value: proposeDescription(p, ctx.siteName), review: true }));
}

/** Le site a-t-il une page ou un lien correspondant ? (URL ou texte d'ancre). */
export function siteHasPage(ctx: AuditCtx, urlRe: RegExp, anchorRe: RegExp): boolean {
  if (ctx.pages.some((p) => urlRe.test(p.finalUrl) || urlRe.test(p.url))) return true;
  return ctx.crawl.links.some((l) => (l.internal && urlRe.test(l.to)) || anchorRe.test(l.anchor));
}

export const CONTENU: CheckDef[] = [
  {
    id: 'seo.title.missing', section: sec, category: 'balisage', severity: 'high', impact: 3, effort: 1, scope: 'page',
    label: 'Titre (balise title) absent',
    title: (n) => `${pl(n, 'page n’a', 'pages n’ont')} pas de titre`,
    why: 'Le titre est la ligne cliquable dans Google : sans lui, Google en invente un, souvent peu parlant.',
    fix: 'Donnez à chaque page un titre unique qui dit ce qu’on y trouve (et la ville pour un commerce local).',
    source: SRC.titleLink,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => !p.title?.trim());
      return hitPages(ps, undefined, { autoFix: { kind: 'meta.title', payload: { items: titleItems(ctx, ps) } } });
    },
  },
  {
    id: 'seo.title.too_long', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Titre trop long (> 60 caractères)',
    title: (n) => `${pl(n, 'titre dépasse', 'titres dépassent')} 60 caractères et risque d’être coupé`,
    why: 'Google tronque les titres trop longs (environ 600 pixels) : la fin, souvent votre nom, disparaît.',
    fix: 'Placez l’essentiel au début et visez 50 à 60 caractères.',
    source: SRC.titleLink,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => (p.title?.trim().length ?? 0) > 60);
      return hitPages(ps, (p) => `${p.title?.trim().length} car. : ${p.title}`, { autoFix: { kind: 'meta.title', payload: { items: titleItems(ctx, ps) } } });
    },
  },
  {
    id: 'seo.title.too_short', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Titre trop court (< 20 caractères)',
    title: (n) => `${pl(n, 'titre est trop court', 'titres sont trop courts')} pour décrire la page`,
    why: 'Un titre de deux mots ne dit ni ce que vous proposez ni où : Google le réécrit souvent.',
    fix: 'Complétez : activité + précision + ville ou marque (ex. « Plombier dépannage 24 h à Nantes | Dupont »).',
    source: SRC.titleLink,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => {
        const t = p.title?.trim() ?? '';
        return t.length > 0 && t.length < 20 && !GENERIC_TITLE.test(t);
      });
      return hitPages(ps, (p) => p.title, { autoFix: { kind: 'meta.title', payload: { items: titleItems(ctx, ps) } } });
    },
  },
  {
    id: 'seo.title.generic', section: sec, category: 'balisage', severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Titre générique (« Accueil », « Sans titre »…)',
    title: (n) => `${pl(n, 'page a', 'pages ont')} un titre générique (« Accueil », « Sans titre »…)`,
    why: 'Ces titres ne disent rien de votre activité : ils ne se positionnent sur aucune recherche.',
    fix: 'Remplacez-les par un titre descriptif propre à chaque page.',
    source: SRC.titleLink,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => {
        const t = (p.title ?? '').trim();
        if (!t) return false;
        return GENERIC_TITLE.test(t) || /just another wordpress site|un site utilisant wordpress/i.test(t);
      });
      return hitPages(ps, (p) => p.title, { autoFix: { kind: 'meta.title', payload: { items: titleItems(ctx, ps) } } });
    },
  },
  {
    id: 'seo.title.multiple', section: sec, category: 'balisage', severity: 'medium', impact: 1, effort: 1, scope: 'page',
    label: 'Plusieurs balises title',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} plusieurs balises <title>`,
    why: 'Google doit deviner lequel utiliser : souvent un conflit entre le thème et une extension SEO.',
    fix: 'Gardez une seule balise <title> (désactivez le doublon du thème ou de l’extension).',
    source: SRC.titleLink,
    run: (ctx) => hitPages(ctx.html.filter((p) => !!p.html && (headOf(p.html).match(/<title\b/gi)?.length ?? 0) > 1)),
  },
  {
    id: 'seo.meta.missing', section: sec, category: 'balisage', severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Meta description absente',
    title: (n) => `${pl(n, 'page n’a', 'pages n’ont')} pas de description (meta description)`,
    why: 'La description est votre « pitch » sous le titre dans Google ; sans elle, Google prend un bout de texte au hasard.',
    fix: 'Rédigez 1 à 2 phrases (≈ 150 caractères) qui donnent envie de cliquer. Nous en proposons une par page.',
    source: SRC.snippet,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => !p.metaDescription?.trim());
      return hitPages(ps, undefined, { autoFix: { kind: 'meta.description', payload: { items: descItems(ctx, ps) } } });
    },
  },
  {
    id: 'seo.meta.too_long', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Meta description trop longue (> 160)',
    title: (n) => `${pl(n, 'description dépasse', 'descriptions dépassent')} 160 caractères`,
    why: 'Au-delà, la description est coupée dans les résultats.',
    fix: 'Raccourcissez à environ 150 caractères, message clé en premier.',
    source: SRC.snippet,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => (p.metaDescription?.trim().length ?? 0) > 160);
      return hitPages(ps, (p) => `${p.metaDescription?.trim().length} car.`, { autoFix: { kind: 'meta.description', payload: { items: descItems(ctx, ps) } } });
    },
  },
  {
    id: 'seo.meta.too_short', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Meta description trop courte (< 50)',
    title: (n) => `${pl(n, 'description est trop courte', 'descriptions sont trop courtes')}`,
    why: 'Une description de quelques mots ne convainc pas et Google la remplace souvent.',
    fix: 'Visez 120 à 155 caractères : ce que vous proposez, pour qui, où, et un argument.',
    source: SRC.snippet,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => {
        const n = p.metaDescription?.trim().length ?? 0;
        return n > 0 && n < 50;
      });
      return hitPages(ps, (p) => p.metaDescription, { autoFix: { kind: 'meta.description', payload: { items: descItems(ctx, ps) } } });
    },
  },
  {
    id: 'seo.h1.missing', section: sec, category: 'contenu', severity: 'medium', impact: 2, effort: 1, scope: 'page',
    label: 'Titre principal H1 absent',
    title: (n) => `${pl(n, 'page n’a', 'pages n’ont')} pas de titre principal (H1)`,
    why: 'Le H1 annonce le sujet de la page aux visiteurs, à Google et aux IA.',
    fix: 'Ajoutez un H1 unique et explicite en haut de la page.',
    source: SRC.seoStarter,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.h1.length === 0)),
  },
  {
    id: 'seo.h1.empty', section: sec, category: 'contenu', severity: 'medium', impact: 1, effort: 1, scope: 'page',
    label: 'H1 vide',
    title: (n) => `${pl(n, 'page a', 'pages ont')} un H1 vide (ou une image sans texte)`,
    why: 'Un H1 vide ne transmet aucune information sur le sujet de la page.',
    fix: 'Mettez un vrai texte dans le H1 (ou un texte alternatif si c’est un logo).',
    source: SRC.seoStarter,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.h1.length > 0 && p.h1.every((h) => !h.trim()))),
  },
  {
    id: 'seo.h1.multiple', section: sec, category: 'contenu', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Plusieurs H1',
    title: (n) => `${pl(n, 'page a', 'pages ont')} plusieurs H1`,
    why: 'Ce n’est pas une erreur pour Google, mais un seul H1 clair rend le sujet de la page plus net.',
    fix: 'Gardez un H1 et passez les autres en H2.',
    source: SRC.seoStarter,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.h1.filter((h) => h.trim()).length > 1), (p) => p.h1.slice(0, 3).join(' / ')),
  },
  {
    id: 'seo.h1.too_long', section: sec, category: 'contenu', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'H1 trop long (> 80)',
    title: (n) => `${pl(n, 'H1 dépasse', 'H1 dépassent')} 80 caractères`,
    why: 'Un titre principal trop long est moins lisible et dilue le sujet.',
    fix: 'Resserrez le H1 sur le sujet principal ; détaillez dans le texte.',
    source: SRC.seoStarter,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.h1.some((h) => h.trim().length > 80))),
  },
  {
    id: 'seo.headings.skip', section: sec, category: 'contenu', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Hiérarchie des intertitres incohérente',
    title: (n) => `${pl(n, 'page saute', 'pages sautent')} des niveaux d’intertitres (ex. H2 → H4)`,
    why: 'Une structure claire aide les lecteurs d’écran, Google et les IA à découper votre contenu.',
    fix: 'Enchaînez H1 → H2 → H3 sans sauter de niveau.',
    source: SRC.seoStarter,
    run: (ctx) => hitPages(ctx.html.filter((p) => {
      let prev = 0;
      for (const h of p.headings) {
        if (prev && h.level > prev + 1) return true;
        prev = h.level;
      }
      return false;
    })),
  },
  {
    id: 'seo.headings.no_h2', section: sec, category: 'contenu', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Long texte sans intertitre',
    title: (n) => `${pl(n, 'longue page n’a', 'longues pages n’ont')} aucun intertitre (H2)`,
    why: 'Un bloc de texte sans intertitres se lit mal et se découpe mal en réponses par Google et les IA.',
    fix: 'Ajoutez des intertitres H2 tous les 2 à 4 paragraphes, formulés comme les questions de vos clients.',
    source: SRC.helpful,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => p.wordCount >= 600 && !p.headings.some((h) => h.level === 2)), (p) => `${p.wordCount} mots`),
  },
  {
    id: 'seo.content.thin', section: sec, category: 'contenu', severity: 'medium', impact: 2, effort: 2, scope: 'page',
    label: 'Pages au contenu très court',
    title: (n) => `${pl(n, 'page indexable contient', 'pages indexables contiennent')} moins de 200 mots`,
    why: 'Les pages trop pauvres répondent mal aux questions et sont rarement bien classées ou citées.',
    fix: 'Enrichissez avec ce que vos clients demandent : prestations, prix indicatifs, délais, zone, exemples, questions fréquentes.',
    source: SRC.helpful,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => p !== ctx.home && p.wordCount < 200 && !/contact|mentions|legal|cgv|cgu|confidentialit|privacy|plan-du-site/i.test(p.finalUrl) && !ctx.isProduct(p) && !p.renderHints.likelyClientRendered), (p) => `${p.wordCount} mots`),
  },
  {
    id: 'seo.content.home_thin', section: sec, category: 'contenu', severity: 'medium', impact: 2, effort: 2, scope: 'site',
    label: 'Page d’accueil trop pauvre en texte',
    title: () => 'Votre page d’accueil contient très peu de texte',
    why: 'L’accueil doit dire clairement qui vous êtes, ce que vous faites et où : c’est la page que Google et les IA lisent en premier.',
    fix: 'Ajoutez 250 mots minimum : activité, services phares, zone, preuves (avis, années d’expérience), contact.',
    source: SRC.helpful,
    run: (ctx) => (ctx.home && ctx.home.status === 200 && ctx.home.wordCount < 250 && !ctx.home.renderHints.likelyClientRendered ? hitSite(ctx, `${ctx.home.wordCount} mots`) : null),
  },
  {
    id: 'seo.content.lorem', section: sec, category: 'contenu', severity: 'high', impact: 2, effort: 1, scope: 'page',
    label: 'Texte de remplissage (lorem ipsum)',
    title: (n) => `${pl(n, 'page contient', 'pages contiennent')} du faux texte « lorem ipsum »`,
    why: 'Un texte provisoire oublié fait amateur et signale à Google une page inachevée.',
    fix: 'Remplacez-le par votre vrai contenu ou dépubliez la page.',
    source: SRC.helpful,
    run: (ctx) => hitPages(ctx.html.filter((p) => /lorem ipsum|dolor sit amet/i.test(ctx.text(p)))),
  },
  {
    id: 'seo.content.text_ratio', section: sec, category: 'contenu', severity: 'low', impact: 1, effort: 2, scope: 'page',
    label: 'Très peu de texte par rapport au code',
    title: (n) => `${pl(n, 'page a', 'pages ont')} très peu de texte au regard du code (moins de 3 %)`,
    why: 'Souvent le signe d’un constructeur de pages lourd : plus lent, et un contenu noyé dans le code.',
    fix: 'Allégez le gabarit (modules inutiles) et étoffez le texte utile.',
    source: SRC.helpful,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => p.renderHints.textToHtmlRatio > 0 && p.renderHints.textToHtmlRatio < 0.03 && p.bytes > 50_000), (p) => `${(p.renderHints.textToHtmlRatio * 100).toFixed(1)} %`),
  },
  {
    id: 'seo.lang.missing', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Langue de la page non déclarée',
    title: (n) => `${pl(n, 'page ne déclare', 'pages ne déclarent')} pas sa langue (attribut lang)`,
    why: 'La langue déclarée aide les moteurs, les IA et les lecteurs d’écran à bien traiter le texte.',
    fix: 'Ajoutez lang="fr" sur la balise <html>.',
    source: SRC.htmlLang,
    run: (ctx) => hitPages(ctx.html.filter((p) => !p.lang?.trim())),
  },
  {
    id: 'seo.og.missing', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Balises de partage (Open Graph) absentes',
    title: (n) => `${pl(n, 'page n’a', 'pages n’ont')} pas de balises de partage (Open Graph)`,
    why: 'Partagée sur Facebook, LinkedIn ou WhatsApp, la page s’affiche sans titre ni image soignés.',
    fix: 'Ajoutez og:title, og:description et og:image (la plupart des extensions SEO le font).',
    source: SRC.ogp,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => !p.openGraph['og:title'] && !p.openGraph['og:image'])),
  },
  {
    id: 'seo.og.image_missing', section: sec, category: 'balisage', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Image de partage (og:image) absente',
    title: (n) => `${pl(n, 'page n’a', 'pages n’ont')} pas d’image de partage (og:image)`,
    why: 'Sans image, vos liens partagés attirent beaucoup moins l’œil.',
    fix: 'Définissez une image de partage par défaut (1200 × 630 px) et une par page importante.',
    source: SRC.ogp,
    run: (ctx) => hitPages(ctx.indexable.filter((p) => !!p.openGraph['og:title'] && !p.openGraph['og:image'])),
  },
  {
    id: 'seo.meta.keywords', section: sec, category: 'balisage', severity: 'info', impact: 1, effort: 1, scope: 'site',
    label: 'Balise meta keywords (ignorée)',
    title: () => 'Votre site utilise la balise « meta keywords », ignorée par Google',
    why: 'Google n’en tient aucun compte depuis 2009 ; elle montre votre liste de mots-clés à vos concurrents.',
    fix: 'Vous pouvez la retirer ; concentrez l’effort sur les titres et les textes.',
    source: SRC.seoStarter,
    run: (ctx) => {
      const ps = ctx.html.filter((p) => !!p.html && /<meta[^>]+name\s*=\s*["']?keywords/i.test(headOf(p.html)));
      return ps.length ? { items: ps.map((p) => ({ url: p.finalUrl })) } : null;
    },
  },
  {
    id: 'seo.trust.legal_missing', section: sec, category: 'contenu', severity: 'medium', impact: 2, effort: 1, scope: 'site',
    label: 'Mentions légales introuvables',
    title: () => 'Aucune page « Mentions légales » trouvée',
    why: 'Obligatoire pour tout site professionnel en France (identité de l’éditeur, hébergeur) ; c’est aussi un signal de confiance.',
    fix: 'Publiez une page « Mentions légales » liée depuis le pied de page de toutes les pages.',
    source: SRC.mentionsLegales,
    run: (ctx) => (siteHasPage(ctx, /mentions?-legales|legal-notice|mentions_legales|\/legal\b|impressum/i, /mentions\s+l[ée]gales|legal notice/i) ? null : hitSite(ctx)),
  },
  {
    id: 'seo.trust.privacy_missing', section: sec, category: 'contenu', severity: 'low', impact: 1, effort: 1, scope: 'site',
    label: 'Politique de confidentialité introuvable',
    title: () => 'Aucune politique de confidentialité trouvée',
    why: 'Dès qu’un formulaire ou des cookies collectent des données, le RGPD impose d’informer les visiteurs.',
    fix: 'Publiez une page « Politique de confidentialité » liée depuis le pied de page.',
    source: SRC.rgpd,
    run: (ctx) => (siteHasPage(ctx, /confidentialit|privacy|donnees-personnelles|rgpd|vie-privee/i, /confidentialit|donn[ée]es personnelles|privacy|rgpd|vie priv[ée]e/i) ? null : hitSite(ctx)),
  },
  {
    id: 'seo.trust.contact_missing', section: sec, category: 'contenu', severity: 'medium', impact: 2, effort: 1, scope: 'site', types: ['pme', 'ecommerce'],
    label: 'Page contact introuvable',
    title: () => 'Aucune page de contact trouvée',
    why: 'Les visiteurs (et Google, dans ses consignes de qualité) cherchent qui est derrière le site et comment le joindre.',
    fix: 'Publiez une page « Contact » (téléphone, e-mail, adresse) liée depuis le menu ou le pied de page.',
    source: SRC.helpful,
    run: (ctx) => (siteHasPage(ctx, /contact|nous-joindre|joindre/i, /contact|nous joindre|nous écrire/i) ? null : hitSite(ctx)),
  },
  {
    id: 'seo.trust.about_missing', section: sec, category: 'contenu', severity: 'low', impact: 1, effort: 2, scope: 'site', types: ['pme', 'ecommerce'],
    label: 'Page « Qui sommes-nous » introuvable',
    title: () => 'Aucune page de présentation (« Qui sommes-nous », « À propos ») trouvée',
    why: 'Montrer qui vous êtes (équipe, histoire, expertise) renforce la confiance des visiteurs, de Google et des IA.',
    fix: 'Créez une page de présentation avec votre histoire, votre équipe et vos références.',
    source: SRC.helpful,
    run: (ctx) => (siteHasPage(ctx, /qui-sommes-nous|a-propos|about|notre-histoire|notre-equipe|equipe|l-entreprise|presentation/i, /qui sommes[- ]nous|à propos|a propos|about|notre (histoire|équipe|equipe)|l['’]entreprise/i) ? null : hitSite(ctx)),
  },
];
