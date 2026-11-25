import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Vector3 } from "three";
import { clamp01, lerp, mulberry32, sampleStops, smoothstep, type Stops } from "./space";

/**
 * The figure, sculpted from outlines traced off the reference image and merged
 * into one geometry (one draw call). Coordinates in this file are pixels of that
 * image (1581 x 2000); `ix` and `iy` convert them to world units, with the axis
 * of the horns at x = 0 and the standing foot at y = -1.97.
 */

const SCALE = 1 / 624;
const AXIS = 804;
export const ix = (x: number) => (x - AXIS) * SCALE;
export const iy = (y: number) => 0.64 - (y - 75) * SCALE;

/** Centers of the two fists; every gripped cable passes through one of them. */
export const FIST = {
  L: new Vector3(ix(366), iy(1013), 0.1),
  R: new Vector3(ix(1193), iy(1000), 0.1),
} as const;

export const PART = { fabric: 0, horn: 1, skin: 3, sheet: 5 } as const;
type Part = (typeof PART)[keyof typeof PART];

interface SurfaceOptions {
  part: Part;
  closed?: boolean;
  /** Offset applied while the opening wind is blowing. */
  billow?: (u: number, v: number, out: Vector3) => void;
  flutter?: (u: number, v: number) => number;
  /** Open sheet that faces the camera. */
  front?: boolean;
  /** Crease depth, -1 (valley) to 1 (ridge); shades fold occlusion. */
  fold?: (u: number, v: number) => number;
}

class Sculptor {
  private pos: number[] = [];
  private nor: number[] = [];
  private part: number[] = [];
  private billow: number[] = [];
  private shade: number[] = []; // fold, flutter
  private idx: number[] = [];

  surface(nu: number, nv: number, fn: (u: number, v: number, out: Vector3) => void, o: SurfaceOptions) {
    const base = this.pos.length / 3;
    const p = new Vector3();
    const a = new Vector3();
    const b = new Vector3();
    const du = new Vector3();
    const dv = new Vector3();
    const bl = new Vector3();
    const e = 0.5 / Math.max(nu, nv);
    const wrapU = (u: number) => (o.closed ? (u + 1) % 1 : clamp01(u));
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i <= nu; i++) {
        const u = o.closed && i === nu ? 0 : i / nu;
        fn(u, v, p);
        fn(wrapU(u + e), v, a);
        fn(wrapU(u - e), v, b);
        du.subVectors(a, b);
        fn(u, clamp01(v + e), a);
        fn(u, clamp01(v - e), b);
        dv.subVectors(a, b);
        du.cross(dv);
        if (du.lengthSq() < 1e-16) du.set(0, 1, 0);
        du.normalize();
        if (o.front && du.z < 0) du.negate();
        bl.set(0, 0, 0);
        o.billow?.(u, v, bl);
        this.pos.push(p.x, p.y, p.z);
        this.nor.push(du.x, du.y, du.z);
        this.part.push(o.part);
        this.billow.push(bl.x, bl.y, bl.z);
        this.shade.push(o.fold?.(u, v) ?? 0, o.flutter?.(u, v) ?? 0);
      }
    }
    const row = nu + 1;
    if (o.closed) this.orient(base, row, nv + 1);
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const k = base + j * row + i;
        this.idx.push(k, k + 1, k + row, k + 1, k + row + 1, k + row);
      }
    }
  }

  /** Make a closed form's normals point away from the center of each ring. */
  private orient(base: number, row: number, rings: number) {
    let score = 0;
    for (let j = 0; j < rings; j++) {
      const start = (base + j * row) * 3;
      const c = [0, 0, 0];
      for (let i = 0; i < row - 1; i++) for (let k = 0; k < 3; k++) c[k] += this.pos[start + i * 3 + k] / (row - 1);
      for (let i = 0; i < row - 1; i++) for (let k = 0; k < 3; k++) score += (this.pos[start + i * 3 + k] - c[k]) * this.nor[start + i * 3 + k];
    }
    if (score < 0) for (let i = base * 3; i < this.nor.length; i++) this.nor[i] *= -1;
  }

  /** Tapered tube along a curve in world units. */
  tube(points: Vector3[], radius: Stops, o: SurfaceOptions & { nu?: number; nv?: number; shape?: (u: number, v: number) => number }) {
    const curve = new CatmullRomCurve3(points, false, "centripetal");
    const c = new Vector3();
    const t = new Vector3();
    const n = new Vector3();
    const bin = new Vector3();
    const Z = new Vector3(0, 0, 1);
    const X = new Vector3(1, 0, 0);
    this.surface(
      o.nu ?? 14,
      o.nv ?? 40,
      (u, v, out) => {
        curve.getPoint(v, c);
        curve.getTangent(v, t);
        const ref = Math.abs(t.z) > 0.9 ? X : Z;
        bin.crossVectors(t, ref).normalize();
        n.crossVectors(bin, t);
        const ang = u * Math.PI * 2;
        const r = Math.max(0, sampleStops(radius, v)) * (o.shape?.(u, v) ?? 1);
        out.copy(c).addScaledVector(bin, Math.cos(ang) * r).addScaledVector(n, Math.sin(ang) * r);
      },
      { ...o, closed: true },
    );
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute("aPart", new BufferAttribute(new Float32Array(this.part), 1));
    g.setAttribute("aBillow", new BufferAttribute(new Float32Array(this.billow), 3));
    g.setAttribute("aShade", new BufferAttribute(new Float32Array(this.shade), 2));
    g.setIndex(new BufferAttribute(new Uint32Array(this.idx), 1));
    return g;
  }
}

