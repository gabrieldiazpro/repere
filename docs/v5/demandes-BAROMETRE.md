# Demandes de BAROMETRE aux autres modules

1. **sitemap.ts** (src/app/sitemap.ts) : ajouter les baromètres publiés (vide tant que rien n'est mesuré) :
   ```ts
   import { publishedEntries } from '@/lib/barometre/public';
   // dans sitemap(), avant le return :
   try { for (const b of await publishedEntries()) entries.push({ url: abs(b.path), lastModified: b.lastModified }); } catch { /* base indisponible */ }
   ```
2. **llms.txt** (src/app/llms.txt/route.ts, aujourd'hui `force-static`) : passer en `export const revalidate = 3600`, rendre `GET`
   asynchrone et ajouter une section seulement si non vide :
   ```ts
   const baros = await publishedEntries().catch(() => []);
   if (baros.length) lines.push('', '## Baromètres (mesures mensuelles réelles)', ...baros.map((b) => link(b.title, b.path, `mis à jour le ${b.lastModified}`)));
   ```
3. **File de tâches** (src/lib/jobs/types.ts) : ajouter `'barometre.run'` à `JOB_TYPES`, puis appeler `registerBarometreJob()`
   (src/lib/barometre/job.ts) depuis src/lib/jobs/handlers.ts ; cron mensuel (ex. le 2 du mois) qui enfile
   `enqueue('barometre.run', {}, { dedupeKey: 'barometre:AAAA-MM' })`. D'ici là : `scripts/barometre/run.ts`.
4. **Contact** (src/components/pages/contact.ts) : ajouter le sujet `{ id: "barometre", label: "Baromètre : retrait ou rectification" }` ;
   les pages lient aujourd'hui `/contact?sujet=question` + e-mail.
5. **Navigation / pied de page** (vague B) : lien « Baromètres » vers /barometre seulement quand `listPublished()` n'est pas vide.
