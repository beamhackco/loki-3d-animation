import { Vector3, type BufferGeometry } from "three";
import { Sculptor, type SurfaceOptions } from "./sculptor";
import { lerp, sampleStops, smoothstep, type Stops } from "./space";

/**
 * The rival: hooded, masked, arms crossed, in a long green cloak over armor.
 * Traced from the supplied image (888 x 1309 px, axis at x = 455, soles at
 * y = 1293) and sculpted in local units: soles at y = 0, facing +z toward Loki
 * and the camera. aBillow carries motion weights (head turn, breath, cloth).
 */

/** Where he stands: on the dolly axis, hidden behind Loki until the camera passes through. */
export const RIVAL = { x: 0, z: -5.9, height: 2.45 } as const;

export const RIVAL_PART = { cloth: 0, obsidian: 1, steel: 2, visor: 3, under: 4, shadow: 5 } as const;

const TAU = Math.PI * 2;
const S = RIVAL.height / (1293 - 84);
const AXIS = 455;
const FEET = 1293;
/** Image pixel to local units. */
const P = (x: number, y: number, z = 0) => new Vector3((x - AXIS) * S, (FEET - y) * S, z);
const r = (stops: ReadonlyArray<readonly [number, number]>): Stops => stops.map(([t, v]) => [t, v * S] as const);
const gauss = (x: number, w: number) => Math.exp(-(x * x) / (w * w));

type Motion = { head?: number; breath?: number; cloth?: (u: number, v: number) => number };
const motion = (m: Motion): Pick<SurfaceOptions, "billow"> => ({
  billow: (u, v, out) => out.set(m.head ?? 0, m.breath ?? 0, m.cloth?.(u, v) ?? 0),
});

interface Outline {
  left: Stops;
  right: Stops;
}
const center = (o: Outline, row: number) => (sampleStops(o.left, row) + sampleStops(o.right, row)) / 2;
const half = (o: Outline, row: number) => (sampleStops(o.right, row) - sampleStops(o.left, row)) / 2;

const CLOAK: Outline = {
  left: [[262, 336], [284, 312], [300, 282], [324, 259], [344, 252], [384, 230], [424, 224], [464, 232], [504, 258], [604, 270], [704, 266], [804, 254], [904, 238], [1004, 219], [1064, 207], [1086, 212], [1104, 244], [1124, 300]],
  right: [[262, 604], [284, 640], [300, 672], [344, 681], [384, 682], [444, 676], [504, 672], [604, 673], [704, 679], [804, 688], [904, 702], [1004, 725], [1064, 738], [1086, 736], [1104, 724], [1124, 700]],
};
const HOOD: Outline = {
  left: [[84, 451], [104, 412], [124, 399], [144, 390], [164, 382], [184, 373], [204, 363], [224, 352], [244, 340], [266, 326], [290, 312]],
  right: [[84, 458], [104, 497], [124, 511], [144, 522], [164, 534], [184, 542], [204, 556], [224, 571], [244, 584], [266, 598], [290, 616]],
};

/** Closed form between two traced edges. Front is +z; `depth` gives front and back half depth by row. */
function loft(s: Sculptor, nu: number, nv: number, o: Outline, top: number, bottom: number, depth: (row: number, front: boolean) => number, so: Omit<SurfaceOptions, "closed">, shape?: (a: number, row: number) => number) {
  s.surface(
    nu,
    nv,
    (u, v, out) => {
      const a = u * TAU;
      const row = lerp(top, bottom, v);
      const z = Math.cos(a);
      const d = depth(row, z > 0) * (shape?.(a, row) ?? 1);
      out.copy(P(center(o, row) + Math.sin(a) * half(o, row), row, z * d));
    },
    { ...so, closed: true },
  );
}

function cloak(s: Sculptor) {
  // Falls from the shoulders behind the arms, open over the tunic.
  s.surface(
    150,
    110,
    (u, v, out) => {
      const row = lerp(268, 1124, v);
      const gap = lerp(0.42, 0.9, smoothstep(470, 820, row));
      const th = lerp(gap, TAU - gap, u);
      const pleat = 1 + 0.06 * v * Math.sin(th * 8 + v * 2.2) + 0.025 * v * Math.sin(th * 17 + 1.3);
      const rz = lerp(0.17, 0.36, smoothstep(268, 1124, row)) * pleat;
      const p = P(center(CLOAK, row) + Math.sin(th) * half(CLOAK, row) * pleat, row);
      out.set(p.x, p.y, Math.cos(th) * rz - lerp(0.02, 0.09, v));
    },
    {
      part: RIVAL_PART.cloth,
      fold: (u, v) => Math.sin(lerp(0.5, TAU - 0.5, u) * 8 + v * 2.2),
      ...motion({ breath: 0.35, cloth: (_, v) => Math.pow(v, 1.6) }),
    },
  );
  // Hood, with the face opening pushed back so the mask sits inside it.
  loft(
    s,
    90,
    70,
    HOOD,
    84,
    292,
    (row) => lerp(0.02, 0.215, smoothstep(84, 200, row)),
    { part: RIVAL_PART.cloth, fold: (u, v) => 0.6 * Math.sin(Math.sin(u * TAU) * 9 + v * 3), ...motion({ head: 1, breath: 1 }) },
    (a, row) => {
      const open = smoothstep(0.66, 0.42, Math.abs(Math.sin(a))) * smoothstep(110, 128, row) * (1 - smoothstep(240, 262, row));
      return Math.cos(a) > 0 ? 1 - 0.5 * open : 1;
    },
  );
}