const TAU = Math.PI * 2;
type P = readonly [x: number, y: number, z?: number];
const at = ([x, y, z]: P) => new Vector3(ix(x), iy(y), z ?? 0);
const px2 = (stops: ReadonlyArray<readonly [number, number]>): Stops => stops.map(([t, r]) => [t, r * SCALE] as const);

/* --------------------------------------------------------------- outlines */

/** Left and right edges of the head, by image row. */
const HEAD_L: Stops = [[394, 806], [396, 786], [402, 770], [410, 757], [420, 750], [432, 745], [446, 737], [462, 730], [480, 728], [497, 731], [520, 731], [545, 734], [570, 736], [592, 732], [606, 722], [630, 712]];
const HEAD_R: Stops = [[394, 822], [396, 834], [402, 845], [410, 853], [420, 859], [432, 862], [446, 870], [462, 878], [480, 883], [497, 881], [520, 880], [545, 876], [570, 875], [592, 884], [606, 898], [630, 908]];

/** Outer edges of the coat from the collar to its two wind-blown corners. */
const COAT_L: Stops = [[596, 726], [608, 717], [618, 710], [630, 692], [640, 674], [650, 658], [670, 640], [695, 628], [720, 614], [745, 601], [770, 591], [795, 577], [820, 566], [845, 557], [870, 542], [900, 529], [940, 514], [1000, 502], [1045, 489], [1070, 480], [1095, 466], [1120, 449], [1145, 431], [1170, 414], [1195, 397], [1220, 381], [1245, 369], [1272, 363]];
const COAT_R: Stops = [[596, 890], [608, 903], [618, 914], [630, 938], [640, 954], [650, 962], [670, 971], [695, 979], [720, 988], [745, 997], [770, 1009], [795, 1021], [820, 1026], [845, 1031], [870, 1036], [900, 1048], [940, 1063], [1000, 1079], [1045, 1090], [1070, 1098], [1095, 1106], [1120, 1115], [1145, 1127], [1170, 1140], [1195, 1152], [1220, 1163], [1250, 1175], [1290, 1186], [1345, 1194]];
const COAT_HEM: Stops = [[363, 1272], [395, 1279], [427, 1287], [455, 1330], [500, 1420], [640, 1440], [1000, 1440], [1012, 1428], [1027, 1404], [1080, 1390], [1125, 1380], [1160, 1361], [1194, 1345]];

