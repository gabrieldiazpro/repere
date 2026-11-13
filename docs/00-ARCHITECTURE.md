# AuditIA Local — brief commun et architecture (source de vérité pour tous les agents)

## Le produit
AuditIA Local mesure si un commerce/artisan local est recommandé par les assistants IA
(ChatGPT, Perplexity, Gemini — plus tard Claude, Google AI Overviews) quand un client potentiel
demande « meilleur plombier Paris 11e », « bon restaurant italien près de Bastille », etc.

Offre (provisoire, l'agent pricing peut l'affiner) :
- Audit gratuit : score de visibilité IA /100 + PDF, concurrents cités à sa place.
- Suivi mensuel : 29 €/mois (audit refait chaque mois, évolution, alertes, concurrents).
- Plan d'action : 149 € une fois (actions concrètes personnalisées pour remonter dans les IA).
Cible : TPE locales françaises (artisans, restaurants, cabinets, agences immo, instituts…), Paris d'abord.
Fondateur solo, budget 0–50 €, tout doit tourner sur des offres gratuites + paiement à l'usage.
Langue de tout le produit : français. Ton : clair, concret, sans jargon (« GEO » expliqué simplement).

## Livrables finaux
1. **Démo live** : une page HTML autonome publiée comme artefact claude.ai (landing + audit réel en direct via
   la capacité `sample` qui interroge Claude + rapport + capture de leads via `db`).
2. **Code production** : `/home/claude/auditia/app` — Next.js (App Router, TypeScript, Tailwind), déployable
   sur Vercel gratuit. Moteur d'audit réel multi-IA. PWA installable = « l'app ».
3. **Kit business** : stratégie, offre, juridique, prospection, SEO (doc à partir de `docs/`).

## Stack (production)
- Next.js 15 App Router + TypeScript strict + Tailwind CSS.
- Supabase (Postgres + Auth magic link) — tier gratuit.
- Stripe Payment Links / Checkout + webhook.
- Resend (e-mail, tier gratuit) pour envoyer le rapport et les alertes.
- Vercel Cron pour le ré-audit mensuel.
- PDF : @react-pdf/renderer côté serveur.
- PWA : manifest + service worker simple (installable sur mobile, notifications plus tard).
- Mode démo : si une clé API manque, le provider correspondant est remplacé par `mock` (données plausibles,
  clairement étiquetées « démo »). L'app doit builder et tourner sans aucune clé.

## Arborescence imposée
```
app/
  package.json, tsconfig.json, next.config.ts, tailwind/postcss config, .env.example, README.md
  supabase/schema.sql
  public/manifest.webmanifest, public/sw.js, public/icons/*
  src/lib/engine/        ← moteur (agent ENGINE)
    types.ts             types partagés (voir contrat ci-dessous)
    queries.ts           génération des requêtes à partir de métier + ville + quartier
    providers/openai.ts, perplexity.ts, gemini.ts, anthropic.ts, mock.ts, index.ts
    detect.ts            détection de la mention du commerce + extraction des concurrents cités
    scoring.ts           calcul du score /100 et sous-scores
    audit.ts             runAudit(input): Promise<AuditResult>
    actions.ts           génération du plan d'action à partir du résultat
  src/lib/db.ts, src/lib/stripe.ts, src/lib/email.ts, src/lib/pdf/Report.tsx
  src/app/                ← pages (agents FRONT)
    page.tsx (landing), audit/page.tsx (formulaire), rapport/[id]/page.tsx,
    tarifs/page.tsx, app/ (dashboard PWA: page.tsx, [businessId]/page.tsx),
    visibilite-ia/[metier]/[ville]/page.tsx (SEO programmatique),
    mentions-legales, cgv, confidentialite (pages légales)
    api/audit/route.ts, api/report/[id]/pdf/route.ts, api/stripe/webhook/route.ts,
    api/cron/monthly/route.ts, api/leads/route.ts
  src/components/...
```

## Contrat de types (src/lib/engine/types.ts) — à respecter par tous
```ts
export type ProviderId = 'chatgpt' | 'perplexity' | 'gemini' | 'claude';
export interface AuditInput { businessName: string; trade: string; city: string; district?: string; website?: string; email?: string; }
export interface QuerySpec { id: string; text: string; intent: 'best' | 'nearby' | 'urgent' | 'specific' | 'review'; }
export interface ProviderAnswer { provider: ProviderId; queryId: string; run: number; text: string; citations: string[]; demo: boolean; error?: string; }
export interface MentionResult { provider: ProviderId; queryId: string; run: number; mentioned: boolean; rank: number | null; competitors: string[]; snippet?: string; }
export interface CompetitorStat { name: string; mentions: number; share: number; }
export interface AuditResult {
  id: string; input: AuditInput; createdAt: string;
  score: number;                         // 0-100
  subScores: Record<ProviderId, number | null>; // null si provider non utilisé
  mentionRate: number; avgRank: number | null; shareOfVoice: number;
  competitors: CompetitorStat[];
  queries: QuerySpec[]; mentions: MentionResult[]; answers: ProviderAnswer[];
  confidence: 'faible' | 'moyenne' | 'bonne';
  demo: boolean;
}
```

## Conventions
- Pas de secret dans le code ; tout via `process.env`, documenté dans `.env.example`.
- Chaque fichier écrit par un agent ne touche QUE son périmètre. Ne pas réécrire les fichiers des autres.
- Recherches et notes des agents de la vague 1 : `docs/NN-sujet.md`, en français, sources en liens.
