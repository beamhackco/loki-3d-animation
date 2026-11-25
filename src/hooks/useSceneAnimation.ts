"use client";

import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { MathUtils, type PerspectiveCamera } from "three";
import { sceneUniforms, shot } from "@/lib/sceneUniforms";
import { notifyPlayhead, prefersReducedMotion, scroll, SHOT_END, SHOT_LENGTH, SHOT_START, TRACK, WAYPOINTS } from "@/lib/scrollFilm";
import { CAM_START, sampleStops, type Stops } from "@/lib/space";
import { useSceneStore } from "@/store/sceneStore";

/**
 * Dolly measured from the reference by matching the head and shoulders across
 * 13 frames. Values are camera distance at each second.
 */
const MEASURED: Stops = [
  [0, 9.255], [0.333, 8.872], [0.667, 8.329], [1, 7.829], [1.333, 7.208], [1.667, 6.634], [2, 5.973],
  [2.333, 5.251], [2.667, 4.628], [3, 4.069], [3.333, 3.621], [3.667, 3.259], [SHOT_LENGTH, 2.999],
];
/** Last frame of the measured curve. */
const MEASURED_END = 2.999;
/** Where this figure's close-up stops: far enough back to keep both fists in frame. */
const CAM_END = 3.3;
const END_HOLD = 3.16;
const START_HOLD = 9.62;
const END_TARGET_Y = -0.17;

const measuredEase = (p: number) => (CAM_START - sampleStops(MEASURED, p * SHOT_LENGTH)) / (CAM_START - MEASURED_END);

/** Damped pointer in -1..1, read by the camera. */
export const pointerState = { x: 0, y: 0 };

/**
 * The film, on a paused GSAP timeline whose clock is the scroll track. The lead
 * in and the settle match the measured speed at both ends of the shot, so the
 * camera keeps one pace under the reader's hand.
 */
function buildFilm() {
  const tl = gsap.timeline({ paused: true, defaults: { immediateRender: false } });

  // Shore: drift toward the opening frame.
  tl.fromTo(shot, { distance: START_HOLD, targetY: 0 }, { distance: CAM_START, targetY: 0, duration: SHOT_START, ease: "power2.in" }, 0);

  // Current and Approach: the reference, one second per viewport.
  tl.to(shot, { distance: CAM_END, targetY: END_TARGET_Y, duration: SHOT_LENGTH, ease: measuredEase }, SHOT_START);
  tl.fromTo(shot, { billow: 1 }, { billow: 0, duration: 1.7, ease: "sine.inOut" }, SHOT_START + 0.15);
  tl.fromTo(shot, { energy: 0 }, { energy: 1, duration: 0.5, ease: "power1.out" }, SHOT_START + 0.72);
  tl.fromTo(shot, { halo: 0.85 }, { halo: 1.05, duration: SHOT_LENGTH, ease: "sine.inOut" }, SHOT_START);
  tl.fromTo(shot, { focus: 0 }, { focus: 1, duration: 2.6, ease: "sine.inOut" }, SHOT_START + 1.3);

  // Arrival: the camera settles and the light goes out of everything.
  tl.to(shot, { distance: END_HOLD, duration: 0.7, ease: "power2.out" }, SHOT_END);
  tl.to(shot, { energy: 0.06, duration: 0.6, ease: "sine.inOut" }, SHOT_END - 0.05);
  tl.to(shot, { halo: 0.42, duration: 0.75, ease: "sine.inOut" }, SHOT_END);

  // Then every cable lights at once and runs inward.
  tl.fromTo(shot, { surge: 0 }, { surge: 1, duration: 1.45, ease: "none" }, SHOT_END + 0.75);
  tl.to(shot, { halo: 1.4, duration: 0.5, ease: "power2.out" }, SHOT_END + 1.45);
  tl.to(shot, { halo: 1.1, duration: 0.6, ease: "sine.inOut" }, SHOT_END + 2.0);
  tl.to(shot, { energy: 1, duration: 0.5, ease: "sine.inOut" }, SHOT_END + 1.9);
  tl.set({}, {}, TRACK);
  return tl;
}

