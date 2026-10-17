'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CloseIcon, ExpandIcon } from '@/components/icons';
import { Pagination } from '@/components/pagination';
import type { DriverSummary, DriverTripsPage, TripRoute } from '@/lib/truck-history';

// Leaflet reads `window` on import, so it cannot be prerendered on the server.
const RouteMiniMap = dynamic(() => import('@/components/route-mini-map'), {
  ssr: false,
  loading: () => <div className="route-map-empty" role="status">Cargando mapa…</div>,
});

const dateTime = new Intl.DateTimeFormat('es-GT', {
  timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short',
});

function duration(trip: TripRoute) {
  if (!trip.fin) return 'En curso';
  const minutes = Math.round((new Date(trip.fin).getTime() - new Date(trip.inicio).getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

/** Full-size, interactive view of one trip; closes with its button, Escape or a click on the backdrop. */
function RouteMapDialog({ trip, title, onClose }: { trip: TripRoute; title: string; onClose: () => void }) {
  return <dialog className="route-dialog" aria-labelledby={`route-${trip.tripId}`} onClose={onClose}
    ref={node => { if (node && !node.open) node.showModal(); }}
    onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <div className="route-dialog-panel">
      <header className="route-dialog-header">
        <div>
          <h3 id={`route-${trip.tripId}`}>{title}</h3>
          <p>
            {dateTime.format(new Date(trip.inicio))} · {duration(trip)} · {trip.distanciaKm} km · {trip.puntos} puntos GPS
          </p>
        </div>
        <button type="button" className="route-dialog-close" aria-label="Cerrar mapa"
          onClick={event => event.currentTarget.closest('dialog')?.close()}>
          <CloseIcon />
        </button>
      </header>
      <div className="route-dialog-map"><RouteMiniMap ruta={trip.ruta} interactive /></div>
      <p className="route-dialog-legend">
        <span className="legend-dot is-start" aria-hidden="true" />Inicio
        <span className="legend-dot is-end" aria-hidden="true" />{trip.fin ? 'Fin' : 'Última ubicación'}
      </p>
    </div>
  </dialog>;
}

function RouteCard({ trip, title }: { trip: TripRoute; title: string }) {
  const active = trip.estado === 'activo';
  const [expanded, setExpanded] = useState(false);
  return <article className="route-card">
    <div className="route-map">
      {trip.ruta.length
        ? <>
          <RouteMiniMap ruta={trip.ruta} />
          <button type="button" className="route-map-expand" onClick={() => setExpanded(true)}
            aria-label="Ampliar mapa del recorrido" title="Ampliar mapa">
            <ExpandIcon /><span>Ampliar</span>
          </button>
        </>
        : <div className="route-map-empty">Sin recorrido registrado</div>}
    </div>
    {expanded && <RouteMapDialog trip={trip} title={title} onClose={() => setExpanded(false)} />}
    <div className="route-card-body">
      <span className={`status-badge${active ? ' is-active' : ''}`}>{active ? 'En curso' : 'Finalizado'}</span>
      <dl>
        <dt>Inicio</dt><dd>{dateTime.format(new Date(trip.inicio))}</dd>
        <dt>Fin</dt><dd>{trip.fin ? dateTime.format(new Date(trip.fin)) : '—'}</dd>
        <dt>Duración</dt><dd>{duration(trip)}</dd>
        <dt>Distancia</dt><dd>{trip.distanciaKm} km</dd>
        <dt>Puntos GPS</dt><dd>{trip.puntos}</dd>
      </dl>
    </div>
  </article>;
}

type Loaded = { page: number | null; data: DriverTripsPage | null; error: string | null };

/** A driver's layer inside a truck: opening it loads that driver's trips with the truck, five per page. */
export function DriverTrips({ truckId, placa, driver }: { truckId: string; placa: string; driver: DriverSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<Loaded>({ page: null, data: null, error: null });

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/trucks/${truckId}/drivers/${driver.driverId}/trips?page=${page}`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace('/');
          return;
        }
        const data = await response.json().catch(() => null) as (DriverTripsPage & { message?: string }) | null;
        if (!response.ok || !Array.isArray(data?.trips)) throw new Error(data?.message ?? 'No se pudieron cargar las rutas.');
        setLoaded({ page, data, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof TypeError ? 'Sin conexión con el servidor.' : (error as Error).message;
        setLoaded(previous => ({ ...previous, page, error: message }));
      }
    })();
    return () => controller.abort();
  }, [open, page, truckId, driver.driverId, router]);

  const loading = open && loaded.page !== page;
  const data = loaded.data;

  return <details className="driver-layer" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="driver-summary">
      <span className="driver-avatar" aria-hidden="true">{driver.nombre.trim()[0]?.toUpperCase() ?? '?'}</span>
      <span className="driver-text">
        <strong>{driver.nombre}</strong>
        <small>
          {driver.viajes} {driver.viajes === 1 ? 'viaje' : 'viajes'} · último {dateTime.format(new Date(driver.ultimoViaje))}
        </small>
      </span>
      {driver.enCurso && <span className="status-badge is-active">En curso</span>}
    </summary>
    <div className="driver-routes">
      {loading && <p className="layer-note" role="status">Cargando rutas…</p>}
      {loaded.error && <p className="layer-note is-error" role="alert">{loaded.error}</p>}
      {data && data.trips.length === 0 && <p className="layer-note">Sin rutas registradas.</p>}
      {data && data.trips.length > 0 && <>
        <div className="route-grid" aria-busy={loading}>
          {data.trips.map(trip => <RouteCard key={trip.tripId} trip={trip} title={`${placa} · ${driver.nombre}`} />)}
        </div>
        <Pagination page={data.page} totalPages={data.totalPages} label={`Rutas de ${driver.nombre}`}
          onChange={setPage} />
      </>}
    </div>
  </details>;
}
