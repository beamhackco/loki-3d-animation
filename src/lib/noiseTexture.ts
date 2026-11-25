import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, RepeatWrapping, UnsignedByteType } from "three";
import { mulberry32 } from "./space";

/** Periodic gradient noise, so the texture tiles without seams. */
function makeGradientNoise(period: number, seed: number) {
  const rand = mulberry32(seed);
  const gx = new Float32Array(period * period);
  const gy = new Float32Array(period * period);
  for (let i = 0; i < gx.length; i++) {
    const a = rand() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const wrap = (v: number) => ((v % period) + period) % period;
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const dot = (ix: number, iy: number) => {
      const k = wrap(yi + iy) * period + wrap(xi + ix);
      return gx[k] * (fx - ix) + gy[k] * (fy - iy);
    };
    const u = fade(fx);
    const v = fade(fy);
    const a = dot(0, 0) + u * (dot(1, 0) - dot(0, 0));
    const b = dot(0, 1) + u * (dot(1, 1) - dot(0, 1));
    return a + v * (b - a);
  };
}

const SIZE = 256;

function fbm(base: number, octaves: number, seed: number, ridged = false) {
  const layers = Array.from({ length: octaves }, (_, o) => makeGradientNoise(base << o, seed + o * 17));
  const out = new Float32Array(SIZE * SIZE);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let amp = 1;
      let sum = 0;
      for (let o = 0; o < octaves; o++) {
        const f = (base << o) / SIZE;
        const n = layers[o](x * f, y * f);
        sum += amp * (ridged ? 1 - Math.abs(n) * 2.4 : n);
        amp *= 0.52;
      }
      out[y * SIZE + x] = sum;
      min = Math.min(min, sum);
      max = Math.max(max, sum);
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / (max - min);
  return out;
}

let cached: DataTexture | null = null;

/**
 * One 256px RGBA texture replaces per-pixel fbm in every fog shader.
 * R, G: soft fbm with different seeds. B: fine grain. A: ridged fbm for wisps.
 */
export function getNoiseTexture(): DataTexture {
  if (cached) return cached;
  const r = fbm(4, 5, 11);
  const g = fbm(4, 5, 211);
  const b = fbm(32, 3, 431);
  const a = fbm(4, 5, 733, true);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = r[i] * 255;
    data[i * 4 + 1] = g[i] * 255;
    data[i * 4 + 2] = b[i] * 255;
    data[i * 4 + 3] = a[i] * 255;
  }
  const tex = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
