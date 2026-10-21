import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/server/auth/admin';
import { AccountRegistration } from '@/components/account-registration';

export const metadata: Metadata = { title: 'Control de cuentas | Control vehicular' };

export default async function CuentasPage() {
  if (!await getAdmin()) redirect('/');
  return <div className="accounts-page">
    <header><h1 className="panel-title">Control de cuentas</h1>
      <p className="layer-note">Registra camiones y pilotos y descarga sus códigos QR para la app.</p></header>
    <AccountRegistration />
  </div>;
}
