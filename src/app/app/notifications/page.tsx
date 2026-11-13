import { PageHeader } from '@/components/app/PageHeader';
import { NotificationCenter } from '@/components/app/shell/Notifications';
import { loadWorkspace } from '@/components/app/workspace';
import { listNotifications, type NotificationItem } from '@/lib/notify';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const ws = await loadWorkspace();
  // Liste rendue côté serveur (titre-résultat lisible tout de suite) ; le client relit ensuite l'état lu / non lu.
  let initial: NotificationItem[] | null = null;
  try {
    initial = (await listNotifications(ws.business.id, { limit: 50 })).items;
  } catch {
    initial = null;
  }
  return (
    <>
      <PageHeader title="Notifications" meta={<>{ws.business.name}{ws.demo ? ', démo' : ''}</>} />
      <div className="rp-page">
        <NotificationCenter businessId={ws.business.id} demo={ws.demo} initial={initial} />
      </div>
    </>
  );
}
