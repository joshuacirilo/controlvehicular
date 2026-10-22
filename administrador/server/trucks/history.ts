import 'server-only';
import type { ObjectId } from 'mongodb';
import {
  TRIPS_PER_PAGE, TRUCKS_PER_PAGE, type DriverTripsPage, type TripRoute, type TruckHistoryPage,
} from '@/lib/truck-history';
import { getDb } from '@/server/db/mongo';
import { formatGuatemala } from '@/server/time';
import { distanceMeters } from '@/server/trips/pings';
import { hasUsableAccuracy, MAX_ROUTE_GAP_MS } from '@/lib/route-quality';
import type { Result } from '@/server/trips/service';
import { getSpeedControl } from '@/server/control/speed';
import { routeSpeed } from '@/server/control/route-speed';

type TruckRow = {
  _id: ObjectId;
  placa: string;
  modelo?: string;
  activo?: boolean;
  conductores: { _id: ObjectId; viajes: number; ultimoViaje: Date; enCurso: boolean; driver?: { nombre: string } }[];
};

type TripRow = { _id: ObjectId; estado: 'activo' | 'finalizado'; inicio: Date; fin: Date | null };

type PingRow = { coords: { coordinates: [number, number] }; precision?: number | null; timestamp: Date; qualityFlags?: string[]; velocidad?: number | null };

const pageCount = (total: number, size: number) => Math.max(1, Math.ceil(total / size));
const clampPage = (page: number, totalPages: number) => Math.min(Math.max(1, page), totalPages);

/** All trucks by plate, each with the drivers that have trips on it (uses the `{truckId, inicio}` index). */
export async function truckHistoryPage(requestedPage: number): Promise<TruckHistoryPage> {
  const trucks = (await getDb()).collection('trucks');
  const total = await trucks.countDocuments();
  const totalPages = pageCount(total, TRUCKS_PER_PAGE);
  const page = clampPage(requestedPage, totalPages);
  const rows = await trucks.aggregate<TruckRow>([
    { $sort: { placa: 1, _id: 1 } },
    { $skip: (page - 1) * TRUCKS_PER_PAGE },
    { $limit: TRUCKS_PER_PAGE },
    {
      $lookup: {
        from: 'trips', localField: '_id', foreignField: 'truckId', as: 'conductores',
        pipeline: [
          {
            $group: {
              _id: '$driverId',
              viajes: { $sum: 1 },
              ultimoViaje: { $max: '$inicio' },
              enCurso: { $max: { $eq: ['$estado', 'activo'] } },
            },
          },
          { $sort: { ultimoViaje: -1 } },
          {
            $lookup: {
              from: 'drivers', localField: '_id', foreignField: '_id', as: 'driver',
              pipeline: [{ $project: { _id: 0, nombre: 1 } }],
            },
          },
          { $set: { driver: { $first: '$driver' } } },
        ],
      },
    },
    { $project: { placa: 1, modelo: 1, activo: 1, conductores: 1 } },
  ]).toArray();

  return {
    page,
    totalPages,
    total,
    trucks: rows.map(row => ({
      truckId: row._id.toHexString(),
      placa: row.placa,
      modelo: row.modelo ?? '',
      activo: row.activo !== false,
      conductores: row.conductores.map(driver => ({
        driverId: driver._id.toHexString(),
        nombre: driver.driver?.nombre ?? 'Conductor eliminado',
        viajes: driver.viajes,
        ultimoViaje: formatGuatemala(driver.ultimoViaje),
        enCurso: driver.enCurso,
      })),
    })),
  };
}

/**
 * Distance travelled, ignoring GPS jitter: a point only counts once it moves farther from the last
 * counted point than the accuracy of either fix (the same rule the server uses for speed).
 */
function routeSummary(pings: PingRow[]) {
  let meters = 0;
  let anchor: PingRow | undefined;
  let previous: PingRow | undefined;
  for (const ping of pings) {
    if (!hasUsableAccuracy(ping.precision) || ping.qualityFlags?.some(flag => ['stale', 'mocked', 'out_of_order', 'jump'].includes(flag))) {
      anchor = previous = undefined;
      continue;
    }
    if (previous && (ping.timestamp.getTime() <= previous.timestamp.getTime() ||
      ping.timestamp.getTime() - previous.timestamp.getTime() > MAX_ROUTE_GAP_MS)) anchor = undefined;
    previous = ping;
    if (!anchor) {
      anchor = ping;
      continue;
    }
    const step = distanceMeters(anchor.coords.coordinates, ping.coords.coordinates);
    if (step > Math.max(anchor.precision ?? 0, ping.precision ?? 0)) {
      meters += step;
      anchor = ping;
    }
  }
  // Keep every fix in chronological order: its array index is its checkpoint number.
  const ruta = pings
    .map(({ coords: { coordinates: [lng, lat] } }): [number, number] => [lat, lng]);
  const checkpoints = pings.map(ping => ({ precision: ping.precision ?? null, timestamp: formatGuatemala(ping.timestamp), qualityFlags: ping.qualityFlags ?? [], velocidad: ping.velocidad ?? null }));
  return { distanciaKm: Math.round(meters / 100) / 10, ruta, checkpoints };
}

/** Trips of one driver with one truck, newest first, with every checkpoint in chronological order. */
export async function driverTrips(
  truckId: ObjectId,
  driverId: ObjectId,
  requestedPage: number,
): Promise<Result<DriverTripsPage>> {
  const db = await getDb();
  const trips = db.collection<TripRow>('trips');
  const pings = db.collection<PingRow & { tripId: ObjectId; timestamp: Date }>('locationPings');
  const filter = { truckId, driverId };
  const total = await trips.countDocuments(filter);
  const totalPages = pageCount(total, TRIPS_PER_PAGE);
  const page = clampPage(requestedPage, totalPages);
  const rows = await trips.find(filter, { projection: { estado: 1, inicio: 1, fin: 1 } })
    .sort({ inicio: -1, _id: -1 })
    .skip((page - 1) * TRIPS_PER_PAGE)
    .limit(TRIPS_PER_PAGE)
    .toArray();

  const control = await getSpeedControl();
  const result: TripRoute[] = await Promise.all(rows.map(async trip => {
    const tripPings = await pings.find({ tripId: trip._id }, { projection: { _id: 0, coords: 1, precision: 1, timestamp: 1, qualityFlags: 1, velocidad: 1 } })
      .sort({ timestamp: 1, _id: 1 })
      .toArray();
    const summary = routeSummary(tripPings);
    return {
      tripId: trip._id.toHexString(),
      estado: trip.estado,
      inicio: formatGuatemala(trip.inicio),
      fin: trip.fin ? formatGuatemala(trip.fin) : null,
      puntos: tripPings.length,
      ...summary,
      velocidad: routeSpeed(summary.ruta, summary.checkpoints, control?.velocidadPromedio ?? null),
    };
  }));

  return { ok: true, status: 200, body: { page, totalPages, total, trips: result } };
}
