-- V5 (INTEGRATION-V5) : nouveaux types de tâches de la file `jobs` (src/lib/jobs/types.ts, JOB_TYPES).
-- SEO-DATA (Search Console, positions), PUBLICATION (relecture), ANALYSE (réanalyse, balayage), BAROMÈTRE.
-- Idempotent : la contrainte est remplacée par la liste complète.
alter table jobs drop constraint if exists jobs_type_check;
alter table jobs add constraint jobs_type_check check (type in (
  'audit.run','audit.scheduled','tasks.generate','digest.send','report.scheduled','measure.action','siteaudit.run','webhook.deliver',
  'seodata.gsc.sync','seodata.rank.weekly','seodata.rank.collect','publish.verify','analysis.rerun','analysis.scheduled','barometre.run'
));
