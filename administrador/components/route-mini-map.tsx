'use client';
import 'leaflet/dist/leaflet.css';
import { divIcon, type LatLngTuple } from 'leaflet';
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Pane, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { hasQuestionableFix, recordedSpeedLabel, type CheckpointQuality } from '@/lib/route-quality';
import { returnSections } from '@/lib/route-returns';
import { RouteDirectionArrows } from '@/components/route-direction-arrows';

const checkpointTime = new Intl.DateTimeFormat('es-GT', {
  timeZone: 'America/Guatemala', dateStyle: 'short', timeStyle: 'medium',
});

// Leaflet measures its container once; inside a dialog that is still zero-sized at creation,
// so the view is fitted again the first time the container gets a real size.
type RouteFocus = { inicio: number; fin: number };

function FitWhenSized({ ruta, padding, focus }: { ruta: LatLngTuple[]; padding: number; focus?: RouteFocus | null }) {
  const map = useMap();
  useEffect(() => {
    let fitted = false;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      const { x, y } = map.invalidateSize().getSize();
      if (fitted || x === 0 || y === 0) return;
      fitted = true;
      const positions = focus ? ruta.slice(focus.inicio, focus.fin + 1) : ruta;
      map.stop();
      if (positions.length > 1) {
        const options = { padding: [padding, padding] as [number, number], maxZoom: focus ? 19 : 16 };
        if (focus && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.flyToBounds(positions, { ...options, duration: 0.6 });
        else map.fitBounds(positions, options);
      } else if (positions[0]) map.setView(positions[0], 15);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    const frame = requestAnimationFrame(fit);
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      // MapContainer may have already removed the map. Leaflet's remove() stops
      // its animations; calling stop() here would access the deleted map pane.
    };
  }, [map, ruta, padding, focus]);
  return null;
}

