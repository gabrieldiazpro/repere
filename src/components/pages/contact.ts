/** Formulaire de contact : sujets, validation et repli mailto (pur, testé). */
export const CONTACT_SUBJECTS = [
  { id: "question", label: "Une question sur Repéré" },
  { id: "devis", label: "Un devis (plus de 200 questions, plusieurs pays)" },
  { id: "agence", label: "Agence ou partenariat" },
  { id: "presse", label: "Presse" },
  { id: "securite", label: "Sécurité" },
  { id: "donnees", label: "Mes données personnelles" },
  { id: "barometre", label: "Baromètre : retrait ou rectification" },
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]["id"];

export interface ContactFields {
  name: string;
  email: string;
  company: string;
  subject: ContactSubject;
  message: string;
}

export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateContact(f: ContactFields): ContactErrors {
  const e: ContactErrors = {};
  if (!f.name.trim()) e.name = "Indiquez votre nom.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.";
  if (f.message.trim().length < 10) e.message = "Écrivez votre message (10 caractères au moins).";
  if (f.message.length > 4000) e.message = "Votre message dépasse 4 000 caractères : raccourcissez-le.";
  if (!CONTACT_SUBJECTS.some((s) => s.id === f.subject)) e.subject = "Choisissez un sujet.";
  return e;
}

export function subjectLabel(id: ContactSubject): string {
  return CONTACT_SUBJECTS.find((s) => s.id === id)?.label ?? "Contact";
}

/** Corps envoyé à /api/leads (source 'contact'). */
export function leadPayload(f: ContactFields) {
  return {
    email: f.email.trim(),
    businessName: f.company.trim() || f.name.trim(),
    source: "contact" as const,
    subject: f.subject,
    name: f.name.trim(),
    message: f.message.trim(),
    consent: false,
  };
}

/** Lien mailto prérempli, utilisé si l'envoi par le formulaire échoue. */
export function contactMailto(to: string, f: ContactFields): string {
  const subject = `[Repéré] ${subjectLabel(f.subject)}`;
  const body = [f.message.trim(), "", `${f.name.trim()}${f.company.trim() ? `, ${f.company.trim()}` : ""}`, f.email.trim()].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
