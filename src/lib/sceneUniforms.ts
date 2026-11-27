import { Vector2, Vector3 } from "three";
import { getNoiseTexture } from "./noiseTexture";

/**
 * Values shared by every shader. They are mutated once per frame in
 * useSceneAnimation and never pass through React, so nothing re-renders.
 */
export const sceneUniforms = {
  uTime: { value: 0 },
  /** Seconds since the current push-in began; drives energy pulses. */
  uEnergyTime: { value: 0 },
  uEnergy: { value: 0 },
  /** 1: the robe's train is caught by wind (opening). 0: it has settled. */
  uBillow: { value: 1 },
  uHalo: { value: 1 },
  /** Progress of the wave that lights every cable at the end of the track. */
  uSurge: { value: 0 },
  /** Damped scroll speed, -1..1; cables lag behind the camera. */
  uDrag: { value: 0 },
  /** 0 to 1 scene fade used by the intro. */
  uReveal: { value: 0 },
  uPointer: { value: new Vector3(0, 0, 0) },
  uPointerStrength: { value: 0 },
  /** Pulse closest to the body on each side, lighting the robe. */
  uEnergyLightL: { value: new Vector3(-1, -0.5, 0.2) },
  uEnergyLightR: { value: new Vector3(1, -0.5, 0.2) },
  uEnergyLightPower: { value: new Vector2(0, 0) },
  /** Emerald glow at the heart of the coat. */
  uEmber: { value: 0.3 },
  /** The rival condensing out of the mist, 0 to 1. */
  uRival: { value: 0 },
  uRivalEyes: { value: 0 },
  /** The rival's leg: the light gathers behind it and the place goes dark. */
  uDark: { value: 0 },
};

export const noiseUniform = () => ({ value: getNoiseTexture() });

/** Animated by GSAP. Plain numbers only. */
export const shot = {
  distance: 9.62,
  targetY: 0,
  energy: 0,
  energyTime: 0,
  billow: 1,
  halo: 0.85,
  surge: 0,
  reveal: 0,
  /** Depth-of-field strength, 0 to 1. */
  focus: 0,
  /** Focus pulled from the figure (0) to the rival (1). */
  rack: 0,
  /** Where the camera aims: height above targetY, and depth. */
  aimY: 0,
  aimZ: -1.5,
  /** 0 to 1 as the camera dives through the figure; drops the portrait set-back. */
  dive: 0,
  /** Sideways camera offset while it keeps aiming at the rival: a slow arc around it. */
  camX: 0,
  rival: 0,
  rivalEyes: 0,
  dark: 0,
};
