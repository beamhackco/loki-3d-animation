import { RIVAL } from "@/lib/rivalGeometry";
import { FLOOR_SLOPE, FLOOR_Y } from "@/lib/space";
import { commonGLSL } from "./common";
import { shaftGLSL } from "./fogShader";

export const waterVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/**
 * Black water. Reflections are traced analytically against the backdrop, the
 * halo and the robe's silhouette, which costs far less than a mirror pass.
 */
export const waterFragment = /* glsl */ `
  ${commonGLSL}
  ${shaftGLSL}
  const float FLOOR_Y = ${FLOOR_Y.toFixed(4)};
  const float FLOOR_SLOPE = ${FLOOR_SLOPE.toFixed(5)};
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uHalo;
  uniform float uReveal;
  uniform float uDark;
  uniform float uRival;
  varying vec3 vWorld;

  const vec3 RIVAL_AT = vec3(${RIVAL.x.toFixed(4)}, ${(FLOOR_Y + FLOOR_SLOPE * RIVAL.z).toFixed(4)}, ${RIVAL.z.toFixed(4)});

  // The rival's silhouette by height above its soles: boots, cloak, hood.
  float rivalHalfWidth(float y) {
    if (y < 0.0) return 0.0;
    if (y < 0.42) return 0.4;
    if (y < 1.8) return mix(0.55, 0.44, smoothstep(0.42, 1.8, y));
    if (y < 2.08) return mix(0.44, 0.22, smoothstep(1.8, 2.08, y));
    return 0.17 * (1.0 - smoothstep(2.12, 2.45, y));
  }

  // Rings spreading from where something stands in the water.
  float rings(vec2 at, float t, float phase) {
    float d = length((vWorld.xz - at) * vec2(1.0, 1.6));
    return max(0.0, sin(d * 48.0 - t * 2.6 + phase)) * exp(-d * 5.0) * smoothstep(0.015, 0.05, d);
  }

  float robeHalfWidth(float y) {
    return mix(0.36, 0.62, fall(-0.6, -1.3, y));
  }

  void main() {
    vec3 up = normalize(vec3(0.0, 1.0, -FLOOR_SLOPE));
    vec3 toP = vWorld - cameraPosition;
    float dist = length(toP);
    vec3 view = toP / dist;

    // Slow ripples, stretched across the line of sight.
    vec2 q = vec2(vWorld.x * 0.5, vWorld.z * 0.16);
    float r1 = texture2D(uNoise, q * vec2(0.5, 1.6) + vec2(uTime * 0.01, uTime * 0.016)).r - 0.5;
    float r2 = texture2D(uNoise, q * vec2(1.6, 5.0) + vec2(-uTime * 0.02, uTime * 0.03)).g - 0.5;
    float r3 = texture2D(uNoise, q * vec2(3.0, 14.0) + vec2(uTime * 0.03, uTime * 0.05)).b - 0.5;
    float calm = exp(-dist * 0.04);
    vec3 n = normalize(up + vec3(r1 * 0.05 + r2 * 0.05, 0.0, (r1 * 0.05 + r2 * 0.08 + r3 * 0.05)) * calm);

    vec3 R = reflect(view, n);
    R.y = abs(R.y) + 0.002;

    // Backdrop.
    vec3 hit = vWorld + R * ((BACKDROP_Z - vWorld.z) / min(R.z, -0.02));
    vec2 p = backdropPx(hit.xy);
    p.y = clamp(p.y, -100.0, 470.0);
    float I = bgBase(p) * 0.6 + shafts(p, uNoise, uTime) * 0.3;

    // Halo plane.
    vec3 hh = vWorld + R * ((-1.6 - vWorld.z) / min(R.z, -0.02));
    vec2 b = (hh.xy - vec2(0.02, -1.5)) / vec2(0.75, 0.62);
    I += exp(-dot(b, b)) * 0.5 * uHalo * step(vWorld.z, 30.0) * step(-1.6, vWorld.z);

    // The figure's own reflection blocks the light.
    vec3 hc = vWorld + R * ((0.0 - vWorld.z) / min(R.z, -0.02));
    float w = robeHalfWidth(hc.y);
    float robe = fall(w + 0.07, w - 0.05, abs(hc.x + 0.02 + r2 * 0.1)) * step(0.0, vWorld.z);
    // Below the hem only the legs block it.
    float legs = max(gauss(hc.x + 0.26, 0.1), gauss(hc.x - 0.26, 0.1));
    robe *= mix(legs, 1.0, smoothstep(-1.86, -1.68, hc.y));
    I *= 1.0 - robe * 0.92;
    // Light slipping past the hem breaks up on the surface either side.
    float gap = gauss(abs(hc.x - 0.02) - w - 0.1, 0.2) * smoothstep(0.0, 1.0, vWorld.z);
    I += gap * smoothstep(-0.12, 0.2, r2 + r3 * 0.8) * 0.42 * uHalo;
    I *= gather(p, uDark);

    // The rival, once it stands there: its reflection blocks the light, it
    // shades the water around its feet, and rings spread from both boots.
    float ripple = 0.0;
    if (uRival > 0.0) {
      if (vWorld.z > RIVAL_AT.z) {
        vec3 hr = vWorld + R * ((RIVAL_AT.z - vWorld.z) / min(R.z, -0.02));
        float wr = rivalHalfWidth(hr.y - RIVAL_AT.y);
        I *= 1.0 - 0.88 * uRival * fall(wr + 0.05, wr - 0.04, abs(hr.x - RIVAL_AT.x + r2 * 0.06));
      }
      vec2 dc = (vWorld.xz - RIVAL_AT.xz - vec2(0.0, 0.08)) / vec2(0.8, 0.55);
      I *= 1.0 - 0.75 * uRival * exp(-dot(dc, dc) * 2.2);
      ripple = 0.8 * rings(RIVAL_AT.xz + vec2(-0.32, 0.09), uTime, 1.7) + 0.8 * rings(RIVAL_AT.xz + vec2(0.31, 0.09), uTime, 3.9);
      ripple *= uRival;
    }

    float fres = 0.12 + 0.88 * pow(1.0 - clamp(dot(-view, up), 0.0, 1.0), 4.0);
    float nearDark = smoothstep(2.2, 8.5, dist);
    float bright = 0.075 + I * fres * mix(0.8, 1.0, nearDark) * (0.78 + 0.6 * r1 + 1.3 * r3 * calm);
    vec3 col = ramp(bright * 0.9);

    // Thin crests catch the light.
    float crest = smoothstep(0.2, 0.36, r3 + r2 * 0.5) * calm * fall(1.2, 0.2, abs(vWorld.x) * 0.5);
    col += lin(vec3(52.0, 82.0, 54.6)) * crest * 0.35 * nearDark;

    col += lin(vec3(96.0, 150.0, 98.0)) * ripple * 0.2;

    // Dissolve into the mist long before the plane ends.
    float far = smoothstep(2.6, 13.0, dist);
    vec3 bg = ramp(bgBase(backdropBehind(vWorld, cameraPosition)) * 0.72);
    col = mix(col, bg, far);
    float edge = fall(15.2, 9.6, dist);
    col *= 1.0 - 0.5 * smoothstep(2.0, 5.5, abs(vWorld.x));
    gl_FragColor = vec4(col * uReveal, edge);
  }
`;
