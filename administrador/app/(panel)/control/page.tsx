import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/server/auth/admin';
import { SpeedControlForm } from '@/components/speed-control-form';

export const metadata: Metadata = { title: 'Control | Control vehicular' };

export default async function ControlPage() {
  if (!await getAdmin()) redirect('/');
  return <div className="accounts-page">
    <header><h1 className="panel-title">Control</h1>
      <p className="layer-note">Configura la velocidad promedio de referencia para los viajes.</p></header>
    <SpeedControlForm />
  </div>;
}
