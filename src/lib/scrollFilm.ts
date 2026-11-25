/**
 * The scroll track. Positions are in viewport heights: `t` runs from 0 at the
 * top of the page to TRACK at the bottom. The scene and the interface both read
 * from here, so copy and camera can never drift apart.
 */

/** Length of the reference video, in seconds; one second is one viewport. */
export const SHOT_LENGTH = 4.0417;

/** Where the reference's first and last frames sit on the track. */
export const SHOT_START = 1;
export const SHOT_END = SHOT_START + SHOT_LENGTH;

export const TRACK = 7.85;

export interface Waypoint {
  id: string;
  label: string;
  /** Where its leg begins. */
  from: number;
  /** Where its link lands. */
  at: number;
}

export const WAYPOINTS: readonly Waypoint[] = [
  { id: "shore", label: "Shore", from: 0, at: 0 },
  { id: "current", label: "Current", from: SHOT_START, at: 2.45 },
  { id: "approach", label: "Approach", from: 3.02, at: 4.3 },
  { id: "arrival", label: "Arrival", from: SHOT_END, at: TRACK },
];

/** Live state. Mutated once per frame; never goes through React. */
export const scroll = {
  /** Where the page is. */
  target: 0,
  /** Damped playhead that everything is drawn from. */
  t: 0,
  /** Damped playhead speed, about -1..1. */
  drag: 0,
};

type Listener = (t: number) => void;
const listeners = new Set<Listener>();

export function onPlayhead(fn: Listener): () => void {
  listeners.add(fn);
  fn(scroll.t);
  return () => void listeners.delete(fn);
}

export function notifyPlayhead() {
  for (const fn of listeners) fn(scroll.t);
}

/** Height of one track unit in pixels. Read from the track, so mobile toolbars can't skew it. */
let unit = 1;

export function bindTrack(track: HTMLElement): () => void {
  const read = () => {
    scroll.target = Math.min(TRACK, Math.max(0, window.scrollY / unit));
  };
  const measure = () => {
    unit = Math.max(1, track.offsetHeight / (TRACK + 1));
    read();
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(track);
  window.addEventListener("scroll", read, { passive: true });
  return () => {
    observer.disconnect();
    window.removeEventListener("scroll", read);
  };
}

export const pixelsAt = (t: number) => Math.round(t * unit);

/** Plateau window: ramps in, holds at full strength, ramps out. */
export function windowed(t: number, from: number, to: number, rampIn: number, rampOut: number): number {
  const a = rampIn > 0 ? Math.min(1, Math.max(0, (t - from) / rampIn)) : t >= from ? 1 : 0;
  const b = rampOut > 0 ? Math.min(1, Math.max(0, (to - t) / rampOut)) : t <= to ? 1 : 0;
  return Math.min(a, b);
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
