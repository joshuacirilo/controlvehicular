import 'server-only';
import { MongoServerError, ObjectId } from 'mongodb';
import { verifyTruck } from '@/server/auth/driver-login';
import type { DriverSession } from '@/server/auth/session';
import { getDb } from '@/server/db/mongo';
import { formatGuatemala, guatemalaNow, toGuatemala } from '@/server/time';
import { speedKmh, type PingInput } from '@/server/trips/pings';

const START_TOLERANCE_MS = 5 * 60 * 1000;

type Trip = {
  _id: ObjectId;
  truckId: ObjectId;
  driverId: ObjectId;
  rutaPlaneada: null;
  estado: 'activo' | 'finalizado';
  inicio: Date;
  fin: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LocationPing = {
  _id?: ObjectId;
  pingId: string;
  tripId: ObjectId;
  truckId: ObjectId;
  driverId: ObjectId;
  coords: { type: 'Point'; coordinates: [number, number] };
  velocidad: number | null;
  precision: number | null;
  timestamp: Date;
  receivedAt: Date;
};

export type Result<T> = { ok: true; status: number; body: T } | { ok: false; status: number; message: string };

const fail = (status: number, message: string): Result<never> => ({ ok: false, status, message });
const isDuplicateKey = (error: unknown) => error instanceof MongoServerError && error.code === 11000;

async function collections() {
  const db = await getDb();
  return {
    trips: db.collection<Trip>('trips'),
    pings: db.collection<LocationPing>('locationPings'),
    drivers: db.collection<{ _id: ObjectId; activo: boolean }>('drivers'),
  };
}

/** Credentials read from the truck QR; every trip start must present them. */
export type TruckQr = { placa: string; password: string };

/**
 * Starts a trip for the signed-in pilot on the truck whose QR credentials were scanned.
 * Retrying with the same truck while the trip is active returns that trip.
 */
export async function startTrip(session: DriverSession, qr: TruckQr | null, firstPing: PingInput | null) {
  if (!qr) return fail(400, 'Escanea el QR del camión para iniciar el viaje.');
  const { trips, drivers } = await collections();
  const driverId = new ObjectId(session.driverId);
  if (!await drivers.findOne({ _id: driverId, activo: true }, { projection: { _id: 1 } })) {
    return fail(403, 'Tu usuario no está vinculado a un conductor activo.');
  }
  const verified = await verifyTruck(qr.placa, qr.password);
  if (!verified.ok) return verified;
  const truck = verified.body;

  let trip = await trips.findOne({ driverId, estado: 'activo' });
  const resumed = trip !== null;
  if (trip && !trip.truckId.equals(truck._id)) {
    return fail(409, 'Ya tienes un viaje activo con otro camión. Termínalo antes de iniciar uno nuevo.');
  }
  if (!trip) {
    const now = guatemalaNow();
    const candidate: Trip = {
      _id: new ObjectId(), truckId: truck._id, driverId, rutaPlaneada: null,
      estado: 'activo', inicio: now, fin: null, createdAt: now, updatedAt: now,
    };
    try {
      // The partial unique index on active trips per truck rejects concurrent starts.
      await trips.insertOne(candidate);
    } catch (error) {
      if (isDuplicateKey(error)) return fail(409, 'Este camión ya tiene un viaje activo.');
      throw error;
    }
    trip = candidate;
  }
  if (firstPing) await storePings(trip, [firstPing]);
  return {
    ok: true as const,
    status: resumed ? 200 : 201,
    body: {
      tripId: trip._id.toHexString(),
      inicio: formatGuatemala(trip.inicio),
      resumed,
      truck: { placa: truck.placa, modelo: truck.modelo },
    },
  };
}

async function storePings(trip: Trip, input: PingInput[]) {
  const { pings } = await collections();
  const accepted: string[] = [];
  const rejected: { pingId: string; reason: string }[] = [];
  const receivedAt = guatemalaNow();
  const local = input.map(ping => ({ ...ping, timestamp: toGuatemala(ping.timestamp) }));
  for (const ping of local.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
    // Samples taken before the close are still valid history after the trip ends.
    if (trip.fin && ping.timestamp > trip.fin) {
      rejected.push({ pingId: ping.pingId, reason: 'trip_closed' });
      continue;
    }
    if (ping.timestamp.getTime() < trip.inicio.getTime() - START_TOLERANCE_MS) {
      rejected.push({ pingId: ping.pingId, reason: 'before_trip' });
      continue;
    }
    const previous = await pings.findOne(
      { tripId: trip._id, timestamp: { $lt: ping.timestamp } },
      { sort: { timestamp: -1, _id: -1 }, projection: { coords: 1, timestamp: 1, precision: 1 } },
    );
    const coordinates: [number, number] = [ping.longitude, ping.latitude];
    const velocidad = speedKmh(
      previous && { coordinates: previous.coords.coordinates, timestamp: previous.timestamp, accuracy: previous.precision ?? null },
      { coordinates, timestamp: ping.timestamp, accuracy: ping.accuracy },
    );
    try {
      await pings.insertOne({
        pingId: ping.pingId, tripId: trip._id, truckId: trip.truckId, driverId: trip.driverId,
        coords: { type: 'Point', coordinates }, velocidad, precision: ping.accuracy,
        timestamp: ping.timestamp, receivedAt,
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
    accepted.push(ping.pingId);
  }
  return { accepted, rejected };
}

/** Stores samples for a trip owned by the driver. Retried pingIds are acknowledged without duplicating. */
export async function recordPings(session: DriverSession, tripId: ObjectId, input: PingInput[]) {
  const { trips, pings } = await collections();
  const trip = await trips.findOne({ _id: tripId, driverId: new ObjectId(session.driverId) });
  if (!trip) return fail(404, 'Viaje no encontrado.');
  const { accepted, rejected } = await storePings(trip, input);
  const latest = await pings.findOne(
    { tripId },
    { sort: { timestamp: -1, _id: -1 }, projection: { velocidad: 1, timestamp: 1 } },
  );
  return {
    ok: true as const,
    status: 200,
    body: {
      estado: trip.estado,
      accepted,
      rejected,
      latest: latest && { velocidad: latest.velocidad, timestamp: formatGuatemala(latest.timestamp) },
    },
  };
}

/** Closes the driver's trip; closing an already finished trip returns its original end time. */
export async function endTrip(session: DriverSession, tripId: ObjectId) {
  const { trips } = await collections();
  const filter = { _id: tripId, driverId: new ObjectId(session.driverId) };
  const now = guatemalaNow();
  const closed = await trips.findOneAndUpdate(
    { ...filter, estado: 'activo' },
    { $set: { estado: 'finalizado', fin: now, updatedAt: now } },
    { returnDocument: 'after' },
  );
  const trip = closed ?? await trips.findOne(filter);
  if (!trip?.fin) return fail(404, 'Viaje no encontrado.');
  return { ok: true as const, status: 200, body: { tripId: tripId.toHexString(), estado: trip.estado, fin: formatGuatemala(trip.fin) } };
}
