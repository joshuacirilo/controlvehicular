'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { validControlSpeed, type SpeedControl } from '@/lib/speed-control';

const dateTime = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' });

export function SpeedControlForm() {
  const router = useRouter();
  const [saved, setSaved] = useState<SpeedControl | null>(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/control', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (response.status === 401) { router.replace('/'); return; }
        if (!response.ok) throw new Error();
        const current: SpeedControl | null = await response.json();
        if (controller.signal.aborted) return;
        setSaved(current);
        setValue(current ? String(current.velocidadPromedio) : '');
        setLoaded(true);
      } catch {
        if (!controller.signal.aborted) setError('No se pudo cargar la configuración. Recarga la página para intentar de nuevo.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !loaded) return;
    setMessage('');
    const velocidadPromedio = Number(value);
    if (!validControlSpeed(velocidadPromedio)) { setError('Ingresa una velocidad mayor que 0 y hasta 300 km/h, con un decimal como máximo.'); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/control', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ velocidadPromedio }), signal: AbortSignal.timeout(30000),
      });
      if (response.status === 401) { router.replace('/'); return; }
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? 'No se pudo guardar.'); return; }
      setSaved(result);
      setValue(String(result.velocidadPromedio));
      setMessage('Velocidad promedio guardada.');
    } catch {
      setError('No se pudo confirmar el guardado. Recarga la página para comprobar el valor antes de volver a guardar.');
      setLoaded(false);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section className="account-card" aria-labelledby="speed-control-title">
    <h2 id="speed-control-title">Velocidad promedio de referencia</h2>
    <p className="layer-note">Este valor se establece manualmente y se comparte entre administradores. Cada cambio queda registrado.</p>
    {loading && <p role="status">Cargando configuración…</p>}
    {loaded && !saved && <p>Aún no hay una velocidad configurada.</p>}
    {saved && <div className="control-summary">
      <p>Valor guardado: <strong>{saved.velocidadPromedio} km/h</strong></p>
      <p>Modificado por <strong>{saved.modificadoPor.nombre}</strong> (@{saved.modificadoPor.username}) el {dateTime.format(new Date(saved.fechaModificacion))} (Guatemala).</p>
      <p>{saved.velocidadAnterior === null ? 'Primer registro: no existía una velocidad anterior.' : <>Valor anterior: <strong>{saved.velocidadAnterior} km/h</strong>, establecido por {saved.autorAnterior?.nombre} (@{saved.autorAnterior?.username}).</>}</p>
    </div>}
    <form onSubmit={submit} aria-busy={busy || loading}>
      <fieldset disabled={busy || !loaded}>
        <legend className="sr-only">Configuración de velocidad promedio</legend>
        <div className="account-fields"><label htmlFor="average-speed">Velocidad promedio (km/h)
          <input id="average-speed" type="number" min="0.1" max="300" step="0.1" required placeholder="Ej. 100"
            value={value} onChange={event => { setValue(event.target.value); setMessage(''); }} aria-describedby="speed-help" />
        </label></div>
        <p id="speed-help" className="layer-note">De 0.1 a 300 km/h. Puedes usar un decimal.</p>
        <button type="submit" className="primary-button">{busy ? 'Guardando…' : 'Guardar'}</button>
      </fieldset>
      {error && <p className="account-error" role="alert">{error}</p>}
      <p role="status">{message}</p>
    </form>
  </section>;
}
