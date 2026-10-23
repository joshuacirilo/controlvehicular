'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Pagination } from '@/components/pagination';
import type { PickedPoint, PointRole } from '@/components/assignment-picker-map';
import {
  parseAssignment, STATUS_LABELS, type AdminAssignment, type AssignmentOptions, type AssignmentPage,
} from '@/lib/assignments';

const PickerMap = dynamic(() => import('@/components/assignment-picker-map'), {
  ssr: false,
  loading: () => <div className="route-map-empty" role="status">Cargando mapa…</div>,
});

const schedule = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' });

/** Guatemala wall clock (UTC-6, no daylight saving) one hour from now, rounded down to the hour. */
function defaultSchedule() {
  const local = new Date(Date.now() + 60 * 60 * 1000 - 6 * 60 * 60 * 1000).toISOString();
  return { fecha: local.slice(0, 10), hora: `${local.slice(11, 13)}:00`, hoy: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10) };
}

function statusLabel(item: AdminAssignment) {
  if (item.estado !== 'pendiente') return STATUS_LABELS[item.estado];
  return item.leidaAt ? 'Leída por el piloto' : item.entregadaAt ? 'Recibida en la app' : 'Pendiente';
}

const coords = (point: PickedPoint) => `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;

export function AssignmentPlanner({ trucks, drivers }: AssignmentOptions) {
  const router = useRouter();
  const [initial] = useState(defaultSchedule);
  const [origen, setOrigen] = useState<PickedPoint | null>(null);
  const [destino, setDestino] = useState<PickedPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [list, setList] = useState<AssignmentPage | null>(null);
  const [listError, setListError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/assignments?page=${page}`, {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (response.status === 401) { router.replace('/'); return; }
        if (!response.ok) throw new Error();
        const data: AssignmentPage = await response.json();
        if (controller.signal.aborted) return;
        setList(data);
        setListError('');
      } catch {
        if (!controller.signal.aborted) setListError('No se pudieron cargar las asignaciones. Recarga la página.');
      }
    }
    void load();
    return () => controller.abort();
  }, [page, reload, router]);

  function pick(role: PointRole, point: PickedPoint) {
    (role === 'origen' ? setOrigen : setDestino)(point);
    setMessage('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const payload = {
      truckId: data.truckId, driverId: data.driverId,
      origen: origen && { ...origen, nombre: data.origenNombre ?? '' },
      destino: destino && { ...destino, nombre: data.destinoNombre ?? '' },
      fecha: data.fecha, hora: data.hora, nota: data.nota ?? '',
    };
    const parsed = parseAssignment(payload);
    if (!parsed.ok) { setError(parsed.message); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), cache: 'no-store', signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 401) { router.replace('/'); return; }
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? 'No se pudo asignar el viaje.'); return; }
      const created = result as AdminAssignment;
      setMessage(`Viaje asignado a ${created.driver.nombre} con el camión ${created.truck.placa}.`);
      form.reset();
      setOrigen(null);
      setDestino(null);
      setPage(1);
      setReload(value => value + 1);
    } catch {
      setError('No se pudo confirmar la asignación. Revisa la lista antes de volver a intentarlo para no duplicarla.');
      setReload(value => value + 1);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function cancel(item: AdminAssignment) {
    if (cancelling || !window.confirm(`¿Cancelar el viaje asignado a ${item.driver.nombre} (${item.truck.placa})?`)) return;
    setCancelling(item.id);
    setListError('');
    try {
      const response = await fetch(`/api/assignments/${item.id}/cancel`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (response.status === 401) { router.replace('/'); return; }
      if (!response.ok) setListError((await response.json()).message ?? 'No se pudo cancelar.');
    } catch {
      setListError('No se pudo confirmar la cancelación. Revisa la lista.');
    } finally {
      setCancelling(null);
      setReload(value => value + 1);
    }
  }

  const missingData = trucks.length === 0 || drivers.length === 0;

  return <>
    <section className="account-card" aria-labelledby="assign-title">
      <h2 id="assign-title">Nuevo viaje asignado</h2>
      {missingData && <p className="account-error" role="alert">
        {trucks.length === 0 ? 'No hay camiones activos. ' : ''}{drivers.length === 0 ? 'No hay pilotos activos con cuenta para la app. ' : ''}
        Regístralos en Control de cuentas.
      </p>}
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy || missingData}>
          <legend className="sr-only">Datos del viaje asignado</legend>
          <div className="account-fields">
            <label>Camión
              <select name="truckId" required defaultValue="">
                <option value="" disabled>Selecciona un camión</option>
                {trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.placa} · {truck.modelo}</option>)}
              </select>
            </label>
            <label>Piloto
              <select name="driverId" required defaultValue="">
                <option value="" disabled>Selecciona un piloto</option>
                {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.nombre}</option>)}
              </select>
            </label>
            <label>Fecha de salida<input name="fecha" type="date" required min={initial.hoy} defaultValue={initial.fecha} /></label>
            <label>Hora de salida (Guatemala)<input name="hora" type="time" required defaultValue={initial.hora} /></label>
          </div>
          <div className="assign-map-header">
            <p className="layer-note" id="assign-map-help">
              {!origen ? 'Haz clic en el mapa para marcar el origen (A).' : !destino ? 'Ahora haz clic para marcar el destino (B).'
                : 'Arrastra los marcadores para ajustarlos.'}
            </p>
            <button type="button" className="pagination-button" onClick={() => { setOrigen(null); setDestino(null); }}
              disabled={!origen && !destino}>Reiniciar puntos</button>
          </div>
          <div className="assign-map" aria-describedby="assign-map-help">
            <PickerMap origen={origen} destino={destino} onPick={pick} />
          </div>
          <div className="account-fields">
            <label>Origen (A) {origen && <small className="assign-coords">{coords(origen)}</small>}
              <input name="origenNombre" maxLength={120} placeholder="Nombre del lugar (opcional)" autoComplete="off" />
            </label>
            <label>Destino (B) {destino && <small className="assign-coords">{coords(destino)}</small>}
              <input name="destinoNombre" maxLength={120} placeholder="Nombre del lugar (opcional)" autoComplete="off" />
            </label>
            <label className="assign-note">Nota para el piloto
              <textarea name="nota" maxLength={500} rows={3} placeholder="Instrucciones (opcional)" />
            </label>
          </div>
          {error && <p className="account-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit">{busy ? 'Asignando…' : 'Asignar viaje'}</button>
        </fieldset>
        <p role="status" className="assign-success">{message}</p>
      </form>
    </section>

    <section className="account-card" aria-labelledby="assign-list-title">
      <h2 id="assign-list-title">Viajes asignados</h2>
      {listError && <p className="account-error" role="alert">{listError}</p>}
      {!list && !listError && <p role="status">Cargando asignaciones…</p>}
      {list && list.total === 0 && <p className="layer-note">Aún no hay viajes asignados.</p>}
      {list && list.assignments.length > 0 && <ul className="assign-list">
        {list.assignments.map(item => <li key={item.id} className="assign-item">
          <div className="assign-item-header">
            <strong>{item.truck.placa} · {item.driver.nombre}</strong>
            <span className={`status-badge${item.estado === 'en_curso' ? ' is-active' : ''}`}>{statusLabel(item)}</span>
          </div>
          <p>Salida: <strong>{schedule.format(new Date(item.programadoPara))}</strong></p>
          <p>A: {item.origen.nombre || coords(item.origen)} → B: {item.destino.nombre || coords(item.destino)}</p>
          {item.nota && <p className="layer-note">{item.nota}</p>}
          <p className="layer-note">Asignado por {item.createdBy.nombre} (@{item.createdBy.username})</p>
          {item.estado === 'pendiente' && <div className="account-actions assign-actions">
            <button type="button" onClick={() => cancel(item)} disabled={cancelling !== null}>
              {cancelling === item.id ? 'Cancelando…' : 'Cancelar'}
            </button>
          </div>}
        </li>)}
      </ul>}
      {list && <Pagination page={list.page} totalPages={list.totalPages} label="Páginas de viajes asignados" onChange={setPage} />}
    </section>
  </>;
}
