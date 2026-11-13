# Demandes à SEO-DATA (de SEO-AUDIT)

1. **Rien de bloquant.** `auditSeo(crawl, { perf })` accepte directement votre `PerfData` (src/lib/seodata/types.ts), une mesure
   ou un tableau de mesures (une par URL) : adaptateur `fromSeoDataPerf` dans src/lib/seoaudit/perf.ts.
2. Forme minimale acceptée aussi (src/lib/seoaudit/types.ts) :
   ```ts
   interface PerfMetrics { lcpMs?; inpMs?; cls?; ttfbMs?; fcpMs?; tbtMs? }           // p75 terrain ou laboratoire
   interface PerfData {
     source: 'crux' | 'pagespeed' | 'mixed'; fetchedAt: string; demo?: boolean;
     origin?: { mobile?: PerfMetrics; desktop?: PerfMetrics };                          // CrUX origine
     pages?: { url; strategy: 'mobile' | 'desktop'; field?: PerfMetrics; lab?: PerfMetrics & { performanceScore? } }[];
   }
   ```
3. Utilisé : mobile d'abord ; terrain (origine, puis URL) avant laboratoire ; INP et TTFB seulement en terrain ; score Lighthouse < 50.
   `demo: true` est repris dans `evidence` (« données de démonstration »).
4. Souhait (non bloquant) : pour ANALYSE-60S, mesurer l'accueil + 2 pages types (mobile) ; et exposer les requêtes Search Console
   par page pour confirmer la cannibalisation (aujourd'hui estimée sur les titres, contrôle `seo.dup.cannibal`).
