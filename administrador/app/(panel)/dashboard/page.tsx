import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/server/auth/admin';
import { getDashboard } from '@/server/dashboard';
import { formatGuatemala } from '@/server/time';
import { DashboardSpeed } from '@/components/dashboard-speed';

export const metadata: Metadata = { title: 'Dashboard | Control vehicular' };

const dateTime = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'short', timeStyle: 'short' });
const number = new Intl.NumberFormat('es-GT');

export default async function DashboardPage({ searchParams }: PageProps<'/dashboard'>) {
  if (!await getAdmin()) redirect('/');
  const { dias } = await searchParams;
  let data;
  try { data = await getDashboard(dias); }
  catch {
    return <div className="dashboard-page"><h1 className="panel-title">Dashboard</h1>
      <p role="alert">No se pudieron cargar las métricas. Intenta actualizar la página.</p>
      <a href="/dashboard" className="pagination-button">Reintentar</a></div>;
  }
  const { period, summary, quality } = data;
  const percent = quality.total ? Math.round(quality.usable / quality.total * 100) : null;
  const max = Math.max(1, ...data.daily.map(day => day.total));
  const cards = [
    ['Camiones habilitados', number.format(data.trucks), 'Estado actual de la flota'],
    ['Pilotos habilitados', number.format(data.drivers), 'Registros de pilotos activos'],
    ['Viajes en curso', number.format(data.active), 'Todos los viajes activos, sin filtro de fecha'],
    ['Viajes iniciados', number.format(summary.total), `En los últimos ${period.days} días, incluido hoy`],
    ['Viajes finalizados', number.format(summary.completed), 'De los iniciados en el período'],
    ['Duración promedio', summary.averageMs === null ? 'Sin datos' : `${Math.round(summary.averageMs / 60000)} min`, 'Solo viajes finalizados con fechas válidas'],
  ];
  return <div className="dashboard-page">
    <header className="dashboard-heading"><div><p className="dashboard-eyebrow">RESUMEN OPERATIVO</p>
      <h1 className="panel-title">Dashboard</h1><p className="layer-note">Flota, actividad y calidad del seguimiento en un solo lugar.</p></div>
      <a href={`/dashboard?dias=${period.days}`} className="pagination-button">Actualizar métricas</a></header>
    <nav className="dashboard-period" aria-label="Período de métricas">
      {[7, 30].map(days => <Link key={days} href={`/dashboard?dias=${days}`} aria-current={period.days === days ? 'page' : undefined}>Últimos {days} días</Link>)}
      <span>Actualizado: {dateTime.format(data.now)} · Guatemala</span>
    </nav>
    <DashboardSpeed data={data.speed} days={period.days} />
    <section className="dashboard-cards" aria-label="Indicadores operativos">
      {cards.map(([label, value, note]) => <article className="dashboard-card" key={label}><h2>{label}</h2><strong>{value}</strong><p>{note}</p></article>)}
    </section>
    <div className="dashboard-grid">
      <section className="dashboard-section"><h2>Viajes por día</h2><p className="layer-note">Cantidad por fecha de inicio · {period.dates[0]} al {period.dates.at(-1)}</p>
        {summary.total === 0 && <p>No hay viajes iniciados en este período.</p>}
        <div className="dashboard-bars">{data.daily.map(day => <div className="dashboard-bar-row" key={day.date}>
          <time dateTime={day.date}>{day.date.slice(8)}/{day.date.slice(5, 7)}</time>
          <div className="dashboard-bar-track" aria-hidden="true"><div style={{ width: `${day.total / max * 100}%` }} /></div>
          <strong>{number.format(day.total)}<span className="sr-only"> viajes</span></strong>
        </div>)}</div>
      </section>
      <section className="dashboard-section"><h2>Calidad de ubicaciones GPS</h2>
        <p className="dashboard-quality-value">{percent === null ? 'Sin datos' : `${percent}%`}</p>
        <p>Muestras utilizables de los viajes iniciados en el período.</p>
        {percent !== null && <progress value={quality.usable} max={quality.total} aria-label="Proporción de muestras GPS utilizables" />}
        <dl className="dashboard-quality-list"><div><dt>Utilizables</dt><dd>{number.format(quality.usable)}</dd></div>
          <div><dt>Dudosas</dt><dd>{number.format(quality.total - quality.usable)}</dd></div>
          <div><dt>Total recibido</dt><dd>{number.format(quality.total)}</dd></div></dl>
        <p className="layer-note">Utilizable: precisión mayor de 0 y hasta 50 m, sin alertas de salto, muestra antigua, simulada o fuera de orden. No garantiza la exactitud ni mide ubicaciones pendientes de envío.</p>
        <Link href="/mapa" className="dashboard-link">Ver mapa de la flota →</Link>
      </section>
    </div>
    <section className="dashboard-section"><div className="dashboard-heading"><h2>Viajes recientes del período</h2><Link href="/camiones" className="dashboard-link">Consultar recorridos →</Link></div>
      {data.recent.length === 0 ? <p>No hay viajes para mostrar.</p> : <div className="dashboard-table-scroll"><table className="dashboard-table">
        <caption className="sr-only">Los seis viajes más recientes del período</caption>
        <thead><tr><th scope="col">Camión</th><th scope="col">Piloto</th><th scope="col">Inicio · Guatemala</th><th scope="col">Estado</th></tr></thead>
        <tbody>{data.recent.map(trip => <tr key={trip._id.toHexString()}><td>{trip.placa ?? 'Sin placa'}</td><td>{trip.nombre ?? 'Sin conductor'}</td>
          <td>{dateTime.format(new Date(formatGuatemala(trip.inicio)))}</td><td><span className={`status-badge${trip.estado === 'activo' ? ' is-active' : ''}`}>{trip.estado === 'activo' ? 'En curso' : trip.estado === 'finalizado' ? 'Finalizado' : 'Desconocido'}</span></td></tr>)}</tbody>
      </table></div>}
    </section>
    <p className="layer-note">Las métricas se actualizan al cargar esta página. La app captura ubicaciones cada 5 segundos y envía lotes cada minuto; los datos pueden llegar después si no hay conexión.</p>
  </div>;
}
