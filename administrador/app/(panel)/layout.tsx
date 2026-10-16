import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { getAdmin } from '@/server/auth/admin';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect('/');
  return <div className="panel-shell">
    <Sidebar user={{ username: admin.username, nombre: admin.nombre }} />
    <main className="panel-main">{children}</main>
  </div>;
}
