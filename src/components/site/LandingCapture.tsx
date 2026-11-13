'use client';
/**
 * Mémorise en mémoire de l'onglet l'origine de l'arrivée sur le site (première page vue, referrer, UTM) pour
 * l'attribution des inscriptions (src/lib/roi/landing.ts). Aucun cookie, aucun stockage, aucun envoi ici.
 */
import { useEffect } from 'react';
import { captureLanding } from '@/lib/roi/landing';

export function LandingCapture() {
  useEffect(() => captureLanding(), []);
  return null;
}
