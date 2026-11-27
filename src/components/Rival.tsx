"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { DoubleSide, MathUtils, NoColorSpace, ShaderMaterial, TextureLoader, type Group, type PerspectiveCamera } from "three";
import { pointerState } from "@/hooks/useSceneAnimation";
import { createRivalGeometry, RIVAL } from "@/lib/rivalGeometry";
import { noiseUniform, sceneUniforms, shot } from "@/lib/sceneUniforms";
import { floorY } from "@/lib/space";
import { useSceneStore } from "@/store/sceneStore";
import { rivalFragment, rivalVertex } from "@/shaders/rivalShader";

/** Soles at the surface; the boots stand in the shallow water. */
const BASE_Y = floorY(RIVAL.z) - 0.012;

/** The supplied artwork, projected onto the front of the sculpt once it arrives. */
function RivalArt({ material }: { material: ShaderMaterial }) {
  const cached = useLoader(TextureLoader, "/rival-art.webp");
  // Our own copy (sharing the image) to configure and release; the cache's stays untouched.
  const texture = useMemo(() => {
    const t = cached.clone();
    t.colorSpace = NoColorSpace;
    t.anisotropy = 4;
    return t;
  }, [cached]);
  useEffect(() => {
    material.uniforms.uArt.value = texture;
    material.uniforms.uArtOn.value = 1;
    return () => {
      material.uniforms.uArtOn.value = 0;
      material.uniforms.uArt.value = null;
      texture.dispose();
    };
  }, [material, texture]);
  return null;
}

/** A failed artwork request leaves the rival in the shader's untextured look instead of failing the scene. */
class ArtBoundary extends Component<{ children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("Rival artwork failed to load; drawing the plain sculpt.", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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
      {/* Loads in the background: he only appears near the end of the film. */}
      <ArtBoundary>
        <Suspense fallback={null}>
          <RivalArt material={material} />
        </Suspense>
      </ArtBoundary>
    </group>
  );
}
