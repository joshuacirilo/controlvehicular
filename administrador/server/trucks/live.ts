import 'server-only';
import type { ObjectId } from 'mongodb';
import type { LiveTrucksResponse } from '@/lib/live-trucks';
import { getDb } from '@/server/db/mongo';
import { formatGuatemala } from '@/server/time';
import type { Result } from '@/server/trips/service';

type LiveRow = {
  _id: ObjectId;
  truckId: ObjectId;
  inicio: Date;
  truck?: { placa: string; modelo: string };
  driver?: { nombre: string };
  ping?: {
    coords: { coordinates: [number, number] };
    velocidad: number | null;
    precision?: number | null;
    timestamp: Date;
  };
};

/** Active trips with their truck, driver and latest ping (uses the `{tripId, timestamp}` index). */
export async function liveTrucks(): Promise<Result<LiveTrucksResponse>> {
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
          { $limit: 1 },
          { $project: { _id: 0, coords: 1, velocidad: 1, precision: 1, timestamp: 1 } },
        ],
      },
    },
    {
      $project: {
        truckId: 1, inicio: 1,
        truck: { $first: '$truck' }, driver: { $first: '$driver' }, ping: { $first: '$ping' },
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
        velocidad: row.ping.velocidad,
        precision: row.ping.precision ?? null,
        timestamp: formatGuatemala(row.ping.timestamp),
      }
      : null,
  })).sort((a, b) => a.placa.localeCompare(b.placa));

  return { ok: true, status: 200, body: { trucks } };
}
