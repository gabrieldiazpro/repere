import type { Metadata, Viewport } from 'next';
import '@/components/app/app.css';
import '@/components/app/v4/v4.css';
import '@/components/ui/app-shell.css';
import { DemoBar, Sidebar, TabBar, type ShellInfo } from '@/components/app/Shell';
import { SwRegister } from '@/components/app/SwRegister';
import { InstallPrompt } from '@/components/app/InstallPrompt';
import { loadWorkspace } from '@/components/app/workspace';
import { adaptTasks, adaptWeekly } from '@/components/app/adapters';
import { CommandPalette } from '@/components/app/shell/CommandPalette';
import { Toaster } from '@/components/app/shell/Toaster';
import { Visite } from '@/components/app/shell/Visite';
import { loadBusinessOptions, loadEntitlements, loadSearchIndex, loadUnread, themePref } from '@/components/app/shell/server';

export const metadata: Metadata = {
  title: { default: 'Mon espace · Repéré', template: '%s · Repéré' },
  description: 'Ce que les IA disent de vous, les sources à gagner et les actions de la semaine.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Repéré',
  appleWebApp: { capable: true, title: 'Repéré', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3730A3' },
    { media: '(prefers-color-scheme: dark)', color: '#12102E' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await loadWorkspace();
  const [tasks, theme, ent, businesses, unread, index] = await Promise.all([
    adaptTasks(ws.business.id, ws.fb),
    themePref(),
    loadEntitlements(),
    loadBusinessOptions(),
    loadUnread(ws.business.id),
    loadSearchIndex(),
  ]);
  const weekly = await adaptWeekly(ws.business.id, tasks, ws.fb);
  const info: ShellInfo = {
    businessId: ws.business.id,
    businessName: ws.business.name,
    descriptor: ws.business.descriptor,
    planLabel: ws.business.planLabel,
    segment: ws.segment,
    demo: ws.demo,
    errors: ws.latest?.factCheck?.errors ?? 0,
    openTasks: weekly.filter((t) => t.status !== 'done' && t.status !== 'skipped').length,
    weekly: weekly.map((t) => ({ id: t.id, status: t.status })),
    unread,
    theme,
    businesses,
  };
  return (
    <div className="rp-app" data-theme={theme}>
      <a href="#contenu" className="rp-skip">
        Aller au contenu
      </a>
      <Sidebar info={info} />
      <div className="rp-main">
        {ws.demo && <DemoBar segment={ws.segment} />}
        <main id="contenu" tabIndex={-1}>
          {children}
        </main>
      </div>
      <InstallPrompt />
      <TabBar info={info} />
      <CommandPalette businessId={ws.business.id} segment={ws.segment} demo={ws.demo} canExport={ent.exports} index={index} />
      <Visite segment={ws.segment} demo={ws.demo} />
      <Toaster />
      <SwRegister />
    </div>
  );
}
