# CROISSANCE — journal (terminé)
**Fait** : src/lib/growth (jetons, carte, badge SVG, classement, parrainage) ; /carte/[auditId] (+og 1200×630, noindex, jeton + opt-in `growth.cards`, marge d'erreur du moteur) ; /badge/[id].svg + /badge ; /classement(+/[metier]/[ville]) opt-in, « en préparation » < 10, noindex tant que vide, ItemList ; /parrainage ; /api/growth/{card,badge,ranking,referral,referral/attribute}. Autorisation = `requireBusiness` de @/lib/auth (adaptateur supprimé). 18 tests verts, tsc propre.
**Env** : GROWTH_REFERRAL_REWARD (JSON optionnel, défaut 1 mois chacun, plafond 6/an).
**À faire par d'autres**
- Webhook Stripe (COMPTES) : sur invoice.paid, après activation : `await onReferredFirstPayment({ refereeBusinessId: <business_id>, refereeSubscriptionId: invoice.subscription, amountPaidCents: invoice.amount_paid })` dans un try/catch (import '@/lib/growth').
- Inscription (COMPTES/ENTONNOIR) : lire `?ref=CODE`, puis POST /api/growth/referral/attribute { businessId, code } après création du compte.
- App (vague 2b) : boutons de partage de la carte (POST /api/growth/card), activation du badge (POST /api/growth/badge), opt-in classement (POST /api/growth/ranking).
- CONTENU : ajouter /badge, /classement, /parrainage au sitemap (classement seulement une fois publié).
