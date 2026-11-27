"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, type ReactNode } from "react";
import { detectQuality, isIntegratedGpu } from "@/lib/gpuTier";
import { bindTrack, TRACK } from "@/lib/scrollFilm";
import { useSceneStore } from "@/store/sceneStore";
import { LoadingScreen } from "./LoadingScreen";
import { StaticFallback } from "./StaticFallback";
import { WebsiteUI } from "./WebsiteUI";

// The 3D bundle only loads once we know it can run.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

/** null when the scene can't run; otherwise what kind of GPU will run it. */
function probeGpu(): { integrated: boolean } | null {
  if (new URLSearchParams(window.location.search).has("nowebgl")) return null;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return null;
    // Tendril curves are read in the vertex shader.
    const ok = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0;
    const integrated = isIntegratedGpu(gl);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return ok ? { integrated } : null;
  } catch {
    return null;
  }
}

class SceneBoundary extends Component<{ children: ReactNode }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch() {
    useSceneStore.getState().setFailed();
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}

export function Experience() {
  const failed = useSceneStore((s) => s.failed);
  const canRender = useSceneStore((s) => s.gpuReady);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => (track.current ? bindTrack(track.current) : undefined), [failed]);

  useEffect(() => {
    const store = useSceneStore.getState();
    const gpu = probeGpu();
    if (!gpu) {
      store.setFailed();
      return;
    }
    store.configureGpu({ integrated: gpu.integrated, quality: detectQuality(gpu.integrated) });
  }, []);

  if (failed) return <StaticFallback />;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 h-lvh" role="img" aria-label="A two-horned figure in a long coat, seen from behind, gripping fans of black cable in both fists against green light. At the end, the view passes through the figure to a hooded rival in a steel mask and green cloak, arms crossed, standing in the water facing it.">
        {canRender && (
          <SceneBoundary>
            <Scene />
          </SceneBoundary>
        )}
      </div>
      <WebsiteUI />
      <LoadingScreen />
      {/* The only thing in document flow: scroll distance. */}
      <div ref={track} aria-hidden="true" style={{ height: `calc(${TRACK + 1} * 100svh)` }} />
    </>
  );
}
