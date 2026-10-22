'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { getSpeedDashboard } from '@/server/control/speed-dashboard';
import { percentage } from '@/lib/speed-dashboard';

type Data = Awaited<ReturnType<typeof getSpeedDashboard>>;
const percent = (value: number | null) => value === null ? 'Sin datos' : `${value.toFixed(1)}%`;
const time = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'short', timeStyle: 'medium' });

export function DashboardSpeed({ data, days }: { data: Data; days: number }) {
  const [detail, setDetail] = useState<'pilots' | 'trips' | null>(null);
  const tripLink = (trip: { tripId: string; index: number }) => `/camiones?viaje=${encodeURIComponent(trip.tripId)}&tramo=${trip.index}&dias=${days}`;
  const tripRows = (trips: Data['affectedDetails']) => <div className="dashboard-table-scroll"><table className="dashboard-table">
    <thead><tr><th scope="col">Piloto / camión</th><th scope="col">Último exceso · Guatemala</th><th scope="col">Tramos con exceso</th><th scope="col">Viaje</th></tr></thead>
    <tbody>{trips.map(trip => <tr key={trip.tripId}><td>{trip.nombre}<br />{trip.placa}</td><td>{time.format(new Date(trip.end))}</td><td>{trip.excesses}</td>
      <td><Link className="dashboard-link" href={tripLink(trip)} aria-label={`Detalles del viaje de ${trip.nombre}, ${trip.placa}, ${time.format(new Date(trip.end))}`}>Detalles →</Link></td></tr>)}</tbody>
  </table></div>;
  if (data.limit === null) return <section className="dashboard-section"><h2>Control de velocidad</h2>
    <p>Configura un límite para evaluar excesos y porcentajes.</p><Link href="/control" className="dashboard-link">Configurar límite →</Link></section>;
  const metrics = [
    ['Tramos sobre el límite', `${data.excesses}`, `${data.evaluated} evaluados · ${data.skipped} sin evaluar`],
    ['Porcentaje de tramos con exceso', percent(data.percent), 'Tramos con exceso / tramos evaluados'],
    ['Viajes con exceso', `${data.affectedTrips}`, `${percent(data.tripPercent)} de ${data.evaluatedTrips} viajes evaluables`],
    ['Pilotos con exceso', `${data.affectedDrivers}`, `${percent(percentage(data.affectedDrivers, data.evaluatedDrivers))} de ${data.evaluatedDrivers} pilotos evaluables`],
  ];
  return <section className="dashboard-speed" aria-labelledby="speed-title">
    <div className="dashboard-heading"><div><h2 id="speed-title">Control de velocidad</h2>
      <p className="layer-note">Límite vigente: <strong>{data.limit} km/h</strong> · Viajes iniciados en el período seleccionado.</p></div>
      <Link href="/control" className="dashboard-link">Configurar límite →</Link></div>
    <p className="layer-note">Estimaciones entre checkpoints válidos. Cada tramo se cuenta por separado; los porcentajes no representan tiempo de conducción. Los viajes históricos se comparan con el límite actual.</p>
    <div className="dashboard-cards">{metrics.map(([label, value, note], index) => index >= 2
      ? <button type="button" className="dashboard-card dashboard-metric-button" key={label} aria-haspopup="dialog" aria-expanded={detail === (index === 2 ? 'trips' : 'pilots')} aria-controls={detail ? 'speed-metric-details' : undefined}
        onClick={() => setDetail(index === 2 ? 'trips' : 'pilots')}><span>{label}</span><strong>{value}</strong><span>{note}</span><span className="dashboard-link">Ver {index === 2 ? 'viajes' : 'pilotos'} →</span></button>
      : <article className="dashboard-card" key={label}><h3>{label}</h3><strong>{value}</strong><p>{note}</p></article>)}</div>
    {detail && <dialog id="speed-metric-details" className="dashboard-detail-dialog" aria-labelledby="speed-detail-title"
      ref={node => { if (node && !node.open) node.showModal(); }}
      onClose={() => setDetail(null)}
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <section className="dashboard-section">
        <div className="dashboard-heading"><h3 id="speed-detail-title">{detail === 'pilots' ? 'Pilotos con exceso' : 'Viajes con exceso'}</h3><button type="button" className="pagination-button" onClick={event => event.currentTarget.closest('dialog')?.close()}>Cerrar</button></div>
        <p className="layer-note">Detalles abre el viaje exacto en Camiones y enfoca su último tramo con exceso. Incluye todos los viajes afectados del período, no solo los últimos 20 tramos.</p>
        {!data.affectedDetails.length ? <p>No hay excesos registrados en los tramos evaluados de este período.</p>
          : detail === 'trips' ? tripRows(data.affectedDetails)
          : data.ranking.filter(driver => driver.excesses > 0).map(driver => <details key={driver.id} className="dashboard-pilot-details" open>
            <summary>{driver.nombre} · {driver.affected} viajes con exceso · {percent(driver.percent)} de tramos</summary>
            {tripRows(data.affectedDetails.filter(trip => trip.driverId === driver.id))}
          </details>)}
      </section>
    </dialog>}
    {data.evaluated === 0 && <p role="status">No hay tramos con datos suficientes para evaluar velocidad. Esto no confirma ausencia de excesos.</p>}
    <section className="dashboard-section"><h3>Control por piloto</h3>
      <p className="layer-note">Ordenado por cantidad de tramos sobre el límite. Se muestran también pilotos sin excesos o sin muestras evaluables.</p>
      {data.ranking.length === 0 ? <p>No hay pilotos con viajes en este período.</p> : <div className="dashboard-table-scroll"><table className="dashboard-table">
        <thead><tr><th scope="col">Piloto</th><th scope="col">Tramos evaluados</th><th scope="col">Sin evaluar</th><th scope="col">Con exceso</th><th scope="col">% con exceso</th><th scope="col">Viajes con exceso / total</th><th scope="col">Último exceso · Guatemala</th></tr></thead>
        <tbody>{data.ranking.map(driver => <tr key={driver.id}><td>{driver.nombre}</td><td>{driver.evaluated}</td><td>{driver.skipped}</td><td>{driver.excesses}</td><td>{percent(driver.percent)}</td>
          <td>{driver.affected} / {driver.trips}</td><td>{driver.last ? time.format(new Date(driver.last)) : '—'}</td></tr>)}</tbody>
      </table></div>}
    </section>
    <section className="dashboard-section"><h3>Excesos por día</h3><p className="layer-note">Fecha del checkpoint final, hora de Guatemala. Solo días con tramos evaluables.</p>
      {data.daily.length === 0 ? <p>Sin datos evaluables.</p> : <div className="dashboard-table-scroll"><table className="dashboard-table">
        <thead><tr><th scope="col">Fecha</th><th scope="col">Tramos evaluados</th><th scope="col">Con exceso</th><th scope="col">% con exceso</th></tr></thead>
        <tbody>{data.daily.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.evaluated}</td><td>{day.excesses}</td><td>{percent(percentage(day.excesses, day.evaluated))}</td></tr>)}</tbody>
      </table></div>}
    </section>
    <section className="dashboard-section"><div className="dashboard-heading"><h3>Últimos tramos sobre el límite</h3><Link href="/camiones" className="dashboard-link">Revisar recorridos →</Link></div>
      <p className="layer-note">Hasta 20 tramos, del más reciente al más antiguo. El porcentaje sobre el límite compara la velocidad estimada con {data.limit} km/h.</p>
      {data.events.length === 0 ? <p>{data.evaluated ? 'No se detectaron excesos en los tramos evaluados.' : 'Sin datos evaluables.'}</p> : <div className="dashboard-table-scroll"><table className="dashboard-table">
        <thead><tr><th scope="col">Piloto / camión</th><th scope="col">Inicio · Guatemala</th><th scope="col">Fin · Guatemala</th><th scope="col">Tramo</th><th scope="col">Velocidad estimada</th><th scope="col">Sobre el límite</th><th scope="col">Viaje</th></tr></thead>
        <tbody>{data.events.map(event => <tr key={`${event.tripId}-${event.index}`}><td>{event.nombre}<br />{event.placa}</td>
          <td>{time.format(new Date(event.start))}</td><td>{time.format(new Date(event.end))}</td><td>{event.index} ({event.index - 1} → {event.index})</td>
          <td>{event.speed!.toFixed(2)} km/h</td><td>+{((event.speed! / data.limit! - 1) * 100).toFixed(1)}%</td><td><Link href={tripLink(event)} className="dashboard-link">Detalles →</Link></td></tr>)}</tbody>
      </table></div>}
    </section>
  </section>;
}