/** Keep the full route, but only mark questionable fixes at their original indices. */
export default function RouteMiniMap({ ruta, checkpoints, interactive = false, focus }: {
  ruta: [number, number][]; checkpoints: CheckpointQuality[]; interactive?: boolean;
  focus?: RouteFocus | null;
}) {
  const returns = useMemo(() => returnSections(ruta, ruta.slice(1).map((_, index) => {
    const previous = checkpoints[index];
    const next = checkpoints[index + 1];
    if (hasQuestionableFix(previous) || hasQuestionableFix(next)) return false;
    const elapsed = Date.parse(next.timestamp) - Date.parse(previous.timestamp);
    return elapsed > 0 && elapsed <= 30_000;
  })), [ruta, checkpoints]);
  const first = ruta[0];
  const padding = interactive ? 48 : 24;
  if (!first) return <div className="route-map-empty">Sin recorrido registrado</div>;
  const view = ruta.length > 1
    ? { bounds: ruta, boundsOptions: { padding: [padding, padding] as [number, number], maxZoom: 16 } }
    : { center: first, zoom: 15 };
  return <MapContainer {...view} maxZoom={25} className="route-map-canvas" dragging={interactive} zoomControl={interactive}
    scrollWheelZoom={interactive} doubleClickZoom={interactive} touchZoom={interactive} boxZoom={interactive}
    keyboard={interactive}>
    <TileLayer
      maxNativeZoom={19} maxZoom={25}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <FitWhenSized ruta={ruta} padding={padding} focus={focus} />
    {ruta.length > 1 && <Polyline positions={ruta}
      pathOptions={{ color: '#0349b9', weight: interactive ? 5 : 4, opacity: 0.85 }} />}
    {returns.map((positions, index) => <Polyline key={index} positions={positions}
      pathOptions={{ color: '#9333ea', weight: interactive ? 7 : 6, opacity: 1, dashArray: '10 10' }} />)}
    <RouteDirectionArrows route={ruta} returns={returns} />
    {interactive && <Pane name="route-speed-hit-targets" style={{ zIndex: 450 }}>
      {ruta.slice(1).map((end, index) => <Polyline key={index} positions={[ruta[index], end]}
        pathOptions={{ weight: 18, opacity: 0 }}>
        <Popup><strong>Tramo {index + 1}</strong><br />
          Checkpoints {index} → {index + 1}<br />
          Velocidad registrada al final: <strong>{recordedSpeedLabel(checkpoints[index], checkpoints[index + 1])}</strong><br />
          {checkpoints[index + 1] && checkpointTime.format(new Date(checkpoints[index + 1].timestamp))}
          <p>Valor guardado al recibir el checkpoint final; puede diferir de la velocidad estimada usada para evaluar el límite.</p>
          {(hasQuestionableFix(checkpoints[index]) || hasQuestionableFix(checkpoints[index + 1])) && <p>Este tramo contiene una ubicación dudosa.</p>}
        </Popup>
      </Polyline>)}
    </Pane>}
    {focus && <Pane name="selected-speed-segment" style={{ zIndex: 610, pointerEvents: 'none' }}>
      <Polyline positions={ruta.slice(focus.inicio, focus.fin + 1)} interactive={false}
        pathOptions={{ color: '#ffffff', weight: 12, opacity: 1 }} />
      <Polyline positions={ruta.slice(focus.inicio, focus.fin + 1)} interactive={false}
        pathOptions={{ color: '#dc2626', weight: 7, opacity: 1 }} />
    </Pane>}
    {ruta.map((position, index) => hasQuestionableFix(checkpoints[index]) ? <Marker key={index} position={position}
      title={`Checkpoint ${index}`} alt={`Checkpoint ${index}`}
      interactive={interactive} keyboard={interactive}
      icon={divIcon({
        className: 'route-checkpoint-icon',
        html: '<span class="route-checkpoint is-uncertain"></span>',
        iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -7],
      })}>
      <Popup><strong>Checkpoint {index}</strong><br />
        Velocidad registrada: <strong>{recordedSpeedLabel(checkpoints[index - 1], checkpoints[index])}</strong><br />
        Latitud: {position[0].toFixed(6)}<br />Longitud: {position[1].toFixed(6)}<br />
        Precisión reportada: {checkpoints[index]?.precision == null ? 'Desconocida' : `${Math.round(checkpoints[index].precision!)} m`}<br />
        {checkpoints[index] && checkpointTime.format(new Date(checkpoints[index].timestamp))}
        {checkpoints[index]?.qualityFlags?.length ? <p>Alertas del dispositivo: {checkpoints[index].qualityFlags!.map(flag => ({ low_accuracy: "Baja precisión", stale: "Muestra antigua", mocked: "Ubicación simulada", out_of_order: "Fuera de orden", gap: "Intervalo sin muestras", jump: "Salto sospechoso" }[flag] ?? flag)).join(", ")}</p> : null}
        {hasQuestionableFix(checkpoints[index]) && <p>Ubicación dudosa: incluida en la línea del recorrido.</p>}
      </Popup>
    </Marker> : null)}
    {interactive && ruta.map((position, index) => !hasQuestionableFix(checkpoints[index]) ?
      <CircleMarker key={index} center={position} radius={6} pane="markerPane"
        pathOptions={{ color: '#0349b9', fillColor: '#ffffff', fillOpacity: 0.9, weight: 2 }}>
        <Popup><strong>Checkpoint {index}</strong><br />
          Velocidad registrada: <strong>{recordedSpeedLabel(checkpoints[index - 1], checkpoints[index])}</strong><br />
          {checkpointTime.format(new Date(checkpoints[index].timestamp))}<br />
          Latitud: {position[0].toFixed(6)}<br />Longitud: {position[1].toFixed(6)}<br />
          Precisión reportada: {checkpoints[index].precision} m
        </Popup>
      </CircleMarker> : null)}
  </MapContainer>;
}
