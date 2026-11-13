/**
 * E-mails de compte envoyés par le serveur (transactionnels) : accès après paiement, invitation d'équipe.
 * Les liens de connexion demandés depuis /connexion sont envoyés par Supabase (ou affichés en console en local).
 */
import { BRAND, appUrl, esc, sendEmail, type SendEmailResult } from '@/lib/email';
import { getPlan, type PlanId } from '@/lib/plans';
import { ROLE_LABEL, type Role } from './roles';

function html(title: string, paragraphs: string[], cta: { label: string; url: string }, note?: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 18px;font-weight:700;font-size:18px">${esc(BRAND)}</p>
<h1 style="margin:0 0 14px;font-size:20px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.5">${esc(p)}</p>`).join('\n')}
<p style="margin:22px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">${esc(cta.label)}</a></p>
${note ? `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5">${esc(note)}</p>` : ''}
</td></tr></table></td></tr></table></body></html>`;
}

/** Après paiement : lien d'accès direct à l'espace (lien magique) ou, à défaut, lien vers /connexion. */
export async function sendAccessEmail(
  to: string,
  args: { planId: PlanId; businessName?: string | null; magicLink: string | null; secondPurchase?: boolean },
): Promise<SendEmailResult> {
  const plan = getPlan(args.planId);
  const url = args.magicLink ?? `${appUrl()}/connexion?email=${encodeURIComponent(to)}`;
  const what = args.businessName ? `pour ${args.businessName}` : '';
  const subject = `Votre accès ${BRAND} : offre ${plan.name}`;
  const paragraphs = [
    'Bonjour,',
    `Merci pour votre confiance. Votre offre ${plan.name} ${what} est enregistrée.`.replace(/\s+/g, ' ').replace(' .', '.'),
    args.secondPurchase
      ? 'Elle est ajoutée à votre compte existant : vous la retrouverez dans le sélecteur d’espaces.'
      : 'Votre compte est créé avec cette adresse e-mail. Cliquez sur le bouton ci-dessous pour ouvrir votre espace, sans mot de passe.',
  ];
  const note = args.magicLink
    ? `Ce lien est personnel et à usage unique. S’il a expiré, connectez-vous sur ${appUrl()}/connexion avec cette adresse : vous recevrez un nouveau lien.`
    : `Connectez-vous sur ${appUrl()}/connexion avec cette adresse : vous recevrez un lien de connexion.`;
  return sendEmail({
    to,
    subject,
    kind: 'transactional',
    html: html('Votre espace est prêt', paragraphs, { label: 'Ouvrir mon espace', url }, note),
    text: `${paragraphs.join('\n\n')}\n\nOuvrir mon espace : ${url}\n\n${note}`,
    tags: [{ name: 'type', value: 'account_access' }],
  });
}

export async function sendInvitationEmail(
  to: string,
  args: { businessName: string; role: Role; invitedByEmail?: string | null; url: string; expiresAt: string },
): Promise<SendEmailResult> {
  const by = args.invitedByEmail ? `${args.invitedByEmail} vous invite` : 'Vous êtes invité';
  const until = new Date(args.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const paragraphs = [
    'Bonjour,',
    `${by} à rejoindre l’espace ${args.businessName} sur ${BRAND}, avec le rôle « ${ROLE_LABEL[args.role]} ».`,
    'Cliquez sur le bouton ci-dessous : nous vous enverrons un lien de connexion à cette adresse, sans mot de passe.',
  ];
  const note = `Cette invitation est valable jusqu’au ${until}. Si vous ne l’attendiez pas, ignorez simplement cet e-mail.`;
  return sendEmail({
    to,
    subject: `Invitation à rejoindre ${args.businessName} sur ${BRAND}`,
    kind: 'transactional',
    html: html('Vous êtes invité', paragraphs, { label: 'Rejoindre l’espace', url: args.url }, note),
    text: `${paragraphs.join('\n\n')}\n\nRejoindre l’espace : ${args.url}\n\n${note}`,
    tags: [{ name: 'type', value: 'team_invite' }],
  });
}
