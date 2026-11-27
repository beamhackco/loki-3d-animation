"use client";

import { SMAAPreset } from "postprocessing";
import { useSceneStore, type Quality } from "@/store/sceneStore";

export interface QualitySettings {
  maxDpr: number;
  tubeSegments: number;
  tubeSides: number;
  /** Optional tendrils up to this rank are kept (0..1). */
  tendrilDensity: number;
  sparks: number;
  dust: number;
  fogLayers: number;
  depthOfField: boolean;
  bloomLevels: number;
  /** MSAA samples for geometry edges; capped by the GPU's MAX_SAMPLES. */
  multisampling: number;
  /** Post-process AA for edges drawn inside shaders, which MSAA can't reach. */
  smaa: SMAAPreset;
  /** Anisotropic filtering for the shared noise texture; capped by the GPU. */
  anisotropy: number;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  high: { maxDpr: 1.75, tubeSegments: 150, tubeSides: 9, tendrilDensity: 1, sparks: 70, dust: 320, fogLayers: 5, depthOfField: true, bloomLevels: 7, multisampling: 8, smaa: SMAAPreset.HIGH, anisotropy: 16 },
  medium: { maxDpr: 1.5, tubeSegments: 110, tubeSides: 7, tendrilDensity: 0.65, sparks: 45, dust: 200, fogLayers: 4, depthOfField: false, bloomLevels: 6, multisampling: 4, smaa: SMAAPreset.HIGH, anisotropy: 8 },
  low: { maxDpr: 1.6, tubeSegments: 80, tubeSides: 6, tendrilDensity: 0.5, sparks: 28, dust: 100, fogLayers: 3, depthOfField: false, bloomLevels: 5, multisampling: 2, smaa: SMAAPreset.MEDIUM, anisotropy: 4 },
};

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

export function useResponsiveQuality(): QualitySettings {
  return QUALITY[useSceneStore((s) => s.quality)];
}
