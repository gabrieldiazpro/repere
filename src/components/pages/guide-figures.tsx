/**
 * Schémas des guides V5 : SVG faits maison, texte en français dans le SVG (lisible par les lecteurs d'écran via
 * <title> et <desc>), couleurs par jetons (currentColor + variables de ton), aucun logo. Composants serveur.
 * Chaque schéma a une légende (figcaption) qui dit ce qu'il montre.
 */
import type { ReactNode } from "react";

const INK = "currentColor";
const BRAND = "var(--tone-brand-solid, #3730a3)";
const WARN = "var(--tone-warn-solid, #b45309)";
const UP = "var(--tone-up-solid, #15803d)";
const DOWN = "var(--tone-down-solid, #b91c1c)";
const LINE = "var(--tone-neutral-line, #d5d9e4)";
const SOFT = "var(--tone-neutral-bg, #eef0f5)";

function Fig({ id, title, desc, caption, viewBox, children }: { id: string; title: string; desc: string; caption: string; viewBox: string; children: ReactNode }) {
  return (
    <figure className="my-6 rounded-xl border p-3 sm:p-4" style={{ borderColor: "var(--line)", background: "#fff" }}>
      <svg viewBox={viewBox} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full text-[#1b1f2e]" fontFamily="inherit">
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        {children}
      </svg>
      <figcaption className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        {caption}
      </figcaption>
    </figure>
  );
}

function Box({ x, y, w, h, label, sub, fill = SOFT, stroke = LINE, color = INK }: { x: number; y: number; w: number; h: number; label: string; sub?: string; fill?: string; stroke?: string; color?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 4 : h / 2 + 5)} textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>
        {label}
      </text>
      {sub ? (
        <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fontSize="11.5" fill={color} opacity=".75">
          {sub}
        </text>
      ) : null}
    </g>
  );
}

function Arrow({ d, color = INK, dashed = false }: { d: string; color?: string; dashed?: boolean }) {
  return <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeDasharray={dashed ? "4 4" : undefined} markerEnd="url(#gf-arrow)" />;
}

const Defs = () => (
  <defs>
    <marker id="gf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
    </marker>
  </defs>
);

export function DeuxLecteurs() {
  return (
    <Fig
      id="gf-deux"
      viewBox="0 0 640 250"
      title="Deux lecteurs, un même site"
      desc="Votre site est lu par Googlebot, qui indexe puis classe des pages dans une liste, et par les robots de recherche des IA, qui extraient des passages et citent quelques sources dans une réponse."
      caption="Google classe des pages ; les IA citent des passages. Les deux partent de ce que leurs robots peuvent lire sur votre site."
    >
      <Defs />
      <Box x={10} y={95} w={130} h={60} label="Votre site" sub="HTML, robots.txt" />
      <Arrow d="M140 112 C180 112 180 50 215 50" color={BRAND} />
      <Arrow d="M140 138 C180 138 180 200 215 200" color={WARN} />
      <Box x={218} y={22} w={130} h={56} label="Googlebot" sub="explore, rend" stroke={BRAND} />
      <Box x={218} y={172} w={130} h={56} label="Robots des IA" sub="souvent sans JavaScript" stroke={WARN} />
      <Arrow d="M348 50 L392 50" color={BRAND} />
      <Arrow d="M348 200 L392 200" color={WARN} />
      <Box x={395} y={22} w={110} h={56} label="Index" sub="puis classement" stroke={BRAND} />
      <Box x={395} y={172} w={110} h={56} label="Passages" sub="sous-questions" stroke={WARN} />
      <Arrow d="M505 50 L540 50" color={BRAND} />
      <Arrow d="M505 200 L540 200" color={WARN} />
      <Box x={543} y={14} w={90} h={72} label="Une liste" sub="positions 1 à 10" fill="#fff" stroke={BRAND} />
      <Box x={543} y={164} w={90} h={72} label="Une réponse" sub="3 à 5 noms" fill="#fff" stroke={WARN} />
      <text x="320" y="128" textAnchor="middle" fontSize="12" fill={INK} opacity=".7">
        Les aperçus IA de Google s’appuient sur l’index
      </text>
      <Arrow d="M450 80 L450 108 L560 108 L560 160" color={BRAND} dashed />
    </Fig>
  );
}

