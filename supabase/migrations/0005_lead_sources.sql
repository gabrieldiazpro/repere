-- V3 : sources de prospects « tool » (outils gratuits /outils) et « contact » (formulaire /contact).
-- Pour ces sources, seul l'e-mail est obligatoire (commerce, métier, ville facultatifs) : colonnes déjà nullables.
alter type lead_source add value if not exists 'tool';
alter type lead_source add value if not exists 'contact';