/** Lower coat: the torn skirt that streams to the left. */
const SKIRT_L: Stops = [[1240, 452], [1290, 430], [1345, 437], [1385, 462], [1430, 457], [1470, 441], [1530, 406], [1570, 387], [1617, 380]];
const SKIRT_R: Stops = [[1240, 1090], [1330, 1062], [1404, 1027], [1435, 1010], [1465, 1004], [1525, 1003]];
const SKIRT_HEM: Stops = [[380, 1617], [410, 1622], [440, 1626], [480, 1619], [525, 1614], [556, 1618], [580, 1623], [606, 1620], [630, 1624], [655, 1631], [674, 1620], [695, 1600], [706, 1586], [716, 1569], [722, 1548], [732, 1540], [742, 1541], [746, 1564], [752, 1550], [760, 1537], [774, 1531], [780, 1512], [800, 1511], [840, 1515], [858, 1517], [876, 1511], [888, 1511], [960, 1520], [1003, 1525]];

/** Standing legs. Both boots reach row 1716, just under the water line. */
const LEG_R_IN: Stops = [[1470, 868], [1511, 887], [1560, 902], [1590, 914], [1630, 927], [1670, 934], [1695, 934], [1716, 926]];
const LEG_R_OUT: Stops = [[1470, 1003], [1520, 1004], [1600, 1004], [1660, 1006], [1695, 1010], [1716, 1017]];
const LEG_L_OUT: Stops = [[1470, 640], [1540, 628], [1600, 619], [1640, 613], [1670, 608], [1695, 601], [1716, 592]];
const LEG_L_IN: Stops = [[1470, 752], [1540, 724], [1600, 705], [1640, 694], [1670, 686], [1695, 684], [1716, 688]];

/* ------------------------------------------------------------------- parts */

interface Loft {
  left: Stops;
  right: Stops;
  top: number;
  /** Last row of each edge. */
  bottomL: number;
  bottomR: number;
  hem?: Stops;
  depth: Stops; // by v
  z?: Stops; // by v
  folds?: (u: number, v: number) => number;
  foldDepth?: (v: number) => number;
}

/**
 * Closed form whose silhouette is exactly the traced pair of edges. Folds only
 * push the surface in depth, so they shade the cloth without moving its outline.
 */
function loft(s: Sculptor, nu: number, nv: number, l: Loft, o: Omit<SurfaceOptions, "closed" | "fold">) {
  s.surface(
    nu,
    nv,
    (u, v, out) => {
      const a = u * TAU;
      const q = (Math.cos(a) + 1) / 2;
      const yl = lerp(l.top, l.bottomL, v);
      const yr = lerp(l.top, l.bottomR, v);
      const x = lerp(sampleStops(l.left, yl), sampleStops(l.right, yr), q);
      let y = lerp(yl, yr, q);
      if (l.hem) y += (sampleStops(l.hem, x) - lerp(l.bottomL, l.bottomR, q)) * Math.pow(v, 2.4);
      const f = Math.sin(a);
      const fold = (l.folds?.(u, v) ?? 0) * (l.foldDepth?.(v) ?? 0) * Math.sqrt(Math.abs(f));
      out.set(ix(x), iy(y), f * (sampleStops(l.depth, v) + fold) + (l.z ? sampleStops(l.z, v) : 0));
    },
    { ...o, closed: true, fold: l.folds },
  );
}

const gauss = (x: number, w: number) => Math.exp(-(x * x) / (w * w));

