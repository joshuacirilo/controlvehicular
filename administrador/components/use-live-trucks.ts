'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { LiveTruck, LiveTrucksResponse, LiveRoute } from '@/lib/live-trucks';

/** Polling is independent of the app's one-minute upload interval. */
const REFRESH_MS = 5000;

export type LiveTrucksState = {
  trucks: LiveTruck[];
  /** Epoch ms of the last successful refresh; null until the first one. */
  updatedAt: number | null;
  error: string | null;
  limiteKmh: number | null;
  route: LiveRoute | null;
  sosRoutes: LiveRoute[];
};

/** Polls the live fleet while the tab is visible; keeps the last data when a refresh fails. */
export function useLiveTrucks(selectedTrip: string | null = null): LiveTrucksState {
  const router = useRouter();
  const [state, setState] = useState<LiveTrucksState>({ trucks: [], updatedAt: null, error: null, limiteKmh: null, route: null, sosRoutes: [] });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function refresh() {
      clearTimeout(timer);
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const response = await fetch(`/api/trucks/live${selectedTrip ? `?trip=${encodeURIComponent(selectedTrip)}` : ''}`, { cache: 'no-store', signal: current.signal });
        if (response.status === 401) {
          router.replace('/');
          return;
        }
        const data = await response.json().catch(() => null) as (LiveTrucksResponse & { message?: string }) | null;
        if (!response.ok || !Array.isArray(data?.trucks)) {
          throw new Error(data?.message ?? 'No se pudo actualizar el mapa.');
        }
        if (current.signal.aborted) return;
        setState({ trucks: data.trucks, updatedAt: Date.now(), error: null, limiteKmh: data.limiteKmh, route: data.route, sosRoutes: data.sosRoutes ?? [] });
      } catch (error) {
        if (current.signal.aborted) return;
        const message = error instanceof TypeError ? 'Sin conexión con el servidor.' : (error as Error).message;
        setState(previous => ({ ...previous, error: message }));
      }
      if (document.visibilityState === 'visible') timer = setTimeout(refresh, REFRESH_MS);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
      else clearTimeout(timer);
    };

    void refresh();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [router, selectedTrip]);

  return state;
}
