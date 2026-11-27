"use client";

import "@/lib/threeConsole";
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoToneMapping } from "three";
import { useResponsiveQuality } from "@/hooks/useResponsiveQuality";
import { useSceneAnimation } from "@/hooks/useSceneAnimation";
import { getNoiseTexture } from "@/lib/noiseTexture";
import { BASE_FOV } from "@/lib/space";
import { createCurveTexture } from "@/lib/tendrilBuffers";
import { createTendrils } from "@/lib/tendrilPaths";
import { useSceneStore } from "@/store/sceneStore";
import { AtmosphericFog } from "./AtmosphericFog";
import { CameraController } from "./CameraController";
import { Character } from "./Character";
import { CinematicLighting } from "./CinematicLighting";
import { EnergyParticles } from "./EnergyParticles";
import { PostEffects } from "./PostEffects";
import { Rival } from "./Rival";
import { Tendrils } from "./Tendrils";
import { WaterFloor } from "./WaterFloor";

/** Compiles every shader up front, then reports ready after warm-up frames. */
function Preloader() {
  const { gl, scene, camera } = useThree();
  const compiled = useRef(false);
  const frames = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const { setProgress } = useSceneStore.getState();
    setProgress(0.6);
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        compiled.current = true;
        setProgress(0.85);
      });
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera]);

  useFrame(() => {
    if (compiled.current && frames.current < 4 && ++frames.current === 4) useSceneStore.getState().setReady();
  });
  return null;
}

/** Keeps the shared noise crisp where it's seen at a grazing angle, like the water floor. */
function NoiseAnisotropy({ level }: { level: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const tex = getNoiseTexture();
    const anisotropy = Math.min(level, gl.capabilities.getMaxAnisotropy());
    if (tex.anisotropy === anisotropy) return;
    tex.anisotropy = anisotropy;
    tex.needsUpdate = true;
  }, [gl, level]);
  return null;
}

function World() {
  const settings = useResponsiveQuality();
  useSceneAnimation();

  const tendrils = useMemo(() => createTendrils(settings.tendrilDensity), [settings.tendrilDensity]);
  const curves = useMemo(() => createCurveTexture(tendrils), [tendrils]);
  useEffect(() => () => curves.dispose(), [curves]);

  return (
    <>
      <NoiseAnisotropy level={settings.anisotropy} />
      <CameraController />
      <AtmosphericFog layers={settings.fogLayers} dust={settings.dust} />
      <WaterFloor />
      <CinematicLighting />
      <Tendrils tendrils={tendrils} curves={curves} segments={settings.tubeSegments} sides={settings.tubeSides} />
      <Character />
      <Rival />
      <EnergyParticles tendrils={tendrils} curves={curves} perPulse={settings.sparks} />
      <PostEffects settings={settings} />
      <Preloader />
    </>
  );
}

const LOWER = { high: "medium", medium: "low", low: "low" } as const;

export default function Scene() {
  const settings = useResponsiveQuality();
  const ready = useSceneStore((s) => s.ready);
  const integrated = useSceneStore((s) => s.integrated);
  const [scale, setScale] = useState(1);
  const declines = useRef(0);

  // Resolution drops first; only a sustained decline lowers the tier.
  const onDecline = ({ fps }: { fps: number }) => {
    // A covered window is throttled to about 1 fps; that says nothing about the GPU.
    if (document.hidden || fps < 4) return;
    declines.current += 1;
    if (declines.current >= 3) {
      declines.current = 0;
      const { quality, setQuality } = useSceneStore.getState();
      setQuality(LOWER[quality]);
    } else {
      setScale((s) => Math.max(0.6, s - 0.18));
    }
  };

  return (
    <Canvas
      className="!absolute inset-0"
      // The stage is fixed; re-measuring it on every scroll event would be wasted layout.
      resize={{ scroll: false }}
      dpr={integrated ? Math.max(0.5, 0.76 * scale) : [scale, Math.max(0.75, settings.maxDpr * scale)]}
      camera={{ fov: BASE_FOV, near: 0.2, far: 60, position: [0, 0, 9.62] }}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance", toneMapping: NoToneMapping }}
      onCreated={({ gl }) => {
        gl.setClearColor("#020803", 1);
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          useSceneStore.getState().setFailed();
        });
      }}
    >
      {ready && <PerformanceMonitor ms={300} iterations={8} threshold={0.75} bounds={() => [40, 58]} onDecline={onDecline} />}
      <World />
    </Canvas>
  );
}
