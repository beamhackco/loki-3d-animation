import { commonGLSL } from "./common";
import { pulseGLSL, pulseGlowGLSL, tendrilMotionGLSL } from "./energyShader";

export const tendrilVertex = /* glsl */ `
  ${tendrilMotionGLSL}
  ${pulseGLSL}
  uniform float uEnergyTime;
  attribute float aRow;
  attribute vec4 aMotion;
  attribute vec4 aPulse;
  attribute vec2 aRange;
  attribute float aGlow;
  attribute vec4 aLook; // radius, length in world units, arc flag, back layer flag
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec2 vTube; // angle, distance along
  varying float vT;
  varying vec4 vPulse; // head, life, direction, trail
  varying vec3 vLook;  // arc, back, seed
  varying float vGlow;

  float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  vec3 hash3(float n) { return vec3(hash(n), hash(n * 1.7 + 3.1), hash(n * 2.3 + 7.9)); }

  void main() {
    float t = position.x;
    float ang = position.y;
    float e = 0.012;
    vec3 c = tendrilPoint(aRow, t, aMotion);
    vec3 c0 = tendrilPoint(aRow, t - e, aMotion);
    vec3 c1 = tendrilPoint(aRow, t + e, aMotion);

    vec3 pulse = pulseHead(aPulse, aRange, uEnergyTime);
    float radius = aLook.x * mix(0.8, 1.0, smoothstep(0.0, 0.05, t));

    // Arcs: hair-thin jagged filaments that only exist around their pulse.
    if (aLook.z > 0.5) {
      float gate = pulse.y * exp(-pow((t - pulse.x) / (aPulse.w * 1.4), 2.0));
      float tick = floor(uTime * 14.0) * 3.1 + aRow * 11.0;
      float k = t * 90.0;
      float i = floor(k);
      vec3 j = mix(hash3(i + tick), hash3(i + 1.0 + tick), fract(k)) - 0.5;
      c += j * vec3(0.035, 0.085, 0.06) * gate;
      c.z += 0.13 * gate;
      radius *= gate * step(0.02, gate);
    }

    vec3 T = normalize(c1 - c0);
    vec3 ref = abs(T.z) > 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec3 B = normalize(cross(T, ref));
    vec3 N = cross(B, T);
    vec3 n = cos(ang) * B + sin(ang) * N;

    // Knots along the strand, like a rough vine.
    float knot = max(0.0, sin(t * aLook.y * 6.5 + aMotion.y * 40.0) * sin(t * aLook.y * 2.3 + aMotion.y * 17.0));
    float swell = 1.0 + 0.1 * sin(t * 23.0 + aMotion.y * 40.0) + 0.45 * pow(knot, 6.0);
    vec3 w = c + n * radius * swell;

    vWorld = w;
    vNormalW = n;
    vTube = vec2(ang, t * aLook.y);
    vT = t;
    vGlow = aGlow;
    vPulse = vec4(pulse, aPulse.w);
    vLook = vec3(aLook.z, aLook.w, aMotion.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;

export const tendrilFragment = /* glsl */ `
  ${commonGLSL}
  ${pulseGlowGLSL}
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uHalo;
  uniform float uSurge;
  uniform float uReveal;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec2 vTube;
  varying float vT;
  varying vec4 vPulse;
  varying vec3 vLook;
  varying float vGlow;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);

    // Twisted fibre: a helical groove plus fine grain, fading with distance.
    float dist = length(cameraPosition - vWorld);
    float detail = fall(9.0, 3.2, dist) * (1.0 - vLook.y * 0.6);
    float groove = sin(vTube.x * 2.0 + vTube.y * 62.0 + vLook.z * 20.0) * 0.5 + 0.5;
    float grain = texture2D(uNoise, vec2(vTube.x * 0.35, vTube.y * 3.0 + vLook.z * 7.0)).b - 0.5;

    // Below about two pixels wide, highlights would break into dots; average them.
    float thin = smoothstep(0.55, 1.7, fwidth(vTube.x));

    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = mix(pow(1.0 - ndv, 2.4), 0.22, thin);

    // Light falls from the shafts above and behind.
    vec3 toLight = normalize(vec3(0.05, 4.4, -2.6) - vWorld);
    float wrap = clamp(dot(N, toLight) * 0.6 + 0.4, 0.0, 1.0);
    vec3 H = normalize(toLight + V);
    float spec = mix(pow(clamp(dot(N, H), 0.0, 1.0), 18.0), 0.12, thin);

    vec2 c = vWorld.xy - vec2(0.0, -0.3);
    float nearHalo = exp(-dot(c, c) * 0.55);
    float lit = mix(0.36, 1.0, nearHalo) * (0.75 + 0.25 * uHalo);

    vec3 col = lin(vec3(13.0, 18.0, 13.7)) * (0.55 + 0.9 * wrap);
    col *= mix(1.0, 0.45 + 0.9 * groove, detail) * (1.0 + grain * 0.9);
    vec3 rimCol = mix(lin(vec3(58.0, 76.0, 60.9)), lin(vec3(128.0, 160.0, 132.8)), nearHalo);
    float back = smoothstep(-0.05, 0.75, dot(N, normalize(vec3(0.0, 0.78, -0.62))));
    col += rimCol * back * (0.14 + 0.86 * fres) * lit * 2.0 * mix(1.0, 0.3 + 0.95 * groove, detail);
    col += lin(vec3(72.0, 90.0, 75.6)) * spec * wrap * lit * 0.8 * (0.5 + 0.9 * groove * detail);

    // Edges facing the column of light carry a silver line, stronger on some strands.
    vec3 inward = normalize(vec3(-vWorld.x * 0.55, 2.2 - vWorld.y * 0.4, 0.25));
    float silver = mix(pow(clamp(dot(N, inward), 0.0, 1.0), 4.0), 0.2, thin) * (0.15 + 1.1 * fract(vLook.z * 7.31));
    col += lin(vec3(94.0, 110.0, 98.7)) * silver * lit * 0.62 * mix(1.0, 0.4 + 0.8 * groove, detail);

    // Back layer hangs inside the light, so it is never fully black.
    if (vLook.y > 0.5) col += lin(vec3(17.0, 42.0, 17.9)) * 0.7;

    // Aerial perspective toward the light actually behind this point.
    vec3 bg = ramp(bgBase(backdropBehind(vWorld, cameraPosition)) * 0.92);
    float fog = 1.0 - exp(-max(0.0, -0.3 - vWorld.z) * 0.4);
    float ground = fall(-1.0, -2.0, vWorld.y) * 0.4;
    col = mix(col, bg, clamp(fog * (1.0 + 0.55 * vLook.y) + ground, 0.0, 0.8));
    // Hanging strands dissolve before their loose ends.
    if (vLook.y > 0.5) col = mix(bg * 1.1, col, smoothstep(0.0, 0.24, vT));
    col *= 1.0 - 0.25 * smoothstep(2.6, 4.8, abs(vWorld.x));

    // Emerald energy.
    float flick = 0.7 + 0.55 * texture2D(uNoise, vec2(vT * 9.0 - uTime * 0.9, uTime * 0.7 + vLook.z)).r;
    float spark = smoothstep(0.56, 0.8, texture2D(uNoise, vec2(vT * 40.0, uTime * 1.6 + vLook.z)).b);
    float I = pulseShape(vT, vPulse) * vPulse.y * uEnergy * flick;
    float core = pow(min(I, 1.0), 1.6) * (0.45 + 0.55 * ndv);
    float crackle = texture2D(uNoise, vec2(vTube.x * 0.22 + uTime * 0.13, vTube.y * 1.9 - uTime * 0.6)).a;
    vec3 energy = energyColor(I, core * (0.45 + 0.75 * smoothstep(0.3, 0.8, crackle)), spark + groove * 0.5) * (0.35 + 1.0 * smoothstep(0.25, 0.75, crackle));
    // Strands with light inside them: brightest near the grip, dying out along the length.
    float inner = vGlow * exp(-vT * 8.0) * smoothstep(0.004, 0.02, vT);
    energy += lin(vec3(72.0, 190.0, 16.0)) * inner * (0.3 + 0.7 * ndv) * (0.55 + 0.6 * crackle) * (0.22 + 0.9 * min(uEnergy, 1.0));

    if (uSurge > 0.0 && uSurge < 1.0) {
      float own = fract(vLook.z * 13.7);
      float front = mix(0.5, -0.1, uSurge) + (own - 0.5) * 0.2;
      float ds = vT - front;
      float wave = ds < 0.0 ? exp(-ds * ds * 1600.0) : exp(-ds * 13.0);
      float head = exp(-ds * ds * 2600.0);
      float gate = smoothstep(0.0, 0.16, uSurge) * (1.0 - smoothstep(0.78, 1.0, uSurge)) * mix(0.25, 1.0, own) * (1.0 - vLook.y) * flick;
      head *= gate;
      wave *= gate * (0.25 + 1.1 * smoothstep(0.3, 0.8, crackle));
      energy += energyColor(wave * 0.3, head * (0.3 + 0.7 * ndv) * (0.35 + 1.5 * smoothstep(0.35, 0.8, crackle)), spark);
    }
    if (vLook.x > 0.5) {
      col = vec3(0.0);
      energy = (vec3(0.35, 1.8, 0.25) + vec3(0.9) * core) * I * 1.4;
    }
    gl_FragColor = vec4((col + energy) * uReveal, 1.0);
  }
`;
