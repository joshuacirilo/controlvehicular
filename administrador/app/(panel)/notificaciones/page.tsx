import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/server/auth/admin';
import { EmailSettingsForm } from '@/components/email-settings-form';
import { IncidentFeed } from '@/components/incident-feed';
export const metadata: Metadata = { title: 'Notificaciones | Control vehicular' };
export default async function NotificationsPage() {
  if (!await getAdmin()) redirect('/');
  return <div className="trucks-page"><h1 className="panel-title">Configuración de notificaciones</h1><IncidentFeed /><EmailSettingsForm /></div>;
}
