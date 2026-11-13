# Mission COMPTES (journal : docs/v3/progress/COMPTES.md)

C'est le chantier le plus important : aujourd'hui, un client qui paie ne peut pas se connecter.

## À lire
- docs/v3/10-audit-technique.md : chantiers 1, 2, 3 et tout ce qui touche authentification, multi-tenant, facturation, rattachement.
- docs/v3/09-audit-app.md : points 1 et 2, § architecture.
- Code : src/lib/db.ts, src/lib/plans.ts, src/lib/stripe.ts, src/lib/execution/auth.ts, src/app/api/{checkout,stripe}/**,
  src/app/app/connexion/**, src/components/app/{LoginForm,SessionSync,workspace}.ts*, supabase/schema.sql, src/lib/demo-v2.ts.

## Périmètre exclusif
src/middleware.ts, src/lib/auth/**, src/lib/entitlements.ts, src/lib/db.ts, src/lib/plans.ts, src/lib/stripe.ts,
src/app/api/{stripe,checkout,account,team}/** (sauf src/app/api/account/data/**, qui est à TACHES-FOND),
src/app/{connexion,inscription,bienvenue}/**, src/app/app/connexion/**, supabase/migrations/0003_comptes.sql, supabase/schema.sql.

## À livrer
1. **@/lib/auth** : getSession, requireBusiness, HttpError, rôles (signatures du contrat). Session serveur par cookies
   httpOnly Supabase (lien magique + échange de code PKCE, sans @supabase/ssr qui n'est pas installé : @supabase/supabase-js
   + cookies gérés à la main + rafraîchissement). Sans variables Supabase : « compte local de développement »,
   connectable par un lien magique affiché dans la console, pour tester tout le parcours sans service externe.
   Les anciens helpers (execution/auth.ts, db.canAccessBusiness) doivent déléguer à @/lib/auth : fournis
   src/lib/auth/compat.ts et signale le remplacement à faire dans les fichiers hors périmètre.
2. **src/middleware.ts** : protège /app/** (sauf comptes démo explicites via ?compte=demo… ou cookie de démo),
   rafraîchit la session, redirige vers /connexion. Ne retombe JAMAIS en silence sur la démo pour un utilisateur
   connecté sans commerce : /bienvenue.
3. **Parcours** : /inscription (offre Découverte gratuite : e-mail, nom de l'entreprise, parcours), /connexion (lien
   magique), /bienvenue (création ou rattachement du commerce avec le bon segment). Après paiement Stripe : le webhook
   crée l'utilisateur s'il est absent, le commerce avec le BON segment et le plan, envoie un e-mail avec lien magique ;
   rattachement réservé aux e-mails confirmés ; deuxième achat géré ; lien correct sur /merci (signale le lien à poser,
   /merci est à PAGES-SITE). Portail de facturation Stripe avec URL de retour valide. Invitations d'équipe (rôles),
   /api/team. Sélecteur multi-commerces (/api/account/businesses).
4. **@/lib/entitlements** : getEntitlements, assertEntitled (contrat). Table des droits par offre (Découverte,
   Essentiel, Accompagné, Agence, démo) dérivée de docs/v2/07-plans-v2.json et de la décision 2. Offre Découverte
   gratuite ajoutée à plans.ts pour chaque parcours.
5. **SQL** : supabase/migrations/0003_comptes.sql (memberships, invitations, segment sur businesses, RLS par
   membership) + schema.sql à jour.
6. **Tests** : session, rôles, droits par offre, webhook (compte + commerce créés, bon segment, deuxième achat, e-mail
   non confirmé), middleware (redirections).