export function OrdreAction() {
  const rows = [
    { label: "1. Accès", sub: "robots.txt, noindex, pare-feu, texte dans le HTML", w: 600 },
    { label: "2. Identité", sub: "mêmes nom, adresse, téléphone partout", w: 520 },
    { label: "3. Pages qui répondent", sub: "une page par besoin, réponse en tête", w: 440 },
    { label: "4. Technique fine", sub: "doublons, liens, vitesse, images", w: 360 },
    { label: "5. Présence ailleurs", sub: "fiches, annuaires, comparatifs, médias", w: 280 },
  ];
  return (
    <Fig
      id="gf-ordre"
      viewBox="0 0 640 300"
      title="Dans quel ordre agir"
      desc="Une pile de cinq chantiers, du plus fondamental en bas au plus avancé en haut : accès, identité, pages qui répondent, technique fine, présence ailleurs."
      caption="Un chantier du bas annule ceux du haut : on commence par l’accès des robots."
    >
      {rows
        .slice()
        .reverse()
        .map((r, i) => {
          const y = 10 + i * 56;
          const x = (640 - r.w) / 2;
          const base = i === rows.length - 1;
          return (
            <g key={r.label}>
              <rect x={x} y={y} width={r.w} height={48} rx="10" fill={base ? BRAND : SOFT} stroke={base ? BRAND : LINE} strokeWidth="1.5" />
              <text x={320} y={y + 21} textAnchor="middle" fontSize="14" fontWeight="700" fill={base ? "#fff" : INK}>
                {r.label}
              </text>
              <text x={320} y={y + 38} textAnchor="middle" fontSize="11.5" fill={base ? "#fff" : INK} opacity={base ? 0.9 : 0.75}>
                {r.sub}
              </text>
            </g>
          );
        })}
    </Fig>
  );
}

export function TriangleNap() {
  return (
    <Fig
      id="gf-nap"
      viewBox="0 0 640 280"
      title="Le triangle de cohérence"
      desc="Votre site, votre fiche Google et les annuaires doivent donner le même nom, la même adresse et le même téléphone. Au centre, Google et les IA comparent les trois."
      caption="Exemple fictif : un ancien numéro dans un annuaire suffit à créer le doute."
    >
      <Defs />
      <line x1="320" y1="62" x2="130" y2="222" stroke={LINE} strokeWidth="2" />
      <line x1="320" y1="62" x2="510" y2="222" stroke={LINE} strokeWidth="2" />
      <line x1="130" y1="222" x2="510" y2="222" stroke={DOWN} strokeWidth="2" strokeDasharray="5 4" />
      <Box x={235} y={18} w={170} h={64} label="Votre site" sub="04 78 00 00 00" stroke={UP} />
      <Box x={30} y={196} w={200} h={64} label="Fiche Google" sub="04 78 00 00 00" stroke={UP} />
      <Box x={410} y={196} w={200} h={64} label="Annuaire" sub="04 72 11 11 11 (ancien)" stroke={DOWN} />
      <circle cx="320" cy="160" r="40" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <text x="320" y="156" textAnchor="middle" fontSize="12.5" fontWeight="700" fill={INK}>
        Google
      </text>
      <text x="320" y="172" textAnchor="middle" fontSize="12.5" fontWeight="700" fill={INK}>
        et les IA
      </text>
      <text x="320" y="245" textAnchor="middle" fontSize="12" fill={DOWN}>
        Deux numéros différents
      </text>
    </Fig>
  );
}

export function JsonLdVisible() {
  return (
    <Fig
      id="gf-jsonld"
      viewBox="0 0 640 230"
      title="Le balisage doit refléter la page"
      desc="À gauche, ce que voit le client : prix 34 euros, en stock. À droite, le balisage JSON-LD : il doit donner exactement le même prix et la même disponibilité. Un prix balisé à 29 euros est une erreur."
      caption="Le balisage décrit la page ; il ne la contredit jamais."
    >
      <rect x="10" y="10" width="290" height="210" rx="12" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      <text x="30" y="40" fontSize="13" fontWeight="700" fill={INK}>Ce que voit le client</text>
      <rect x="30" y="54" width="90" height="70" rx="8" fill={SOFT} />
      <text x="135" y="72" fontSize="13" fontWeight="700" fill={INK}>Savon solide 100 g</text>
      <text x="135" y="96" fontSize="20" fontWeight="700" fill={INK}>34,00 €</text>
      <text x="135" y="118" fontSize="12" fill={UP}>En stock</text>
      <text x="30" y="160" fontSize="12" fill={INK} opacity=".75">Retours gratuits sous 30 jours</text>
      <rect x="340" y="10" width="290" height="210" rx="12" fill="#1b1f2e" />
      <text x="360" y="40" fontSize="13" fontWeight="700" fill="#fff">Le balisage (JSON-LD)</text>
      <text x="360" y="72" fontSize="12.5" fill="#c9c6f2" fontFamily="ui-monospace, monospace">"@type": "Product",</text>
      <text x="360" y="94" fontSize="12.5" fill="#c9c6f2" fontFamily="ui-monospace, monospace">"price": "34.00",</text>
      <text x="360" y="116" fontSize="12.5" fill="#c9c6f2" fontFamily="ui-monospace, monospace">"priceCurrency": "EUR",</text>
      <text x="360" y="138" fontSize="12.5" fill="#c9c6f2" fontFamily="ui-monospace, monospace">"availability": "InStock"</text>
      <text x="360" y="180" fontSize="12" fill="#fca5a5">Pas « 29.00 » : ce serait faux</text>
      <path d="M300 100 L340 100" stroke={UP} strokeWidth="2" />
      <circle cx="320" cy="100" r="11" fill={UP} />
      <path d="M314 100 l4 4 l8 -8" stroke="#fff" strokeWidth="2" fill="none" />
    </Fig>
  );
}

