"use client";

import { useSceneStore } from "@/store/sceneStore";

/** A single hairline fills while geometry builds and shaders compile. */
export function LoadingScreen() {
  const progress = useSceneStore((s) => s.progress);
  const ready = useSceneStore((s) => s.ready);

  return (
    <div
      className={`fixed inset-0 z-20 grid place-items-center bg-abyss transition-opacity duration-700 ease-out ${ready ? "pointer-events-none opacity-0" : "opacity-100"}`}
      aria-hidden={ready}
    >
      <div
        role="progressbar"
        aria-label="Loading scene"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-px w-40 overflow-hidden bg-mist/15"
      >
        <div className="h-full origin-left bg-mist transition-transform duration-500 ease-out" style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
      </div>
    </div>
  );
}
