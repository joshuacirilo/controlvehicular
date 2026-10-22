import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DriverTrips, RouteCard } from '@/components/driver-trips';
import { TruckIcon } from '@/components/icons';
import { Pagination } from '@/components/pagination';
import { getAdmin } from '@/server/auth/admin';
import { truckHistoryPage, selectedTripHistory } from '@/server/trucks/history';

export const metadata: Metadata = { title: 'Camiones | Control vehicular' };

export default async function CamionesPage({ searchParams }: PageProps<'/camiones'>) {
  // Layouts do not re-run on client navigation, so the page authorizes its own data.
  if (!await getAdmin()) redirect('/');
  const { pagina, viaje, tramo, dias } = await searchParams;
  if (viaje !== undefined) {
    const selected = typeof viaje === 'string' ? await selectedTripHistory(viaje) : null;
    const segment = typeof tramo === 'string' && /^[1-9]\d{0,8}$/.test(tramo) ? Number(tramo) : undefined;
    return <div className="trucks-page"><header className="trucks-header"><h1 className="panel-title">Camiones · Detalle del viaje</h1>
      <Link href={`/dashboard?dias=${dias === '30' ? 30 : 7}`} className="dashboard-link">Volver al dashboard</Link>
      <Link href="/camiones" className="dashboard-link">Ver todos los camiones</Link></header>
      {selected ? <><h2>{selected.title}</h2><RouteCard key={`${selected.trip.tripId}-${segment}`} trip={selected.trip} title={selected.title} initiallyExpanded initialSegment={segment} /></>
        : <p role="alert">El viaje solicitado no existe o ya no está disponible.</p>}
    </div>;
  }
  const requested = typeof pagina === 'string' && /^[1-9]\d{0,5}$/.test(pagina) ? Number(pagina) : 1;
  const { page, totalPages, total, trucks } = await truckHistoryPage(requested);

  return <div className="trucks-page">
    <header className="trucks-header">
      <h1 className="panel-title">Camiones</h1>
      <p className="layer-note">{total} {total === 1 ? 'camión registrado' : 'camiones registrados'}</p>
      <Link href="/cuentas" className="account-create-link">Registrar camión o piloto</Link>
    </header>
    {trucks.length === 0 && <p className="layer-note">No hay camiones registrados.</p>}
    {trucks.map(truck => <section key={truck.truckId} className="truck-layer" aria-labelledby={`truck-${truck.truckId}`}>
      <header className="truck-layer-header">
        <span className="truck-layer-icon"><TruckIcon /></span>
        <div className="truck-layer-text">
          <h2 id={`truck-${truck.truckId}`}>{truck.placa}</h2>
          {truck.modelo && <small>{truck.modelo}</small>}
        </div>
        {!truck.activo && <span className="status-badge">Inactivo</span>}
        <span className="truck-layer-count">
          {truck.conductores.length} {truck.conductores.length === 1 ? 'piloto' : 'pilotos'}
        </span>
      </header>
      {truck.conductores.length === 0
        ? <p className="layer-note">Sin viajes.</p>
        : <div className="driver-list">
          {truck.conductores.map(driver => <DriverTrips key={driver.driverId} truckId={truck.truckId} placa={truck.placa}
            driver={driver} />)}
        </div>}
    </section>)}
    <Pagination page={page} totalPages={totalPages} label="Páginas de camiones"
      hrefFor={target => `/camiones?pagina=${target}`} />
  </div>;
}
