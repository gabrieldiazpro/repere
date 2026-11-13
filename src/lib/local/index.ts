/**
 * Module LOCAL (docs/v3/12-CONTRATS-V3.md) : audit de fiche Google /100, carte de visibilité par zone (simulation),
 * audit NAP sur annuaires, calendrier de posts avec rappels, thèmes des avis. Routes : /api/local/*.
 */
export * from './types';
export { GBP_WEIGHTS, GBP_GROUP_LABEL, GBP_NOTES, auditGbp, gbpCriteria, gbpPriorities, profileFromManual, toStorableAudit, sameAddress, sameName, samePhone, sameHours, sameSite } from './gbp';
export { buildZoneGrid, nearestZones, cityKey, GRID_CITIES } from './zones';
export { MAP_CAPS, MAP_DISCLAIMER, MAP_RUNS, aggregateZones, bandOf, defaultZoneQuestions, demoVisibilityMap, fillZone, mapBudget, normalizeZoneQuestions, planMap, runVisibilityMap, summarizeMap, toSvgModel, type MapPlan, type MapCaps } from './map';
export { directoriesFor, urlMatchesDirectory } from './directories';
export { auditNap, checkPage, htmlToText, napScore, parseNapEntries, phonesIn, type NapReference, type PageFetcher } from './nap';
export { POST_MAX, planPosts, postIdea, postClipboard, seasonOf, isPostType, type PostContext, type PlanOptions } from './posts';
export { THEME_RULES, analyzeReviewThemes, analyzeReviewThemesAsync, parseReviews, toStorableThemes } from './reviews';
export { PLACES_POLICY, PLACES_FIELD_MASK, PLACE_ID_RE, placesEnabled, fetchPlaceDetails, findPlaceId, profileFromPlaces, reviewsFromPlaces } from './places';
export { buildLocalDemo, DEMO_MANUAL, DEMO_REVIEWS, type LocalDemo } from './demo';
export { localTier, type LocalTier } from './auth';
