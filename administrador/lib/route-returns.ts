type Position = [number, number];
type Segment = { a: Position; dx: number; dy: number; length: number };

const CELL = 40;
const TOLERANCE = 15;
const MIN_LENGTH = 8;
const MAX_LENGTH = 500;

/** Approximate retracing, not road matching. Only earlier, reliable edges are evidence. */
export function returnSections(route: Position[], reliableEdges: boolean[]): Position[][] {
  if (route.length < 3) return [];
  const longitudeScale = 111_320 * Math.cos(route[0][0] * Math.PI / 180);
  const projected: Position[] = route.map(([lat, lng]) => [
    (lng - route[0][1]) * longitudeScale, (lat - route[0][0]) * 111_320,
  ]);
  const grid = new Map<string, Segment[]>();
  const sections: Position[][] = [];
  let current: Position[] | undefined;
  for (let i = 1; i < route.length; i++) {
    const a = projected[i - 1];
    const b = projected[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (!reliableEdges[i - 1] || !Number.isFinite(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
      current = undefined;
      continue;
    }
    const segment = { a, dx, dy, length };
    const samples = Math.max(3, Math.ceil(length / 10));
    let matches = 0;
    for (let sample = 0; sample < samples; sample++) {
      const fraction = (sample + 0.5) / samples;
      const x = a[0] + dx * fraction;
      const y = a[1] + dy * fraction;
      const candidates = grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? [];
      if (candidates.some(previous => {
        // At least 150 degrees apart: crossings and same-direction repeats do not count.
        if ((dx * previous.dx + dy * previous.dy) / (length * previous.length) > -0.866) return false;
        const px = x - previous.a[0];
        const py = y - previous.a[1];
        const along = (px * previous.dx + py * previous.dy) / previous.length ** 2;
        if (along < 0 || along > 1) return false;
        return Math.hypot(px - along * previous.dx, py - along * previous.dy) <= TOLERANCE;
      })) matches++;
    }
    if (matches / samples >= 0.8) {
      if (current) current.push(route[i]);
      else {
        current = [route[i - 1], route[i]];
        sections.push(current);
      }
    } else current = undefined;

    // Index after comparing, so an edge never matches itself or a future edge.
    for (let x = Math.floor((Math.min(a[0], b[0]) - TOLERANCE) / CELL);
      x <= Math.floor((Math.max(a[0], b[0]) + TOLERANCE) / CELL); x++) {
      for (let y = Math.floor((Math.min(a[1], b[1]) - TOLERANCE) / CELL);
        y <= Math.floor((Math.max(a[1], b[1]) + TOLERANCE) / CELL); y++) {
        const key = `${x},${y}`;
        const entries = grid.get(key);
        if (entries) entries.push(segment);
        else grid.set(key, [segment]);
      }
    }
  }
  return sections;
}
