import { CatmullRomCurve3, Vector3 } from "three";
import { FIST } from "./characterGeometry";
import { floorY, lerp, mulberry32, pxFloor, smoothstep } from "./space";

/**
 * Cables gripped in the figure's fists. Each side fans upward and outward from
 * the top of the fist, and downward and outward from the bottom, as in the
 * reference image. t = 0 is always inside the hand. Further out the upper fan
 * bends toward the vertical, so the wide shot keeps its sweeping arms.
 */

export const CURVE_SAMPLES = 128;

type Side = "L" | "R";

export interface Pulse {
  /** Seconds after the push-in begins. */
  start: number;
  /** Repeat interval; energy time keeps running while the reader rests. */
  period: number;
  /** Travel time. */
  duration: number;
  /** Trail length in curve units (0..1). */
  trail: number;
  /** Curve range the pulse travels, in order. */
  range: [number, number];
}

export interface TendrilDef {
  points: Vector3[];
  length: number;
  radius: number;
  groupSeed: number;
  seed: number;
  groupAmp: number;
  ownAmp: number;
  layer: "near" | "back";
  arc: boolean;
  pulse: Pulse | null;
  /** Steady inner light, 0..1; a few strands in each fan carry it. */
  glow: number;
  /** Hand that grips this cable, if any. */
  hand: Side | null;
  /** 0 keeps the tendril on every tier; higher values are dropped first. */
  optional: number;
}

type Options = Partial<Omit<TendrilDef, "points" | "length">>;

