import 'server-only';
import { ObjectId } from 'mongodb';
import { getDb, getMongoClient } from '@/server/db/mongo';
import { getSpeedControl } from '@/server/control/speed';
import { formatGuatemala, guatemalaNow } from '@/server/time';
import type { DriverSession } from '@/server/auth/session';
import type { LivePing } from '@/server/trucks/live-speed';
import { advanceMotion, type MotionState } from '@/server/notifications/incident-rules';
import { appUrl, emailjsConfigured, sendEmergency, sendNotification } from '@/server/notifications/emailjs';
import { getEmailRecord, reserveEmailSend } from '@/server/notifications/repository';
import { takeGate } from '@/server/notifications/rate';
import { NotificationError } from '@/server/notifications/errors';

type Trip = { _id: ObjectId; driverId: ObjectId; truckId: ObjectId; estado: string; inicio: Date; notificationState?: MotionState; sosId?: string };
export type Incident = { _id: string; tripId: ObjectId; type: 'speed' | 'low-speed' | 'sos'; priority: number;
  driver: string; plate: string; location: string; eventDate: string; speed?: number; limit?: number | null;
  createdAt: Date; acknowledgedAt?: Date; acknowledgedBy?: string;
  mail: 'pending' | 'sending' | 'accepted' | 'unconfirmed'; nextAttempt: Date };

const incidents = async () => (await getDb()).collection<Incident>('notificationIncidents');
const location = (coords?: [number, number]) => coords ? `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}` : 'Sin ubicación GPS disponible';

/** State and outbox commit together; concurrent workers retry the transaction. */
export async function evaluateTripIncidents(tripId: ObjectId) {
  const db = await getDb();
  const control = await getSpeedControl();
  const session = (await getMongoClient()).startSession();
  try {
    await session.withTransaction(async () => {
      const trips = db.collection<Trip>('trips');
      const trip = await trips.findOne({ _id: tripId }, { session });
      if (!trip || trip.estado !== 'activo') return;
      const state = trip.notificationState ?? {};
      // Initial rollout only evaluates recent data; stale/offline backlogs cannot raise live alerts.
      const cutoff = new Date(guatemalaNow().getTime() - 2 * 60000);
      const from = state.last && state.last.timestamp > cutoff ? state.last.timestamp : cutoff;
      const points = await db.collection<LivePing & { tripId: ObjectId }>('locationPings')
        .find({ tripId, timestamp: { $gt: from, $lte: guatemalaNow() } }, { session })
        .sort({ timestamp: 1, _id: 1 }).limit(500).toArray();
      if (!points.length) return;
      const driver = await db.collection('drivers').findOne({ _id: trip.driverId }, { session });
      const truck = await db.collection('trucks').findOne({ _id: trip.truckId }, { session });
      for (const point of points) {
        for (const event of advanceMotion(state, point, control?.velocidadPromedio ?? null)) {
          const now = new Date();
          const row: Incident = { _id: `${tripId}:${event.type}:${+event.at}`, tripId, type: event.type, priority: 0,
            driver: String(driver?.nombre ?? 'Sin conductor'), plate: String(truck?.placa ?? 'Sin placa'),
            location: location(event.coordinates), eventDate: formatGuatemala(event.at), speed: event.speed,
            limit: control?.velocidadPromedio ?? null, createdAt: now, mail: 'pending', nextAttempt: now };
          await db.collection<Incident>('notificationIncidents').updateOne({ _id: row._id }, { $setOnInsert: row }, { upsert: true, session });
        }
      }
      // Avoid persisting Mongo metadata in the last-ping snapshot.
      if (state.last) { const p = state.last; state.last = { coords: p.coords, timestamp: p.timestamp, precision: p.precision, qualityFlags: p.qualityFlags ?? [] }; }
      await trips.updateOne({ _id: tripId }, { $set: { notificationState: state } }, { session });
    });
  } finally { await session.endSession(); }
}

