import type { Quality } from "@/store/sceneStore";

/*
 * Runs before the 3D bundle loads, so it must not import three or postprocessing:
 * anything imported here ships to every visitor, including those who get the still.
 */

/** Laptop graphics without their own memory: fill rate is the limit, not geometry. */
export function isIntegratedGpu(gl: WebGL2RenderingContext): boolean {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  if (/Arc\(TM\) [AB]\d/i.test(name)) return false;
  return /Intel|UHD|Iris|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d|SwiftShader|llvmpipe|Basic Render/i.test(name);
}

/** Initial tier from the device; PerformanceMonitor lowers it later if needed. */
export function detectQuality(integrated: boolean): Quality {
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "high" || forced === "medium" || forced === "low") return forced;

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);

  if (coarse && shortSide < 600) return "low";
  if (integrated) return "low";
  if (coarse || cores <= 4 || memory <= 4) return "medium";
  return "high";
}
