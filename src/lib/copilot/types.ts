/** Types partagés du copilote V3 (outils, livrables, intentions). */

export type CopilotIntent =
  // V2 (inchangées)
  | 'why_competitor'
  | 'faq'
  | 'prices'
  | 'review_reply'
  | 'committee'
  | 'first_source'
  | 'traffic'
  | 'weekly_plan'
  | 'comparison'
  | 'product_pages'
  // V3 (docs/v3/09-audit-app.md § 7)
  | 'score'
  | 'provider_score'
  | 'rank'
  | 'competitor'
  | 'citations_urls'
  | 'track_question'
  | 'period_compare'
  | 'fact_lookup'
  | 'fact_errors'
  | 'missing_queries'
  | 'fastest_competitor'
  | 'export'
  | 'content_ideas'
  | 'content_brief'
  | 'outreach_email'
  | 'gbp_description'
  /** « Ma fiche Google est-elle complète ? » : score /100 et critères manquants (écran Fiche Google) */
  | 'gbp_audit'
  | 'crawlers'
  | 'plan_quarter'
  | 'page_citable'
  | 'perception'
  | 'shopping'
  | 'sales'
  | 'traffic_why'
  | 'opportunities'
  | 'tasks'
  /** part de voix (vous et un concurrent) mesure par mesure */
  | 'share_of_voice'
  | 'compound'
  | 'thanks'
  | 'greeting'
  /** hors périmètre : une phrase honnête + 3 questions proches */
  | 'other';

export interface Deliverable {
  type: 'html' | 'jsonld' | 'text' | 'csv';
  label: string;
  content: string;
}

/** Action proposée à l'interface (jamais exécutée par le copilote lui-même : l'utilisateur confirme). */
export interface CopilotAction {
  type: 'track_question' | 'add_task' | 'open' | 'download';
  label: string;
  payload: Record<string, unknown>;
}

/** Note de source (« [1] Concurrents · audit du 5 novembre 2026 »), liée à l'écran. */
export interface SourceRef {
  label: string;
  href: string;
  date?: string;
}

export type ToolName =
  | 'getScore'
  | 'getRank'
  | 'getCompetitor'
  | 'compareCompetitors'
  | 'getSources'
  | 'getOpportunities'
  | 'getPerception'
  | 'getFactErrors'
  | 'checkFact'
  | 'getTasks'
  | 'getTraffic'
  | 'getSales'
  | 'getPromptResults'
  | 'explainChange'
  | 'draftDeliverable';

export interface ToolCall {
  name: ToolName;
  args: Record<string, unknown>;
}

export interface ToolResult<T = Record<string, unknown>> {
  tool: ToolName;
  args: Record<string, unknown>;
  ok: boolean;
  /** données structurées (chiffres exacts, noms tels que stockés) */
  data: T;
  /** une phrase sourcée, en français */
  text: string;
  source: SourceRef;
  deliverables?: Deliverable[];
  actions?: CopilotAction[];
}

export interface ScriptedAnswer {
  intent: CopilotIntent;
  content: string;
  deliverables: Deliverable[];
  /** outils appelés (dans l'ordre) */
  tools?: ToolCall[];
  sources?: SourceRef[];
  actions?: CopilotAction[];
}
