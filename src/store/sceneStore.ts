import { create } from "zustand";

export type Quality = "high" | "medium" | "low";

interface SceneState {
  /** Loading progress, 0 to 1, advanced by real setup stages. */
  progress: number;
  /** Shaders compiled and first frames drawn. */
  ready: boolean;
  /** Intro veil has lifted; the interface may appear. */
  live: boolean;
  failed: boolean;
  quality: Quality;
  /** Integrated graphics: render below native resolution from the start. */
  integrated: boolean;
  /** The GPU probe passed and set quality and integrated; the scene may mount. */
  gpuReady: boolean;
  setProgress: (value: number) => void;
  setReady: () => void;
  setLive: () => void;
  setFailed: () => void;
  setQuality: (quality: Quality) => void;
  configureGpu: (gpu: { integrated: boolean; quality: Quality }) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  progress: 0,
  ready: false,
  live: false,
  failed: false,
  quality: "high",
  integrated: false,
  gpuReady: false,
  setProgress: (value) => set((s) => ({ progress: Math.max(s.progress, value) })),
  setReady: () => set({ ready: true, progress: 1 }),
  setLive: () => set({ live: true }),
  setFailed: () => set({ failed: true }),
  setQuality: (quality) => set({ quality }),
  configureGpu: ({ integrated, quality }) =>
    set((s) => ({ integrated, quality, gpuReady: true, progress: Math.max(s.progress, 0.2) })),
}));
