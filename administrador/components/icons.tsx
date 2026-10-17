import type { SVGProps } from 'react';

function Icon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

export function DashboardIcon() {
  return <Icon><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Icon>;
}

export function MapIcon() {
  return <Icon><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z" /><path d="M9 4v13.5M15 6.5V20" /></Icon>;
}

export function TruckIcon() {
  return <Icon><path d="M2 6.5A1.5 1.5 0 0 1 3.5 5H14v11H2V6.5Z" /><path d="M14 9h4l3 3.5V16h-7V9Z" />
    <circle cx="6.5" cy="17.5" r="2" /><circle cx="17.5" cy="17.5" r="2" /></Icon>;
}

export function ExpandIcon() {
  return <Icon width="16" height="16"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></Icon>;
}

export function CloseIcon() {
  return <Icon><path d="M18 6 6 18M6 6l12 12" /></Icon>;
}

export function AccountsIcon() {
  return <Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5" /></Icon>;
}

export function LogoutIcon() {
  return <Icon><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></Icon>;
}
