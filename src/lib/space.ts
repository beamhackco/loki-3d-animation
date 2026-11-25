import { Vector3 } from "three";

/**
 * The whole scene is authored in pixels of the reference's first frame
 * (864 x 496), then unprojected to world space at a chosen depth. Whatever depth
 * a point is given, it lands on the same pixel as the reference at shot time 0.
 * The character stands at z = 0, where 100 reference pixels are 1 world unit.
 */
export const REF = { width: 864, height: 496, cx: 433, cy: 248 } as const;

/** Camera distance at shot time 0, and the vertical field of view it implies. */
export const CAM_START = 9.255;
export const BASE_FOV = (2 * Math.atan(REF.height / 200 / CAM_START) * 180) / Math.PI;

/** Depth of the backdrop that carries the light shafts. */
export const BACKDROP_Z = -6.4;

/**
 * Floor plane. The reference has its horizon at y = 428px while verticals stay
 * parallel (a shifted lens), so the floor carries the slope and the camera
 * dollies straight down -z.
 */
export const FLOOR_Y = -1.97;
export const FLOOR_SLOPE = 1.8 / CAM_START;

export const floorY = (z: number) => FLOOR_Y + FLOOR_SLOPE * z;

export function px(x: number, y: number, z = 0): Vector3 {
  const k = (1 - z / CAM_START) / 100;
  return new Vector3((x - REF.cx) * k, (REF.cy - y) * k, z);
}

/** Reference pixel that lies on the floor, lifted slightly above it. */
export function pxFloor(x: number, y: number, lift = 0.008): Vector3 {
  const Y = (y - REF.cy) / 100;
  const z = (Y + FLOOR_Y) / (Y / CAM_START - FLOOR_SLOPE);
  const p = px(x, y, z);
  p.y += lift;
  return p;
}

/** Deterministic PRNG: the composition must be identical on every load. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export type Stops = ReadonlyArray<readonly [number, number]>;

/** Cubic Hermite interpolation through [position, value] stops. */
export function sampleStops(stops: Stops, at: number): number {
  const n = stops.length;
  if (at <= stops[0][0]) return stops[0][1];
  if (at >= stops[n - 1][0]) return stops[n - 1][1];
  let i = 0;
  while (i < n - 2 && at > stops[i + 1][0]) i++;
  const [x1, y1] = stops[i];
  const [x2, y2] = stops[i + 1];
  const [x0, y0] = stops[Math.max(0, i - 1)];
  const [x3, y3] = stops[Math.min(n - 1, i + 2)];
  const h = x2 - x1;
  const t = (at - x1) / h;
  const m1 = i === 0 ? (y2 - y1) / h : (y2 - y0) / (x2 - x0);
  const m2 = i === n - 2 ? (y2 - y1) / h : (y3 - y1) / (x3 - x1);
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y1 + (t3 - 2 * t2 + t) * h * m1 + (3 * t2 - 2 * t3) * y2 + (t3 - t2) * h * m2;
}
