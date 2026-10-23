import 'server-only';
import { ObjectId } from 'mongodb';
import type { DriverSession } from '@/server/auth/session';
import { getDb } from '@/server/db/mongo';
import { formatGuatemala, guatemalaNow } from '@/server/time';
import type { Result } from '@/server/trips/service';

/** Pause dates follow the trip convention: Guatemala wall-clock time. */
type PausableTrip = {
  _id: ObjectId;
  driverId: ObjectId;
  truckId: ObjectId;
  estado: 'activo' | 'finalizado';
  pausadoDesde?: Date | null;
  pausaMovimientoAt?: Date | null;
  updatedAt: Date;
};

type TripPause = {
  _id: ObjectId;
  tripId: ObjectId;
  driverId: ObjectId;
  truckId: ObjectId;
  inicio: Date;
  fin: Date | null;
  movimientoAt: Date | null;
  velocidadKmh: number | null;
};

export type PauseState = { tripId: string; pausado: boolean; pausadoDesde: string | null };

const fail = (status: number, message: string): Result<never> => ({ ok: false, status, message });

async function collections() {
  const db = await getDb();
  return { trips: db.collection<PausableTrip>('trips'), pauses: db.collection<TripPause>('tripPauses') };
}

const state = (trip: Pick<PausableTrip, '_id' | 'pausadoDesde'>): PauseState => ({
  tripId: trip._id.toHexString(),
  pausado: Boolean(trip.pausadoDesde),
  pausadoDesde: trip.pausadoDesde ? formatGuatemala(trip.pausadoDesde) : null,
});

/** Explains why the conditional update did not apply. */
async function unchanged(trips: Awaited<ReturnType<typeof collections>>['trips'], own: { _id: ObjectId; driverId: ObjectId }) {
  const trip = await trips.findOne(own, { projection: { estado: 1, pausadoDesde: 1 } });
  if (!trip) return fail(404, 'Viaje no encontrado.');
  if (trip.estado !== 'activo') return fail(409, 'El viaje ya terminó.');
  return { ok: true as const, status: 200, body: state(trip) };
}

/** Pauses the pilot's active trip. Pausing an already paused trip returns its current pause. */
export async function pauseTrip(session: DriverSession, tripId: ObjectId): Promise<Result<PauseState>> {
  const { trips, pauses } = await collections();
  const own = { _id: tripId, driverId: new ObjectId(session.driverId) };
  const now = guatemalaNow();
  const paused = await trips.findOneAndUpdate(
    { ...own, estado: 'activo', pausadoDesde: null },
    { $set: { pausadoDesde: now, pausaMovimientoAt: null, updatedAt: now } },
    { returnDocument: 'after' },
  );
  if (!paused) return unchanged(trips, own);
  await pauses.insertOne({
    _id: new ObjectId(), tripId, driverId: own.driverId, truckId: paused.truckId,
    inicio: now, fin: null, movimientoAt: null, velocidadKmh: null,
  });
  return { ok: true, status: 200, body: state(paused) };
}

/** Resumes the trip. Resuming a trip that is not paused is harmless. */
export async function resumeTrip(session: DriverSession, tripId: ObjectId): Promise<Result<PauseState>> {
  const { trips, pauses } = await collections();
  const own = { _id: tripId, driverId: new ObjectId(session.driverId) };
  const now = guatemalaNow();
  const resumed = await trips.findOneAndUpdate(
    { ...own, estado: 'activo', pausadoDesde: { $ne: null } },
    { $set: { pausadoDesde: null, pausaMovimientoAt: null, updatedAt: now } },
    { returnDocument: 'after' },
  );
  // Also on retries, in case an earlier request updated the trip but not its pause record.
  await pauses.updateOne({ tripId, fin: null }, { $set: { fin: now } });
  return resumed ? { ok: true, status: 200, body: state(resumed) } : unchanged(trips, own);
}

/** The app saw the vehicle moving while the trip was paused; the first report of each pause is kept. */
export async function reportPausedMovement(session: DriverSession, tripId: ObjectId, input: Record<string, unknown> | null) {
  const speed = input?.velocidadKmh;
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0 || speed > 300) {
    return fail(400, 'Velocidad inválida.');
  }
  const { trips, pauses } = await collections();
  const own = { _id: tripId, driverId: new ObjectId(session.driverId) };
  const now = guatemalaNow();
  const trip = await trips.findOne(own, { projection: { estado: 1, pausadoDesde: 1 } });
  if (!trip) return fail(404, 'Viaje no encontrado.');
  if (trip.estado !== 'activo' || !trip.pausadoDesde) return fail(409, 'El viaje no está en pausa.');
  await trips.updateOne({ ...own, pausadoDesde: { $ne: null }, pausaMovimientoAt: null }, { $set: { pausaMovimientoAt: now } });
  await pauses.updateOne({ tripId, fin: null, movimientoAt: null }, { $set: { movimientoAt: now, velocidadKmh: Math.round(speed * 10) / 10 } });
  return { ok: true as const, status: 200, body: { tripId: tripId.toHexString(), registrado: true } };
}

/** Closing a trip also ends its open pause; safe to repeat. */
export async function closePause(tripId: ObjectId, fin: Date) {
  const { trips, pauses } = await collections();
  await trips.updateOne({ _id: tripId, pausadoDesde: { $ne: null } }, { $set: { pausadoDesde: null, pausaMovimientoAt: null } });
  await pauses.updateOne({ tripId, fin: null }, { $set: { fin } });
}
