import 'server-only';
import type { ObjectId } from 'mongodb';
import type { LiveTrucksResponse, LiveRoute } from '@/lib/live-trucks';
import { getSpeedControl } from '@/server/control/speed';
import { liveSpeed, type LivePing } from '@/server/trucks/live-speed';
import { getDb } from '@/server/db/mongo';
import { formatGuatemala } from '@/server/time';
import type { Result } from '@/server/trips/service';

type LiveRow = {
  _id: ObjectId;
  truckId: ObjectId;
  inicio: Date;
  pausadoDesde?: Date | null;
  pausaMovimientoAt?: Date | null;
  truck?: { placa: string; modelo: string };
  driver?: { nombre: string };
  sos?: { _id: string; createdAt: Date };
  ping?: {
    coords: { coordinates: [number, number] };
    velocidad: number | null;
    precision?: number | null;
    timestamp: Date;
  };
  recent: LivePing[];
};

/** Active trips with their truck, driver and latest ping (uses the `{tripId, timestamp}` index). */
export async function liveTrucks(selectedTrip?: string): Promise<Result<LiveTrucksResponse>> {
  const control = await getSpeedControl();
  const rows = await (await getDb()).collection('trips').aggregate<LiveRow>([
    { $match: { estado: 'activo' } },
    {
      $lookup: {
        from: 'trucks', localField: 'truckId', foreignField: '_id', as: 'truck',
        pipeline: [{ $project: { _id: 0, placa: 1, modelo: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'drivers', localField: 'driverId', foreignField: '_id', as: 'driver',
        pipeline: [{ $project: { _id: 0, nombre: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'locationPings', localField: '_id', foreignField: 'tripId', as: 'ping',
        pipeline: [
          { $sort: { timestamp: -1, _id: -1 } },
          { $limit: 2 },
          { $project: { _id: 0, coords: 1, precision: 1, timestamp: 1, qualityFlags: 1 } },
        ],
      },
    },
    {
      $lookup: {
        from: 'notificationIncidents', localField: 'sosId', foreignField: '_id', as: 'sos',
        pipeline: [{ $match: { acknowledgedAt: { $exists: false } } }, { $project: { _id: 1, createdAt: 1 } }],
      },
    },
    {
      $project: {
        truckId: 1, inicio: 1, pausadoDesde: 1, pausaMovimientoAt: 1, recent: '$ping',
        truck: { $first: '$truck' }, driver: { $first: '$driver' }, ping: { $first: '$ping' }, sos: { $first: '$sos' },
      },
    },
  ]).toArray();

  const trucks = rows.map(row => ({
    tripId: row._id.toHexString(),
    truckId: row.truckId.toHexString(),
    placa: row.truck?.placa ?? 'Sin placa',
    modelo: row.truck?.modelo ?? '',
    conductor: row.driver?.nombre ?? 'Sin conductor',
    inicio: formatGuatemala(row.inicio),
    ubicacion: row.ping
      ? {
        lat: row.ping.coords.coordinates[1],
        lng: row.ping.coords.coordinates[0],
        velocidad: liveSpeed(row.recent),
        precision: row.ping.precision ?? null,
        timestamp: formatGuatemala(row.ping.timestamp),
      }
      : null,
    pausa: row.pausadoDesde
      ? {
        desde: formatGuatemala(row.pausadoDesde),
        movimiento: row.pausaMovimientoAt ? formatGuatemala(row.pausaMovimientoAt) : null,
      }
      : null,
    sos: row.sos ? { id: row.sos._id, desde: row.sos.createdAt.toISOString() } : null,
  })).sort((a, b) => a.placa.localeCompare(b.placa));

  const routes = new Map<string, Promise<LiveRoute>>();
  const routeOf = (tripId: ObjectId) => {
    const key = tripId.toHexString();
    if (!routes.has(key)) routes.set(key, fullRoute(tripId));
    return routes.get(key)!;
  };
  const selected = rows.find(row => row._id.toHexString() === selectedTrip);
  const [route, sosRoutes] = await Promise.all([
    selected ? routeOf(selected._id) : null,
    Promise.all(rows.filter(row => row.sos).slice(0, MAX_SOS_ROUTES).map(row => routeOf(row._id))),
  ]);
  return { ok: true, status: 200, body: { trucks, limiteKmh: control?.velocidadPromedio ?? null, route, sosRoutes } };
}

/** Bounds the work of each 5 s refresh if many emergencies are open at once. */
const MAX_SOS_ROUTES = 10;

async function fullRoute(tripId: ObjectId): Promise<LiveRoute> {
  const points = await (await getDb()).collection<LivePing & { tripId: ObjectId }>('locationPings')
    .find({ tripId }, { projection: { coords: 1 }, maxTimeMS: 15000 })
    .sort({ timestamp: 1, _id: 1 }).toArray();
  return { tripId: tripId.toHexString(), ruta: points.map(p => [p.coords.coordinates[1], p.coords.coordinates[0]]) };
}
