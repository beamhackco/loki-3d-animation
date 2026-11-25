"use client";

import { useEffect, useMemo } from "react";
import { DoubleSide, ShaderMaterial } from "three";
import { createCharacterGeometry } from "@/lib/characterGeometry";
import { noiseUniform, sceneUniforms } from "@/lib/sceneUniforms";
import { characterFragment, characterVertex } from "@/shaders/characterShader";

/** The horned, robed figure: one procedural mesh, one draw call. */
export function Character() {
  const geometry = useMemo(createCharacterGeometry, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: characterVertex,
        fragmentShader: characterFragment,
        side: DoubleSide,
        uniforms: {
          uNoise: noiseUniform(),
          uTime: sceneUniforms.uTime,
          uBillow: sceneUniforms.uBillow,
          uHalo: sceneUniforms.uHalo,
          uReveal: sceneUniforms.uReveal,
          uEnergyLightL: sceneUniforms.uEnergyLightL,
          uEnergyLightR: sceneUniforms.uEnergyLightR,
          uEnergyLightPower: sceneUniforms.uEnergyLightPower,
          uEmber: sceneUniforms.uEmber,
        },
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
