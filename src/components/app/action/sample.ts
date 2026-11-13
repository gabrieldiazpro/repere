// Page d'exemple pour l'audit de page en démo (aucun appel réseau). Contenu volontairement perfectible et
// étiqueté « page d'exemple » à l'écran : il sert à montrer les règles, pas à décrire un vrai commerce.
import type { Segment } from '@/lib/engine/types-v2';

const BODY: Record<Segment, { title: string; h1: string; paras: string[] }> = {
  local: {
    title: 'Nos services',
    h1: 'Bienvenue chez nous',
    paras: [
      'Depuis de nombreuses années, notre équipe passionnée met tout son savoir-faire à votre service avec sérieux et professionnalisme.',
      'Nous intervenons rapidement pour tous vos besoins. N’hésitez pas à nous contacter pour plus d’informations, nous serons ravis de vous aider.',
      'Devis sur demande. Contactez-nous.',
    ],
  },
  pme: {
    title: 'Notre solution',
    h1: 'La solution qui simplifie votre quotidien',
    paras: [
      'Notre plateforme innovante accompagne les équipes ambitieuses dans leur transformation, grâce à une approche unique et des fonctionnalités puissantes.',
      'Des centaines d’entreprises nous font confiance. Demandez une démo pour découvrir tout ce que nous pouvons faire pour vous.',
    ],
  },
  ecommerce: {
    title: 'Notre boutique',
    h1: 'Des produits pensés pour vous',
    paras: [
      'Découvrez notre sélection de produits de qualité, choisis avec soin pour leur efficacité et leur douceur.',
      'Livraison rapide. Satisfait ou remboursé. Profitez de nos offres du moment.',
    ],
  },
};

export function sampleHtml(segment: Segment, name: string): string {
  const b = BODY[segment];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(b.title)} | ${esc(name)}</title></head><body><header><nav><a href="/">Accueil</a> <a href="/contact">Contact</a></nav></header><main><h1>${esc(b.h1)}</h1>${b.paras.map((p) => `<p>${esc(p)}</p>`).join('')}</main><footer>${esc(name)}</footer></body></html>`;
}

/** robots.txt d'exemple : un robot d'entraînement bloqué (sans effet sur les citations) et un robot de recherche bloqué. */
export const SAMPLE_ROBOTS = `User-agent: *
Disallow: /panier

User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

Sitemap: https://www.exemple.fr/sitemap.xml
`;

/** Adresse fictive de la page d'exemple (domaine réservé « exemple.fr », jamais appelé). */
export const SAMPLE_URL = 'https://www.exemple.fr/';
