/* eslint-disable @typescript-eslint/no-explicit-any -- script ponctuel hors application */
/**
 * Construit une liste de prospects : API Recherche d'entreprises (gratuite) + Google Places (option).
 * Usage : node --experimental-strip-types scripts/build-leads.ts --naf 43.22A --cp 75011 [--limit 200]
 * Sortie : .data/leads-<naf>-<cp>.csv. Aucun e-mail n'est collecté (colonne email_generique à remplir à la main,
 * depuis les mentions légales du site du commerce, avec email_source_url).
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const NAF_LABELS: Record<string, string> = {
  '49.42Z': 'déménageur',
  '68.31Z': 'agence immobilière',
  '43.22A': 'plombier',
  '43.21A': 'électricien',
  '43.34Z': 'peintre',
  '56.10A': 'restaurant',
  '96.02A': 'coiffeur',
  '47.24Z': 'boulangerie',
};
const BLOCKED_NAF = /^(86\.|69\.1|69\.2|71\.11)/; // santé, avocats/notaires, comptables, architectes (docs/12 §6)

function arg(name: string, def = ''): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Lead {
  nom: string; siren: string; siret: string; adresse: string; code_postal: string; naf: string; metier: string;
  site: string; telephone: string; place_id: string; forme_juridique: string; ei: string;
  email_generique: string; email_source_url: string;
}

async function main() {
  const naf = arg('naf');
  const cp = arg('cp');
  const limit = Number(arg('limit', '200'));
  if (!naf || !cp) {
    console.error('Usage : build-leads.ts --naf 43.22A --cp 75011 [--limit 200]');
    process.exit(1);
  }
  if (BLOCKED_NAF.test(naf)) {
    console.error(`NAF ${naf} exclu (métier réglementé, voir docs/12-verticales.md §6).`);
    process.exit(1);
  }
  const metier = NAF_LABELS[naf] ?? naf;
  const leads: Lead[] = [];
  const seen = new Set<string>();

  // Format : GET /search?code_postal=&activite_principale=&etat_administratif=A&per_page=<=25&page=
  // Réponse : { results: [{ siren, nom_complet, nature_juridique, siege: { siret, adresse, code_postal, activite_principale } }], total_pages }
  // (non testé depuis l'environnement de développement : proxy 403 ; à valider sur /docs/ au premier lancement)
  for (let page = 1; leads.length < limit && page <= 40; page++) {
    const url = new URL('https://recherche-entreprises.api.gouv.fr/search');
    url.search = new URLSearchParams({
      code_postal: cp, activite_principale: naf, etat_administratif: 'A', per_page: '25', page: String(page),
    }).toString();
    const res = await fetch(url);
    if (res.status === 429) { await sleep(2000); page--; continue; }
    if (!res.ok) { console.error(`API Recherche d'entreprises : HTTP ${res.status}`); break; }
    const json = (await res.json()) as { results?: any[]; total_pages?: number };
    const results = json.results ?? [];
    if (!results.length) break;
    for (const e of results) {
      const s = e.siege ?? {};
      const nom = String(e.nom_complet ?? '');
      if (!s.siret || seen.has(s.siret) || s.code_postal !== cp) continue;
      if (/non[- ]diffusible/i.test(nom)) continue; // G3 : respecter la non-diffusion
      seen.add(s.siret);
      leads.push({
        nom, siren: e.siren ?? '', siret: s.siret, adresse: s.adresse ?? '', code_postal: cp, naf, metier,
        site: '', telephone: '', place_id: '', forme_juridique: String(e.nature_juridique ?? ''),
        ei: String(e.nature_juridique) === '1000' ? 'oui' : 'non', // E8 : entrepreneur individuel = personne physique
        email_generique: '', email_source_url: '',
      });
      if (leads.length >= limit) break;
    }
    if (page >= (json.total_pages ?? 1)) break;
    await sleep(300);
  }

  const key = process.env.GOOGLE_PLACES_KEY;
  if (key) {
    for (const l of leads) {
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.id,places.websiteUri,places.nationalPhoneNumber',
        },
        body: JSON.stringify({ textQuery: `${l.nom} ${l.adresse}`, languageCode: 'fr', maxResultCount: 1 }),
      });
      if (!r.ok) { console.error(`Places HTTP ${r.status}, enrichissement interrompu`); break; }
      const p = ((await r.json()) as { places?: any[] }).places?.[0];
      if (p) {
        l.place_id = p.id ?? '';
        l.site = p.websiteUri ?? '';
        l.telephone = p.nationalPhoneNumber ?? '';
      }
      await sleep(200);
    }
  } else {
    console.error('GOOGLE_PLACES_KEY absente : liste Sirene seule (site et téléphone vides).');
  }

  mkdirSync('.data', { recursive: true });
  const cols = Object.keys(leads[0] ?? ({} as Lead));
  const out = `.data/leads-${naf}-${cp}.csv`;
  writeFileSync(out, [cols.join(','), ...leads.map((l) => cols.map((c) => csvCell((l as any)[c])).join(','))].join('\n') + '\n');
  console.log(`${leads.length} prospects -> ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