export function ScEntonnoir() {
  const steps = [
    { label: "Impressions", value: "1 200", w: 560, color: SOFT },
    { label: "Clics", value: "48", w: 300, color: SOFT },
    { label: "CTR", value: "4 %", w: 200, color: SOFT },
  ];
  return (
    <Fig
      id="gf-sc"
      viewBox="0 0 640 220"
      title="Des impressions aux clics"
      desc="Exemple fictif pour la requête plombier lyon 3 : 1 200 impressions, 48 clics, soit un taux de clic de 4 %, en position moyenne 6,3."
      caption="Exemple fictif, requête « plombier lyon 3 » sur trois mois : vue 1 200 fois, cliquée 48 fois, en position moyenne 6,3."
    >
      {steps.map((s, i) => {
        const y = 12 + i * 62;
        const x = (640 - s.w) / 2;
        return (
          <g key={s.label}>
            <rect x={x} y={y} width={s.w} height={50} rx="10" fill={i === 1 ? BRAND : s.color} stroke={i === 1 ? BRAND : LINE} strokeWidth="1.5" />
            <text x={320} y={y + 21} textAnchor="middle" fontSize="13" fontWeight="700" fill={i === 1 ? "#fff" : INK}>
              {s.label}
            </text>
            <text x={320} y={y + 40} textAnchor="middle" fontSize="15" fontWeight="700" fill={i === 1 ? "#fff" : INK}>
              {s.value}
            </text>
          </g>
        );
      })}
      <text x="600" y="210" textAnchor="end" fontSize="12" fill={INK} opacity=".75">
        Position moyenne : 6,3
      </text>
    </Fig>
  );
}

export function CwvSeuils() {
  const rows = [
    { k: "LCP", name: "le contenu principal s’affiche", good: "≤ 2,5 s", mid: "2,5 à 4 s", bad: "> 4 s" },
    { k: "INP", name: "la page réagit au clic", good: "≤ 200 ms", mid: "200 à 500 ms", bad: "> 500 ms" },
    { k: "CLS", name: "la mise en page reste stable", good: "≤ 0,1", mid: "0,1 à 0,25", bad: "> 0,25" },
  ];
  return (
    <Fig
      id="gf-cwv"
      viewBox="0 0 640 236"
      title="Les trois Signaux Web essentiels"
      desc="LCP bon jusqu'à 2,5 secondes, mauvais au-delà de 4 ; INP bon jusqu'à 200 millisecondes, mauvais au-delà de 500 ; CLS bon jusqu'à 0,1, mauvais au-delà de 0,25. Jugés au 75e centile des visites."
      caption="Seuils publiés par Google (web.dev), jugés au 75e centile des visites réelles."
    >
      {rows.map((r, i) => {
        const y = 10 + i * 74;
        return (
          <g key={r.k}>
            <text x="10" y={y + 18} fontSize="15" fontWeight="700" fill={INK}>
              {r.k}
            </text>
            <text x="58" y={y + 18} fontSize="12.5" fill={INK} opacity=".75">
              {r.name}
            </text>
            <rect x="10" y={y + 28} width="200" height="34" fill="var(--tone-up-bg, #e7f6ec)" />
            <rect x="210" y={y + 28} width="210" height="34" fill="var(--tone-warn-bg, #fdf1e3)" />
            <rect x="420" y={y + 28} width="210" height="34" fill="var(--tone-down-bg, #fdecec)" />
            <text x="110" y={y + 50} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={UP}>
              Bon {r.good}
            </text>
            <text x="315" y={y + 50} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={WARN}>
              À améliorer {r.mid}
            </text>
            <text x="525" y={y + 50} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={DOWN}>
              Mauvais {r.bad}
            </text>
          </g>
        );
      })}
    </Fig>
  );
}

