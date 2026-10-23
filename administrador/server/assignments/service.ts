import 'server-only';
import { ObjectId } from 'mongodb';
import {
  ASSIGNMENTS_PER_PAGE, parseAssignment,
  type AdminAssignment, type AssignmentOptions, type AssignmentPage, type AssignmentPoint, type AssignmentStatus,
  type DriverAssignment,
} from '@/lib/assignments';
import type { AdminUser } from '@/server/auth/admin';
import type { DriverSession } from '@/server/auth/session';
import { getDb } from '@/server/db/mongo';
import type { Result } from '@/server/trips/service';

type GeoPoint = { type: 'Point'; coordinates: [number, number]; nombre: string };

export type AssignmentDoc = {
  _id: ObjectId;
  truckId: ObjectId;
  driverId: ObjectId;
  createdBy: { id: string; username: string; nombre: string };
  origen: GeoPoint;
  destino: GeoPoint;
  programadoPara: Date;
  nota: string;
  estado: AssignmentStatus;
  tripId: ObjectId | null;
  entregadaAt: Date | null;
  leidaAt: Date | null;
  iniciadaAt: Date | null;
  completadaAt: Date | null;
  canceladaAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TruckDoc = { _id: ObjectId; placa: string; modelo: string; activo?: boolean };
type DriverDoc = { _id: ObjectId; nombre: string; userId: ObjectId | null; activo?: boolean };

const fail = (status: number, message: string): Result<never> => ({ ok: false, status, message });

async function collections() {
  const db = await getDb();
  return {
    assignments: db.collection<AssignmentDoc>('tripAssignments'),
    trucks: db.collection<TruckDoc>('trucks'),
    drivers: db.collection<DriverDoc>('drivers'),
    users: db.collection<{ _id: ObjectId; rol: string; activo: boolean }>('users'),
    trips: db.collection<{ _id: ObjectId; assignmentId?: ObjectId }>('trips'),
  };
}

const toGeo = ({ lat, lng, nombre }: AssignmentPoint): GeoPoint => ({ type: 'Point', coordinates: [lng, lat], nombre });
const fromGeo = ({ coordinates: [lng, lat], nombre }: GeoPoint): AssignmentPoint => ({ lat, lng, nombre });

function toDriverAssignment(doc: AssignmentDoc, truck: Pick<TruckDoc, 'placa' | 'modelo'> | null): DriverAssignment {
  return {
    id: doc._id.toHexString(),
    truck: { placa: truck?.placa ?? '', modelo: truck?.modelo ?? '' },
    origen: fromGeo(doc.origen), destino: fromGeo(doc.destino),
    programadoPara: doc.programadoPara.toISOString(), nota: doc.nota, estado: doc.estado,
    entregada: doc.entregadaAt !== null, leida: doc.leidaAt !== null,
  };
}

/** Pilots that can receive an assignment: active driver linked to an active `conductor` user. */
export async function assignmentOptions(): Promise<AssignmentOptions> {
  const { trucks, drivers, users } = await collections();
  const [truckRows, driverRows] = await Promise.all([
    trucks.find({ activo: true }, { projection: { placa: 1, modelo: 1 }, sort: { placa: 1 } }).toArray(),
    drivers.find({ activo: true, userId: { $ne: null } }, { projection: { nombre: 1, userId: 1 }, sort: { nombre: 1 } }).toArray(),
  ]);
  const activeUsers = new Set((await users.find(
    { _id: { $in: driverRows.map(row => row.userId!) }, rol: 'conductor', activo: true }, { projection: { _id: 1 } },
  ).toArray()).map(user => user._id.toHexString()));
  return {
    trucks: truckRows.map(row => ({ id: row._id.toHexString(), placa: row.placa, modelo: row.modelo })),
    drivers: driverRows.filter(row => activeUsers.has(row.userId!.toHexString()))
      .map(row => ({ id: row._id.toHexString(), nombre: row.nombre })),
  };
}

export async function createAssignment(admin: AdminUser, input: unknown, now = new Date()): Promise<Result<AdminAssignment>> {
  const parsed = parseAssignment(input, now);
  if (!parsed.ok) return fail(400, parsed.message);
  const value = parsed.value;
  const { assignments, trucks, drivers, users } = await collections();
  const truck = await trucks.findOne({ _id: new ObjectId(value.truckId), activo: true }, { projection: { placa: 1, modelo: 1 } });
  if (!truck) return fail(400, 'El camión no existe o está inactivo.');
  const driver = await drivers.findOne({ _id: new ObjectId(value.driverId), activo: true, userId: { $ne: null } },
    { projection: { nombre: 1, userId: 1 } });
  const user = driver?.userId && await users.findOne({ _id: driver.userId, rol: 'conductor', activo: true }, { projection: { _id: 1 } });
  if (!driver || !user) return fail(400, 'El piloto no existe, está inactivo o no tiene cuenta para la app.');
  const doc: AssignmentDoc = {
    _id: new ObjectId(), truckId: truck._id, driverId: driver._id,
    createdBy: { id: admin.id, username: admin.username, nombre: admin.nombre },
    origen: toGeo(value.origen), destino: toGeo(value.destino),
    programadoPara: value.programadoPara, nota: value.nota, estado: 'pendiente', tripId: null,
    entregadaAt: null, leidaAt: null, iniciadaAt: null, completadaAt: null, canceladaAt: null,
    createdAt: now, updatedAt: now,
  };
  await assignments.insertOne(doc);
  return { ok: true, status: 201, body: toAdminAssignment(doc, truck, driver) };
}

function toAdminAssignment(doc: AssignmentDoc, truck: TruckDoc | null, driver: Pick<DriverDoc, '_id' | 'nombre'> | null): AdminAssignment {
  const base = toDriverAssignment(doc, truck);
  return {
    ...base,
    truck: { id: doc.truckId.toHexString(), ...base.truck },
    driver: { id: doc.driverId.toHexString(), nombre: driver?.nombre ?? '' },
    createdBy: { username: doc.createdBy.username, nombre: doc.createdBy.nombre },
    tripId: doc.tripId?.toHexString() ?? null,
    entregadaAt: doc.entregadaAt?.toISOString() ?? null,
    leidaAt: doc.leidaAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listAssignments(requestedPage: number): Promise<AssignmentPage> {
  const { assignments, trucks, drivers } = await collections();
  const total = await assignments.countDocuments({});
  const totalPages = Math.max(1, Math.ceil(total / ASSIGNMENTS_PER_PAGE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const rows = await assignments.find({}, {
    sort: { programadoPara: -1, _id: -1 }, skip: (page - 1) * ASSIGNMENTS_PER_PAGE, limit: ASSIGNMENTS_PER_PAGE,
  }).toArray();
  const [truckRows, driverRows] = await Promise.all([
    trucks.find({ _id: { $in: rows.map(row => row.truckId) } }, { projection: { placa: 1, modelo: 1 } }).toArray(),
    drivers.find({ _id: { $in: rows.map(row => row.driverId) } }, { projection: { nombre: 1 } }).toArray(),
  ]);
  const truckById = new Map(truckRows.map(row => [row._id.toHexString(), row]));
  const driverById = new Map(driverRows.map(row => [row._id.toHexString(), row]));
  return {
    page, totalPages, total,
    assignments: rows.map(row => toAdminAssignment(row,
      truckById.get(row.truckId.toHexString()) ?? null, driverById.get(row.driverId.toHexString()) ?? null)),
  };
}

export async function cancelAssignment(id: ObjectId): Promise<Result<{ id: string; estado: AssignmentStatus }>> {
  const { assignments } = await collections();
  const now = new Date();
  const result = await assignments.updateOne({ _id: id, estado: 'pendiente' },
    { $set: { estado: 'cancelada', canceladaAt: now, updatedAt: now } });
  if (result.matchedCount === 1) return { ok: true, status: 200, body: { id: id.toHexString(), estado: 'cancelada' } };
  const existing = await assignments.findOne({ _id: id }, { projection: { estado: 1 } });
  return existing ? fail(409, 'Solo se pueden cancelar asignaciones pendientes.') : fail(404, 'Asignación no encontrada.');
}

export async function driverAssignments(session: DriverSession): Promise<Result<{ assignments: DriverAssignment[] }>> {
  const { assignments, trucks } = await collections();
  const rows = await assignments.find(
    { driverId: new ObjectId(session.driverId), estado: { $in: ['pendiente', 'en_curso'] } },
    { sort: { programadoPara: 1, _id: 1 }, limit: 50 },
  ).toArray();
  const truckRows = await trucks.find({ _id: { $in: rows.map(row => row.truckId) } }, { projection: { placa: 1, modelo: 1 } }).toArray();
  const truckById = new Map(truckRows.map(row => [row._id.toHexString(), row]));
  return {
    ok: true, status: 200,
    body: { assignments: rows.map(row => toDriverAssignment(row, truckById.get(row.truckId.toHexString()) ?? null)) },
  };
}

/** Records that the pilot's app received (`delivered`) or opened (`read`) the assignment. Repeating is harmless. */
export async function markAssignment(session: DriverSession, id: ObjectId, mark: 'delivered' | 'read') {
  const { assignments } = await collections();
  const own = { _id: id, driverId: new ObjectId(session.driverId) };
  const now = new Date();
  await assignments.updateOne({ ...own, entregadaAt: null }, { $set: { entregadaAt: now, updatedAt: now } });
  if (mark === 'read') await assignments.updateOne({ ...own, leidaAt: null }, { $set: { leidaAt: now, updatedAt: now } });
  const doc = await assignments.findOne(own, { projection: { entregadaAt: 1, leidaAt: 1 } });
  if (!doc) return fail(404, 'Asignación no encontrada.');
  return { ok: true as const, status: 200, body: { id: id.toHexString(), entregada: doc.entregadaAt !== null, leida: doc.leidaAt !== null } };
}

/**
 * Links a newly started trip to the pilot's oldest pending assignment for that truck.
 * The conditional update makes concurrent starts claim an assignment only once.
 */
export async function linkAssignment(trip: { _id: ObjectId; truckId: ObjectId; driverId: ObjectId }) {
  const { assignments, trucks, trips } = await collections();
  const now = new Date();
  const claimed = await assignments.findOneAndUpdate(
    { driverId: trip.driverId, truckId: trip.truckId, estado: 'pendiente' },
    { $set: { estado: 'en_curso', tripId: trip._id, iniciadaAt: now, updatedAt: now } },
    { sort: { programadoPara: 1, _id: 1 }, returnDocument: 'after' },
  );
  if (!claimed) return null;
  await trips.updateOne({ _id: trip._id }, { $set: { assignmentId: claimed._id } });
  const truck = await trucks.findOne({ _id: claimed.truckId }, { projection: { placa: 1, modelo: 1 } });
  return toDriverAssignment(claimed, truck);
}

export async function tripAssignment(tripId: ObjectId) {
  const { assignments, trucks } = await collections();
  const doc = await assignments.findOne({ tripId });
  if (!doc) return null;
  const truck = await trucks.findOne({ _id: doc.truckId }, { projection: { placa: 1, modelo: 1 } });
  return toDriverAssignment(doc, truck);
}

export async function completeAssignment(tripId: ObjectId) {
  const { assignments } = await collections();
  const now = new Date();
  await assignments.updateOne({ tripId, estado: 'en_curso' }, { $set: { estado: 'completada', completadaAt: now, updatedAt: now } });
}