function head(s: Sculptor) {
  loft(
    s,
    56,
    80,
    { left: HEAD_L, right: HEAD_R, top: 394, bottomL: 630, bottomR: 630, depth: [[0, 0.004], [0.02, 0.05], [0.06, 0.085], [0.15, 0.116], [0.3, 0.135], [0.5, 0.135], [0.7, 0.12], [0.85, 0.1], [1, 0.1]] },
    { part: PART.horn },
  );

  // Two horns, and only two. Center line and half width, in image pixels.
  const hornL: ReadonlyArray<readonly [number, number, number]> = [
    [752, 474, 25], [735, 456, 25], [717, 430, 21], [704, 400, 17.5], [690, 350, 15], [679, 300, 13], [672.5, 250, 11], [670, 200, 9.6], [672, 150, 9], [677, 122, 9], [684, 102, 9.4], [693, 89, 9.2], [704, 83, 8.2], [716, 85, 6], [727, 91.5, 3.4], [738, 99, 0.3],
  ];
  const hornR: ReadonlyArray<readonly [number, number, number]> = [
    [859, 474, 25], [875, 456, 25], [891, 430, 21], [904, 400, 17.5], [917, 350, 15.6], [928, 300, 14], [934.5, 250, 11.8], [937.5, 200, 10.2], [935, 150, 9.2], [929, 122, 9.6], [922, 104, 10.2], [912, 90, 10], [900, 82, 8.6], [888, 83.5, 5.6], [880, 87.5, 3], [873, 92, 0.3],
  ];
  for (const horn of [hornL, hornR]) {
    const n = horn.length - 1;
    s.tube(
      horn.map(([x, y], i) => at([x, y, lerp(0.02, -0.02, i / n)])),
      px2(horn.map(([, , r], i) => [i / n, r] as const)),
      { part: PART.horn, nu: 22, nv: 150 },
    );
  }

  // Hair escaping under the helm.
  const rand = mulberry32(514);
  for (const k of [-1, 1] as const) {
    const edge = k < 0 ? 735 : 876;
    for (let i = 0; i < 26; i++) {
      const y = lerp(505, 600, rand());
      const low = smoothstep(505, 585, y);
      const len = lerp(4, k < 0 ? 20 : 26, rand()) * (0.35 + 0.75 * low);
      const z = (rand() - 0.5) * 0.14;
      s.tube(
        [at([edge - k * 8, y - 10, z]), at([edge + k * len * 0.4, y + len * 0.12, z]), at([edge + k * len * 0.8, y + len * (0.35 - rand() * 0.3), z]), at([edge + k * len, y + len * (0.35 - rand() * 0.7), z])],
        px2([[0, 3.2], [0.5, 2], [1, 0.2]]),
        { part: PART.horn, nu: 5, nv: 10 },
      );
    }
  }
}

