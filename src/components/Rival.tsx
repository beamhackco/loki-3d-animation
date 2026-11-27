"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, MathUtils, NoColorSpace, ShaderMaterial, TextureLoader, type Group, type PerspectiveCamera } from "three";
import { pointerState } from "@/hooks/useSceneAnimation";
import { createRivalGeometry, RIVAL } from "@/lib/rivalGeometry";
import { noiseUniform, sceneUniforms, shot } from "@/lib/sceneUniforms";
import { floorY } from "@/lib/space";
import { useSceneStore } from "@/store/sceneStore";
import { rivalFragment, rivalVertex } from "@/shaders/rivalShader";

/** Soles at the surface; the boots stand in the shallow water. */
const BASE_Y = floorY(RIVAL.z) - 0.012;

/** The rival, across the water beyond Loki, facing him. One mesh, one draw call. */
export function Rival() {
  const group = useRef<Group>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const geometry = useMemo(createRivalGeometry, []);
  const yaw = useRef(0);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: rivalVertex,
        fragmentShader: rivalFragment,
        side: DoubleSide,
        uniforms: {
          uNoise: noiseUniform(),
          uTime: sceneUniforms.uTime,
          uHalo: sceneUniforms.uHalo,
          uReveal: sceneUniforms.uReveal,
          uPresence: sceneUniforms.uRival,
          uEyes: sceneUniforms.uRivalEyes,
          uDark: sceneUniforms.uDark,
          uHeadYaw: { value: 0 },
          uArt: { value: null },
          uArtOn: { value: 0 },
        },
      }),
    [],
  );
  // The supplied artwork, projected onto the front of the sculpt. Loads in the
  // background: he only appears near the end of the film.
  useEffect(() => {
    let live = true;
    new TextureLoader().load("/rival-art.webp", (t) => {
      if (!live) return t.dispose();
      t.colorSpace = NoColorSpace;
      t.anisotropy = 4;
      material.uniforms.uArt.value = t;
      material.uniforms.uArtOn.value = 1;
    });
    return () => {
      live = false;
      material.uniforms.uArt.value?.dispose();
    };
  }, [material]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, delta) => {
    // Stays in the scene until the shaders are compiled, then only draws once it starts to form.
    if (group.current && useSceneStore.getState().ready) group.current.visible = shot.rival > 0.001;
    // The head follows the camera, a beat behind it, with a little of the pointer.
    const toCamera = Math.atan2(camera.position.x - RIVAL.x, camera.position.z - RIVAL.z);
    const want = MathUtils.clamp(toCamera * 0.9 + pointerState.x * 0.06, -0.5, 0.5);
    yaw.current = MathUtils.damp(yaw.current, want, 1.6, Math.min(delta, 0.05));
    material.uniforms.uHeadYaw.value = yaw.current;
  });

  return (
    <group ref={group} position={[RIVAL.x, BASE_Y, RIVAL.z]}>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
