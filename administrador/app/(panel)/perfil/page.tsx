import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/server/auth/admin';
import { ProfileForm } from '@/components/profile-form';

export const metadata: Metadata = { title: 'Panel de usuario | Control vehicular' };

export default async function PerfilPage() {
  const user = await getAdmin();
  if (!user) redirect('/');
  return <div className="trucks-page"><h1 className="panel-title">Panel de usuario</h1><ProfileForm user={user} /></div>;
}