function coat(s: Sculptor) {
  const pleats = (u: number, v: number) => {
    const a = u * TAU;
    return 0.6 * Math.sin(Math.cos(a) * 9 + 1.2 * Math.sin(v * 3) + 0.6) + 0.4 * Math.sin(Math.cos(a) * 17 + v * 4);
  };
  loft(
    s,
    120,
    120,
    {
      left: COAT_L, right: COAT_R, top: 596, bottomL: 1272, bottomR: 1345, hem: COAT_HEM,
      depth: [[0, 0.1], [0.06, 0.13], [0.2, 0.175], [0.45, 0.2], [0.75, 0.26], [1, 0.33]],
      folds: pleats, foldDepth: (v) => 0.012 + 0.03 * v,
    },
    { part: PART.fabric, flutter: (u, v) => 0.01 * smoothstep(0.7, 1, v) * Math.abs(Math.cos(u * TAU)) },
  );

  // Skirt: torn along the bottom, streaming left, open in an arch over the stride.
  loft(
    s,
    200,
    90,
    {
      left: SKIRT_L, right: SKIRT_R, top: 1240, bottomL: 1617, bottomR: 1525, hem: SKIRT_HEM,
      depth: [[0, 0.22], [0.5, 0.2], [1, 0.16]], z: [[0, 0], [1, -0.04]],
      folds: pleats, foldDepth: () => 0.03,
    },
    {
      part: PART.fabric,
      billow: (u, v, out) => {
        const left = 1 - (Math.cos(u * TAU) + 1) / 2;
        out.set(-0.11 * left * left * v, 0.05 * left * left * v, 0);
      },
      flutter: (u, v) => 0.02 * v * v * (1 - (Math.cos(u * TAU) + 1) / 2),
    },
  );

  // A thinner tail of cloth caught further back in the wind.
  const tailTop = [[427, 1284], [385, 1340], [325, 1446], [312, 1530]] as const;
  const tailBot = [[500, 1384], [470, 1440], [440, 1490], [352, 1560]] as const;
  const curve = (p: ReadonlyArray<readonly [number, number]>) => new CatmullRomCurve3(p.map(([x, y]) => at([x, y])), false, "centripetal");
  const top = curve(tailTop);
  const bot = curve(tailBot);
  const b = new Vector3();
  s.surface(
    28,
    18,
    (u, v, out) => {
      top.getPoint(u, out);
      bot.getPoint(u, b);
      out.lerp(b, v);
      out.z = -0.24 + 0.03 * Math.sin(u * 6 + v * 4);
    },
    { part: PART.sheet, billow: (u, _, out) => out.set(-0.12 * u, 0.06 * u, 0), flutter: (u) => 0.04 * u * u, fold: (u, v) => Math.sin(v * 9 + u * 3) },
  );
}

function legs(s: Sculptor) {
  const leg = (left: Stops, right: Stops, z: number) =>
    loft(
      s,
      32,
      60,
      { left, right, top: 1470, bottomL: 1716, bottomR: 1716, depth: [[0, 0.1], [0.4, 0.075], [0.78, 0.066], [0.9, 0.085], [1, 0.12]], z: [[0, 0], [0.8, z], [1, z + 0.035]] },
      { part: PART.fabric },
    );
  leg(LEG_L_OUT, LEG_L_IN, -0.02);
  leg(LEG_R_IN, LEG_R_OUT, 0.02);
}

