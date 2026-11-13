/**
 * Extraction des entreprises citées dans une réponse : extracteur LLM du moteur (le moins cher configuré) avec un
 * prompt « sans cible », validé par parseExtraction (rejette tout nom absent du texte) ; heuristique sinon.
 */
import { extractHeuristic, parseExtraction } from '../engine/detect';
import type { Extractor } from '../engine/providers/http';
import { extractInlineUrls } from '../engine/sources';
import type { AuditInput } from '../engine/types';
import { companyDomainFor } from './names';
import type { RawAnswerRecord } from './types';

export const BAROMETRE_EXTRACT_SYSTEM =
  "Tu es un extracteur d'entités. Tu lis la réponse d'un assistant IA et tu renvoies UNIQUEMENT du JSON valide.";

export function buildBarometreExtractionPrompt(question: string, subject: string, answerText: string, citations: string[]): string {
  return `Question posée : «${question}»
Sujet : ${subject}
Réponse à analyser :
"""
${answerText}
"""
Sources citées : ${JSON.stringify(citations.slice(0, 15))}

Liste, dans l'ordre d'apparition, chaque entreprise, marque, commerce ou produit nommé précis qui est recommandé ou cité.
Les plateformes, annuaires, comparateurs et médias (Google Maps, PagesJaunes, Trustpilot, Capterra, Amazon…) vont
dans "platforms". N'invente aucun nom : recopie le nom exactement tel qu'il est écrit dans la réponse.

Format :
{
  "recommends_businesses": true|false,
  "businesses": [{"name": "nom exact", "rank": 1, "is_target": false, "location_hint": null, "url": "url ou domaine associé ou null"}],
  "platforms": ["..."]
}`;
}

export interface ExtractedCompany {
  name: string;
  position: number;
  domain?: string;
}

export interface AnswerExtraction {
  companies: ExtractedCompany[];
  via: 'llm' | 'heuristic';
}

/** Extrait les entreprises d'une réponse (réponses simulées : heuristique seulement, aucun appel payant). */
export async function extractCompanies(
  a: RawAnswerRecord,
  questionText: string,
  subject: string,
  input: AuditInput,
  extractor: Extractor | null,
): Promise<AnswerExtraction> {
  if (a.error || !a.text) return { companies: [], via: 'heuristic' };
  const urls = [...a.citations, ...a.sources.map((s) => s.url), ...extractInlineUrls(a.text)];
  const withDomain = (name: string, url?: string | null): string | undefined =>
    companyDomainFor(name, [...(url ? [/^https?:\/\//.test(url) ? url : `https://${url}`] : []), ...urls]);
  if (extractor && !a.demo) {
    try {
      const raw = await extractor.completeJson(BAROMETRE_EXTRACT_SYSTEM, buildBarometreExtractionPrompt(questionText, subject, a.text, a.citations));
      const res = parseExtraction(raw, a.text);
      if (res) {
        return { via: 'llm', companies: res.entities.map((e, i) => ({ name: e.name, position: i + 1, domain: withDomain(e.name, e.url) })) };
      }
    } catch {
      /* repli heuristique */
    }
  }
  const ents = extractHeuristic(a.text, input);
  return { via: 'heuristic', companies: ents.map((e, i) => ({ name: e.name, position: i + 1, domain: withDomain(e.name) })) };
}
