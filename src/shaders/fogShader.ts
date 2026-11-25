import { commonGLSL } from "./common";

export const backdropVertex = /* glsl */ `
  ${commonGLSL}
  varying vec2 vPx;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPx = backdropPx(w.xy);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/** Light shafts as a function of slope from a source above the frame. */
export const shaftGLSL = /* glsl */ `
  float beam(float u, float c, float w) { float d = (u - c) / w; return exp(-d * d); }

  float shafts(vec2 p, sampler2D noise, float time) {
    vec2 s = vec2(437.0, -140.0);
    float h = max(p.y - s.y, 20.0);
    float u = (p.x - s.x) / h;
    float down = max(p.y / 496.0, 0.0);

    // Fine streaks drift slowly in angle, so the light breathes.
    float n1 = texture2D(noise, vec2(u * 1.5 + time * 0.004, time * 0.006)).r;
    float n2 = texture2D(noise, vec2(u * 4.1 - time * 0.006, 0.37 + time * 0.005)).g;
    float streak = smoothstep(0.28, 0.82, n1) * 0.6 + smoothstep(0.3, 0.8, n2) * 0.4;

    float core = beam(u, -0.02, 0.46);
    float central = core * 0.5 * streak * exp(-down * 1.55);
    central += (beam(u, -0.27, 0.05) * 0.2 + beam(u, -0.05, 0.04) * 0.2 + beam(u, 0.11, 0.035) * 0.22
      + beam(u, 0.27, 0.05) * 0.16) * exp(-down * 1.5);

    float breathe = 0.85 + 0.15 * sin(time * 0.35);
    float side = beam(u, -0.66, 0.085) * 0.4 * breathe
      + beam(u, -0.47, 0.05) * 0.14
      + beam(u, 0.53, 0.1) * 0.36 * (1.7 - breathe)
      + beam(u, -1.02, 0.16) * 0.16
      + beam(u, 0.9, 0.15) * 0.13
      + beam(u, -1.55, 0.22) * 0.07
      + beam(u, 1.45, 0.22) * 0.06;
    side *= exp(-down * 1.0) * (0.55 + 0.8 * n2);
    return central + side;
  }
`;

export const backdropFragment = /* glsl */ `
  ${commonGLSL}
  ${shaftGLSL}
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uHalo;
  uniform float uReveal;
  varying vec2 vPx;

  void main() {
    vec2 p = vPx;
    float I = bgBase(p);

    // Large drifting cloud structure, domain-warped.
    vec2 q = p / 760.0;
    vec2 warp = texture2D(uNoise, q * 0.7 + vec2(uTime * 0.004, -uTime * 0.003)).rg - 0.5;
    float cloud = texture2D(uNoise, q + warp * 0.35 + vec2(-uTime * 0.005, uTime * 0.002)).g;
    float cloud2 = texture2D(uNoise, q * 2.3 + warp * 0.5 + vec2(uTime * 0.008, 0.0)).r;
    float density = mix(cloud, cloud2, 0.35);
    I *= 0.66 + 0.68 * density;

    // Wisp of smoke climbing diagonally through the light column.
    vec2 w = p - vec2(440.0, 130.0);
    float along = dot(w, vec2(0.751, -0.661));
    float across = dot(w, vec2(0.661, 0.751));
    vec2 sq = p / 330.0 + warp * 0.55 + vec2(-uTime * 0.006, uTime * 0.011);
    float wisp = texture2D(uNoise, sq).a * 0.6 + texture2D(uNoise, sq * 2.1 + 0.3).a * 0.4;
    I += smoothstep(0.5, 0.86, wisp) * gauss(along, 150.0) * gauss(across, 62.0) * 0.22;

    I += shafts(p, uNoise, uTime) * 0.95;

    // Corners fall to black.
    float ex = (p.x - 436.0) / 470.0;
    I *= 1.0 - 0.3 * smoothstep(0.45, 1.2, ex * ex);
    I *= mix(0.86, 1.0, uHalo) * smoothstep(0.0, 1.0, uReveal);
    // Only the silence before the surge goes below 0.85.
    I *= mix(0.6, 1.0, smoothstep(0.4, 0.85, uHalo));

    // Dither hides banding in the long dark gradients.
    float d = texture2D(uNoise, gl_FragCoord.xy / 97.0).b - 0.5;
    gl_FragColor = vec4(ramp(I + d * 0.012), 1.0);
  }
`;

export const fogVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/** A drifting sheet of mist, lit by whatever light sits behind it. */
export const fogFragment = /* glsl */ `
  ${commonGLSL}
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uScale;
  uniform float uLift;
  uniform vec2 uDrift;
  uniform vec2 uBand; // center and half-height of the mist, world units
  uniform float uCenterBias;
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    vec2 q = vWorld.xy * uScale + uDrift * uTime;
    vec2 warp = texture2D(uNoise, q * 0.6 + uTime * 0.0035).rg - 0.5;
    float a = texture2D(uNoise, q + warp * 0.42).r;
    float b = texture2D(uNoise, q * 2.1 - warp * 0.3 + uDrift * uTime * 0.7).g;
    float d = smoothstep(0.32, 0.86, a * 0.65 + b * 0.4);

    float band = gauss(vWorld.y - uBand.x, uBand.y);
    float bias = mix(1.0, gauss(vWorld.x, 2.4), uCenterBias);
    float edge = smoothstep(0.0, 0.2, vUv.x) * fall(1.0, 0.8, vUv.x)
      * smoothstep(0.0, 0.2, vUv.y) * fall(1.0, 0.8, vUv.y);

    // Thin out as the camera approaches, so it never flies through a wall.
    float near = smoothstep(0.35, 1.9, cameraPosition.z - vWorld.z);

    vec2 p = backdropBehind(vWorld, cameraPosition);
    float I = bgBase(p) * 0.85 + uLift;
    gl_FragColor = vec4(ramp(I), d * band * bias * edge * near * uOpacity * uReveal);
  }
`;

export const haloFragment = /* glsl */ `
  ${commonGLSL}
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uHalo;
  uniform float uReveal;
  uniform float uStrength;
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    vec2 p = vWorld.xy;
    vec2 q = p * 0.16;
    vec2 warp = texture2D(uNoise, q + vec2(0.0, -uTime * 0.005)).rg - 0.5;
    float n = texture2D(uNoise, q * 1.7 + warp * 0.4 + vec2(uTime * 0.004, 0.0)).g;

    // Upper glow behind the shoulders, lower glow between the robe and floor.
    vec2 a = (p - vec2(0.0, 0.1)) / vec2(1.2, 1.0);
    vec2 b = (p - vec2(0.02, -1.42)) / vec2(0.98, 0.74);
    vec2 c = (p - vec2(0.0, -0.4)) / vec2(2.0, 1.75);
    float g = exp(-dot(a, a)) * 0.72 + exp(-dot(b, b)) * 0.2 + exp(-dot(c, c)) * 0.3;
    vec2 h = (p - vec2(0.02, 0.72)) / vec2(0.72, 0.75);
    g += exp(-dot(h, h)) * 0.26;
    g *= 0.7 + 0.6 * n;
    g *= uHalo * uReveal * uStrength;

    vec2 e = vUv * 2.0 - 1.0;
    g *= fall(1.0, 0.6, length(e));
    vec3 col = mix(lin(vec3(92.0, 178.0, 86.0)), lin(vec3(198.0, 240.0, 194.0)), smoothstep(0.2, 0.9, g));
    gl_FragColor = vec4(col, clamp(g, 0.0, 0.97));
  }
`;
