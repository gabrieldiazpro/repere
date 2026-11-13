# Mission SECURITE-V3 — revue de code en LECTURE SEULE (aucun fichier de code modifié)
Lis docs/v3/12-CONTRATS-V3.md, puis les revues précédentes qa/securite.md et qa/v2/securite-v2.md (ne refais pas ce qui
est corrigé : vérifie seulement les régressions sur 10 points).

Revois tout le code nouveau de la V3 :
- src/lib/auth/**, src/middleware.ts, src/lib/entitlements.ts, src/app/api/{account,team,stripe,checkout}/**,
  src/app/{connexion,inscription,bienvenue}/** : session (cookies, rotation, fixation), lien magique (rejeu,
  expiration, redirection ouverte via ?next=), compte local de développement (impossible à activer en production ?),
  création de compte par le webhook (appropriation d'un commerce, e-mail non confirmé), invitations (jeton, élévation
  de rôle), requireBusiness sur CHAQUE route (liste les routes /api/** qui lisent un businessId sans passer par lui),
  contournement des droits par offre.
- src/lib/jobs/**, src/app/api/{cron,jobs,health}/** : accès au worker, fuite d'informations par /api/jobs/[id] et
  /api/health, empoisonnement de la file.
- src/lib/{share,exports,notify,integrations,annotations,measure}/**, src/app/r/** : jetons de partage (entropie,
  hachage, énumération, mot de passe en force brute), injection CSV (formules Excel : =, +, -, @), SSRF par les URL de
  webhook et de logo en marque blanche, signature HMAC, XSS dans /r et dans les notifications.
- src/lib/siteaudit/**, src/app/api/tools/** : anti-SSRF (DNS rebinding, IPv6 mappé, redirections, décimal/octal,
  protocole), dénis de service (taille, décompression, délais), limite par IP, cache empoisonné, XSS par le contenu des
  pages auditées réaffiché dans /outils/*.
- src/lib/{prompts,local,ecommerce,growth}/** et leurs routes : IDOR, import CSV, connecteur Shopify (state OAuth,
  jetons chiffrés), badge SVG et image OG (injection), classement (opt-in réel), parrainage (auto-parrainage, fraude).
- src/lib/copilot/** : injection de prompt par les données, exfiltration entre comptes par les outils, budget.
- CSP réelle (next.config.ts, middleware), en-têtes, t.js, RGPD (export, suppression : rien n'est oublié ?).

Livrable : /home/claude/auditia/qa/v3/securite-v3.md — chaque problème : gravité (critique / élevé / moyen / faible),
fichier:ligne, scénario d'exploitation concret, patch exact (avant / après). Termine par un ordre d'application.
Écris le fichier au fur et à mesure (critiques d'abord) : un autre agent le lit pendant que tu travailles.
Réponse : 150 mots max (critiques et élevés, une ligne chacun).
