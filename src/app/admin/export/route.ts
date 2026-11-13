import { cookies } from 'next/headers';
import { isAdmin, loadLeads, toCsv } from '../data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = (await cookies()).get('admin_token')?.value; // cookie HttpOnly uniquement (M3)
  if (!isAdmin(token)) return new Response('Non autorisé', { status: 401 });
  return new Response(toCsv(loadLeads()), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="prospects.csv"' },
  });
}
