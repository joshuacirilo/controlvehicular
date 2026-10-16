'use client';
import dynamic from 'next/dynamic';
import { useLiveTrucks, type LiveTrucksState } from '@/components/use-live-trucks';

// Leaflet reads `window` on import, so it cannot be prerendered on the server.
const FleetMap = dynamic(() => import('@/components/fleet-map'), {
  ssr: false,
  loading: () => <div className="fleet-map map-loading" role="status">Cargando mapa…</div>,
});

const clock = new Intl.DateTimeFormat('es-GT', {
  timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function LiveStatus({ trucks, updatedAt, error }: LiveTrucksState) {
  if (updatedAt === null) {
    return <p className={`map-status${error ? ' is-error' : ''}`} role="status">
      {error ? `${error} Reintentando…` : 'Buscando vehículos en viaje…'}
    </p>;
  }
  const withoutLocation = trucks.filter(truck => !truck.ubicacion).length;
  const summary = trucks.length === 0
    ? 'No hay vehículos en viaje.'
    : `${trucks.length} ${trucks.length === 1 ? 'vehículo' : 'vehículos'} en viaje` +
      (withoutLocation ? ` (${withoutLocation} sin ubicación aún)` : '') + '.';
  return <p className={`map-status${error ? ' is-error' : ''}`} role="status">
    {summary} {error ? `${error} Reintentando…` : `Actualizado a las ${clock.format(updatedAt)}.`}
  </p>;
}

export function MapView() {
  const live = useLiveTrucks();
  return <>
    <LiveStatus {...live} />
    <div className="map-frame"><FleetMap trucks={live.trucks} now={live.updatedAt} /></div>
  </>;
}
