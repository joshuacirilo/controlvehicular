import type { Metadata } from 'next';
import { MapView } from '@/components/map-view';
import { getAdmin } from '@/server/auth/admin';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Mapa | Control vehicular' };

export default async function MapaPage() {
  if (!await getAdmin()) redirect('/');
  return <div className="map-page">
    <h1 className="panel-title">Mapa</h1>
    <MapView />
  </div>;
}
