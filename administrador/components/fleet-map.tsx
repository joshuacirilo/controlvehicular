'use client';
import 'leaflet/dist/leaflet.css';
import { divIcon, type LatLngBoundsExpression, type LatLngTuple } from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet';
import { isRecentLocation, type LiveTruck, type TruckLocation, type LiveRoute } from '@/lib/live-trucks';

// Guatemala's bounding box (south-west, north-east) with a small margin around the border.
const GUATEMALA_BOUNDS: LatLngBoundsExpression = [[13.6, -92.4], [17.9, -88.1]];


const clock = new Intl.DateTimeFormat('es-GT', {
  timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

type LocatedTruck = LiveTruck & { ubicacion: TruckLocation };

// The zoom that fits the whole country depends on the container size, so it is recomputed on resize.
function LockToGuatemala() {
  const map = useMap();
  useEffect(() => {
    const updateMinZoom = () => { map.setMinZoom(map.getBoundsZoom(GUATEMALA_BOUNDS)); };
    updateMinZoom();
    map.on('resize', updateMinZoom);
    return () => { map.off('resize', updateMinZoom); };
  }, [map]);
  return null;
}

// Frames the trucks once, when the first positions arrive; later refreshes never move the view.
function FitFirstPositions({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    fitted.current = true;
    map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
  }, [map, points]);
  return null;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);

function TruckMarker({ truck, stale, selected, limiteKmh }: { truck: LocatedTruck; stale: boolean; selected: boolean; limiteKmh: number | null }) {
  const { lat, lng, velocidad, precision, timestamp } = truck.ubicacion;
  const paused = truck.pausa !== null;
  const movingWhilePaused = Boolean(truck.pausa?.movimiento);
  // Same rule as the speed alerts list: a recent sample strictly above the limit.
  const speeding = !stale && velocidad !== null && limiteKmh !== null && velocidad > limiteKmh;
  const speedLabel = speeding ? ` · ${velocidad.toFixed(0)} km/h` : '';
  const state = speeding ? ' is-speeding' : paused ? movingWhilePaused ? ' is-paused-moving' : ' is-paused' : stale ? ' is-stale' : '';
  // Built from HTML so no image assets are needed (Leaflet's default icon breaks with bundlers).
  const icon = useMemo(() => divIcon({
    className: 'truck-marker-icon',
    iconSize: [0, 0],
    html: `<span class="truck-marker${state}${selected ? ' is-selected' : ''}">` +
      `<span class="truck-marker-label">${escapeHtml(truck.placa)}${speedLabel}${paused ? ' · En pausa' : ''}</span><span class="truck-marker-dot"></span></span>`,
  }), [truck.placa, state, selected, speedLabel, paused]);

  return <Marker position={[lat, lng]} icon={icon} title={truck.placa} zIndexOffset={selected ? 1000 : 0}>
    <Popup>
      <div className="truck-popup">
        <strong>{truck.placa}</strong>
        {truck.modelo && <span>{truck.modelo}</span>}
        {speeding && <p className="truck-popup-speeding" role="alert">
          Exceso de velocidad: {velocidad.toFixed(1)} km/h (límite {limiteKmh} km/h).
        </p>}
        {truck.pausa && <p className="truck-popup-pause">
          Viaje en pausa desde las {clock.format(new Date(truck.pausa.desde))}.
          {truck.pausa.movimiento && <strong> Se detectó movimiento durante la pausa ({clock.format(new Date(truck.pausa.movimiento))}).</strong>}
        </p>}
        <dl>
          <dt>Conductor</dt><dd>{truck.conductor}</dd>
          <dt>Velocidad estimada</dt><dd>{stale ? 'Dato antiguo' : velocidad === null ? 'Sin datos confiables' : `${velocidad.toFixed(1)} km/h`}</dd>
          <dt>Última ubicación</dt><dd>{clock.format(new Date(timestamp))}{stale && ' (sin señal reciente)'}</dd>
          {precision !== null && <><dt>Precisión</dt><dd>±{Math.round(precision)} m</dd></>}
          <dt>Inicio del viaje</dt><dd>{clock.format(new Date(truck.inicio))}</dd>
        </dl>
      </div>
    </Popup>
  </Marker>;
}

function FocusSelected({ truck, route, request }: { truck?: LiveTruck; route: LiveRoute | null; request: number }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (!truck) { fitted.current = null; return; }
    const key = `${truck.tripId}-${request}-${route ? 'route' : 'position'}`;
    if (fitted.current === key) return;
    const points: LatLngTuple[] = [...(route?.ruta ?? [])];
    if (truck.ubicacion) points.push([truck.ubicacion.lat, truck.ubicacion.lng]);
    if (!points.length) return;
    fitted.current = key;
    map.invalidateSize();
    map.fitBounds(points, { padding: [48, 48], maxZoom: 16 });
  }, [map, truck, route, request]);
  return null;
}

export default function FleetMap({ trucks, now, selectedTrip, route, focusRequest, limiteKmh }: { trucks: LiveTruck[]; now: number | null; selectedTrip: string | null; route: LiveRoute | null; focusRequest: number; limiteKmh: number | null }) {
  const located = useMemo(
    () => trucks.filter((truck): truck is LocatedTruck => truck.ubicacion !== null),
    [trucks],
  );
  const points = useMemo(
    () => located.map(({ ubicacion }): LatLngTuple => [ubicacion.lat, ubicacion.lng]),
    [located],
  );

  return <MapContainer bounds={GUATEMALA_BOUNDS} maxBounds={GUATEMALA_BOUNDS} maxBoundsViscosity={1}
    className="fleet-map" scrollWheelZoom>
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <LockToGuatemala />
    <FitFirstPositions points={points} />
    <FocusSelected truck={trucks.find(truck => truck.tripId === selectedTrip)} route={route} request={focusRequest} />
    {route && route.ruta.length > 1 && <Polyline positions={route.ruta} pathOptions={{ color: '#0349b9', weight: 5, opacity: 0.9 }} />}
    {located.map(truck => <TruckMarker key={truck.tripId} truck={truck}
      selected={truck.tripId === selectedTrip}
      limiteKmh={limiteKmh}
      stale={now === null || !isRecentLocation(truck.ubicacion.timestamp, now)} />)}
  </MapContainer>;
}
