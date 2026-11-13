import Script from "next/script";
import { HOUSE_BUSINESS_ID } from "@/lib/seo/site";
import { LandingCapture } from "./LandingCapture";

/**
 * Dogfooding : notre propre script de mesure du trafic IA (public/t.js), comme chez nos clients.
 * Sans cookie ni identifiant ; respecte Do Not Track. Inclus par le Header du site public uniquement
 * (jamais dans /app, /admin ni /rapport). React 19 place ce script asynchrone dans <head> et le dédoublonne.
 * Attribut lu par t.js : data-site (et non data-k).
 * Chargé par next/script (inséré par le runtime, donc autorisé par la CSP « strict-dynamic » des pages à nonce ;
 * une balise <script> brute y était bloquée, ex. /connexion et /inscription).
 */
export function SiteTracking() {
  return (
    <>
      <Script id="repere-t" src="/t.js" strategy="afterInteractive" data-site={HOUSE_BUSINESS_ID} />
      {/* Origine de l'arrivée gardée en mémoire de l'onglet (attribution des inscriptions, sans cookie). */}
      <LandingCapture />
    </>
  );
}
