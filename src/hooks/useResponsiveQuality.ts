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

export function useResponsiveQuality(): QualitySettings {
  return QUALITY[useSceneStore((s) => s.quality)];
}
