'use client';
import 'leaflet/dist/leaflet.css';
import type { LatLngTuple } from 'leaflet';
import { useEffect, useRef } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';

const START_STYLE = { color: '#fff', weight: 2, fillColor: '#0ddddf', fillOpacity: 1 };
const END_STYLE = { color: '#fff', weight: 2, fillColor: '#01215a', fillOpacity: 1 };

// Leaflet measures its container once; inside a dialog that is still zero-sized at creation,
// so the view is fitted again the first time the container gets a real size.
function FitWhenSized({ ruta, padding }: { ruta: LatLngTuple[]; padding: number }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const { x, y } = map.invalidateSize().getSize();
      if (fitted.current || x === 0 || y === 0) return;
      fitted.current = true;
      if (ruta.length > 1) map.fitBounds(ruta, { padding: [padding, padding], maxZoom: 16 });
      else map.setView(ruta[0], 15);
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, ruta, padding]);
  return null;
}

/** Map of one trip: the trace plus its start (teal) and end (navy) points. Static unless `interactive`. */
export default function RouteMiniMap({ ruta, interactive = false }: { ruta: LatLngTuple[]; interactive?: boolean }) {
  const first = ruta[0];
  const last = ruta[ruta.length - 1];
  const padding = interactive ? 48 : 16;
  const view = ruta.length > 1
    ? { bounds: ruta, boundsOptions: { padding: [padding, padding] as [number, number], maxZoom: 16 } }
    : { center: first, zoom: 15 };
  return <MapContainer {...view} className="route-map-canvas" dragging={interactive} zoomControl={interactive}
    scrollWheelZoom={interactive} doubleClickZoom={interactive} touchZoom={interactive} boxZoom={interactive}
    keyboard={interactive}>
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <FitWhenSized ruta={ruta} padding={padding} />
    {ruta.length > 1 && <Polyline positions={ruta}
      pathOptions={{ color: '#0349b9', weight: interactive ? 5 : 4, opacity: 0.85 }} />}
    <CircleMarker center={first} radius={interactive ? 8 : 6} pathOptions={START_STYLE} />
    {ruta.length > 1 && <CircleMarker center={last} radius={interactive ? 8 : 6} pathOptions={END_STYLE} />}
  </MapContainer>;
}
