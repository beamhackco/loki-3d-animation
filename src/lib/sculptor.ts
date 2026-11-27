import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Vector3 } from "three";
import { clamp01, sampleStops, type Stops } from "./space";

/**
 * Builds a figure out of parametric surfaces merged into one geometry, so each
 * figure is one draw call. Shared by the horned figure and the rival.
 */

export interface SurfaceOptions {
  /** Material zone, read by the figure's shader. */
  part: number;
  closed?: boolean;
  /** Per-vertex vector stored as aBillow: the robe's wind offset, or the rival's motion weights. */
  billow?: (u: number, v: number, out: Vector3) => void;
  flutter?: (u: number, v: number) => number;
  /** Open sheet that faces the camera. */
  front?: boolean;
  /** Crease depth, -1 (valley) to 1 (ridge); shades fold occlusion. */
  fold?: (u: number, v: number) => number;
}

export type TubeOptions = SurfaceOptions & { nu?: number; nv?: number; shape?: (u: number, v: number) => number };

export class Sculptor {
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
  tube(points: Vector3[], radius: Stops, o: TubeOptions) {
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
