'use client';
import 'leaflet/dist/leaflet.css';
import type { LatLngBoundsExpression } from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';

// Guatemala's bounding box (south-west, north-east) with a small margin around the border.
const GUATEMALA_BOUNDS: LatLngBoundsExpression = [[13.6, -92.4], [17.9, -88.1]];

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

export default function FleetMap() {
  return <MapContainer bounds={GUATEMALA_BOUNDS} maxBounds={GUATEMALA_BOUNDS} maxBoundsViscosity={1}
    className="fleet-map" scrollWheelZoom>
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <LockToGuatemala />
  </MapContainer>;
}