function arms(s: Sculptor) {
  const wrinkle = (u: number, v: number) => 1 + 0.035 * Math.sin(v * 21 + Math.sin(u * TAU) * 2) * smoothstep(0.2, 0.5, v) * (1 - smoothstep(0.85, 1, v));
  s.tube(
    [at([730, 800, -0.04]), at([618, 872, 0.0]), at([500, 955, 0.05]), at([460, 981, 0.07]), at([424, 1006, 0.1]), at([392, 1014, 0.125])],
    px2([[0, 26], [0.3, 38], [0.56, 37], [0.75, 31], [0.92, 25], [0.98, 22], [1, 9]]),
    { part: PART.fabric, nu: 30, nv: 60, shape: wrinkle },
  );
  s.tube(
    [at([880, 800, -0.04]), at([980, 892, 0.0]), at([1060, 956, 0.05]), at([1112, 984, 0.07]), at([1146, 1001, 0.1]), at([1172, 1002, 0.125])],
    px2([[0, 26], [0.34, 40], [0.6, 41], [0.78, 36], [0.93, 30], [0.98, 25], [1, 10]]),
    { part: PART.fabric, nu: 30, nv: 60, shape: wrinkle },
  );

  // Seen from behind: the back of the hand faces us and the cables pass in
  // front of the palm, hidden by it. Fingers leave at the knuckles on the outer
  // edge and curl away around the far side.
  const hand = (c: Vector3, k: -1 | 1, hx: number, hy: number) => {
    const rx = hx * SCALE;
    const ry = hy * SCALE;
    const P3 = (x: number, y: number, z: number) => new Vector3(c.x + k * x * rx, c.y + y * ry, c.z + z);
    /** Knuckle positions, index to little finger. */
    const knuckles = [
      { x: 0.5, y: 0.56, r: 0.19, reach: 0.96 },
      { x: 0.57, y: 0.19, r: 0.195, reach: 1.02 },
      { x: 0.53, y: -0.17, r: 0.185, reach: 0.98 },
      { x: 0.42, y: -0.5, r: 0.165, reach: 0.86 },
    ];

    // Back of the hand: one continuous sheet with tendons and knuckles in relief.
    const top = (x: number) => lerp(0.44, 0.78, smoothstep(-1, 0.25, x)) - 0.12 * smoothstep(0.45, 0.8, x);
    const bottom = (x: number) => lerp(-0.46, -0.72, smoothstep(-1, 0.3, x)) + 0.16 * smoothstep(0.4, 0.8, x);
    s.surface(
      90,
      90,
      (u, v, out) => {
        const x = lerp(-1.12, 0.78, u);
        const n = v * 2 - 1;
        const y = lerp(bottom(x), top(x), v);
        let z = -0.012 + 0.077 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(n), 2.6)), 0.5);
        z += 0.012 * smoothstep(-0.9, 0.3, x) * (1 - n * n);
        const along = smoothstep(-1.0, 0.45, x);
        for (const k2 of knuckles) {
          const track = lerp(0.02 + k2.y * 0.2, k2.y, along);
          z += 0.0062 * gauss(y - track, 0.07) * smoothstep(-0.85, -0.35, x) * (1 - smoothstep(k2.x - 0.1, k2.x + 0.1, x));
          const dx = (x - k2.x) / 0.19;
          const dy = (y - k2.y) / 0.14;
          z += 0.016 * Math.exp(-dx * dx - dy * dy);
        }
        // Rolls off past the knuckles, where the fingers take over.
        z -= 0.05 * smoothstep(0.6, 0.8, x);
        out.copy(P3(x, y, z));
      },
      { part: PART.skin, front: true },
    );
    // Heel and palm side, so the hand is solid from every angle.
    s.tube([P3(-1.0, 0.0, 0.004), P3(-0.5, 0.0, -0.006), P3(0.2, 0.02, -0.012)], [[0, ry * 0.2], [0.5, ry * 0.5], [1, ry * 0.6]], { part: PART.skin, nu: 20, nv: 16 });

    for (const { x, y, r, reach } of knuckles) {
      const f = ry * r;
      s.tube(
        [P3(x - 0.26, y, 0.016), P3(x + 0.02, y, 0.06), P3(0.84 * reach, y - 0.015, 0.05), P3(1.08 * reach, y - 0.03, 0.012), P3(1.06 * reach, y - 0.04, -0.034), P3(0.7 * reach, y - 0.045, -0.066), P3(0.15, y - 0.04, -0.07)],
        [[0, f * 0.3], [0.2, f * 0.96], [0.3, f * 0.92], [0.42, f * 0.96], [0.52, f * 1.02], [0.64, f * 0.9], [1, f * 0.75]],
        { part: PART.skin, nu: 16, nv: 60 },
      );
    }

    // Thumb: base on the inner top edge, then over the far side of the cables.
    s.tube(
      [P3(-1.0, 0.0, 0.0), P3(-0.76, 0.3, 0.036), P3(-0.52, 0.6, 0.034), P3(-0.3, 0.76, -0.008), P3(0.04, 0.8, -0.052), P3(0.4, 0.74, -0.066)],
      [[0, ry * 0.12], [0.28, ry * 0.21], [0.5, ry * 0.19], [0.8, ry * 0.17], [1, ry * 0.1]],
      { part: PART.skin, nu: 16, nv: 44 },
    );
  };
  hand(FIST.L, -1, 37, 47);
  hand(FIST.R, 1, 34, 41);
}

export function createCharacterGeometry(): BufferGeometry {
  const s = new Sculptor();
  head(s);
  coat(s);
  legs(s);
  arms(s);
  return s.build();
}
