"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { PlaneGeometry, ShaderMaterial, Vector3 } from "three";
import { noiseUniform, sceneUniforms, shot } from "@/lib/sceneUniforms";
import { FIST } from "@/lib/characterGeometry";
import { handPulses, pulseAt, type Pulse } from "@/lib/tendrilPaths";
import { fogVertex, haloFragment } from "@/shaders/fogShader";

const LEFT = FIST.L.clone().add(new Vector3(0, 0, 0.16));
const RIGHT = FIST.R.clone().add(new Vector3(0, 0, 0.16));

/** How much light is arriving in a hand right now. */
const arriving = (pulses: Pulse[], et: number) =>
  pulses.reduce((sum, pulse) => {
    const { head, life } = pulseAt(pulse, et);
    return sum + life * Math.exp(-head * 13);
  }, 0);

/**
 * Materials here are custom shaders, so "lights" are the halo card behind the
 * figure plus uniforms that tell the robe where the emerald energy is.
 */
export function CinematicLighting() {
  const geometry = useMemo(() => new PlaneGeometry(7, 7), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: fogVertex,
        fragmentShader: haloFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uNoise: noiseUniform(),
          uTime: sceneUniforms.uTime,
          uHalo: sceneUniforms.uHalo,
          uReveal: sceneUniforms.uReveal,
          uStrength: { value: 1 },
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

  const pulses = useMemo(() => ({ L: handPulses("L"), R: handPulses("R") }), []);

  useFrame(() => {
    const et = shot.energyTime;
    const power = sceneUniforms.uEnergyLightPower.value;
    const flicker = 0.85 + 0.15 * Math.sin(et * 23) * Math.sin(et * 11.3);
    sceneUniforms.uEnergyLightL.value.copy(LEFT);
    sceneUniforms.uEnergyLightR.value.copy(RIGHT);

    // The surge arrives through both fists at once.
    const hit = shot.surge > 0 ? Math.exp(-(((shot.surge - 0.8) / 0.16) ** 2)) : 0;
    const base = 0.03 * shot.energy + hit * 0.5;
    power.set((base + arriving(pulses.L, et) * 0.22 * shot.energy) * flicker, (base + arriving(pulses.R, et) * 0.22 * shot.energy) * flicker);
    sceneUniforms.uEmber.value = 0.4 + 0.55 * shot.energy + 0.8 * hit;
  });

  return <mesh geometry={geometry} material={material} position={[0, -0.55, -1.95]} renderOrder={7} />;
}
