"use client";

import { useEffect, useMemo } from "react";
import { ShaderMaterial, type DataTexture } from "three";
import { noiseUniform, sceneUniforms } from "@/lib/sceneUniforms";
import { createTubeGeometry } from "@/lib/tendrilBuffers";
import { CURVE_SAMPLES, type TendrilDef } from "@/lib/tendrilPaths";
import { tendrilFragment, tendrilVertex } from "@/shaders/tendrilShader";

interface Props {
  tendrils: TendrilDef[];
  curves: DataTexture;
  segments: number;
  sides: number;
}

/** Every cable in the scene: two instanced draws, near and back. */
export function Tendrils({ tendrils, curves, segments, sides }: Props) {
  const near = useMemo(() => createTubeGeometry(tendrils, "near", segments, sides), [tendrils, segments, sides]);
  // The back layer is thin and soft, so it gets a lighter tube.
  const back = useMemo(
    () => createTubeGeometry(tendrils, "back", Math.round(segments * 0.75), Math.max(5, sides - 3)),
    [tendrils, segments, sides],
  );
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: tendrilVertex,
        fragmentShader: tendrilFragment,
        uniforms: {
          uCurves: { value: curves },
          uSamples: { value: CURVE_SAMPLES },
          uNoise: noiseUniform(),
          uTime: sceneUniforms.uTime,
          uEnergyTime: sceneUniforms.uEnergyTime,
          uEnergy: sceneUniforms.uEnergy,
          uHalo: sceneUniforms.uHalo,
          uSurge: sceneUniforms.uSurge,
          uReveal: sceneUniforms.uReveal,
          uDrag: sceneUniforms.uDrag,
          uPointer: sceneUniforms.uPointer,
          uPointerStrength: sceneUniforms.uPointerStrength,
        },
      }),
    [curves],
  );

  useEffect(() => () => near.dispose(), [near]);
  useEffect(() => () => back.dispose(), [back]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <>
      <mesh geometry={back} material={material} frustumCulled={false} />
      <mesh geometry={near} material={material} frustumCulled={false} />
    </>
  );
}
