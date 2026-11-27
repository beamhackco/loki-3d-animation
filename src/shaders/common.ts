import { BACKDROP_Z, CAM_START } from "@/lib/space";

/**
 * Palette and lighting functions shared by all materials. Colors were sampled
 * from the reference frames; intensity is authored perceptually (0..1) and
 * mapped through one ramp so every layer stays inside the same grade.
 */
export const commonGLSL = /* glsl */ `
  // Descending smoothstep; reversed smoothstep edges are undefined in GLSL.
  float fall(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }

  const float CAM_START = ${CAM_START.toFixed(4)};
  const float BACKDROP_Z = ${BACKDROP_Z.toFixed(4)};

  vec3 lin(vec3 c) { return pow(c / 255.0, vec3(2.2)); }

  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.4);
    vec3 c = mix(vec3(2.0, 5.0, 2.0), vec3(12.0, 27.0, 11.0), smoothstep(0.0, 0.16, t));
    c = mix(c, vec3(29.0, 63.0, 28.0), smoothstep(0.14, 0.36, t));
    c = mix(c, vec3(62.0, 124.0, 58.0), smoothstep(0.34, 0.57, t));
    c = mix(c, vec3(104.0, 192.0, 98.0), smoothstep(0.54, 0.74, t));
    c = mix(c, vec3(148.0, 224.0, 142.0), smoothstep(0.72, 0.9, t));
    c = mix(c, vec3(202.0, 241.0, 198.0), smoothstep(0.88, 1.3, t));
    return lin(c);
  }

  // Reference-frame pixel of a point on the backdrop plane.
  vec2 backdropPx(vec2 xy) {
    float k = 100.0 / (1.0 - BACKDROP_Z / CAM_START);
    return vec2(433.0 + xy.x * k, 248.0 - xy.y * k);
  }

  // Backdrop pixel seen behind a world-space point from the current camera.
  vec2 backdropBehind(vec3 p, vec3 cam) {
    float s = (BACKDROP_Z - cam.z) / min(p.z - cam.z, -0.01);
    return backdropPx(cam.xy + (p.xy - cam.xy) * s);
  }

  float gauss(float x, float s) { return exp(-(x * x) / (s * s)); }

  // Smooth part of the background light, without rays or noise.
  float bgBase(vec2 p) {
    float dx = p.x - 436.0;
    float y = clamp(p.y, -80.0, 520.0);
    float column = gauss(dx, 150.0 + y * 0.06) * mix(0.42, 0.26, smoothstep(0.0, 400.0, y));
    float top = gauss(dx, 122.0) * gauss(y + 20.0, 110.0) * 0.34;
    float band = gauss(y - 372.0, 92.0) * (0.15 + 0.2 * gauss(dx, 230.0));
    float wide = 0.22 * gauss(dx, 360.0);
    return 0.085 + column + top + band + wide;
  }

  // The rival's leg (dark = 1): the light gathers into one shaft behind it and
  // the rest of the place falls away. Multiplies a backdrop intensity.
  float gather(vec2 p, float dark) {
    float dx = p.x - 436.0;
    float shaft = gauss(dx, 62.0) * (0.55 + 0.45 * smoothstep(150.0, 430.0, p.y));
    return mix(1.0, 0.14 + 1.05 * shaft + 0.22 * gauss(dx, 180.0), dark);
  }
`;