function build(points: Vector3[], o: Options): TendrilDef {
  const curve = new CatmullRomCurve3(points, false, "centripetal");
  curve.arcLengthDivisions = 400;
  return {
    points: curve.getSpacedPoints(CURVE_SAMPLES - 1),
    length: curve.getLength(),
    radius: o.radius ?? 0.011,
    groupSeed: o.groupSeed ?? 0,
    seed: o.seed ?? 0,
    groupAmp: o.groupAmp ?? 0.02,
    ownAmp: o.ownAmp ?? 0.008,
    layer: o.layer ?? "near",
    arc: o.arc ?? false,
    pulse: o.pulse ?? null,
    glow: o.glow ?? 0,
    hand: o.hand ?? null,
    optional: o.optional ?? 0,
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const groupSeed = (side: Side) => (side === "L" ? 0.13 : 0.58);

/** Walks a path from a heading, one step at a time. Angles are from the vertical, outward positive. */
function walk(start: Vector3, k: number, up: 1 | -1, steps: number, step: number, heading: (l: number) => number, drift: (l: number) => number): Vector3[] {
  const pts = [start.clone()];
  const p = start.clone();
  for (let i = 1; i <= steps; i++) {
    const l = i * step;
    const h = heading(l);
    p.x += k * Math.sin(h) * step;
    p.y += up * Math.cos(h) * step;
    p.z += drift(l) * step;
    const ground = floorY(p.z) + 0.014;
    if (p.y < ground) {
      // Lies down on the water and runs out along it.
      p.y = ground;
      p.x += k * step * 0.35;
      p.z -= step * 0.12;
    }
    pts.push(p.clone());
  }
  return pts;
}

interface Fan {
  side: Side;
  up: 1 | -1;
  count: number;
  /** Heading of the innermost and outermost strand, degrees from vertical. */
  inner: number;
  outer: number;
}

const FANS: readonly Fan[] = [
  { side: "L", up: 1, count: 28, inner: -1.5, outer: 49 },
  { side: "R", up: 1, count: 28, inner: 14, outer: 53 },
  { side: "L", up: -1, count: 22, inner: 4, outer: 72 },
  { side: "R", up: -1, count: 22, inner: 5, outer: 68 },
];

function fan({ side, up, count, inner, outer }: Fan, rand: () => number): TendrilDef[] {
  const k = side === "L" ? -1 : 1;
  const grip = FIST[side];
  const out: TendrilDef[] = [];
  for (let i = 0; i < count; i++) {
    const f = Math.min(1, Math.max(0, (i + (rand() - 0.5) * 0.9) / (count - 1)));
    const a = rad(lerp(inner, outer, Math.pow(f, 1.15)));
    const start = new Vector3(grip.x + k * (0.012 - 0.03 * (1 - f)), grip.y + up * 0.02, grip.z - 0.014 + (rand() - 0.5) * 0.05);
    const mouth = new Vector3(grip.x + k * lerp(-0.018, 0.034, f), grip.y + up * 0.082, start.z);
    // Outer strands lean toward the lens and fall out of focus.
    const lean = (rand() - 0.42) * lerp(0.1, 0.4, f);
    const drift = (l: number) => (mouth.z + lean * l > 1.15 ? 0 : lean * Math.exp(-l * 0.18));
    const bow = rad(lerp(2, 7, rand()));
    const heading =
      up > 0
        ? (l: number) => a * (1 - 0.42 * smoothstep(0.8, 5.5, l)) - bow * smoothstep(0, 1.2, l) * (1 - smoothstep(1.2, 3, l))
        : (l: number) => Math.min(rad(86), a * 0.82 + rad(20) * smoothstep(0, 1.1, l) + rad(26) * smoothstep(0.8, 3.2, l) * f);
    const pts = [start, ...walk(mouth, k, up, up > 0 ? 64 : 52, 0.11, heading, drift)];
    const thick = rand();
    const lit = i % 5 === 2;
    const pulse: Pulse | null =
      i % 7 === 3
        ? {
            start: 0.8 + (i / count) * 2.4 + (up > 0 ? 0 : 0.5) + (side === "R" ? 0.25 : 0),
            period: 3.9 + rand() * 1.3,
            duration: 2.1 + rand() * 0.5,
            trail: 0.045,
            range: [up > 0 ? 0.4 : 0.5, 0.005],
          }
        : null;
    const o: Options = {
      radius: lit ? lerp(0.0075, 0.011, thick) : lerp(0.0055, 0.0145, thick * thick),
      groupSeed: groupSeed(side) + (up > 0 ? 0 : 0.2),
      seed: rand(),
      groupAmp: 0.016,
      ownAmp: 0.009,
      glow: lit ? lerp(0.6, 1, rand()) : 0,
      pulse,
      hand: side,
      optional: pulse || lit ? 0 : i % 3 === 1 ? 0.8 : i % 3 === 2 ? 0.6 : 0,
    };
    out.push(build(pts, o));
    if (pulse && i % 2) {
      out.push(build(pts, { ...o, radius: 0.0042, glow: 0, arc: true, optional: 0.2, pulse: { ...pulse, trail: 0.05 } }));
    }
  }
  return out;
}

/** Soft verticals hanging far behind, seen through the mist. */
function curtain(side: Side, rand: () => number, count: number): TendrilDef[] {
  const k = side === "L" ? -1 : 1;
  const out: TendrilDef[] = [];
  for (let i = 0; i < count; i++) {
    const x = k * lerp(0.55, 2.5, Math.pow(rand(), 1.5));
    const z = lerp(-1.1, -2.1, rand());
    const lean = (rand() - 0.35) * 0.35 * k;
    const ph = rand() * 6.28;
    const foot = -1.15 - 0.4 * rand();
    const pts: Vector3[] = [];
    for (let j = 0; j <= 10; j++) {
      const h = j / 10;
      pts.push(new Vector3(x + lean * h + 0.03 * Math.sin(h * 5 + ph), lerp(foot, 5.2, h), z + 0.1 * Math.sin(h * 4 + ph)));
    }
    out.push(build(pts, { radius: lerp(0.006, 0.0145, rand()), groupSeed: groupSeed(side) + 0.4, seed: rand(), groupAmp: 0.02, ownAmp: 0.01, layer: "back", optional: i % 2 ? 0.7 : 0 }));
  }
  return out;
}

/** Taut threads crossing the light behind the figure. */
function threads(rand: () => number, count: number): TendrilDef[] {
  const out: TendrilDef[] = [];
  for (let i = 0; i < count; i++) {
    const z = lerp(-1.5, -3.2, rand());
    const s = 1 - z * 0.2;
    const from = new Vector3(-lerp(0.7, 1.7, rand()) * s, lerp(-0.5, 1.3, rand()) * s, z);
    const to = new Vector3(lerp(0.7, 1.7, rand()) * s, lerp(-0.6, 1.3, rand()) * s, z - 0.3 + rand() * 0.6);
    const pts: Vector3[] = [];
    for (let j = 0; j <= 6; j++) {
      const p = from.clone().lerp(to, j / 6);
      p.y -= Math.sin((j / 6) * Math.PI) * 0.012;
      pts.push(p);
    }
    out.push(build(pts, { radius: lerp(0.0026, 0.0058, rand()), groupSeed: rand(), seed: rand(), groupAmp: 0.004, ownAmp: 0.003, layer: "back", optional: i % 2 ? 0.7 : 0.3 }));
  }
  return out;
}

/** Slack lying on the water around the feet. */
function floorCoils(rand: () => number): TendrilDef[] {
  const coils: ReadonlyArray<readonly [cx: number, cy: number, rx: number, ry: number]> = [
    [160, 442.6, 58, 2.6],
    [226, 443.4, 120, 3.2],
    [330, 444, 60, 3],
    [520, 444, 64, 2.8],
    [592, 442.6, 84, 2.6],
  ];
  return coils.map(([cx, cy, rx, ry], i) => {
    const pts: Vector3[] = [];
    const phase = rand() * 6.28;
    const turns = 1.35 + rand() * 0.5;
    for (let j = 0; j <= 22; j++) {
      const a = phase + (j / 22) * Math.PI * 2 * turns;
      const grow = 0.8 + 0.3 * (j / 22);
      pts.push(pxFloor(cx + Math.cos(a) * rx * grow, cy + Math.sin(a) * ry * grow, 0.012));
    }
    return build(pts, { radius: 0.008, seed: rand(), groupAmp: 0, ownAmp: 0.003, optional: i > 2 ? 0.6 : 0.2 });
  });
}

function createAll(): TendrilDef[] {
  const rand = mulberry32(20417);
  return [
    ...FANS.flatMap((f) => fan(f, rand)),
    ...curtain("L", rand, 26),
    ...curtain("R", rand, 26),
    ...threads(rand, 26),
    ...floorCoils(rand),
  ];
}

let all: TendrilDef[] | null = null;

/** `density` (0..1) drops optional tendrils; the main fans always stay. */
export function createTendrils(density: number): TendrilDef[] {
  all ??= createAll();
  return all.filter((t) => t.optional <= density || t.pulse !== null);
}

/** Pulses that arrive in each hand, so the lighting can follow them. */
export function handPulses(side: Side): Pulse[] {
  all ??= createAll();
  return all.flatMap((t) => (t.hand === side && t.pulse && !t.arc ? [t.pulse] : []));
}

/** CPU twin of pulseHead() in energyShader. */
export function pulseAt(pulse: Pulse, et: number): { head: number; life: number } {
  if (et < pulse.start) return { head: 0, life: 0 };
  const k = ((et - pulse.start) % pulse.period) / pulse.duration;
  if (k > 1) return { head: 0, life: 0 };
  return {
    head: lerp(pulse.range[0], pulse.range[1], k),
    life: smoothstep(0, 0.1, k) * (1 - smoothstep(0.86, 1, k)),
  };
}
