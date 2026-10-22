import type { ObjectId } from 'mongodb';
import { getDb } from '@/server/db/mongo';
import { getSpeedControl } from '@/server/control/speed';
import { routeSpeed } from '@/server/control/route-speed';
import { formatGuatemala } from '@/server/time';
import { speedDashboardAccumulator } from '@/lib/speed-dashboard';

type Trip = { _id: ObjectId; driverId: ObjectId; truckId: ObjectId; nombre?: string; placa?: string };
type Ping = { coords: { coordinates: [number, number] }; timestamp: Date; precision?: number | null; qualityFlags?: string[] };

export async function getSpeedDashboard(start: Date, end: Date) {
  const control = await getSpeedControl();
  const result = speedDashboardAccumulator(control?.velocidadPromedio ?? null);
  if (!control) return result.snapshot();
  const db = await getDb();
  const trips = db.collection('trips').aggregate<Trip>([
    { $match: { inicio: { $gte: start, $lt: end } } },
    { $lookup: { from: 'drivers', localField: 'driverId', foreignField: '_id', as: 'driver', pipeline: [{ $project: { nombre: 1 } }] } },
    { $lookup: { from: 'trucks', localField: 'truckId', foreignField: '_id', as: 'truck', pipeline: [{ $project: { placa: 1 } }] } },
    { $project: { driverId: 1, truckId: 1, nombre: { $arrayElemAt: ['$driver.nombre', 0] }, placa: { $arrayElemAt: ['$truck.placa', 0] } } },
  ], { maxTimeMS: 15000 });
  try {
    for await (const trip of trips) {
      const identity = { tripId: trip._id.toHexString(), driverId: trip.driverId.toHexString(), nombre: trip.nombre ?? 'Sin conductor', placa: trip.placa ?? 'Sin placa' };
      result.addTrip(identity);
      const pings = db.collection<Ping>('locationPings').find({ tripId: trip._id }, {
        projection: { coords: 1, timestamp: 1, precision: 1, qualityFlags: 1 }, maxTimeMS: 15000,
      }).sort({ timestamp: 1, _id: 1 });
      let previous: Ping | undefined;
      let index = 0;
      try {
        for await (const ping of pings) {
          if (previous) {
            const pair = [previous, ping];
            const evaluation = routeSpeed(pair.map(p => [p.coords.coordinates[1], p.coords.coordinates[0]]),
              pair.map(p => ({ precision: p.precision ?? null, timestamp: formatGuatemala(p.timestamp), qualityFlags: p.qualityFlags })), control.velocidadPromedio);
            result.addSegment(identity, {
              evaluated: evaluation.evaluados === 1, speed: evaluation.excesos[0]?.velocidadKmh ?? null,
              start: formatGuatemala(previous.timestamp), end: formatGuatemala(ping.timestamp), index,
            });
          }
          previous = ping;
          index++;
        }
      } finally { await pings.close(); }
    }
  } finally { await trips.close(); }
  return result.snapshot();
}
