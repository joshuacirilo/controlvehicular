'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isRecentLocation } from '@/lib/live-trucks';
import { useLiveTrucks, type LiveTrucksState } from '@/components/use-live-trucks';
import { Pagination } from '@/components/pagination';

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
  const paused = trucks.filter(truck => truck.pausa).length;
  const sos = trucks.filter(truck => truck.sos).length;
  const summary = trucks.length === 0
    ? 'No hay vehículos en viaje.'
    : `${trucks.length} ${trucks.length === 1 ? 'vehículo' : 'vehículos'} en viaje` +
      (withoutLocation ? ` (${withoutLocation} sin ubicación aún)` : '') +
      (paused ? `, ${paused} en pausa` : '') + (sos ? `, ${sos} con SOS` : '') + '.';
  return <p className={`map-status${error ? ' is-error' : ''}`} role="status">
    {summary} {error ? `${error} Reintentando…` : `Actualizado a las ${clock.format(updatedAt)}.`}
  </p>;
}

export function MapView() {
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [plateQuery, setPlateQuery] = useState('');
  const [requestedPage, setRequestedPage] = useState(1);
  const live = useLiveTrucks(selected);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const clockNow = now ?? live.updatedAt;
  const current = live.trucks.find(truck => truck.tripId === selected);
  const route = current && live.route?.tripId === selected ? live.route : null;
  const alerts = live.error ? [] : live.trucks.filter(truck => truck.ubicacion && clockNow !== null &&
    isRecentLocation(truck.ubicacion.timestamp, clockNow) && truck.ubicacion.velocidad !== null &&
    live.limiteKmh !== null && truck.ubicacion.velocidad > live.limiteKmh)
    .sort((a, b) => b.ubicacion!.velocidad! - a.ubicacion!.velocidad!);
  const unknown = live.trucks.filter(truck => !truck.ubicacion || clockNow === null ||
    !isRecentLocation(truck.ubicacion.timestamp, clockNow) || truck.ubicacion.velocidad === null).length;
  const query = plateQuery.trim().toUpperCase();
  const matches = alerts.filter(truck => truck.placa.toUpperCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(matches.length / 5));
  const page = Math.min(requestedPage, totalPages);
  const visible = matches.slice((page - 1) * 5, page * 5);
  const pausedMoving = live.trucks.filter(truck => truck.pausa?.movimiento);
  const emergencies = live.trucks.filter(truck => truck.sos);
  const sosRoute = (tripId: string) => live.sosRoutes.find(item => item.tripId === tripId);
  return <>
    <LiveStatus {...live} />
    <div className="live-map-layout">
      <aside className="live-speed-sidebar" aria-labelledby="live-speed-title">
        {emergencies.length > 0 && <section className="live-sos-alert" role="alert" aria-label="SOS sin atender">
          <h2>SOS · Emergencia</h2>
          <ul>{emergencies.map(truck => <li key={truck.tripId}>
            <strong>{truck.placa}</strong> · {truck.conductor} · desde las {clock.format(new Date(truck.sos!.desde))}
            <small>{truck.ubicacion ? `Última ubicación: ${clock.format(new Date(truck.ubicacion.timestamp))}` : 'Sin ubicación recibida'}
              {' · '}{sosRoute(truck.tripId)?.ruta.length ?? 0} puntos de ruta</small>
            <button type="button" className="pagination-button" onClick={() => { setSelected(truck.tripId); setFocus(value => value + 1); }}>Ver en el mapa</button>
          </li>)}</ul>
          <p className="layer-note">El camión y su ruta completa se marcan en rojo hasta que el SOS se marque como atendido. <Link href="/notificaciones" className="dashboard-link">Atender en Notificaciones</Link></p>
        </section>}
        {pausedMoving.length > 0 && <section className="live-pause-alert" role="alert" aria-label="Movimiento con viaje en pausa">
          <h2>Movimiento con viaje en pausa</h2>
          <ul>{pausedMoving.map(truck => <li key={truck.tripId}>
            <strong>{truck.placa}</strong> · {truck.conductor} · desde las {clock.format(new Date(truck.pausa!.movimiento!))}
          </li>)}</ul>
          <p className="layer-note">La app ya le pidió al piloto reanudar el viaje. Mientras siga en pausa no se registra el recorrido.</p>
        </section>}
        <h2 id="live-speed-title">Control de velocidad</h2>
        <p className="layer-note">{live.limiteKmh === null ? 'Sin límite configurado.' : `Límite vigente: ${live.limiteKmh} km/h.`} <Link href="/control" className="dashboard-link">Configurar</Link></p>
        {(live.error || live.updatedAt === null || live.limiteKmh === null) && <p role="status">{live.error ? 'Alertas no disponibles mientras se recupera la conexión.' : live.updatedAt === null ? 'Cargando vehículos…' : 'Configura un límite para detectar excesos.'}</p>}
        {!live.error && unknown > 0 && <p className="layer-note">{unknown} vehículos sin datos recientes suficientes para evaluar.</p>}
        <div className="live-plate-search">
          <label htmlFor="live-plate-query">Buscar placa en las alertas</label>
          <input id="live-plate-query" type="search" value={plateQuery} placeholder="Ej. PRUEBA o 123" maxLength={40}
            onChange={event => { setPlateQuery(event.target.value); setRequestedPage(1); }} />
          {plateQuery && <button type="button" className="dashboard-link" onClick={() => { setPlateQuery(''); setRequestedPage(1); }}>Limpiar búsqueda</button>}
        </div>
        {!live.error && live.updatedAt !== null && live.limiteKmh !== null && <p className="layer-note" role="status">
          {matches.length ? `${(page - 1) * 5 + 1}–${Math.min(page * 5, matches.length)} de ${matches.length} camiones${query ? ' coincidentes' : ''}.`
            : query ? 'No hay alertas con una placa coincidente.' : 'No hay camiones con exceso reciente.'}
        </p>}
        <ul className="live-speed-list">{visible.map(truck => <li key={truck.tripId}>
          <button type="button" aria-pressed={selected === truck.tripId} onClick={() => { setSelected(truck.tripId); setFocus(value => value + 1); }}>
            <strong>{truck.placa} · {truck.ubicacion!.velocidad!.toFixed(1)} km/h</strong><span>{truck.conductor}</span>
            <small>Muestra: {clock.format(new Date(truck.ubicacion!.timestamp))}</small><span>Ver camión y recorrido →</span>
          </button></li>)}</ul>
        <Pagination page={page} totalPages={totalPages} label="Páginas de alertas de camiones" onChange={setRequestedPage} />
        {selected && <section className="live-selected-trip" aria-label="Viaje seleccionado">
          <h3>{current ? `${current.placa} · ${current.conductor}` : 'Viaje seleccionado'}</h3>
          {!current ? <p>El viaje ya no está activo o no está disponible.</p> : <>
            <p>{route ? `${route.ruta.length} puntos del recorrido recibido.` : live.error ? 'No se pudo actualizar el recorrido.' : 'Cargando recorrido…'}</p>
            {!alerts.some(truck => truck.tripId === selected) && <p className="layer-note">Este viaje ya no figura entre las alertas recientes. El recorrido permanece seleccionado.</p>}
            <button type="button" className="pagination-button" onClick={() => setFocus(value => value + 1)}>Enfocar recorrido</button>
            <Link href={`/camiones?viaje=${selected}`} className="dashboard-link">Detalles del viaje →</Link>
          </>}
          <button type="button" className="pagination-button" onClick={() => setSelected(null)}>Quitar selección</button>
        </section>}
      </aside>
      <div className="map-frame"><FleetMap trucks={live.trucks} now={clockNow} selectedTrip={current?.tripId ?? null} route={route} focusRequest={focus} limiteKmh={live.error ? null : live.limiteKmh} sosRoutes={live.sosRoutes} /></div>
    </div>
  </>;
}
