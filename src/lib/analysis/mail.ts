/**
 * V8 (TEST-MARQUE) — e-mail du rapport d'analyse : test de marque (cité ou non, par IA, avec sa fourchette), puis
 * scores SEO / GEO et priorités. Type « service » : liste d'opposition appliquée, lien de désinscription en un clic.
 * Sans RESEND_API_KEY, l'e-mail est journalisé (démo).
 */
import { BRAND, esc, sendEmail, unsubscribeUrl, type SendEmailResult } from '@/lib/email';
import type { BrandTest, FullAnalysis } from './types';

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const score = (n: number | null) => (n == null ? 'non mesuré' : `${n}/100`);

/** Phrase-réponse du test de marque (rapport, e-mail, partage). */
export function brandHeadline(t: BrandTest): string {
  const o = t.overall;
  if (!o.asked) return `Aucune réponse exploitable des IA pour ${t.brand} sur cette mesure.`;
  const who = t.providers.filter((p) => p.cited > 0).map((p) => p.label);
  if (!o.cited) return `${t.brand} n’est cité dans aucune des ${o.asked} réponses des IA.`;
  return `${t.brand} est cité dans ${o.cited} réponse${o.cited > 1 ? 's' : ''} sur ${o.asked} (${o.rate} %, entre ${o.low} et ${o.high} %), par ${who.join(', ')}.`;
}

export function analysisEmailContent(a: FullAnalysis, reportUrl: string, to: string): { subject: string; html: string; text: string } {
  const brand = a.detected.brand || a.input.brand || a.input.url;
  const site = a.crawl?.finalOrigin || a.input.url;
  const t = a.brandTest;
  const subject = t && t.overall.asked ? `${brand} : cité ${t.overall.cited} fois sur ${t.overall.asked} par les IA${t.demo ? ' (démonstration)' : ''}` : a.scores.global != null ? `Analyse de ${brand} : ${a.scores.global}/100` : `Analyse de ${brand} : votre rapport`;
  const top = a.priorities.slice(0, 3);
  const why = (t?.why ?? []).slice(0, 2);
  const rows = t
    ? t.providers.map((p) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eef0f4">${esc(p.label)}</td><td style="padding:6px 10px;border-bottom:1px solid #eef0f4;text-align:right"><strong>${p.cited}</strong> sur ${p.asked}</td></tr>`).join('')
    : '';
  const p = (x: string, muted = false) => `<p style="margin:0 0 14px;line-height:1.5${muted ? ';color:#6b7280;font-size:14px' : ''}">${x}</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#111827">
<div style="display:none;max-height:0;overflow:hidden">${esc(t ? brandHeadline(t) : a.verdict)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:580px;background:#ffffff;border-radius:12px;padding:28px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 18px;font-weight:700;font-size:18px">${esc(BRAND)}</p>
${p('Bonjour,')}
${p(`L’analyse de <strong>${esc(brand)}</strong> (${esc(site)}) est prête.`)}
${
  t
    ? `<h2 style="margin:18px 0 8px;font-size:17px">Votre marque est-elle citée par les IA ?</h2>
${p(esc(brandHeadline(t)))}
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 12px;font-size:14px;width:100%;max-width:360px">${rows}</table>
${why.length ? p(`Cités à votre place : ${why.map((w) => `<strong>${esc(w.competitor)}</strong> (« ${esc(w.question)} »)`).join(' ; ')}. Le rapport explique pourquoi et par quoi commencer.`) : ''}
${p(`${t.demo ? 'Démonstration : réponses simulées, aucune IA interrogée.' : `Mesure unique du ${esc(dateFr(t.measuredAt))}, à confirmer dans le temps : les réponses des IA varient d’un jour à l’autre.`}`, true)}`
    : ''
}
<h2 style="margin:18px 0 8px;font-size:17px">Votre site</h2>
${p(esc(a.verdict))}
${p(`Google (SEO) : <strong>${esc(score(a.scores.seo))}</strong> · IA (GEO) : <strong>${esc(score(a.scores.geo))}</strong>`)}
${top.length ? `<p style="margin:0 0 6px">À corriger en priorité :</p><ul style="margin:0 0 14px;padding-left:20px">${top.map((x) => `<li style="margin:0 0 4px">${esc(x.title)}</li>`).join('')}</ul>` : ''}
${a.partial ? p('Une partie des mesures n’a pas pu aboutir : le rapport indique lesquelles.', true) : ''}
<p style="margin:22px 0"><a href="${esc(reportUrl)}" style="display:inline-block;background:#3b3aa8;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Voir le rapport complet</a></p>
${p('Lien personnel, valable 90 jours. Ces résultats décrivent la situation au moment de l’analyse ; ils ne préjugent pas de vos positions ni de vos citations futures.', true)}
<p style="margin:18px 0 0;color:#9ca3af;font-size:12px;line-height:1.5">Vous recevez ce message parce que vous avez demandé une analyse de votre site sur ${esc(BRAND)}. <a href="${esc(unsubscribeUrl(to))}" style="color:#6b7280">Ne plus recevoir d’e-mails</a></p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    'Bonjour,',
    '',
    `L’analyse de ${brand} (${site}) est prête.`,
    ...(t
      ? [
          '',
          'Votre marque est-elle citée par les IA ?',
          brandHeadline(t),
          ...t.providers.map((x) => `- ${x.label} : ${x.cited} sur ${x.asked}`),
          ...(why.length ? [`Cités à votre place : ${why.map((w) => `${w.competitor} (« ${w.question} »)`).join(' ; ')}.`] : []),
          t.demo ? 'Démonstration : réponses simulées, aucune IA interrogée.' : `Mesure unique du ${dateFr(t.measuredAt)}, à confirmer dans le temps.`,
        ]
      : []),
    '',
    'Votre site',
    a.verdict,
    `Google (SEO) : ${score(a.scores.seo)} · IA (GEO) : ${score(a.scores.geo)}`,
    ...(top.length ? ['', 'À corriger en priorité :', ...top.map((x) => `- ${x.title}`)] : []),
    '',
    `Voir le rapport : ${reportUrl}`,
    '(lien personnel, valable 90 jours)',
    '',
    `Ne plus recevoir d’e-mails : ${unsubscribeUrl(to)}`,
  ].join('\n');
  return { subject, html, text };
}

export async function sendAnalysisEmail(to: string, a: FullAnalysis, reportUrl: string): Promise<SendEmailResult> {
  const c = analysisEmailContent(a, reportUrl, to);
  return sendEmail({ to, subject: c.subject, html: c.html, text: c.text, kind: 'service', tags: [{ name: 'type', value: 'analysis' }] });
}
