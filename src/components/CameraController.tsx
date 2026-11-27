"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { MathUtils, type PerspectiveCamera } from "three";
import { pointerState } from "@/hooks/useSceneAnimation";
import { sceneUniforms, shot } from "@/lib/sceneUniforms";
import { BASE_FOV, CAM_START } from "@/lib/space";

/**
 * Straight dolly along the view axis, exactly as in the reference. The pointer
 * adds parallax by moving the camera a little while it keeps facing the figure.
 */
export function CameraController() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const aspect = width / height;

  // Portrait screens would crop everything but the body, so they open the lens
  // and stop the dolly earlier to keep the horns and shoulders in frame.
  const portrait = MathUtils.clamp((1.35 - aspect) / 0.9, 0, 1);

  useEffect(() => {
    camera.fov = MathUtils.lerp(BASE_FOV, 37, portrait);
    camera.near = 0.2;
    camera.far = 60;
    camera.updateProjectionMatrix();
  }, [camera, portrait]);

  useFrame(() => {
    const push = MathUtils.clamp((CAM_START - shot.distance) / CAM_START, 0, 1);
    // Portrait holds back to keep the horns in frame, until the dive goes through him.
    const distance = shot.distance + portrait * push * 3.0 * (1 - shot.dive);
    const drift = sceneUniforms.uTime.value;
    const reach = Math.max(1, Math.abs(distance)) * 0.013;
    const x = pointerState.x * reach;
    const y = shot.targetY + pointerState.y * reach * 0.6;
    const breathe = 1 + Math.sin(drift * 0.4) * 0.0025;
    camera.position.set(shot.camX + x, y, distance * breathe);
    // Aim slightly past the figure: near tendrils slide against the fog behind.
    camera.lookAt(x * 0.25, shot.targetY + shot.aimY + (y - shot.targetY) * 0.25, shot.aimZ);
  }, -1);

  return null;
}
