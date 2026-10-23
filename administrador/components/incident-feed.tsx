'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Incident = { id: string; type: string; driver: string; plate: string; location: string; eventDate: string; tripId: string; mail: string; acknowledged: boolean; speed: number | null; limit: number | null };
const titles: Record<string, string> = { sos: 'SOS · Emergencia', speed: 'Exceso de velocidad', 'low-speed': 'Velocidad baja prolongada' };
const mailLabels: Record<string, string> = { pending: 'Correo pendiente', sending: 'Correo en proceso; entrega sin confirmar', accepted: 'Aceptado por EmailJS', unconfirmed: 'Entrega no confirmada' };
const when = (date: string) => new Date(date).toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
const speedText = (row: Incident) => row.speed === null ? '' :
  `${row.speed.toFixed(1)} km/h${row.type === 'speed' && row.limit !== null ? ` (límite ${row.limit} km/h)` : ''}`;
/** Speed alerts shown in the banner on every page; the rest stay in Notificaciones. */
const BANNER_SPEED_ROWS = 3;
export function IncidentFeed({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<Incident[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState('');
  useEffect(() => {
    let alive = true, timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/notifications/incidents', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (alive) { setRows(data.incidents); setError(''); }
      } catch { if (alive) setError('No se pudieron actualizar las alertas.'); }
      finally { if (alive) timer = setTimeout(load, 15000); }
    }
    void load(); return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, []);
  async function acknowledge(id: string) {
    if (busy) return; setBusy(id);
    try {
      const response = await fetch('/api/notifications/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      setRows(rows => rows.map(row => row.id === id ? { ...row, acknowledged: true } : row));
    } catch { setError('No se pudo confirmar la atención del incidente.'); }
    finally { setBusy(''); }
  }
  const emergencies = rows.filter(row => row.type === 'sos' && !row.acknowledged);
  const speeding = rows.filter(row => row.type === 'speed' && !row.acknowledged)
    .sort((a, b) => Date.parse(b.eventDate) - Date.parse(a.eventDate));
  if (compact) return <>
    {emergencies.length > 0 && <div role="alert" className="incident-sos"><strong>{emergencies.length} SOS pendientes de atención</strong> · <Link href="/mapa">Ver en el mapa</Link> · <Link href="/notificaciones">Ver emergencias</Link></div>}
    {speeding.length > 0 && <div role="alert" className="incident-speed">
      <strong>{speeding.length === 1 ? 'Exceso de velocidad sin atender' : `${speeding.length} excesos de velocidad sin atender`}</strong>
      <ul>{speeding.slice(0, BANNER_SPEED_ROWS).map(row => <li key={row.id}>
        <span><strong>{row.plate}</strong> · {row.driver} · {speedText(row)} · {when(row.eventDate)}</span>
        <Link href={`/camiones?viaje=${row.tripId}`}>Consultar viaje</Link>
        <button type="button" className="pagination-button" disabled={Boolean(busy)} onClick={() => acknowledge(row.id)}>Marcar atendido</button>
      </li>)}</ul>
      {speeding.length > BANNER_SPEED_ROWS && <Link href="/notificaciones">Ver los {speeding.length} excesos</Link>}
    </div>}
    {error && <p role="status">{error}</p>}
  </>;
  return <section className="account-card"><h2>Incidentes recientes</h2><p>Hasta 100 incidentes; emergencias sin atender primero. Se actualiza cada 15 segundos.</p>
    {error && <p role="alert">{error}</p>}{!rows.length && <p>No hay incidentes registrados.</p>}
    {rows.map(row => <article className={row.type === 'sos' && !row.acknowledged ? 'incident-sos' : 'incident-item'} key={row.id}>
      <h3>{titles[row.type]} · {row.plate}</h3><p>{row.driver} · {when(row.eventDate)}</p>
      {row.type !== 'sos' && row.speed !== null && <p>Velocidad: {speedText(row)}</p>}
      <p>{row.location}</p><p>{mailLabels[row.mail]}</p>
      <Link href={`/camiones?viaje=${row.tripId}`}>Consultar viaje</Link>{' '}
      {!row.acknowledged ? <button className="pagination-button" disabled={Boolean(busy)} onClick={() => acknowledge(row.id)}>Marcar atendido</button> : <span>Atendido</span>}
    </article>)}
  </section>;
}
