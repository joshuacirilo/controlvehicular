'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AccountsIcon, DashboardIcon, LogoutIcon, MapIcon } from '@/components/icons';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { href: '/mapa', label: 'Mapa', icon: MapIcon },
  { href: '/cuentas', label: 'Control de cuentas', icon: AccountsIcon },
] as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';
}

export function Sidebar({ user }: { user: { username: string; nombre: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    if (leaving) return;
    setLeaving(true);
    try {
      await fetch('/api/auth/admin/logout', { method: 'POST', signal: AbortSignal.timeout(10000) });
    } catch {
      // The cookie expires on its own; still leave the panel.
    } finally {
      router.replace('/');
      router.refresh();
    }
  }

  return <aside className="sidebar" aria-label="Navegación principal">
    <div className="sidebar-brand">
      <span className="brand-mark sidebar-mark" aria-hidden="true">CV</span>
      <span className="sidebar-label">Control vehicular</span>
    </div>
    <nav className="sidebar-nav">
      {links.map(({ href, label, icon: LinkIcon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={href} href={href} className="sidebar-link" aria-current={active ? 'page' : undefined} title={label}>
          <LinkIcon /><span className="sidebar-label">{label}</span>
        </Link>;
      })}
    </nav>
    <div className="sidebar-footer">
      <Link href="/perfil" className="sidebar-user" aria-current={pathname === '/perfil' ? 'page' : undefined}
        title="Panel de usuario">
        <span className="sidebar-avatar" aria-hidden="true">{initials(user.nombre)}</span>
        <span className="sidebar-label sidebar-user-text">
          <strong>{user.nombre}</strong>
          <small>@{user.username}</small>
        </span>
      </Link>
      <button type="button" className="sidebar-link sidebar-logout" onClick={logout} disabled={leaving} title="Cerrar sesión">
        <LogoutIcon /><span className="sidebar-label">{leaving ? 'Saliendo…' : 'Cerrar sesión'}</span>
      </button>
    </div>
  </aside>;
}