/** SOS is durable before any provider request. One open SOS per trip, even across retries. */
export async function createSos(driver: DriverSession, tripId: ObjectId) {
  const db = await getDb();
  const session = (await getMongoClient()).startSession();
  try {
    return await session.withTransaction(async () => {
      const trips = db.collection<Trip>('trips');
      const trip = await trips.findOne({ _id: tripId, driverId: new ObjectId(driver.driverId), estado: 'activo' }, { session });
      if (!trip) throw new NotificationError(404, 'No tienes ese viaje activo.');
      if (trip.sosId) {
        const existing = await db.collection<Incident>('notificationIncidents').findOne({ _id: trip.sosId }, { session });
        if (existing && (!existing.acknowledgedAt || Date.now() - +existing.createdAt < 60000)) return { incidentId: existing._id, recorded: true };
      }
      const ping = await db.collection<LivePing & { tripId: ObjectId }>('locationPings').findOne({ tripId }, { session, sort: { timestamp: -1 } });
      const truck = await db.collection('trucks').findOne({ _id: trip.truckId }, { session });
      const now = new Date(), id = new ObjectId().toHexString();
      const row: Incident = { _id: id, tripId, type: 'sos', priority: 1, driver: driver.name, plate: String(truck?.placa ?? 'Sin placa'),
        location: location(ping?.coords.coordinates) + (ping ? ` (último GPS: ${formatGuatemala(ping.timestamp)})` : ''),
        eventDate: now.toISOString(), createdAt: now, mail: 'pending', nextAttempt: now };
      await db.collection<Incident>('notificationIncidents').insertOne(row, { session });
      await trips.updateOne({ _id: tripId }, { $set: { sosId: id } }, { session });
      return { incidentId: id, recorded: true };
    });
  } finally { await session.endSession(); }
}

/** One claimed message per invocation. Ambiguous sends are never retried automatically. */
export async function dispatchIncident() {
  const rows = await incidents();
  const row = await rows.findOneAndUpdate({ mail: 'pending', nextAttempt: { $lte: new Date() } },
    { $set: { mail: 'sending' } }, { sort: { priority: -1, createdAt: 1 }, returnDocument: 'after' });
  if (!row) return;
  let attempted = false;
  try {
    const settings = await getEmailRecord();
    if (!settings?.enabled || !settings.verifiedAt || !emailjsConfigured(row.type === 'sos')) throw new NotificationError(503, 'Configuración pendiente.');
    // SOS bypasses the routine 20/day budget. Provider-wide gate still applies.
    if (row.type !== 'sos') await reserveEmailSend();
    await takeGate('provider', 1100);
    const current = await getEmailRecord();
    if (!current?.enabled || !current.verifiedAt || current.revision !== settings.revision) throw new NotificationError(409, 'Configuración modificada.');
    attempted = true;
    if (row.type === 'sos') await sendEmergency({ to_email: current.email, driver_name: row.driver, vehicle_plate: row.plate, location: row.location, event_date: row.eventDate });
    else {
      const title = row.type === 'speed' ? 'Exceso de velocidad' : 'Velocidad baja prolongada';
      await sendNotification({ to_email: current.email, subject: title, title,
        message: row.type === 'speed' ? 'Un conductor superó el límite configurado.' : 'Velocidad inferior a 5 km/h durante 30 minutos consecutivos.',
        details: `Conductor: ${row.driver}\nPlaca: ${row.plate}\nVelocidad: ${row.speed} km/h\nLímite: ${row.limit ?? 'No configurado'} km/h\nUbicación: ${row.location}\nFecha: ${row.eventDate}`,
        action_url: appUrl(`/camiones?viaje=${row.tripId}`), button_text: 'Consultar vehículo' });
    }
    await rows.updateOne({ _id: row._id }, { $set: { mail: 'accepted' } });
  } catch {
    await rows.updateOne({ _id: row._id }, { $set: attempted ? { mail: 'unconfirmed' } : { mail: 'pending', nextAttempt: new Date(Date.now() + 60000) } });
    console.warn('[notifications] incident_mail', row._id, attempted ? 'unconfirmed' : 'deferred');
  }
}

export async function processTripNotifications(tripId: ObjectId) {
  try { await evaluateTripIncidents(tripId); await dispatchIncident(); }
  catch { console.warn('[notifications] trip_processing_failed', tripId.toHexString()); }
}

export async function listIncidents() {
  const rows = await (await incidents()).find({}).sort({ acknowledgedAt: 1, priority: -1, createdAt: -1 }).limit(100).toArray();
  return rows.map(row => ({ id: row._id, type: row.type, driver: row.driver, plate: row.plate, location: row.location,
    eventDate: row.eventDate, tripId: row.tripId.toHexString(), mail: row.mail, acknowledged: Boolean(row.acknowledgedAt),
    speed: row.speed ?? null, limit: row.limit ?? null }));
}

export async function acknowledgeIncident(id: unknown, adminId: string) {
  if (typeof id !== 'string' || id.length > 100) throw new NotificationError(400, 'Incidente inválido.');
  await (await incidents()).updateOne({ _id: id, acknowledgedAt: { $exists: false } }, { $set: { acknowledgedAt: new Date(), acknowledgedBy: adminId } });
  return { acknowledged: true };
}
