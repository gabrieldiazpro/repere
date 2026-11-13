# Arbitrages du fondateur (pris par Claude en son absence — modifiables)

1. **TVA** : démarrage en micro-entreprise, franchise en base. Partout : prix affichés « net », mention
   « TVA non applicable, art. 293 B du CGI ». Supprimer toute mention « HT, TVA ajoutée » ou « TTC ».
2. **Garantie** : « Satisfait ou remboursé 14 jours » s'applique UNIQUEMENT au Plan d'action (149 €) et au
   pack Démarrage (part plan d'action). Suivi : sans engagement, résiliable en 1 clic, pas de remboursement
   du mois entamé. Aligner CGV art. 7 et tous les textes.
3. **Pro et Agence** : non livrés en V1 (pas de multi-établissements ni de marque blanche dans le code).
   → Retirés des offres achetables. Sur /tarifs : bloc « Bientôt : Pro (multi-établissements) et Agence
   (marque blanche) — rejoindre la liste d'attente » (mailto ou POST /api/leads source 'waitlist').
   Les retirer des CGV comme offres actives.
4. **Promesses** : aucune garantie de résultat. Interdits : « passer devant X », « apparaître dans ChatGPT
   garanti », gains chiffrés. Formulations autorisées : « augmenter vos chances d'être recommandé ».
   Le slogan « Soyez celui que l'IA recommande » est conservé comme slogan de marque (aspirationnel),
   jamais accolé à une promesse chiffrée.
5. **Chiffres** : « un Français sur deux » → « 52 % des Français » (source CB News/Eskimoz × Ipsos).
   « 43 % à Paris » : retirer (échantillon trop faible) ou mention « échantillon réduit ». Retirer.
6. **Marque** : « Repéré » partout ; plus aucune occurrence « AuditIA » visible par un utilisateur
   (les noms de dossiers/code peuvent rester).
7. **Consentement** : l'e-mail saisi sert à recevoir le rapport (transactionnel) ; une case SÉPARÉE et
   facultative pour les conseils/offres (marketing).
8. **Métiers réglementés** (santé, avocats, experts-comptables) : le formulaire les refuse avec un message
   poli (« Repéré ne couvre pas encore les professions réglementées »).
9. **Gemini** : `GEMINI_GROUNDING=off` par défaut tant que les CGU de l'ancrage Search ne sont pas validées
   (documenter dans .env.example et README).
10. **Prospection** : e-mail à froid B2B uniquement (pas d'appel à froid en V1), signature « Repéré ».
