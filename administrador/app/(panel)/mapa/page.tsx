import type { Metadata } from 'next';
import { MapView } from '@/components/map-view';

export const metadata: Metadata = { title: 'Mapa | Control vehicular' };

export default function MapaPage() {
  return <div className="map-page">
    <h1 className="panel-title">Mapa</h1>
    <MapView />
  </div>;
}