/** `?shot=2.5` freezes the film at a given second, to compare with the reference. */
function frozenShot(): number | null {
  const raw = new URLSearchParams(window.location.search).get("shot");
  const value = raw === null || raw === "" ? NaN : Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

/** Reduced motion: each leg is one still framing. */
const STILLS = [0, 2.45, 4.3, TRACK];
const legAt = (t: number) => {
  let leg = 0;
  WAYPOINTS.forEach((w, i) => {
    if (t >= w.from) leg = i;
  });
  return leg;
};

/** Scroll drives the film; pointer and idle time add life on top of it. */
export function useSceneAnimation() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const ready = useSceneStore((s) => s.ready);
  const film = useRef<gsap.core.Timeline | null>(null);
  const env = useRef<{ frozen: number | null; reduced: boolean } | null>(null);
  const pointer = useRef({ tx: 0, ty: 0, strength: 0, lastMove: -10 });
  const idle = useRef({ ambient: 0, still: 0, leg: -1 });

  useEffect(() => {
    film.current = buildFilm();
    env.current = { frozen: frozenShot(), reduced: prefersReducedMotion() };
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      if (env.current) env.current.reduced = query.matches;
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
      film.current?.kill();
      film.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Begin where the page already is, for reloads and deep links.
    scroll.t = scroll.target;
    const { setLive } = useSceneStore.getState();
    if (env.current?.frozen != null) {
      shot.reveal = 1;
      setLive();
      return;
    }
    const quick = env.current?.reduced;
    const fade = gsap.to(shot, { reveal: 1, duration: quick ? 0.6 : 2.2, ease: "sine.inOut" });
    const call = gsap.delayedCall(quick ? 0.3 : 1.2, setLive);
    return () => {
      fade.kill();
      call.kill();
    };
  }, [ready]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer.current.lastMove = performance.now() / 1000;
      pointer.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.ty = 1 - (e.clientY / window.innerHeight) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, rawDelta) => {
    const tl = film.current;
    const e = env.current;
    if (!tl || !e) return;
    const dt = Math.min(rawDelta, 1 / 20);
    let play: number;

    if (e.frozen !== null) {
      play = SHOT_START + e.frozen;
      scroll.t = play;
      sceneUniforms.uTime.value = 40 + e.frozen;
      shot.energyTime = e.frozen;
    } else {
      const before = scroll.t;
      scroll.t = e.reduced ? scroll.target : MathUtils.damp(scroll.t, scroll.target, 6.5, dt);
      if (Math.abs(scroll.target - scroll.t) < 0.0002) scroll.t = scroll.target;
      const speed = dt > 0 ? (scroll.t - before) / dt : 0;
      const wanted = e.reduced ? 0 : MathUtils.clamp(speed / 2.4, -1, 1);
      scroll.drag = MathUtils.damp(scroll.drag, wanted, wanted === 0 ? 2.6 : 5, dt);

      play = scroll.t;
      if (e.reduced) {
        const leg = legAt(scroll.t);
        if (leg !== idle.current.leg) {
          const first = idle.current.leg === -1;
          idle.current.leg = leg;
          // A short dissolve between framings, in place of the dolly.
          if (!first && ready) gsap.fromTo(shot, { reveal: 0.15 }, { reveal: 1, duration: 0.7, ease: "sine.out", overwrite: "auto" });
        }
        play = STILLS[leg];
      }

      sceneUniforms.uTime.value += dt * (e.reduced ? 0.35 : 1);

      // Energy is scrubbed by scroll. Only when the reader rests does it idle
      // forward on its own, so a continuous scroll keeps the reference's timing.
      const s = idle.current;
      s.still = Math.abs(speed) > 0.02 ? 0 : s.still + dt;
      if (play < SHOT_START + 0.6) s.ambient = 0;
      else if (s.still > 0.35) s.ambient += dt * 0.75 * Math.min(1, (s.still - 0.35) / 0.8);
      shot.energyTime = Math.max(0, play - SHOT_START) + s.ambient;

      const p = pointer.current;
      pointerState.x = MathUtils.damp(pointerState.x, e.reduced ? 0 : p.tx, 2.2, dt);
      pointerState.y = MathUtils.damp(pointerState.y, e.reduced ? 0 : p.ty, 2.2, dt);
      const moving = !e.reduced && performance.now() / 1000 - p.lastMove < 2.5;
      p.strength = MathUtils.damp(p.strength, moving ? 1 : 0, moving ? 2.5 : 0.9, dt);
      sceneUniforms.uPointerStrength.value = p.strength;
    }

    tl.time(play, true);
    if (e.reduced && play >= SHOT_END) shot.surge = 0;

    const pull = Math.abs(scroll.drag);
    sceneUniforms.uEnergyTime.value = shot.energyTime;
    sceneUniforms.uEnergy.value = shot.energy * (1 + pull * 0.45);
    sceneUniforms.uSurge.value = shot.surge;
    sceneUniforms.uDrag.value = scroll.drag;
    sceneUniforms.uBillow.value = Math.min(1, shot.billow + pull * 0.12);
    sceneUniforms.uHalo.value = shot.halo;
    sceneUniforms.uReveal.value = shot.reveal;

    // Pointer projected onto the character's plane.
    const halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    sceneUniforms.uPointer.value.set(
      pointerState.x * halfH * camera.aspect + camera.position.x,
      pointerState.y * halfH + camera.position.y,
      0,
    );
    notifyPlayhead();
  }, -2);
}
