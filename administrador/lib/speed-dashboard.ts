type Identity = { tripId: string; driverId: string; nombre: string; placa: string };
type Segment = { evaluated: boolean; speed: number | null; start: string; end: string; index: number };
type Driver = { id: string; nombre: string; evaluated: number; skipped: number; excesses: number; trips: Set<string>; affected: Set<string>; last: string | null };
export const percentage = (part: number, total: number) => total ? Math.round(part / total * 1000) / 10 : null;

/** Counts segments, not independent incidents or percent of time driving. */
export function speedDashboardAccumulator(limit: number | null) {
  const drivers = new Map<string, Driver>();
  const evaluatedTrips = new Set<string>();
  const affectedTrips = new Set<string>();
  const daily = new Map<string, { date: string; evaluated: number; excesses: number }>();
  const events: (Identity & Segment)[] = [];
  const affectedDetails = new Map<string, Identity & Segment & { excesses: number }>();
  let evaluated = 0, skipped = 0, excesses = 0;
  function addTrip(identity: Identity) {
    if (!drivers.has(identity.driverId)) drivers.set(identity.driverId, {
      id: identity.driverId, nombre: identity.nombre, evaluated: 0, skipped: 0, excesses: 0,
      trips: new Set(), affected: new Set(), last: null,
    });
    drivers.get(identity.driverId)!.trips.add(identity.tripId);
  }
  return {
    addTrip,
    addSegment(identity: Identity, segment: Segment) {
      addTrip(identity);
      const driver = drivers.get(identity.driverId)!;
      if (!segment.evaluated) { skipped++; driver.skipped++; return; }
      evaluated++; driver.evaluated++; evaluatedTrips.add(identity.tripId);
      const date = segment.end.slice(0, 10);
      if (!daily.has(date)) daily.set(date, { date, evaluated: 0, excesses: 0 });
      const day = daily.get(date)!;
      day.evaluated++;
      if (segment.speed === null) return;
      excesses++; driver.excesses++; day.excesses++;
      affectedTrips.add(identity.tripId); driver.affected.add(identity.tripId);
      const detail = affectedDetails.get(identity.tripId);
      if (!detail || segment.end > detail.end) {
        affectedDetails.set(identity.tripId, { ...identity, ...segment, excesses: (detail?.excesses ?? 0) + 1 });
      } else detail.excesses++;
      if (!driver.last || segment.end > driver.last) driver.last = segment.end;
      events.push({ ...identity, ...segment });
      events.sort((a, b) => b.end.localeCompare(a.end) || a.tripId.localeCompare(b.tripId) || b.index - a.index);
      if (events.length > 20) events.length = 20;
    },
    snapshot() {
      const ranking = [...drivers.values()].map(d => ({
        id: d.id, nombre: d.nombre, evaluated: d.evaluated, skipped: d.skipped, excesses: d.excesses,
        trips: d.trips.size, affected: d.affected.size, last: d.last, percent: percentage(d.excesses, d.evaluated),
      })).sort((a, b) => b.excesses - a.excesses || a.nombre.localeCompare(b.nombre));
      return { limit, evaluated, skipped, excesses, percent: percentage(excesses, evaluated),
        evaluatedTrips: evaluatedTrips.size, affectedTrips: affectedTrips.size,
        tripPercent: percentage(affectedTrips.size, evaluatedTrips.size),
        evaluatedDrivers: ranking.filter(d => d.evaluated > 0).length,
        affectedDrivers: ranking.filter(d => d.excesses > 0).length,
        ranking, daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), events,
        affectedDetails: [...affectedDetails.values()].sort((a, b) => b.end.localeCompare(a.end)),
      };
    },
  };
}
