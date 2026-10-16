'use client';
import dynamic from 'next/dynamic';

// Leaflet reads `window` on import, so it cannot be prerendered on the server.
const FleetMap = dynamic(() => import('@/components/fleet-map'), {
  ssr: false,
  loading: () => <div className="fleet-map map-loading" role="status">Cargando mapa…</div>,
});

export function MapView() {
  return <div className="map-frame"><FleetMap /></div>;
}
