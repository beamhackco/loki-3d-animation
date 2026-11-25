export const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  attribute vec4 aRand;
  varying float vAlpha;
  varying float vTint;

  void main() {
    vec3 p = position;
    float s = 0.04 + aRand.x * 0.06;
    // Wrapped drift keeps the volume evenly filled forever.
    p.y = mod(p.y + uTime * s + 2.5, 5.0) - 2.5;
    p.x += 0.25 * sin(uTime * 0.17 + aRand.y * 6.28) + 0.08 * sin(uTime * 0.6 + aRand.z * 6.28);
    p.z += 0.15 * sin(uTime * 0.21 + aRand.w * 6.28);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    float edge = 1.0 - smoothstep(2.0, 2.5, abs(p.y));
    float twinkle = 0.45 + 0.55 * sin(uTime * (0.5 + aRand.z) + aRand.x * 40.0);
    vAlpha = edge * twinkle * smoothstep(0.5, 1.4, depth) * (0.18 + 0.5 * aRand.w * aRand.w);
    vTint = step(0.93, aRand.y);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp((0.006 + 0.009 * aRand.z) * uScale / depth, 1.0, 9.0);
  }
`;

export const dustFragment = /* glsl */ `
  uniform float uReveal;
  varying float vAlpha;
  varying float vTint;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float d = dot(q, q);
    if (d > 1.0) discard;
    vec3 col = mix(vec3(0.26, 0.5, 0.24), vec3(0.2, 0.85, 0.1), vTint);
    gl_FragColor = vec4(col * uReveal, exp(-d * 3.0) * vAlpha * 0.55);
  }
`;
