'use client';
import 'leaflet/dist/leaflet.css';
import { divIcon, type LatLngBoundsExpression } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import { GUATEMALA_LIMITS, insideGuatemala } from '@/lib/assignments';

export type PickedPoint = { lat: number; lng: number };
export type PointRole = 'origen' | 'destino';

const BOUNDS: LatLngBoundsExpression = [
  [GUATEMALA_LIMITS.south, GUATEMALA_LIMITS.west], [GUATEMALA_LIMITS.north, GUATEMALA_LIMITS.east],
];

const icon = (role: PointRole) => divIcon({
  className: 'assign-marker-icon',
  html: `<span class="assign-marker is-${role}">${role === 'origen' ? 'A' : 'B'}</span>`,
  iconSize: [30, 30], iconAnchor: [15, 15],
});

function ClickToPlace({ origen, destino, onPick }: {
  origen: PickedPoint | null; destino: PickedPoint | null; onPick: (role: PointRole, point: PickedPoint) => void;
}) {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng;
      if (!insideGuatemala(lat, lng)) return;
      if (!origen) onPick('origen', { lat, lng });
      else if (!destino) onPick('destino', { lat, lng });
    },
  });
  return null;
}

export default function AssignmentPickerMap({ origen, destino, onPick }: {
  origen: PickedPoint | null; destino: PickedPoint | null; onPick: (role: PointRole, point: PickedPoint) => void;
}) {
  const marker = (role: PointRole, point: PickedPoint | null) => point && <Marker position={point} icon={icon(role)} draggable
    title={role === 'origen' ? 'Origen' : 'Destino'} alt={role === 'origen' ? 'Origen' : 'Destino'}
    eventHandlers={{
      dragend(event) {
        const { lat, lng } = event.target.getLatLng();
        if (insideGuatemala(lat, lng)) onPick(role, { lat, lng });
        else event.target.setLatLng(point);
      },
    }} />;
  return <MapContainer bounds={BOUNDS} maxBounds={BOUNDS} maxBoundsViscosity={1} maxZoom={19} className="route-map-canvas">
    <TileLayer maxZoom={19}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <ClickToPlace origen={origen} destino={destino} onPick={onPick} />
    {origen && destino && <Polyline positions={[origen, destino]}
      pathOptions={{ color: '#0349b9', weight: 4, opacity: 0.85, dashArray: '10 10' }} />}
    {marker('origen', origen)}
    {marker('destino', destino)}
  </MapContainer>;
}
