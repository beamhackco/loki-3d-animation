"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, MathUtils, PlaneGeometry, ShaderMaterial, Vector2, type PerspectiveCamera } from "three";
import { noiseUniform, sceneUniforms } from "@/lib/sceneUniforms";
import { BACKDROP_Z, mulberry32 } from "@/lib/space";
import { dustFragment, dustVertex } from "@/shaders/dustShader";
import { backdropFragment, backdropVertex, fogFragment, fogVertex } from "@/shaders/fogShader";

interface Layer {
  z: number;
  size: [number, number];
  y: number;
  opacity: number;
  scale: number;
  lift: number;
  drift: [number, number];
  band: [number, number];
  centerBias: number;
}

/** Ordered by importance: lower tiers keep the first few. */
const LAYERS: Layer[] = [
  // Between the hanging bundles and the figure: carves the silhouette out.
  { z: -0.62, size: [11, 6], y: -1.0, opacity: 0.5, scale: 0.2, lift: 0.1, drift: [0.008, -0.003], band: [-1.35, 0.7], centerBias: 0.35 },
  // Low mist over the water.
  { z: 0.75, size: [9, 3.2], y: -1.7, opacity: 0.2, scale: 0.28, lift: -0.1, drift: [-0.012, 0.002], band: [-1.75, 0.36], centerBias: 0.2 },
  // Mid-distance banks.
  { z: -3.2, size: [24, 13], y: -1.2, opacity: 0.4, scale: 0.09, lift: 0.06, drift: [0.006, 0.002], band: [-2.1, 1.5], centerBias: 0 },
  // Smoke in the column of light.
  { z: -5.0, size: [22, 15], y: 1.0, opacity: 0.3, scale: 0.1, lift: 0.14, drift: [-0.004, -0.006], band: [1.2, 2.0], centerBias: 0.85 },
  // A breath of haze in front of the lens.
  { z: 2.1, size: [10, 6], y: -0.6, opacity: 0.05, scale: 0.18, lift: 0.0, drift: [0.014, 0.004], band: [-0.9, 1.4], centerBias: 0 },
];

function FogLayer({ layer }: { layer: Layer }) {
  const geometry = useMemo(() => new PlaneGeometry(layer.size[0], layer.size[1]), [layer]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: fogVertex,
        fragmentShader: fogFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uNoise: noiseUniform(),
          uTime: sceneUniforms.uTime,
          uReveal: sceneUniforms.uReveal,
          uOpacity: { value: layer.opacity },
          uScale: { value: layer.scale },
          uLift: { value: layer.lift },
          uDrift: { value: new Vector2(...layer.drift) },
          uBand: { value: new Vector2(...layer.band) },
          uCenterBias: { value: layer.centerBias },
        },
      }),
    [layer],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} position={[0, layer.y, layer.z]} renderOrder={10 + layer.z} />;
}

function Backdrop() {
  const geometry = useMemo(() => new PlaneGeometry(70, 34), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: backdropVertex,
        fragmentShader: backdropFragment,
        uniforms: {
          uNoise: noiseUniform(),
          uTime: sceneUniforms.uTime,
          uHalo: sceneUniforms.uHalo,
          uReveal: sceneUniforms.uReveal,
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
  return <mesh geometry={geometry} material={material} position={[0, 0, BACKDROP_Z]} renderOrder={-100} />;
}

/** Ambient motes suspended in the air, independent of the tendrils. */
function Dust({ count }: { count: number }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const geometry = useMemo(() => {
    const rand = mulberry32(991);
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos.set([(rand() - 0.5) * 8, (rand() - 0.5) * 5, rand() * 7 - 4], i * 3);
      rnd.set([rand(), rand(), rand(), rand()], i * 4);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aRand", new BufferAttribute(rnd, 4));
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uTime: sceneUniforms.uTime, uReveal: sceneUniforms.uReveal, uScale: { value: 1 } },
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    material.uniforms.uScale.value = gl.domElement.height / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)));
  });
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={18} />;
}

export function AtmosphericFog({ layers, dust }: { layers: number; dust: number }) {
  return (
    <>
      <Backdrop />
      {LAYERS.slice(0, layers).map((layer) => (
        <FogLayer key={layer.z} layer={layer} />
      ))}
      <Dust count={dust} />
    </>
  );
}
