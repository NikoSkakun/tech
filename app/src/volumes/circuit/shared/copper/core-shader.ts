/**
 * The copper of the wire core. At depth 0 it is the stand's own wire, colour for colour (core.ts holds the
 * values measured on the stand's hand-over frame): three soft bands and the lamp's soft glints — the dissolve
 * from the stand must not show. On the way down the solid metal «розсипається на рівні ряди кульок» in four
 * calm stages: (1) lighter dots appear in the metal, at the true places of the lattice behind; (2) the metal
 * between them sinks into the dark and the dots become coral balls — still a flat picture; the real atoms and
 * electrons then come in in front of it (copper.ts); (3) the flat picture opens between the balls and the
 * depth behind shows; (4) it is gone. The dots are drawn where the line of sight meets the planes of the real
 * atoms, so the flat balls and the real ones coincide on screen.
 */
import { ATOM_R, PITCH, PLANE_GAP } from './layout';

export const CORE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;   // position in the frame of the copper world (before the dive's scaling of the lattice)
varying float vAlong; // along the wire, in the core's own units (they grow with it)
uniform mat4 uToCopper;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = (uToCopper * w).xyz;
  vN = normalize(normal);
  vAlong = position.x;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const K = (PITCH / ATOM_R).toFixed(4);

export const CORE_FRAG = /* glsl */ `
uniform mat4 projectionMatrix;
uniform mat4 uFromCopper;
uniform vec3 uEye;       // the camera in the frame of the copper world
// metal: the upper edge, lit, half-tone, shade, glint — each [handed over · lamp off, on; inside · lamp off, on]
uniform vec3 uTop[4];
uniform vec3 uLit[4];
uniform vec3 uMid[4];
uniform vec3 uShade[4];
uniform vec3 uGlint[4];
uniform vec3 uRim[4];   // the very top edge, where the stand's rim light shows
uniform float uWarmth; // 0 = as handed over by the stand … 1 = inside
uniform vec3 uAtom;
uniform vec3 uAtomShade;
uniform vec3 uDeep;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uLamp;
uniform float uDots;   // 0…1 dots showing in the metal
uniform float uBalls;  // 0…1 metal → balls in the dark
uniform float uOpen;   // 0…1 the flat picture opens between the balls
uniform float uPitch;  // lattice pitch, in copper-world units
uniform float uRadius; // radius of the core as it is now (it grows with the dive), copper-world units
uniform float uFade;
uniform float uRelief; // strength of the surface's lines and mottle (± share of the metal's brightness)
uniform float uKTime;
varying vec3 vN;
varying vec3 vP;
varying float vAlong;

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

vec3 pick(vec3 c[4], float lamp, float w) { return mix(mix(c[0], c[1], lamp), mix(c[2], c[3], lamp), w); }

// where the line of sight through this fragment meets the plane z = const of the copper world
vec3 onPlane(float z) {
  vec3 d = vP - uEye;
  return uEye + d * ((z - uEye.z) / d.z);
}

// one plane of the lattice as discs shaded like the atoms: lit cap, shaded underside
vec4 plane(vec2 cellPos, float fw, vec3 L, float soft) {
  vec2 c = fract(cellPos + 0.5) - 0.5;
  float r = length(c) * ${K};
  float mask = 1.0 - smoothstep(1.0 - max(2.5 * fw, soft), 1.0, r);
  vec3 n = vec3(c * ${K}, sqrt(max(1.0 - r * r, 0.0)));
  vec3 col = mix(uAtomShade, uAtom, smoothstep(-0.45, 0.4, n.y));
  // the same two-band light as the real atoms: lit from above, the underside in indigo shade
  col *= mix(vec3(0.42, 0.4, 0.74), vec3(1.0), smoothstep(-0.1, 0.14, dot(n, L)));
  return vec4(col, mask);
}

float hash1(float p) { return fract(sin(p * 127.1 + 11.3) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise1(float t) {
  float i = floor(t);
  float f = fract(t);
  return mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f));
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + 1.0), f.x), f.y);
}

// The drawn metal's own surface, fixed to it and so growing with the dive: lengthwise lines left by the die the
// wire was drawn through (each runs on along the wire, drifting a little), over a faint mottle. Periods in lattice
// cells (su: along the wire, around it); an octave shows only while its period is a few pixels or more
// (fp = cells per pixel), so it never shimmers, and the coarser ones carry on as the zoom grows — the reader sees
// the metal come closer.
float surface(vec2 su, float fp) {
  float v = 0.0;
  for (int i = 0; i < 4; i++) {
    float period = 1.6 * pow(2.7, float(i));
    float k = smoothstep(2.5, 7.0, period / fp);
    float drift = vnoise(vec2(su.x / (period * 45.0), float(i) * 7.3)) * 1.4;
    v += k * (vnoise1(su.y / period + drift + float(i) * 17.3) - 0.5);
  }
  float mottle = vnoise(su / 4.5 + 41.0) - 0.5;
  v += smoothstep(2.5, 7.0, 4.5 / fp) * mottle * 0.6;
  return v * 0.5; // about −0.5 … 0.5
}

// a soft elliptical glint of the stand's lamp: centre along the wire and in n.y, half-sizes, strength
float glint(float x, float ny, vec4 e, float strength) {
  vec2 q = vec2((x - e.x) / e.z, (ny - e.y) / e.w);
  return strength * (1.0 - smoothstep(0.55, 1.0, dot(q, q)));
}

void main() {
  float dither = ign(gl_FragCoord.xy + fract(uKTime) * 37.0) * 0.998 + 0.001;
  if (uFade < 0.999 && uFade <= dither) discard;
  vec3 n = normalize(vN);
  float lamp = clamp(uLamp, 0.0, 1.0);
  // Two measured looks of the same wire (core.ts): «as handed over» — under the stand's own light at the moment
  // of the dissolve, a lit top third over dark red-brown — and «inside», under the light of this floor, a
  // brighter three-band copper. uWarmth goes from the first to the second as the dive leaves the stand.
  float w = uWarmth;
  float lit = smoothstep(mix(0.19, -0.12, w), mix(0.29, 0.36, w), n.y);
  float shade = 1.0 - smoothstep(mix(-0.13, -0.45, w), mix(-0.04, -0.35, w), n.y);
  vec3 metal = mix(pick(uMid, lamp, w), pick(uLit, lamp, w), lit);
  metal = mix(metal, pick(uTop, lamp, w), smoothstep(0.22, 0.95, n.y));
  metal = mix(metal, pick(uShade, lamp, w), shade);
  metal = mix(metal, pick(uRim, lamp, w), smoothstep(0.7, 0.97, n.y));
  // the lamp's soft glints (and, inside, the room's cool one far left); they breathe a little
  float breathe = 0.94 + 0.06 * sin(uKTime * 1.3);
  float handed = lamp * (glint(vAlong, n.y, vec4(3.9, 0.72, 1.7, 0.05), 0.8)
                       + glint(vAlong, n.y, vec4(-1.3, 0.62, 2.6, 0.04), 0.3));
  float inside = lamp * (glint(vAlong, n.y, vec4(5.05, 0.5, 2.9, 0.075), 1.0)
                       + glint(vAlong, n.y, vec4(7.4, 0.72, 1.5, 0.05), 0.9)
                       + glint(vAlong, n.y, vec4(1.2, 0.63, 2.2, 0.04), 0.3))
               + (1.0 - lamp) * glint(vAlong, n.y, vec4(-6.4, 0.5, 3.6, 0.05), 0.8);
  metal = mix(metal, pick(uGlint, lamp, w), min(mix(handed, inside, w) * breathe, 1.0));
  // the lattice: the focal plane and, in its gaps, the plane behind it — each where the eye will find it
  vec3 L = normalize(vec3(mix(-0.4, 0.42, lamp), 0.82, 0.5));
  vec3 lightCol = mix(vec3(0.62, 0.74, 0.98) * 0.78, vec3(1.0, 0.96, 0.86), lamp);
  float s = uPitch / ${PITCH.toFixed(4)};
  vec2 cell0 = onPlane(0.0).xy / uPitch;
  vec2 cell1 = onPlane(-${PLANE_GAP.toFixed(4)} * s).xy / uPitch + 0.5;
  float fw = max(fwidth(cell0.x), fwidth(cell0.y)) * ${K};
  vec4 front = plane(cell0, fw, L, 0.0);
  vec4 back = plane(cell1, fw, L, 0.3 * uBalls); // the plane behind is out of focus once it is a plane
  // too small to be told apart (a phone, the first moment): plain metal
  float seen = uDots * smoothstep(0.7, 0.35, fw);
  // the surface of the metal (lines and mottle): it comes in with the dissolve from the stand's plain wire
  vec2 su = vec2(vP.x, atan(n.y, n.z) * uRadius) / uPitch;
  float relief = uFade * uFade * uRelief; // the balls (stage 2) take the metal away, and its surface with it
  metal *= 1.0 + relief * surface(su, max(fwidth(su.y), 1e-4));
  // stage 1: in the metal — lighter dots, the plane behind as a fainter print
  vec3 inMetal = mix(metal * 0.82, metal * 0.93, back.a);
  inMetal = mix(inMetal, metal * 1.14 + vec3(0.03, 0.0, 0.0), front.a);
  // stage 2: balls in the dark — the dark is what the veils of backdrop.ts will show there (the lamp's light
  // from above included), the plane behind as it will look through one veil: nothing jumps when it opens
  vec3 ray = normalize(vP - uEye);
  float glow = smoothstep(-0.3, 0.34, ray.y * 0.92 + ray.x * mix(-0.45, 0.45, lamp) * 0.5);
  vec3 dark = uDeep + mix(uCool * 0.3, uWarm * 0.72, lamp) * glow * glow * 0.32;
  vec3 inDark = mix(dark, mix(dark, back.rgb * lightCol * 0.8, 0.42), back.a);
  inDark = mix(inDark, front.rgb * lightCol, front.a);
  vec3 rows = mix(inMetal, inDark, uBalls);
  vec3 col = mix(metal, rows, seen);
  // stage 3: between the balls the picture opens (the flat front balls stay: the real ones stand before them)
  float gone = mix(uOpen * 1.6, (uOpen - 0.6) * 2.5, front.a * seen);
  if (uOpen > 0.001 && (uOpen >= 0.999 || gone > dither)) discard;
  gl_FragColor = vec4(col, 1.0);
  // once it is a picture of balls it lies just behind the real front atoms (and before everything else)
  vec4 clip = projectionMatrix * viewMatrix * uFromCopper * vec4(onPlane(-0.8 * s), 1.0);
  gl_FragDepth = uBalls > 0.001 ? clip.z / clip.w * 0.5 + 0.5 : gl_FragCoord.z;
}`;
