'use client';
import { layerGroup, point, polyline, type LatLngTuple } from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/** Screen-sized chevrons follow the actual edge toward its next checkpoint. */
export function RouteDirectionArrows({ route, returns }: {
  route: LatLngTuple[]; returns: LatLngTuple[][];
}) {
  const map = useMap();
  useEffect(() => {
    const arrows = layerGroup().addTo(map);
    const returnEnds = new Set(returns.flatMap(section => section.slice(1)));
    function draw() {
      arrows.clearLayers();
      const occupied = new Set<string>();
      const size = map.getSize();
      let count = 0;
      for (let index = 1; index < route.length && count < 500; index++) {
        const start = map.latLngToContainerPoint(route[index - 1]);
        const end = map.latLngToContainerPoint(route[index]);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (!Number.isFinite(length) || length < 18) continue;
        const ux = dx / length;
        const uy = dy / length;
        const returning = returnEnds.has(route[index]);
        // Clip sampling to the viewport, even for a very long GPS jump.
        let from = 0;
        let to = 1;
        for (const [origin, delta, limit] of [[start.x, dx, size.x], [start.y, dy, size.y]]) {
          if (delta === 0) {
            if (origin < 0 || origin > limit) to = -1;
          } else {
            const first = -origin / delta;
            const last = (limit - origin) / delta;
            from = Math.max(from, Math.min(first, last));
            to = Math.min(to, Math.max(first, last));
          }
        }
        if (from > to) continue;
        const visibleLength = (to - from) * length;
        const samples = Math.max(1, Math.ceil(visibleLength / 80));
        for (let sample = 0; sample < samples && count < 500; sample++) {
          const fraction = from + (to - from) * (sample + 0.5) / samples;
          // A small right-side offset separates arrows on overlapping opposite passes.
          const x = start.x + dx * fraction - uy * 4;
          const y = start.y + dy * fraction + ux * 4;
          const cell = `${returning}:${Math.floor(x / 36)}:${Math.floor(y / 36)}`;
          if (occupied.has(cell)) continue;
          occupied.add(cell);
          const coordinates = [
            point(x - ux * 5 - uy * 4, y - uy * 5 + ux * 4),
            point(x + ux * 3, y + uy * 3),
            point(x - ux * 5 + uy * 4, y - uy * 5 - ux * 4),
          ].map(position => map.containerPointToLatLng(position));
          polyline(coordinates, {
            color: '#fff', weight: 5, opacity: 0.95, interactive: false,
          }).addTo(arrows);
          polyline(coordinates, {
            color: returning ? '#9333ea' : '#0349b9', weight: 2.5, opacity: 1, interactive: false,
          }).addTo(arrows);
          count++;
        }
      }
    }
    draw();
    map.on('zoomend moveend resize', draw);
    return () => {
      map.off('zoomend moveend resize', draw);
      arrows.remove();
    };
  }, [map, route, returns]);
  return null;
}
