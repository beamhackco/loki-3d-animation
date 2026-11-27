"use client";

import { useEffect, useMemo } from "react";
import { DoubleSide, IcosahedronGeometry, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, Vector3 } from "three";
import { noiseUniform, sceneUniforms } from "@/lib/sceneUniforms";
import { FLOOR_SLOPE, FLOOR_Y, floorY } from "@/lib/space";
import { waterFragment, waterVertex } from "@/shaders/waterShader";

const ROCKS: ReadonlyArray<{ x: number; z: number; scale: [number, number, number]; seed: number }> = [
  { x: -0.61, z: 5.75, scale: [0.14, 0.062, 0.12], seed: 1.3 },
  { x: 0.4, z: 5.6, scale: [0.075, 0.032, 0.07], seed: 4.1 },
  { x: 0.3, z: 5.62, scale: [0.1, 0.012, 0.05], seed: 2.2 },
];

function rockGeometry(seed: number) {
  const g = new IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 2) * Math.sin(v.z * 3.3 + seed * 3);
    v.multiplyScalar(1 + n * 0.25 + 0.06 * Math.sin(v.x * 11 + v.z * 9));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/** Black reflective water and the stones that break its surface. */
export function WaterFloor() {
  const geometry = useMemo(() => new PlaneGeometry(40, 48), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        side: DoubleSide,
        // Writes depth so mist sheets are cut where they meet the surface.
        transparent: true,
        uniforms: {
          uNoise: noiseUniform(),
          uTime: sceneUniforms.uTime,
          uHalo: sceneUniforms.uHalo,
          uReveal: sceneUniforms.uReveal,
          uDark: sceneUniforms.uDark,
          uRival: sceneUniforms.uRival,
        },
      }),
    [],
  );
  const rocks = useMemo(() => ROCKS.map((r) => rockGeometry(r.seed)), []);
  const rockMaterial = useMemo(() => new MeshBasicMaterial({ color: "#030903" }), []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      rockMaterial.dispose();
      rocks.forEach((r) => r.dispose());
    },
    [geometry, material, rockMaterial, rocks],
  );

  return (
    <>
      <mesh geometry={geometry} material={material} position={[0, floorY(-8), -8]} rotation={[-Math.PI / 2 - Math.atan(FLOOR_SLOPE), 0, 0]} renderOrder={-50} />
      {ROCKS.map((r, i) => (
        <mesh key={r.seed} geometry={rocks[i]} material={rockMaterial} position={[r.x, FLOOR_Y + FLOOR_SLOPE * r.z, r.z]} scale={r.scale} rotation={[0, r.seed, 0]} />
      ))}
    </>
  );
}