function coif(s: Sculptor) {
  loft(
    s,
    40,
    30,
    { left: [[112, 428], [150, 404], [220, 406], [262, 420], [300, 410]], right: [[112, 482], [150, 506], [220, 504], [262, 490], [300, 500]] },
    112,
    300,
    (row, f) => (f ? lerp(0.1, 0.13, smoothstep(112, 220, row)) : 0.1),
    { part: RIVAL_PART.shadow, ...motion({ head: 1, breath: 1 }) },
  );
}

function mask(s: Sculptor) {
  // Relief: brow band, nose ridge, eye sockets, mouth slot, chin.
  const L: Stops = [[128, 441], [134, 426], [145, 414], [165, 410], [190, 411], [210, 414], [228, 420], [240, 430], [248, 440]];
  s.surface(
    56,
    70,
    (u, v, out) => {
      const row = lerp(128, 248, v);
      const q = u * 2 - 1;
      const x = AXIS + q * (AXIS - sampleStops(L, row));
      const flat = Math.pow(Math.abs(q), lerp(2.2, 3.6, smoothstep(190, 225, row)));
      let z = 0.105 + 0.05 * Math.sqrt(Math.max(0, 1 - flat));
      z += 0.012 * gauss(row - 149, 5) * (1 - smoothstep(0.75, 0.95, Math.abs(q)));
      z += 0.022 * gauss(q, 0.13) * smoothstep(150, 158, row) * (1 - smoothstep(190, 198, row));
      z -= 0.018 * gauss(Math.abs(q) - 0.47, 0.27) * gauss(row - 169, 9);
      // Mouth slot, bent down at the ends so it reads level from below.
      z -= 0.01 * gauss(row - 211 - 7 * q * q, 2.5) * (1 - smoothstep(0.42, 0.55, Math.abs(q)));
      z += 0.008 * gauss(row - 236, 8) * (1 - smoothstep(0.5, 0.8, Math.abs(q)));
      // Cheek plates either side of the mouth, and a hard brow over the eyes.
      z += 0.009 * gauss(Math.abs(q) - 0.74, 0.1) * smoothstep(182, 192, row) * (1 - smoothstep(226, 236, row));
      z += 0.008 * gauss(row - 158, 3.5) * gauss(Math.abs(q) - 0.45, 0.3);
      out.copy(P(x, row, z));
    },
    { part: RIVAL_PART.visor, front: true, ...motion({ head: 1, breath: 1 }) },
  );
}

function torso(s: Sculptor) {
  // Engraved chest plate, belt and buckle, then the tunic to the knees.
  loft(s, 48, 24, { left: [[425, 360], [470, 368], [526, 372]], right: [[425, 545], [470, 540], [526, 536]] }, 425, 526, (_, f) => (f ? 0.2 : 0.16), { part: RIVAL_PART.steel, ...motion({ breath: 1 }) });
  loft(s, 56, 12, { left: [[520, 346], [600, 344]], right: [[520, 550], [600, 552]] }, 520, 600, (_, f) => (f ? 0.215 : 0.17), { part: RIVAL_PART.obsidian, ...motion({ breath: 0.3 }) });
  const c = P(401, 560, 0.226);
  s.surface(
    36,
    10,
    (u, v, out) => {
      const a = u * TAU;
      const b = v * TAU;
      const R = 27 * S;
      const t = 5.5 * S;
      out.set(c.x + Math.cos(a) * (R + Math.cos(b) * t), c.y + Math.sin(a) * (R + Math.cos(b) * t) * 1.2, c.z + Math.sin(b) * t);
    },
    { part: RIVAL_PART.steel, closed: true, ...motion({ breath: 0.3 }) },
  );
  loft(
    s,
    90,
    60,
    { left: [[596, 332], [700, 312], [850, 302], [1000, 298]], right: [[596, 560], [700, 590], [850, 628], [1000, 646]] },
    596,
    1000,
    (row, f) => (f ? lerp(0.2, 0.23, smoothstep(596, 1000, row)) : 0.17),
    {
      part: RIVAL_PART.cloth,
      fold: (u, v) => 0.7 * Math.sin(Math.sin(u * TAU) * 7 + 0.4) - 1.2 * gauss(Math.sin(u * TAU) - 0.12, 0.06) * smoothstep(0.2, 0.4, v),
      ...motion({ cloth: (_, v) => 0.3 * v }),
    },
    (a, row) => 1 - 0.18 * gauss(Math.sin(a) - 0.12, 0.05) * smoothstep(690, 760, row),
  );
}

