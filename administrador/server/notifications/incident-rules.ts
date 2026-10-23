import { liveSpeed, type LivePing } from '@/server/trucks/live-speed';

export type MotionState = { last?: LivePing; lowSince?: number; lowAlerted?: boolean; speeding?: boolean; limit?: number | null };
export type MotionEvent = { type: 'speed' | 'low-speed'; speed: number; at: Date; coordinates: [number, number] };

/** Chronological samples; unreliable pairs break continuity, never establish low speed. */
export function advanceMotion(state: MotionState, ping: LivePing, limit: number | null): MotionEvent[] {
  if (state.last && ping.timestamp <= state.last.timestamp) return [];
  const previous = state.last;
  const measured = previous ? liveSpeed([ping, previous]) : null;
  const speed = measured !== null && measured <= 300 ? measured : null;
  if (state.limit !== limit) state.speeding = false;
  state.limit = limit;
  state.last = ping;
  if (speed === null) { delete state.lowSince; state.lowAlerted = false; state.speeding = false; return []; }
  const events: MotionEvent[] = [];
  const event = (type: MotionEvent['type']) => ({ type, speed, at: ping.timestamp, coordinates: ping.coords.coordinates });
  if (limit !== null && speed > limit) {
    if (!state.speeding) events.push(event('speed'));
    state.speeding = true;
  } else state.speeding = false;
  if (speed < 5) {
    state.lowSince ??= previous!.timestamp.getTime();
    if (!state.lowAlerted && ping.timestamp.getTime() - state.lowSince >= 30 * 60000) {
      events.push(event('low-speed')); state.lowAlerted = true;
    }
  } else { delete state.lowSince; state.lowAlerted = false; }
  return events;
}
