# Contrats entre modules (vague 2) — à respecter à la lettre

Marque : **Repéré** — descripteur « visibilité IA des commerces locaux ». Slogan : « Soyez celui que l'IA recommande. »
Tokens (docs/01-marque.md) : --primary #3730A3, --accent #F5A524 (jamais en texte), --success #15803D, --warning #B45309,
--danger #B91C1C, --ink #1B1F2E, --muted #5A6275, --line #D5D9E4, --bg #F6F7FB, badges *-bg/*-ink.
Polices : Bricolage Grotesque (titres 600/700), Inter (texte). Jauge : 0–39 Invisible, 40–69 Peu visible, 70–100 Bien recommandé.
Offres : docs/07-plans.json (gratuit, Plan d'action 149 €, Suivi 29 €/mois, Démarrage 199 € mis en avant, Pro 79 €, Agence 149 €).
Copy : docs/08-copy.md. Méthode : docs/03-methode-score.md (8 requêtes × 2 exécutions × 3 IA, score = 0,45M+0,20R+0,20V+0,15C, fourchette bootstrap).

Projet : /home/claude/auditia/app (Next 15.5 App Router, React 19, Tailwind v4, TS). Dépendances DÉJÀ installées :
@supabase/supabase-js, stripe, @react-pdf/renderer, resend, zod, vitest. **N'installez rien d'autre** (si indispensable, dites-le
dans votre réponse finale). **Ne lancez pas `next build`** (d'autres agents écrivent en parallèle) ; vérifiez vos fichiers avec
`npx tsc --noEmit -p . 2>&1 | grep <vos fichiers>`.

## Extension du type AuditResult (additive)
Dans src/lib/engine/types.ts, en plus du contrat de 00-ARCHITECTURE.md :
```ts
range: { low: number; high: number };          // fourchette bootstrap P5–P95
agreement: number;                              // 0–1
measuredAt: string;                             // ISO
providersUsed: ProviderId[];
excerpts: { provider: ProviderId; query: string; text: string; competitorsHighlighted: string[]; mentioned: boolean }[]; // 2-4 extraits pour le rapport
topActions: ActionItem[];                       // 3 actions gratuites
export interface ActionItem { id: string; title: string; why: string; how: string[]; effort: 'S'|'M'|'L'; impact: 1|2|3; }
export type ScoreBand = { min: number; max: number; label: string; color: string; bg: string; ink: string };
```
Exports du moteur (src/lib/engine/index.ts) :
```ts
export * from './types';
export function runAudit(input: AuditInput, opts?: { mode?: 'free'|'paid'; onProgress?: (p: {done:number,total:number,provider:ProviderId}) => void }): Promise<AuditResult>;
export function scoreBand(score: number): ScoreBand;
export function buildActionPlan(result: AuditResult): ActionItem[];   // plan complet (10–15 actions) depuis docs/05-actions.json
export function buildQueries(input: AuditInput, n?: number): QuerySpec[];
export function createMockAudit(input: AuditInput, seed?: string): AuditResult; // données démo réalistes, demo:true
```

## Accès données (src/lib/db.ts) — fourni par l'agent BACKEND
Fonctionne avec Supabase si SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, sinon store mémoire + fichier JSON `.data/` (mode démo).
```ts
export async function saveAudit(r: AuditResult): Promise<void>;
export async function getAudit(id: string): Promise<AuditResult | null>;
export async function listAuditsForBusiness(businessId: string): Promise<AuditResult[]>;
export async function saveLead(l: { email: string; businessName: string; trade: string; city: string; district?: string; auditId?: string; consent: boolean; source: 'site'|'prospection' }): Promise<{ id: string }>;
export async function getBusiness(id: string): Promise<Business | null>;
export async function listBusinessesForUser(userId: string): Promise<Business[]>;
export async function getActionProgress(businessId: string): Promise<Record<string, boolean>>;
export async function setActionProgress(businessId: string, actionId: string, done: boolean): Promise<void>;
export interface Business { id: string; name: string; trade: string; city: string; district?: string; website?: string; plan: 'free'|'suivi'|'pro'|'agency'; lastScore: number | null; createdAt: string; }
export async function getDemoBusiness(): Promise<{ business: Business; audits: AuditResult[] }>; // 6 mois d'historique démo
```

## API HTTP — fournie par l'agent BACKEND
- `POST /api/audit` body AuditInput (+ consent:boolean) → `{ id }` (lance l'audit, sauvegarde, envoie e-mail si email). Rate limit IP (5/jour) + validation zod.
- `GET /api/audit/[id]` → AuditResult
- `GET /api/report/[id]/pdf` → application/pdf (agent PDF fournit `src/lib/pdf/Report.tsx` export `renderReportPdf(r: AuditResult): Promise<Buffer>`)
- `POST /api/checkout` body `{ planId, auditId?, email? }` → `{ url }` (Stripe Checkout ; sans clé → url `/merci?demo=1`)
- `POST /api/stripe/webhook`, `GET /api/cron/monthly` (Bearer CRON_SECRET), `POST /api/leads`
- `POST /api/actions` body `{ businessId, actionId, done }`

## Routes UI et propriétaires
| Route / fichiers | Agent |
|---|---|
| src/app/globals.css, layout.tsx, src/components/ui/*, src/components/site/* (Header, Footer, ScoreGauge, Logo), src/app/page.tsx, src/app/tarifs/page.tsx, src/app/merci/page.tsx | DESIGN+LANDING |
| src/app/audit/page.tsx, src/app/audit/* , src/app/rapport/[id]/*, src/components/report/* | AUDIT+RAPPORT |
| src/lib/pdf/*, src/app/api/report/* | PDF |
| src/app/app/**, public/manifest.webmanifest, public/sw.js, public/icons/*, src/components/app/* | APP PWA |
| src/app/visibilite-ia/**, src/app/methode/*, src/app/mentions-legales, cgv, confidentialite, src/app/sitemap.ts, robots.ts, public/llms.txt, src/lib/seo/* | SEO+LÉGAL |
| src/lib/engine/** | ENGINE |
| src/lib/db.ts, stripe.ts, email.ts, ratelimit.ts, supabase/schema.sql, src/app/api/** (sauf report), .env.example, src/lib/plans.ts | BACKEND |
| scripts/**, src/app/admin/** | PROSPECTION |

Composants partagés que DESIGN fournit (les autres peuvent les importer ; s'ils n'existent pas encore, créez un fallback local
dans VOTRE dossier plutôt que d'écrire chez DESIGN) :
`import { ScoreGauge } from '@/components/site/ScoreGauge'` props `{ score: number; size?: number; range?: {low:number;high:number} }`
`import { Button } from '@/components/ui/Button'` (variant 'primary'|'secondary'|'ghost', href optionnel)
`import { Logo } from '@/components/site/Logo'`, `Header`, `Footer`.
`src/lib/plans.ts` (BACKEND) : `export const PLANS` = contenu typé de docs/07-plans.json.
