/**
 * « Relire mon site » : lit l'accueil et la page contact du client (RepereBot, robots.txt respecté, anti-SSRF via
 * safeFetch) et en extrait les faits affichés : téléphone, e-mail, adresse et horaires du JSON-LD, profils officiels.
 * Ces valeurs sont des OBSERVATIONS (source « lu sur votre site ») : elles servent aux alertes d'incohérence et peuvent
 * être reprises dans la fiche par le client, jamais publiées sans son accord.
 */
import { safeFetch, type SafeResponse } from '@/lib/siteaudit/fetch';
import { phonesIn, htmlToText } from '@/lib/local/nap';
import type { SiteObservation } from './types';

export type SiteFetcher = (url: string) => Promise<Pick<SafeResponse, 'status' | 'body' | 'contentType' | 'finalUrl'>>;

const defaultFetcher: SiteFetcher = (url) => safeFetch(url, { timeoutMs: 6000, maxBytes: 1_500_000 });

type Node = Record<string, unknown>;
const ORG = /^(Organization|Corporation|LocalBusiness|OnlineStore|Store|ProfessionalService|HomeAndConstructionBusiness|Plumber|Electrician|Locksmith|HVACBusiness|Restaurant|FoodEstablishment|Bakery|CafeOrCoffeeShop|HairSalon|BeautySalon|NailSalon|Dentist|Physician|MedicalBusiness|AutoRepair|Florist|LegalService|Notary|AccountingService|RealEstateAgent|GeneralContractor|RoofingContractor|HousePainter|MovingCompany|Optician|Pharmacy|VeterinaryCare|BarOrPub|LiquorStore|DryCleaningOrLaundry|TattooParlor|Physiotherapy|SportsActivityLocation|LodgingBusiness|Hotel)$/;

function jsonLdNodes(html: string): Node[] {
  const out: Node[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim()) as unknown;
      const walk = (v: unknown, depth = 0) => {
        if (!v || typeof v !== 'object' || depth > 4) return;
        if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
        const n = v as Node;
        out.push(n);
        if (Array.isArray(n['@graph'])) walk(n['@graph'], depth + 1);
      };
      walk(data);
    } catch {
      /* bloc invalide : ignoré */
    }
  }
  return out;
}

const types = (n: Node) => (Array.isArray(n['@type']) ? (n['@type'] as unknown[]) : [n['@type']]).map(String);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function addressOf(a: unknown): string | undefined {
  if (typeof a === 'string') return a.trim() || undefined;
  const n = (Array.isArray(a) ? a[0] : a) as Node | undefined;
  if (!n || typeof n !== 'object') return undefined;
  const street = str(n.streetAddress);
  const city = [str(n.postalCode), str(n.addressLocality)].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || undefined;
}

const DAY_FR: Record<string, string> = { Mo: 'lun', Tu: 'mar', We: 'mer', Th: 'jeu', Fr: 'ven', Sa: 'sam', Su: 'dim', Monday: 'lun', Tuesday: 'mar', Wednesday: 'mer', Thursday: 'jeu', Friday: 'ven', Saturday: 'sam', Sunday: 'dim' };
const h = (t: unknown) => (typeof t === 'string' ? t.replace(/^(\d{1,2}):(\d{2}).*$/, (_, a, b) => `${Number(a)} h${b === '00' ? '' : ` ${b}`}`) : '');

