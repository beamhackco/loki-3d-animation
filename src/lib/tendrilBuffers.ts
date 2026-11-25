import { BufferAttribute, DataTexture, FloatType, InstancedBufferAttribute, InstancedBufferGeometry, NearestFilter, RGBAFormat } from "three";
import { CURVE_SAMPLES, type TendrilDef } from "./tendrilPaths";

/** Curve samples packed one tendril per row, read by the vertex shaders. */
export function createCurveTexture(tendrils: TendrilDef[]): DataTexture {
  const data = new Float32Array(CURVE_SAMPLES * tendrils.length * 4);
  tendrils.forEach((t, row) => {
    t.points.forEach((p, i) => {
      const k = (row * CURVE_SAMPLES + i) * 4;
      data[k] = p.x;
      data[k + 1] = p.y;
      data[k + 2] = p.z;
      data[k + 3] = 1;
    });
  });
  const tex = new DataTexture(data, CURVE_SAMPLES, tendrils.length, RGBAFormat, FloatType);
  tex.minFilter = tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const pulseOf = (t: TendrilDef) => (t.pulse ? [t.pulse.start, t.pulse.period, t.pulse.duration, t.pulse.trail] : [0, 0, 1, 1]);
const rangeOf = (t: TendrilDef) => (t.pulse ? t.pulse.range : [0, 1]);

/**
 * A single tube (t, angle) instanced once per tendril. The vertex shader bends
 * each instance along its own curve, so all cables cost one draw call per layer.
 */
export function createTubeGeometry(tendrils: TendrilDef[], layer: TendrilDef["layer"], segments: number, sides: number): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  const verts = new Float32Array((segments + 1) * (sides + 1) * 3);
  let k = 0;
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= sides; j++) {
      verts[k++] = i / segments;
      verts[k++] = (j / sides) * Math.PI * 2;
      verts[k++] = 0;
    }
  }
  const index = new Uint16Array(segments * sides * 6);
  k = 0;
  const row = sides + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * row + j;
      index.set([a, a + row, a + 1, a + 1, a + row, a + row + 1], k);
      k += 6;
    }
  }
  g.setAttribute("position", new BufferAttribute(verts, 3));
  g.setIndex(new BufferAttribute(index, 1));

  const rows = tendrils.map((t, i) => ({ t, i })).filter(({ t }) => t.layer === layer);
  const attr = (name: string, size: number, get: (t: TendrilDef, row: number) => ArrayLike<number>) => {
    const data = new Float32Array(rows.length * size);
    rows.forEach(({ t, i }, n) => data.set(get(t, i), n * size));
    g.setAttribute(name, new InstancedBufferAttribute(data, size));
  };
  attr("aRow", 1, (_, i) => [i]);
  attr("aMotion", 4, (t) => [t.groupSeed, t.seed, t.groupAmp, t.ownAmp]);
  attr("aPulse", 4, pulseOf);
  attr("aRange", 2, rangeOf);
  attr("aGlow", 1, (t) => [t.glow]);
  attr("aLook", 4, (t) => [t.radius, t.length, t.arc ? 1 : 0, t.layer === "back" ? 1 : 0]);
  g.instanceCount = rows.length;
  return g;
}

/** Sparks that ride the pulses; positions are resolved on the GPU. */
export function createSparkGeometry(tendrils: TendrilDef[], perPulse: number, rand: () => number) {
  const carriers = tendrils.map((t, i) => ({ t, i })).filter(({ t }) => t.pulse && !t.arc);
  const n = carriers.length * perPulse;
  const attributes = {
    position: new Float32Array(n * 3),
    aRow: new Float32Array(n),
    aMotion: new Float32Array(n * 4),
    aPulse: new Float32Array(n * 4),
    aRange: new Float32Array(n * 2),
    aRand: new Float32Array(n * 4),
  };
  let k = 0;
  for (const { t, i } of carriers) {
    for (let s = 0; s < perPulse; s++, k++) {
      attributes.aRow[k] = i;
      attributes.aMotion.set([t.groupSeed, t.seed, t.groupAmp, t.ownAmp], k * 4);
      attributes.aPulse.set(pulseOf(t), k * 4);
      attributes.aRange.set(rangeOf(t), k * 2);
      attributes.aRand.set([rand(), rand(), rand(), rand()], k * 4);
    }
  }
  return attributes;
}
