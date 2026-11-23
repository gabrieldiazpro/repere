/** Page /merci : étapes affichées selon l'achat (pur, testé). */
export type PurchaseKind = "accompagne" | "pilote" | "abonnement" | "audit-local" | "audit-approfondi" | "decouverte" | "inconnu";

export function purchaseKind(plan: { id: string; interval: string; segment?: string } | undefined): PurchaseKind {
  if (!plan) return "inconnu";
  if (/_decouverte$/.test(plan.id)) return "decouverte";
  if (/_accompagne_/.test(plan.id)) return "accompagne";
  if (/_pilote_/.test(plan.id)) return "pilote";
  if (plan.id === "action_plan" || plan.id === "bundle_start") return "audit-local";
  if (/_audit_deep$/.test(plan.id)) return plan.segment === "local" ? "audit-local" : "audit-approfondi";
  if (plan.interval === "month" || plan.interval === "year") return "abonnement";
  return "inconnu";
}

export function merciSteps(kind: PurchaseKind, opts: { loggedIn: boolean }): string[] {
  const first =
    kind === "decouverte"
      ? "Votre compte gratuit est créé. Aucun paiement, aucune carte enregistrée."
      : "Un e-mail de confirmation part vers votre boîte, avec votre facture et un lien pour ouvrir votre espace.";
  const second: Record<PurchaseKind, string> = {
    accompagne:
      "Nous vous écrivons sous 2 jours ouvrés pour la mise en place : accès à vos fiches et à votre site, fiche de vérité, questions suivies. Rien ne sera publié sans votre validation.",
    pilote:
      "Sans rendez-vous, en 3 étapes dans votre espace : connectez votre site (assistant pas à pas), confirmez votre fiche officielle pré-remplie, signez le mandat. Le pilote démarre aussitôt ; rien n'est fait hors de ce que vous autorisez.",
    abonnement: "Votre suivi est activé : vos questions sont posées aux IA dès maintenant, puis selon la fréquence de votre offre. Chaque lundi, vos actions de la semaine.",
    "audit-local": "Votre audit et votre plan d'action sont préparés à partir de vos vraies questions clients, et livrés sous 48 heures.",
    "audit-approfondi": "Votre audit approfondi est lancé. Il est livré sous 5 jours ouvrés, avec une proposition de créneau de restitution en visio.",
    decouverte: "Votre première mesure est lancée : 5 questions sur 3 IA. Elle sera refaite chaque mois.",
    inconnu: "Votre commande est enregistrée. Le détail des prochaines étapes est dans l'e-mail de confirmation.",
  };
  const third = opts.loggedIn
    ? "Votre espace est déjà ouvert sur cet appareil : vous pouvez y aller dès maintenant."
    : "Pour ouvrir votre espace, utilisez le lien reçu par e-mail ou connectez-vous avec l'adresse utilisée pour la commande : pas de mot de passe.";
  return [first, second[kind], third];
}

/** Lien « Ouvrir mon espace » : l'app si la session existe, sinon la connexion par lien magique (retour vers `next`). */
export function spaceHref(loggedIn: boolean, next = "/app"): string {
  return loggedIn ? next : `/connexion?next=${encodeURIComponent(next)}`;
}
