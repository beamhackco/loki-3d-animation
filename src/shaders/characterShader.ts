import { commonGLSL } from "./common";

export const characterVertex = /* glsl */ `
  uniform float uTime;
  uniform float uBillow;
  attribute float aPart;
  attribute vec3 aBillow;
  attribute vec2 aShade; // fold, flutter
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormalW;
  varying float vPart;
  varying float vFold;

  void main() {
    vec3 p = position + aBillow * uBillow;

    // Cloth moves in slow traveling waves; stronger while the wind is up.
    float gust = mix(0.35, 1.0, uBillow);
    p += aShade.y * gust * vec3(
      sin(uTime * 1.9 + p.y * 5.0 + p.x * 3.0),
      0.6 * sin(uTime * 1.6 + p.x * 6.0),
      1.2 * sin(uTime * 2.1 + p.x * 7.0 + p.y * 4.0)
    );

    // A breath, felt only in the chest and shoulders.
    float chest = smoothstep(-0.95, -0.4, p.y) * (1.0 - smoothstep(-0.3, -0.18, p.y));
    p.xz *= 1.0 + chest * 0.006 * sin(uTime * 0.9);

    vLocal = position;
    vWorld = p;
    vNormalW = normal;
    vPart = aPart;
    vFold = aShade.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const characterFragment = /* glsl */ `
  ${commonGLSL}
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uHalo;
  uniform float uReveal;
  uniform vec3 uEnergyLightL;
  uniform vec3 uEnergyLightR;
  uniform vec2 uEnergyLightPower;
  uniform float uEmber;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormalW;
  varying float vPart;
  varying float vFold;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);
    float part = floor(vPart + 0.5);
    bool sheet = part > 4.5;
    if (sheet && dot(N, V) < 0.0) N = -N;
    bool fabric = part < 0.5 || sheet;
    bool horn = part > 0.5 && part < 1.5;

    float dist = cameraPosition.z - vWorld.z;
    float detail = fall(7.5, 3.2, dist);

    // Surface grain, projected from the front.
    vec2 q = vLocal.xy;
    float coarse = texture2D(uNoise, q * 1.4).r - 0.5;
    float grain = texture2D(uNoise, q * 5.0).b - 0.5;
    float weave = 0.0;
    if (fabric) {
      weave = sin(q.x * 620.0 + coarse * 14.0) * sin(q.y * 620.0 + coarse * 14.0);
      N = normalize(N + vec3(grain * 0.16 + coarse * 0.2, grain * 0.16 - coarse * 0.16, 0.0) * (0.2 + 0.35 * detail));
    } else if (horn) {
      N = normalize(N + vec3(grain * 0.12) * detail);
    } else {
      N = normalize(N + vec3(grain, -grain, 0.0) * 0.2 * detail);
    }

    // Calm highlights where the normal turns faster than the pixel grid.
    float calm = 1.0 - 0.85 * smoothstep(0.3, 1.1, length(fwidth(vNormalW)));
    float ndv = clamp(dot(N, V), 0.0, 1.0);

    // Backlight: wraps around every edge that faces up or outward.
    float rimShape = pow(1.0 - ndv, 2.6);
    vec2 hc = (vWorld.xy - vec2(0.0, 0.02)) / vec2(0.95, 1.5);
    float halo = exp(-dot(hc, hc));
    float up = clamp(N.y * 0.75 + 0.25, 0.0, 1.0);
    float outward = clamp(abs(N.x) * 0.5 + up, 0.0, 1.0);
    vec3 rimCol = mix(lin(vec3(52.0, 98.0, 54.6)), lin(vec3(176.0, 214.0, 175.7)), halo);
    float rim = rimShape * outward * mix(0.16, 1.1, up * up) * mix(0.4, 1.0, halo);

    float ao = mix(0.38, 1.2, clamp(vFold * 0.5 + 0.5, 0.0, 1.0));

    // A hairline of near-white where the silhouette meets the light.
    float edge = pow(1.0 - ndv, 7.0) * (0.35 + 0.65 * up) * (0.3 + 0.7 * halo) * smoothstep(-0.5, -0.1, N.y + abs(N.x) * 0.4);

    // Surfaces turning over toward the light behind them.
    float over = smoothstep(0.02, 0.72, dot(N, normalize(vec3(sign(N.x) * 0.22, 0.74, -0.62))));
    float turn = over * (0.03 + 0.97 * pow(1.0 - ndv, 2.9)) * mix(0.55, 1.0, ao);

    // Light spilling down from the shafts onto upward-facing cloth.
    float top = pow(clamp(N.y, 0.0, 1.0), 2.2) * smoothstep(-0.55, 0.05, vWorld.y);
    // Faint scattered light from the mist in front.
    float fill = clamp(dot(N, normalize(vec3(-0.35, 0.55, 0.75))), 0.0, 1.0);

    vec3 base = lin(vec3(6.0, 11.5, 6.3));
    if (horn) base = lin(vec3(7.0, 12.5, 7.4));

    vec3 col = base * (0.42 + 0.5 * fill) * ao;
    float clothUp = fabric ? 1.0 : 0.6;
    col += lin(vec3(12.0, 20.0, 12.6)) * top * ao * clothUp * (0.6 + grain * 0.3 + weave * 0.08 * detail);
    col += lin(vec3(13.0, 21.0, 13.7)) * pow(fill, 2.2) * ao * ao * (fabric ? 0.55 : 0.25) * smoothstep(-1.3, -0.1, vWorld.y);

    float sheen = pow(1.0 - ndv, 1.6) * up;
    col += lin(vec3(48.0, 70.0, 50.4)) * sheen * ao * 0.09 * (fabric ? 1.0 : 0.5) * smoothstep(-0.9, 0.0, vWorld.y);

    // The hands take enough light to read as the backs of hands.
    if (part > 2.5 && part < 3.5) {
      vec3 hl = normalize(vec3(-0.5, 0.62, 0.6));
      float hk = clamp(dot(N, hl), 0.0, 1.0);
      float hs = clamp(dot(N, normalize(hl + V)), 0.0, 1.0);
      // Fades in from the wrist, so the hand grows out of the dark sleeve.
      float reach = smoothstep(0.0, 0.07, vLocal.x < 0.0 ? -vLocal.x - 0.635 : vLocal.x - 0.56);
      col += reach * (lin(vec3(18.0, 30.0, 17.0)) * (0.25 + 0.9 * hk * hk) + lin(vec3(92.0, 138.0, 88.0)) * pow(hs, 10.0) * 0.18);
    }

    // The cap catches a little of the light above it; the rest of the head is a void.
    if (horn) {
      float cap = smoothstep(0.045, 0.125, vLocal.y) * fall(0.12, 0.06, abs(vLocal.x));
      col += lin(vec3(30.0, 62.0, 28.8)) * cap * (0.25 + 0.75 * clamp(N.y, 0.0, 1.0)) * uHalo * 0.6;
    }

    col += rimCol * calm * (rim * 0.16 + edge * 0.85 + turn * 0.05) * smoothstep(-1.15, -0.35, vWorld.y) * (0.65 + 0.35 * uHalo) * (0.95 + grain * 0.3);

    // Emerald spill from energy running along the cables.
    vec3 dl = uEnergyLightL - vWorld;
    vec3 dr = uEnergyLightR - vWorld;
    float el = uEnergyLightPower.x * exp(-dot(dl, dl) * 11.0) * clamp(dot(N, normalize(dl)) * 0.6 + 0.4, 0.0, 1.0);
    float er = uEnergyLightPower.y * exp(-dot(dr, dr) * 11.0) * clamp(dot(N, normalize(dr)) * 0.6 + 0.4, 0.0, 1.0);
    col += vec3(0.006, 0.085, 0.006) * (el + er) * (0.5 + 0.5 * ao);

    // Black at the shoulders, thinning to deep green toward the hem.
    float low = fall(-0.55, -1.75, vWorld.y);
    vec3 bg = ramp(bgBase(backdropBehind(vWorld, cameraPosition)) * 0.62);
    float mist = low * (0.1 + 0.2 * texture2D(uNoise, vWorld.xy * 0.35 + vec2(uTime * 0.01, 0.0)).g);
    mist += 0.012 * smoothstep(2.5, 9.0, dist);
    if (sheet) mist += 0.4;
    col = mix(col, bg, mist);

    // Emerald ember behind the coat, above the stride.
    vec2 em = (vWorld.xy - vec2(0.0, -1.545)) / vec2(0.21, 0.2);
    float ember = exp(-dot(em, em)) * uEmber * (0.85 + 0.15 * sin(uTime * 0.9));
    col += lin(vec3(38.0, 158.0, 38.0)) * ember * (0.8 + 0.4 * grain);

    gl_FragColor = vec4(col * uReveal, 1.0);
  }
`;
