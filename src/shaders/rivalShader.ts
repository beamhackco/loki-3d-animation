import { RIVAL, RIVAL_PART } from "@/lib/rivalGeometry";
import { commonGLSL } from "./common";

const f = (n: number) => n.toFixed(5);
/** Local units per pixel of the traced image, and its axis and soles. */
const PX = RIVAL.height / (1293 - 84);

export const rivalVertex = /* glsl */ `
  uniform float uTime;
  uniform float uHeadYaw;
  uniform float uPresence;
  attribute float aPart;
  attribute vec3 aBillow; // motion weights: head turn, breath, cloth
  attribute vec2 aShade;  // fold, flutter
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormalW;
  varying vec3 vNormalL;
  varying float vPart;
  varying float vFold;
  varying float vCloth;

  vec2 turn(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
  }

  void main() {
    vec3 p = position;
    vec3 n = normal;
    float head = aBillow.x;
    float breath = aBillow.y;
    float cloth = aBillow.z;

    // Slow, heavy breathing in the chest and shoulders.
    float b = sin(uTime * 0.75);
    p.y += breath * 0.006 * b;
    p.xz *= 1.0 + breath * 0.007 * b;

    // The head turns to keep the camera in its slit.
    float yaw = uHeadYaw * head;
    p.xz = turn(p.xz, yaw);
    n.xz = turn(n.xz, yaw);

    // Wind in the cloak, strongest at the hem; a gust while it is still forming.
    float gust = 1.0 + 2.2 * (1.0 - uPresence);
    float around = atan(p.x, p.z);
    p.x += cloth * gust * 0.028 * sin(uTime * 1.15 + p.y * 3.6 + around * 3.0);
    p.z += cloth * gust * (0.04 * sin(uTime * 0.95 + p.y * 2.8 + around * 5.0) - 0.02);

    vec4 w = modelMatrix * vec4(p, 1.0);
    vLocal = position;
    vWorld = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * n);
    vNormalL = normal;
    vPart = aPart;
    vFold = aShade.x;
    vCloth = cloth;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

export const rivalFragment = /* glsl */ `
  ${commonGLSL}
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uHalo;
  uniform float uReveal;
  uniform float uPresence;
  uniform float uEyes;
  uniform float uDark;
  uniform sampler2D uArt;
  uniform float uArtOn;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormalW;
  varying vec3 vNormalL;
  varying float vPart;
  varying float vFold;
  varying float vCloth;

  bool is(float part, float id) { return abs(part - id) < 0.5; }

  void main() {
    // Condenses out of the water mist from the ground up.
    float h = vLocal.y / ${f(RIVAL.height)};
    float wisp = texture2D(uNoise, vLocal.xy * vec2(2.4, 1.6) + vec2(0.0, -uTime * 0.05)).a;
    float m = h * 0.8 + (wisp - 0.5) * 0.24 + 0.1;
    float front = uPresence * 1.2 - 0.06;
    if (m > front) discard;
    float forming = 1.0 - smoothstep(0.0, 0.05, front - m);

    float part = floor(vPart + 0.5);
    bool cloth = is(part, ${f(RIVAL_PART.cloth)});
    // Pixel of the traced image, for painted detail on the mask and plate.
    vec2 img = vec2(455.0 + vLocal.x / ${f(PX)}, 1293.0 - vLocal.y / ${f(PX)});
    vec4 art = texture2D(uArt, vec2(img.x / 888.0, 1.0 - img.y / 1309.0));
    // The cloth is trimmed to the artwork's outline where it faces the camera.
    if (cloth && uArtOn > 0.5 && art.a < 0.25 && vNormalL.z > -0.3) discard;
    bool under = is(part, ${f(RIVAL_PART.under)});
    bool obsidian = is(part, ${f(RIVAL_PART.obsidian)});
    bool steel = is(part, ${f(RIVAL_PART.steel)});
    bool visor = is(part, ${f(RIVAL_PART.visor)});
    bool shadow = is(part, ${f(RIVAL_PART.shadow)});
    bool glossy = obsidian || visor;

    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vNormalW);
    // The cloak is a single sheet: its inside shows through the open front.
    bool inside = cloth && dot(N, V) < 0.0;
    if (inside) N = -N;

    vec2 q = vLocal.xy;
    float grain = texture2D(uNoise, q * 5.0 + vLocal.z).b - 0.5;
    float coarse = texture2D(uNoise, q * 1.4).r - 0.5;
    if (cloth) N = normalize(N + vec3(grain * 0.16 + coarse * 0.22, grain * 0.12, 0.0));
    else if (steel || visor) N = normalize(N + vec3(grain, -grain, 0.0) * 0.05);
    if (under) {
      // Chainmail: rows of rings catching light on their tops.
      float rings = sin(img.x * 1.6 + floor(img.y * 0.4) * 1.57) * sin(img.y * 1.25);
      N = normalize(N + vec3(rings * 0.25, rings * 0.45, 0.0));
    }
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float ao = mix(0.45, 1.15, clamp(vFold * 0.5 + 0.5, 0.0, 1.0));

    // Light: the shaft behind him, and a cold key from the side the camera came in.
    vec2 behind = backdropBehind(vWorld, cameraPosition);
    vec3 bg = ramp(bgBase(behind) * 0.62 * gather(behind, uDark));
    vec3 K = normalize(vec3(-0.5, 0.62, 0.6));
    float key = clamp(dot(N, K), 0.0, 1.0);
    float up = clamp(N.y * 0.7 + 0.3, 0.0, 1.0);
    float rim = pow(1.0 - ndv, 3.6) * clamp(abs(N.x) * 0.6 + up, 0.0, 1.0);
    vec3 R = reflect(-V, N);
    vec3 env = mix(lin(vec3(6.0, 9.0, 7.0)), bg, smoothstep(-0.25, 0.75, R.y) * smoothstep(-0.2, 0.8, -R.z * 0.6 + R.y));

    vec3 col;
    if (steel || visor) {
      // Polished steel: the green light mirrored in it, hard highlights from the key.
      float spec = pow(max(dot(R, K), 0.0), 40.0);
      float sheen = pow(max(dot(R, K), 0.0), 8.0);
      // Steel mirrors the room but stays steel: most of the green drains out of it.
      vec3 grey = vec3(dot(env, vec3(0.2126, 0.7152, 0.0722)));
      vec3 chrome = mix(env, grey * 1.15, 0.7);
      float fresnel = 0.35 + 0.65 * pow(1.0 - ndv, 2.0);
      col = lin(vec3(82.0, 88.0, 86.0)) * (0.16 + 0.95 * key * key) * ao;
      col += chrome * fresnel * 0.9 * ao;
      col += lin(vec3(236.0, 242.0, 238.0)) * (spec * 1.6 + sheen * 0.16);
      if (visor) col *= 1.25;
    } else if (glossy) {
      // Black enamel: belt, greaves and boots.
      float spec = pow(max(dot(R, K), 0.0), 60.0);
      col = lin(vec3(5.0, 7.0, 6.0)) * (0.5 + 0.6 * key) + env * (0.04 + 0.45 * pow(1.0 - ndv, 4.0));
      col += lin(vec3(190.0, 214.0, 196.0)) * spec * 1.1;
    } else if (under) {
      col = lin(vec3(52.0, 56.0, 54.0)) * (0.2 + 0.9 * key) * ao + env * 0.1;
      col += lin(vec3(170.0, 178.0, 172.0)) * pow(max(dot(R, K), 0.0), 12.0) * 0.5;
    } else {
      // Heavy green wool, lighter on the crests of the folds.
      vec3 wool = mix(lin(vec3(6.0, 15.0, 9.0)), lin(vec3(20.0, 46.0, 28.0)), smoothstep(-0.25, 0.4, coarse + grain * 0.4));
      col = wool * (0.3 + 0.9 * key) * ao;
      if (inside) col *= 0.3;
    }
    col += bg * 1.6 * rim * (0.55 + 0.45 * uHalo) * mix(0.6, 1.0, ao) * (glossy ? 1.2 : 1.0);

    // The mask: dark eye sockets, a mouth slot, rivets along the brow.
    vec3 red = lin(vec3(255.0, 52.0, 20.0));
    float flick = 0.88 + 0.12 * sin(uTime * 6.3) * sin(uTime * 2.9);
    if (visor) {
      vec2 eye = vec2((abs(img.x - 455.0) - 26.0) / 12.0, (img.y - 165.0) / 5.0);
      float socket = 1.0 - smoothstep(0.75, 1.15, length(eye));
      // Bent down at the ends: seen from below, a straight slot on a curved mask reads as a smile.
      float mouth = exp(-pow((img.y - 211.0 - 7.0 * pow((img.x - 455.0) / 26.0, 2.0)) / 1.6, 2.0)) * (1.0 - smoothstep(22.0, 27.0, abs(img.x - 455.0)));
      float vents = exp(-pow((abs(img.x - 455.0) - 33.0) / 1.4, 2.0)) * smoothstep(186.0, 192.0, img.y) * (1.0 - smoothstep(222.0, 228.0, img.y));
      float rivets = exp(-pow((img.y - 151.0) / 1.4, 2.0)) * smoothstep(0.55, 0.85, sin(img.x * 1.3)) * step(10.0, abs(img.x - 455.0)) * step(abs(img.x - 455.0), 36.0);
      col *= 1.0 - 0.92 * socket - 0.8 * mouth - 0.6 * vents - 0.6 * rivets;
    }
    if (steel && img.y > 430.0 && img.y < 522.0 && abs(img.x - 455.0) < 85.0) {
      // Engraved squares, each with a diamond in it.
      vec2 cell = (img - vec2(455.0, 430.0)) / 44.0;
      vec2 g = abs(fract(cell) - 0.5);
      float frame = smoothstep(0.42, 0.47, max(g.x, g.y));
      float diamond = 1.0 - smoothstep(0.02, 0.045, abs(g.x + g.y - 0.26));
      col *= 1.0 - 0.55 * frame;
      col += lin(vec3(120.0, 130.0, 122.0)) * diamond * (0.15 + 0.5 * key);
    }

    // Inside the hood, around the mask: no light reaches.
    if (shadow) col = lin(vec3(2.0, 3.5, 2.5));
    if (cloth && uArtOn < 0.5) col *= 1.0 - 0.8 * (1.0 - smoothstep(52.0, 70.0, abs(img.x - 455.0))) * smoothstep(104.0, 120.0, img.y) * (1.0 - smoothstep(262.0, 280.0, img.y));

    // The supplied artwork, projected straight on from the front, onto every
    // surface: from where the camera looks, each one shows what the image has at
    // that pixel, the insides of sleeves and the cloak's lining included. It carries the
    // painted detail and its own studio light; the sculpt adds the room's green
    // rim light and live glints on the steel as the camera moves.
    float onArt = uArtOn * smoothstep(0.3, 0.75, art.a);
    vec3 painted = pow(art.rgb, vec3(2.2)) * vec3(0.9, 1.05, 0.93) * (0.95 + 0.3 * key);
    if (steel || visor) painted += lin(vec3(236.0, 242.0, 238.0)) * pow(max(dot(R, K), 0.0), 40.0) * 0.35;
    painted += bg * (cloth ? 0.7 : 1.1) * rim * (0.55 + 0.45 * uHalo);
    col = mix(col, painted, onArt);

    // Behind the eye holes something wakes when the camera comes close.
    if (visor) {
      vec2 eye = vec2((abs(img.x - 455.0) - 26.0) / 12.0, (img.y - 165.0) / 5.0);
      float socket = 1.0 - smoothstep(0.75, 1.15, length(eye));
      col += red * socket * (0.04 + 1.6 * uEyes) * flick * (1.0 - smoothstep(0.0, 1.0, length(eye)) * 0.5);
    }

    // Mist at the feet, and while it is still forming.
    float haze = 0.03 + (1.0 - uPresence) * 0.4;
    col = mix(col, bg, clamp(haze, 0.0, 0.9));
    // Where it stands in the water the light can't reach: the boots sink into dark.
    float wet = 1.0 - smoothstep(0.0, 0.12, vLocal.y);
    col *= 1.0 - 0.6 * wet;

    // The forming edge burns emerald, like the cables.
    col += lin(vec3(70.0, 200.0, 80.0)) * forming * forming * 0.6 * step(0.001, 1.0 - uPresence);

    gl_FragColor = vec4(col * uReveal, 1.0);
  }
`;
