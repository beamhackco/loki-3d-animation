"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, MathUtils, ShaderMaterial, type DataTexture, type PerspectiveCamera } from "three";
import { sceneUniforms } from "@/lib/sceneUniforms";
import { mulberry32 } from "@/lib/space";
import { createSparkGeometry } from "@/lib/tendrilBuffers";
import { CURVE_SAMPLES, type TendrilDef } from "@/lib/tendrilPaths";
import { sparkFragment, sparkVertex } from "@/shaders/energyShader";

interface Props {
  tendrils: TendrilDef[];
  curves: DataTexture;
  perPulse: number;
}

/** Glowing motes that travel with the energy and shed off the cables. */
export function EnergyParticles({ tendrils, curves, perPulse }: Props) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;

  const geometry = useMemo(() => {
    const a = createSparkGeometry(tendrils, perPulse, mulberry32(77));
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(a.position, 3));
    g.setAttribute("aRow", new BufferAttribute(a.aRow, 1));
    g.setAttribute("aMotion", new BufferAttribute(a.aMotion, 4));
    g.setAttribute("aPulse", new BufferAttribute(a.aPulse, 4));
    g.setAttribute("aRange", new BufferAttribute(a.aRange, 2));
    g.setAttribute("aRand", new BufferAttribute(a.aRand, 4));
    return g;
  }, [tendrils, perPulse]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: sparkVertex,
        fragmentShader: sparkFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uCurves: { value: curves },
          uSamples: { value: CURVE_SAMPLES },
          uScale: { value: 1 },
          uTime: sceneUniforms.uTime,
          uEnergyTime: sceneUniforms.uEnergyTime,
          uEnergy: sceneUniforms.uEnergy,
          uReveal: sceneUniforms.uReveal,
          uDrag: sceneUniforms.uDrag,
          uPointer: sceneUniforms.uPointer,
          uPointerStrength: sceneUniforms.uPointerStrength,
        },
      }),
    [curves],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    // World size to pixels at unit depth.
    material.uniforms.uScale.value = gl.domElement.height / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)));
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={20} />;
}
