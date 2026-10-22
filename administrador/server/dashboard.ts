import 'server-only';
import { getDb } from '@/server/db/mongo';
import { dashboardPeriod } from '@/lib/dashboard';
import { MAX_ROUTE_ACCURACY_METERS } from '@/lib/route-quality';
import { getSpeedDashboard } from '@/server/control/speed-dashboard';

type Summary = { total: number; completed: number; averageMs: number | null };
type Recent = { _id: { toHexString(): string }; inicio: Date; estado: string; placa?: string; nombre?: string };
type Report = {
  summary: Summary[];
  daily: { _id: string; total: number }[];
  quality: { total: number; usable: number }[];
  recent: Recent[];
};

export async function getDashboard(value: unknown) {
  const now = new Date();
  const period = dashboardPeriod(value, now);
  const db = await getDb();
  const [trucks, drivers, active, reports, speed] = await Promise.all([
    db.collection('trucks').countDocuments({ activo: true }),
    db.collection('drivers').countDocuments({ activo: true }),
    db.collection('trips').countDocuments({ estado: 'activo' }),
    db.collection('trips').aggregate<Report>([
      { $match: { inicio: { $gte: period.start, $lt: period.end } } },
      { $facet: {
        summary: [{ $group: {
          _id: null, total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$estado', 'finalizado'] }, 1, 0] } },
          averageMs: { $avg: { $cond: [{ $and: [
            { $eq: ['$estado', 'finalizado'] }, { $eq: [{ $type: '$fin' }, 'date'] }, { $gte: ['$fin', '$inicio'] },
          ] }, { $subtract: ['$fin', '$inicio'] }, null] } },
        } }],
        daily: [{ $group: { _id: { $dateToString: { date: '$inicio', format: '%Y-%m-%d', timezone: 'UTC' } }, total: { $sum: 1 } } }],
        quality: [
          { $lookup: { from: 'locationPings', localField: '_id', foreignField: 'tripId', as: 'quality', pipeline: [
            { $group: { _id: null, total: { $sum: 1 }, usable: { $sum: { $cond: [{ $and: [
              { $isNumber: '$precision' }, { $gt: ['$precision', 0] }, { $lte: ['$precision', MAX_ROUTE_ACCURACY_METERS] },
              { $eq: [{ $size: { $setIntersection: [{ $ifNull: ['$qualityFlags', []] }, ['stale', 'mocked', 'out_of_order', 'jump']] } }, 0] },
            ] }, 1, 0] } } } },
          ] } },
          { $unwind: '$quality' },
          { $group: { _id: null, total: { $sum: '$quality.total' }, usable: { $sum: '$quality.usable' } } },
        ],
        recent: [
          { $sort: { inicio: -1, _id: -1 } }, { $limit: 6 },
          { $lookup: { from: 'trucks', localField: 'truckId', foreignField: '_id', as: 'truck', pipeline: [{ $project: { placa: 1 } }] } },
          { $lookup: { from: 'drivers', localField: 'driverId', foreignField: '_id', as: 'driver', pipeline: [{ $project: { nombre: 1 } }] } },
          { $project: { inicio: 1, estado: 1, placa: { $arrayElemAt: ['$truck.placa', 0] }, nombre: { $arrayElemAt: ['$driver.nombre', 0] } } },
        ],
      } },
    ], { maxTimeMS: 15000 }).toArray(),
    getSpeedDashboard(period.start, period.end),
  ]);
  const report = reports[0];
  return {
    now, period, trucks, drivers, active, speed,
    summary: report?.summary[0] ?? { total: 0, completed: 0, averageMs: null },
    quality: report?.quality[0] ?? { total: 0, usable: 0 },
    daily: period.dates.map(date => ({ date, total: report?.daily.find(day => day._id === date)?.total ?? 0 })),
    recent: report?.recent ?? [],
  };
}
