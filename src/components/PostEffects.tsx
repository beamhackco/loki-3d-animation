"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize, type DepthOfFieldEffect } from "postprocessing";
import { useRef } from "react";
import { HalfFloatType } from "three";
import type { QualitySettings } from "@/hooks/useResponsiveQuality";
import { shot } from "@/lib/sceneUniforms";

/** Energy blooms, distance softens, edges fall away, grain binds it together. */
export function PostEffects({ settings }: { settings: QualitySettings }) {
  const dof = useRef<DepthOfFieldEffect>(null);
  // Portrait crops away the dark flanks, so the vignette supplies them.
  const portrait = useThree((s) => s.size.width < s.size.height);

  useFrame(() => {
    const effect = dof.current;
    if (!effect) return;
    // Focus stays on the figure while the background blurs during the push-in.
    const coc = effect.cocMaterial;
    coc.focusDistance = shot.distance - 0.1;
    coc.focusRange = 2.6 - shot.focus * 0.9;
    effect.bokehScale = 0.4 + shot.focus * 2.6;
  });

  return (
    <EffectComposer multisampling={settings.multisampling} frameBufferType={HalfFloatType}>
      {settings.depthOfField ? <DepthOfField ref={dof} focusDistance={0.1} focusRange={0.05} bokehScale={1} resolutionScale={0.5} /> : <></>}
      <Bloom
        mipmapBlur
        luminanceThreshold={0.98}
        luminanceSmoothing={0.12}
        intensity={0.95}
        radius={0.72}
        levels={settings.bloomLevels}
        kernelSize={KernelSize.MEDIUM}
      />
      <Vignette offset={portrait ? 0.18 : 0.22} darkness={portrait ? 0.62 : 0.34} />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.07} />
    </EffectComposer>
  );
}
