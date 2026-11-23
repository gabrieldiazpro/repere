/**
 * Outil de prise de rendez-vous externe (facultatif) : NEXT_PUBLIC_BOOKING_URL (Cal.com, ou tout outil équivalent).
 * Option gratuite documentée : Cal.com, offre gratuite pour une personne (types de rendez-vous et réservations
 * illimités, plusieurs agendas connectés ; vérifié sur cal.com/pricing le 23 nov. 2026). Sans variable : la demande
 * est enregistrée, le fondateur est prévenu par e-mail et une réponse automatique honnête part au demandeur.
 * Pur : lecture et validation de l'adresse (https, sans identifiants).
 */
export function bookingUrl(env: Record<string, string | undefined> = process.env): string | null {
  const raw = (env.NEXT_PUBLIC_BOOKING_URL ?? '').trim();
  if (!raw || raw.length > 500) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Nom lisible de l'outil (affiché sur le bouton), d'après le domaine. */
export function bookingToolName(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (h === 'cal.com' || h.endsWith('.cal.com') || h === 'cal.eu') return 'Cal.com';
    if (h.endsWith('calendly.com')) return 'Calendly';
    if (h.endsWith('google.com')) return 'Google Agenda';
    return h;
  } catch {
    return 'l’agenda en ligne';
  }
}
