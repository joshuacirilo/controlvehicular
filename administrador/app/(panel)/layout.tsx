import { Sidebar } from '@/components/sidebar';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <div className="panel-shell">
    <Sidebar />
    <main className="panel-main">{children}</main>
  </div>;
}
