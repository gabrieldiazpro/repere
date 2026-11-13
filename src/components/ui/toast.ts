'use client';
/**
 * Annonces (toasts) : affichées par le <Toaster /> de la coquille de l'app (région aria-live, 6 s, 9 s avec lien).
 * toast({ text: 'Tâche marquée comme faite.', tone: 'success' })
 * toast({ text: 'Échec de l’enregistrement.', tone: 'error', href: '/app/reglages', linkLabel: 'Réessayer' })
 */
export { toast } from '@/components/app/shell/client';
export type { ToastDetail } from '@/components/app/shell/client';
