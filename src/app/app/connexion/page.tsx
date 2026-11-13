import { redirect } from 'next/navigation';

type SP = Record<string, string | string[] | undefined>;

/** Ancienne adresse de connexion (V2, liens déjà envoyés) : la connexion vit désormais sur /connexion. */
export default async function AncienneConnexion({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') q.set(k, v);
  const s = q.toString();
  redirect(`/connexion${s ? `?${s}` : ''}`);
}
