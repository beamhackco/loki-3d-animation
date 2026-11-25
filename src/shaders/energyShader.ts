/**
 * Energy pulses. A pulse is (start, period, duration, trail) plus the part of
 * the tendril it runs along. The same function positions the glow on tubes,
 * the sparks, and (mirrored in lib/tendrilPaths) the light on the robe.
 */
export const pulseGLSL = /* glsl */ `
  // returns vec3(head position 0..1 along the curve, intensity, direction)
  vec3 pulseHead(vec4 pulse, vec2 range, float et) {
    if (pulse.y <= 0.0 || et < pulse.x) return vec3(0.0);
    float k = mod(et - pulse.x, pulse.y) / pulse.z;
    if (k > 1.0) return vec3(0.0);
    float head = mix(range.x, range.y, k);
    float life = smoothstep(0.0, 0.1, k) * (1.0 - smoothstep(0.86, 1.0, k));
    return vec3(head, life, sign(range.y - range.x));
  }
`;

/** Emerald glow of a pulse at curve position t. */
export const pulseGlowGLSL = /* glsl */ `
  // pulse: head, life, direction, trail
  float pulseShape(float t, vec4 pulse) {
    float d = (t - pulse.x) * pulse.z;
    float trail = max(pulse.w, 1e-3);
    return d < 0.0 ? exp(d / trail * 2.2) : exp(-d * d / (trail * trail * 0.03));
  }

  vec3 energyColor(float I, float core, float spark) {
    vec3 c = vec3(0.035, 0.46, 0.03) * I * (0.7 + 0.6 * spark);
    c += vec3(0.42, 1.8, 0.3) * core;
    c += vec3(1.4, 2.3, 1.5) * pow(core, 3.0) * 0.8;
    return c;
  }
`;

/** Curve lookup and procedural motion, shared by tubes and sparks. */
export const tendrilMotionGLSL = /* glsl */ `
  uniform sampler2D uCurves;
  uniform float uSamples;
  uniform float uTime;
  uniform vec3 uPointer;
  uniform float uPointerStrength;

  vec3 curveRaw(float row, float t) {
    float x = clamp(t, 0.0, 1.0) * (uSamples - 1.0);
    float i = min(floor(x), uSamples - 2.0);
    int r = int(row + 0.5);
    vec3 a = texelFetch(uCurves, ivec2(int(i), r), 0).xyz;
    vec3 b = texelFetch(uCurves, ivec2(int(i) + 1, r), 0).xyz;
    return mix(a, b, x - i);
  }

  uniform float uDrag;

  // motion: group seed, own seed, group amplitude, own amplitude
  vec3 tendrilPoint(float row, float t, vec4 motion) {
    vec3 p = curveRaw(row, t);
    float w = smoothstep(0.01, 0.4, t) * (1.0 - 0.35 * smoothstep(0.75, 1.0, t));
    float g = motion.x * 6.2831;
    float s = motion.y * 6.2831;
    vec3 primary = vec3(
      sin(uTime * 0.46 + g - t * 2.6),
      sin(uTime * 0.38 + g * 1.7 - t * 2.2),
      sin(uTime * 0.31 + g * 2.3 - t * 3.1)
    );
    vec3 secondary = vec3(
      sin(uTime * 0.83 + s - t * 6.3) + 0.4 * sin(uTime * 1.57 + s * 2.1 - t * 13.0),
      sin(uTime * 0.71 + s * 1.9 - t * 5.4) + 0.4 * sin(uTime * 1.33 + s * 1.3 - t * 11.0),
      sin(uTime * 0.62 + s * 2.7 - t * 4.1)
    );
    p += w * (primary * motion.z + secondary * motion.w);

    // Scrolling moves the camera; the cables follow late, the far ends latest.
    vec2 away = p.xy + vec2(0.0, 0.35);
    float lag = uDrag * w * (0.4 + 0.6 * sin(t * 3.0 + s));
    p.xy += away / (length(away) + 0.6) * lag * 0.085;
    p.y -= abs(uDrag) * w * 0.03;

    // Tendrils lean away from the pointer.
    vec2 d = p.xy - uPointer.xy;
    float f = exp(-dot(d, d) * 2.2) * uPointerStrength * w;
    p.xy += d / (length(d) + 0.25) * f * 0.085;
    p.z += f * 0.06;
    return p;
  }
`;

export const sparkVertex = /* glsl */ `
  ${tendrilMotionGLSL}
  ${pulseGLSL}
  uniform float uEnergyTime;
  uniform float uEnergy;
  uniform float uScale;
  attribute float aRow;
  attribute vec4 aMotion;
  attribute vec4 aPulse;
  attribute vec2 aRange;
  attribute vec4 aRand;
  varying float vAlpha;
  varying float vHot;

  void main() {
    vec3 pulse = pulseHead(aPulse, aRange, uEnergyTime);
    // aRand.x: place in the trail; a few run slightly ahead of the head.
    float lag = (aRand.x * aRand.x * 1.5 - 0.06) * aPulse.w;
    float t = clamp(pulse.x - pulse.z * lag, 0.0, 1.0);
    vec3 p = tendrilPoint(aRow, t, aMotion);
    float life = fract(uTime * (0.35 + aRand.w * 0.5) + aRand.y * 7.0);
    float a = aRand.y * 6.2831;
    float r = 0.008 + (0.01 + 0.07 * aRand.z * aRand.z) * life;
    p += vec3(cos(a) * r, sin(a) * r + life * 0.035, abs(cos(a * 3.0)) * r + 0.02);
    vAlpha = pulse.y * uEnergy * sin(life * 3.1416) * (1.0 - 0.6 * aRand.x);
    vHot = 1.0 - aRand.x;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = vAlpha > 0.003 ? clamp((0.004 + 0.009 * aRand.w * aRand.w) * uScale / -mv.z, 1.0, 12.0) : 0.0;
  }
`;

export const sparkFragment = /* glsl */ `
  uniform float uReveal;
  varying float vAlpha;
  varying float vHot;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float d = dot(q, q);
    if (d > 1.0) discard;
    float g = exp(-d * 4.0);
    vec3 col = mix(vec3(0.08, 0.85, 0.06), vec3(0.9, 2.1, 0.7), vHot * g);
    gl_FragColor = vec4(col * uReveal, g * vAlpha);
  }
`;