function arms(s: Sculptor) {
  const tube = (pts: Vector3[], radius: Stops, part: number, nu = 20, nv = 30, breath = 0.5, shape?: (u: number, v: number) => number) =>
    s.tube(pts, radius, { part, nu, nv, shape, ...motion({ breath }) });
  // Gauntlet plates: a flared cuff at the elbow end, raised bands, a ridge along the top.
  const plates = (u: number, v: number) => {
    const band = (at: number, w: number) => Math.exp(-(((v - at) / w) ** 2));
    const top = Math.exp(-(((Math.sin(u * TAU) - 1) / 0.25) ** 2));
    return 1 + 0.1 * smoothstep(0.12, 0, v) + 0.05 * band(0.18, 0.025) + 0.045 * band(0.56, 0.02) + 0.06 * band(0.93, 0.03) + 0.035 * top * (1 - smoothstep(0.85, 0.95, v));
  };
  // Shoulder emblems.
  for (const [x, y, R] of [[345, 304, 30], [522, 271, 32]] as const) {
    const c = P(x, y, 0.235);
    s.surface(
      36,
      10,
      (u, v, out) => {
        const a = u * TAU;
        out.set(c.x + Math.cos(a) * R * S * v, c.y + Math.sin(a) * R * S * v, c.z + 0.007 * (1 - v * v) - 0.012 * smoothstep(0.9, 1, v));
      },
      { part: RIVAL_PART.steel, closed: true, ...motion({ breath: 0.9 }) },
    );
  }
  // The arm folded underneath: chainmail upper arm, then the gauntlet.
  tube([P(340, 296, -0.02), P(282, 352, 0.13), P(258, 420, 0.2)], r([[0, 26], [0.5, 32], [1, 34]]), RIVAL_PART.under, 20, 30, 0.8);
  tube([P(250, 425, 0.22), P(306, 412, 0.26), P(380, 398, 0.28), P(432, 388, 0.27)], r([[0, 56], [0.35, 52], [0.75, 46], [1, 40]]), RIVAL_PART.steel, 32, 64, 0.5, plates);
  tube([P(430, 388, 0.24), P(452, 382, 0.22)], r([[0, 32], [1, 26]]), RIVAL_PART.under, 14, 8);
  // The arm folded on top.
  tube([P(552, 270, -0.02), P(624, 316, 0.13), P(640, 380, 0.2)], r([[0, 28], [0.5, 40], [1, 40]]), RIVAL_PART.under, 20, 30, 0.8);
  tube([P(638, 386, 0.22), P(622, 360, 0.27), P(598, 348, 0.3)], r([[0, 42], [1, 50]]), RIVAL_PART.under, 20, 14);
  tube([P(600, 348, 0.31), P(520, 336, 0.33), P(440, 334, 0.34), P(372, 345, 0.32)], r([[0, 57], [0.4, 54], [0.8, 50], [1, 46]]), RIVAL_PART.steel, 32, 64, 0.5, plates);
  tube([P(374, 346, 0.3), P(352, 352, 0.28)], r([[0, 30], [1, 24]]), RIVAL_PART.under, 14, 8);
}

function legs(s: Sculptor) {
  for (const k of [-1, 1] as const) {
    const x0 = k < 0 ? 346 : 570;
    s.tube([P(x0, 870, 0.0), P(x0 + k * 2, 1000, 0.01), P(x0 + k * 10, 1100, 0.02), P(x0 + k * 22, 1180, 0.025)], r([[0, 38], [0.5, 36], [1, 31]]), { part: RIVAL_PART.obsidian, nu: 20, nv: 30 });
    const knee = P(x0, 890, 0.05);
    s.surface(
      22,
      14,
      (u, v, out) => {
        const a = u * TAU;
        const b = v * Math.PI;
        out.set(knee.x + Math.cos(a) * Math.sin(b) * 33 * S, knee.y + Math.cos(b) * 38 * S, knee.z + Math.sin(a) * Math.sin(b) * 26 * S);
      },
      { part: RIVAL_PART.obsidian, closed: true },
    );
    // Armored boot, toes turned out, standing in the shallows.
    s.tube([P(x0 + k * 22, 1176, 0.024), P(x0 + k * 36, 1236, 0.06), P(x0 + k * 66, 1268, 0.12), P(x0 + k * 92, 1284, 0.16)], r([[0, 38], [0.4, 40], [0.8, 30], [1, 16]]), { part: RIVAL_PART.obsidian, nu: 20, nv: 30 });
  }
}

export function createRivalGeometry(): BufferGeometry {
  const s = new Sculptor();
  cloak(s);
  torso(s);
  legs(s);
  arms(s);
  coif(s);
  // Chest under the folded arms.
  loft(s, 40, 20, { left: [[280, 360], [440, 362]], right: [[280, 548], [440, 545]] }, 280, 440, (_, f) => (f ? 0.19 : 0.15), { part: RIVAL_PART.under, ...motion({ breath: 1 }) });
  mask(s);
  return s.build();
}