function hoursOf(n: Node): string | undefined {
  const spec = n.openingHoursSpecification;
  if (Array.isArray(spec) && spec.length) {
    return spec
      .slice(0, 10)
      .map((s) => {
        const o = s as Node;
        const days = (Array.isArray(o.dayOfWeek) ? o.dayOfWeek : [o.dayOfWeek]).map((d) => DAY_FR[String(d).replace(/^https?:\/\/schema\.org\//, '')] ?? '').filter(Boolean);
        return days.length ? `${days.length > 2 ? `${days[0]}–${days[days.length - 1]}` : days.join(', ')} ${h(o.opens)}–${h(o.closes)}` : '';
      })
      .filter(Boolean)
      .join(', ');
  }
  const oh = n.openingHours;
  if (typeof oh === 'string') return oh;
  if (Array.isArray(oh)) return oh.filter((x) => typeof x === 'string').join(', ');
  return undefined;
}

const EMAIL_RE = /[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SOCIAL = /^https:\/\/(www\.)?(facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com|tiktok\.com|pinterest\.[a-z]+|g\.page|maps\.app\.goo\.gl|wikidata\.org|fr\.wikipedia\.org)\//i;

/** Extraction pure (testable) depuis le HTML de quelques pages. */
export function extractSiteFacts(pages: { url: string; html: string }[]): Omit<SiteObservation, 'url' | 'at' | 'pages' | 'errors'> {
  const out: Omit<SiteObservation, 'url' | 'at' | 'pages' | 'errors'> = {};
  const phones = new Map<string, number>();
  const emails = new Set<string>();
  const same = new Set<string>();
  for (const p of pages) {
    const orgs = jsonLdNodes(p.html).filter((n) => types(n).some((t) => ORG.test(t)));
    for (const o of orgs) {
      out.name ??= str(o.name);
      out.telephone ??= str(o.telephone);
      out.email ??= str(o.email)?.replace(/^mailto:/, '');
      out.adresse ??= addressOf(o.address);
      out.horaires ??= hoursOf(o);
      for (const u of Array.isArray(o.sameAs) ? o.sameAs : [o.sameAs]) if (typeof u === 'string' && /^https:\/\//.test(u)) same.add(u);
    }
    for (const m of p.html.matchAll(/href=["']tel:([^"']+)["']/gi)) phones.set(m[1], (phones.get(m[1]) ?? 0) + 2);
    const text = htmlToText(p.html);
    for (const ph of phonesIn(text)) phones.set(ph, (phones.get(ph) ?? 0) + 1);
    for (const m of p.html.matchAll(/href=["']mailto:([^"'?]+)/gi)) emails.add(m[1].toLowerCase());
    for (const m of text.match(EMAIL_RE) ?? []) if (!/\.(png|jpe?g|webp|svg|gif)$/i.test(m)) emails.add(m.toLowerCase());
    for (const m of p.html.matchAll(/href=["'](https:\/\/[^"'#]+)["']/gi)) if (SOCIAL.test(m[1])) same.add(m[1]);
  }
  if (!out.telephone && phones.size) out.telephone = [...phones.entries()].sort((a, b) => b[1] - a[1])[0][0];
  if (!out.email && emails.size) out.email = [...emails][0];
  if (same.size) out.sameAs = [...same].slice(0, 12);
  return out;
}

/** Lit l'accueil puis la première page « contact » liée. */
export async function readSite(site: string, now = new Date(), fetcher: SiteFetcher = defaultFetcher): Promise<SiteObservation> {
  const start = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  const obs: SiteObservation = { url: start, at: now.toISOString(), pages: [], errors: [] };
  const got: { url: string; html: string }[] = [];
  const read = async (u: string) => {
    try {
      const r = await fetcher(u);
      if (r.status >= 200 && r.status < 300 && /html/i.test(r.contentType || 'text/html')) {
        got.push({ url: r.finalUrl || u, html: r.body });
        obs.pages.push(r.finalUrl || u);
        return r.body;
      }
      obs.errors.push(`${u} : réponse ${r.status}`);
    } catch (e) {
      obs.errors.push(`${u} : ${e instanceof Error && 'publicMessage' in e ? String((e as { publicMessage: string }).publicMessage) : 'page illisible'}`);
    }
    return null;
  };
  const home = await read(start);
  if (home) {
    const m = home.match(/href=["']([^"'#]*contact[^"'#]*)["']/i);
    if (m) {
      try {
        const u = new URL(m[1], got[0].url);
        if (u.host === new URL(got[0].url).host && u.toString() !== got[0].url) await read(u.toString());
      } catch {
        /* lien invalide */
      }
    }
  }
  return { ...obs, ...extractSiteFacts(got) };
}