export function RobotsRoles() {
  const cols = [
    { title: "Entraînement", sub: "bloquer : votre choix", bots: ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"], color: LINE },
    { title: "Recherche", sub: "à autoriser pour être cité", bots: ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot", "Googlebot, Bingbot"], color: UP },
    { title: "À la demande", sub: "lit une page citée", bots: ["ChatGPT-User", "Claude-User", "Perplexity-User", "MistralAI-User"], color: BRAND },
  ];
  return (
    <Fig
      id="gf-robots"
      viewBox="0 0 640 230"
      title="Les robots des IA, par rôle"
      desc="Trois familles : les robots d'entraînement (GPTBot, ClaudeBot, Google-Extended, CCBot), que vous pouvez bloquer ; les robots de recherche (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot), à autoriser pour être cité ; les robots à la demande (ChatGPT-User, Claude-User, Perplexity-User, MistralAI-User)."
      caption="Bloquer l’entraînement est un choix légitime ; bloquer la recherche vous retire des réponses."
    >
      {cols.map((c, i) => {
        const x = 10 + i * 210;
        return (
          <g key={c.title}>
            <rect x={x} y="10" width="200" height="210" rx="12" fill="#fff" stroke={c.color} strokeWidth="2" />
            <text x={x + 16} y="38" fontSize="15" fontWeight="700" fill={INK}>
              {c.title}
            </text>
            <text x={x + 16} y="57" fontSize="11.5" fill={INK} opacity=".75">
              {c.sub}
            </text>
            {c.bots.map((b, j) => (
              <g key={b}>
                <rect x={x + 16} y={74 + j * 34} width="168" height="26" rx="6" fill={SOFT} />
                <text x={x + 26} y={91 + j * 34} fontSize="12.5" fill={INK} fontFamily="ui-monospace, monospace">
                  {b}
                </text>
              </g>
            ))}
          </g>
        );
      })}
    </Fig>
  );
}

export function FicheAnatomie() {
  const notes = [
    { y: 34, text: "Titre : produit, usage, variante", color: BRAND },
    { y: 84, text: "Réponse en tête : pour qui, pour quoi", color: UP },
    { y: 134, text: "Attributs en texte : matière, taille, compatibilité", color: BRAND },
    { y: 184, text: "Questions de vos clients, réponses visibles", color: WARN },
    { y: 234, text: "Prix, stock, retours : balisés à l’identique", color: UP },
  ];
  return (
    <Fig
      id="gf-fiche"
      viewBox="0 0 640 270"
      title="Anatomie d’une fiche produit lisible"
      desc="Une fiche produit avec cinq zones annotées : titre précis, réponse en tête, attributs écrits en texte, questions de clients avec réponses visibles, prix, stock et retours balisés à l'identique."
      caption="Ce que Google, Shopping et les IA peuvent lire sans ambiguïté."
    >
      <Defs />
      <rect x="10" y="10" width="290" height="250" rx="12" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      <rect x="26" y="24" width="258" height="20" rx="4" fill={SOFT} />
      <rect x="26" y="70" width="200" height="12" rx="4" fill={SOFT} />
      <rect x="26" y="88" width="230" height="12" rx="4" fill={SOFT} />
      <rect x="26" y="120" width="120" height="12" rx="4" fill={SOFT} />
      <rect x="156" y="120" width="120" height="12" rx="4" fill={SOFT} />
      <rect x="26" y="140" width="120" height="12" rx="4" fill={SOFT} />
      <rect x="26" y="172" width="250" height="12" rx="4" fill={SOFT} />
      <rect x="26" y="190" width="210" height="12" rx="4" fill={SOFT} />
      <rect x="26" y="222" width="90" height="22" rx="6" fill={BRAND} />
      <rect x="126" y="226" width="80" height="14" rx="4" fill={SOFT} />
      {notes.map((n) => (
        <g key={n.text}>
          <Arrow d={`M ${n.y === 234 ? 210 : 290} ${n.y} L 330 ${n.y}`} color={n.color} />
          <text x="338" y={n.y + 4} fontSize="13" fill={INK}>
            {n.text}
          </text>
        </g>
      ))}
    </Fig>
  );
}

export function GuideFigure({ id }: { id: string }) {
  switch (id) {
    case "deux-lecteurs":
      return <DeuxLecteurs />;
    case "ordre-action":
      return <OrdreAction />;
    case "triangle-nap":
      return <TriangleNap />;
    case "jsonld-visible":
      return <JsonLdVisible />;
    case "sc-entonnoir":
      return <ScEntonnoir />;
    case "cwv-seuils":
      return <CwvSeuils />;
    case "robots-roles":
      return <RobotsRoles />;
    case "fiche-anatomie":
      return <FicheAnatomie />;
    default:
      return null;
  }
}

export const GUIDE_FIGURE_IDS = ["deux-lecteurs", "ordre-action", "triangle-nap", "jsonld-visible", "sc-entonnoir", "cwv-seuils", "robots-roles", "fiche-anatomie"] as const;
