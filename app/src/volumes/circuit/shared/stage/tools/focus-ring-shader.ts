/**
 * The look of the magnifier's focus ring (`focus-ring.ts`): a knurled metal band drawn in screen space along an
 * arc. The geometry is static (`aKV`: share along, v across — 0 at the lens edge … 1 outside, negative v is the
 * room the marker ◆ pokes into the lens); the arc itself (centre, radius, length, CSS px) comes in as uniforms.
 *
 * Profile across the band: a thin cyan line at the lens edge (the rim itself, strong once the ring is pinned to the
 * frame's bottom), a smooth inner lip with the printed floor marks, then the diamond knurl (the grip) that scrolls
 * with the value — turning the ring visibly turns it. Lit from above as one toon band (two soft steps), a rim light
 * on the edges; the ends are rounded. Unlit by the scene on purpose: it lives on the overlay layer, never blurred.
 */
export const MAX_MARKS = 4;

export const FOCUS_RING_VERT = /* glsl */ `
attribute vec2 aKV;      // share along the arc (0…1), v across
uniform vec2 uView;      // canvas size, CSS px
uniform vec3 uCircle;    // centre (px, y down) and inner radius (px)
uniform float uT;
uniform float uHalf;
uniform float uExt;      // the geometry reaches this far past the band's ends (outline, rounding)
varying vec2 vArc;
void main() {
  // laid out here from uniforms set just before the draw: the band never lags the frame it sits on
  float s = (aKV.x * 2.0 - 1.0) * (uHalf + uExt);
  float a = s / uCircle.z;
  float rr = uCircle.z + aKV.y * uT;
  vec2 p = uCircle.xy + rr * vec2(sin(a), cos(a));
  vArc = vec2(s, aKV.y);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`;

export const FOCUS_RING_FRAG = /* glsl */ `
uniform float uHalf;     // half the arc length, px
uniform float uT;        // band thickness, px
uniform float uAmount;   // 0…1 presence (reveal: the band grows from its middle)
uniform float uHot;      // 0…1 hover / drag
uniform float uFocus;    // 0…1 keyboard focus outline
uniform float uRim;      // 0…1 the cyan rim line at the lens edge
uniform float uTurn;     // knurl scroll, px
uniform float uMarker;   // s of the current value, px
uniform float uMarks[${MAX_MARKS}];
uniform float uMarkCount;
uniform vec3 uMetal;
uniform vec3 uLight;
uniform vec3 uDark;
uniform vec3 uCyan;
uniform vec3 uYellow;
uniform vec3 uPrint;
varying vec2 vArc;

float knurl(float s, float y, float pitch) {
  // two diagonal families of grooves → pyramids; each face lit by where it points
  float a = fract((s + y) / pitch) - 0.5;
  float b = fract((s - y) / pitch) - 0.5;
  float face = abs(a) > abs(b) ? (a > 0.0 ? 0.78 : 1.16) : (b > 0.0 ? 0.9 : 1.04);
  float groove = 1.0 - smoothstep(0.36, 0.5, max(abs(a), abs(b)));
  return face * mix(0.72, 1.0, groove);
}

void main() {
  float s = vArc.x;
  float v = vArc.y;
  float px = max(fwidth(s), 1e-3);
  float y = v * uT;                          // px across the band from the lens edge
  float half_ = uHalf * uAmount;
  // the band: a stadium from -half_ … half_ along, 0 … uT across (rounded ends)
  float qx = max(abs(s) - (half_ - 0.5 * uT), 0.0);
  float d = length(vec2(qx, y - 0.5 * uT)) - 0.5 * uT;
  float band = 1.0 - smoothstep(-0.8 * px, 0.8 * px, d);

  // across-profile lighting: the inner side faces up toward the room light, the outer edge rolls away
  float u = clamp(v, 0.0, 1.0);
  float lit = mix(1.08, 0.7, smoothstep(0.15, 1.0, u));
  lit = floor(lit * 4.0 + 0.5) / 4.0 * 0.35 + lit * 0.65;   // a soft toon step
  vec3 col = uMetal * lit;
  // the grip: the outer 55 % knurled, scrolling with the value
  float grip = smoothstep(0.4, 0.46, u) * (1.0 - smoothstep(0.92, 0.97, u));
  float pitch = max(uT * 0.34, 5.0);
  float kn = knurl(s + uTurn, y, pitch);
  col = mix(col, col * kn, grip * smoothstep(1.2, 2.4, pitch / px));
  // printed floor marks on the smooth inner lip
  float print = 0.0;
  for (int i = 0; i < ${MAX_MARKS}; i++) {
    if (float(i) >= uMarkCount) break;
    float m = 1.0 - smoothstep(0.7, 1.5, abs(s - uMarks[i]) / max(px, 0.5));
    print = max(print, m * smoothstep(0.08, 0.14, u) * (1.0 - smoothstep(0.4, 0.46, u)));
  }
  col = mix(col, uPrint, print * 0.9);
  // edges: a bright lip where the band meets the lens, a dark one outside; hover lights both in cyan
  float edgeIn = 1.0 - smoothstep(0.0, 2.2 * px, y);
  float edgeOut = smoothstep(uT - 2.2 * px, uT, y);
  col = mix(col, uLight, edgeIn * 0.5);
  col = mix(col, uDark, edgeOut * 0.6);
  col += uCyan * (0.14 + 0.5 * (edgeIn + edgeOut)) * uHot;
  // the rim: a thin cyan line along the lens edge, with a soft glow into the lens
  float rimLine = (1.0 - smoothstep(1.0 * px, 2.4 * px, abs(y - 0.6 * px))) * step(abs(s), half_);
  col = mix(col, uCyan * 1.15, rimLine * uRim);
  float a = band;

  // the index: a yellow notch across the band at the value and the marker ◆ poking into the lens
  float notch = (1.0 - smoothstep(1.0, 2.0, abs(s - uMarker) / max(px, 0.5))) * band;
  col = mix(col, uYellow, notch * 0.95);
  float mw = 0.34 * uT;
  float mh = 0.42 * uT;
  float md = abs(s - uMarker) / mw + abs(y + 0.36 * uT) / mh;
  float marker = 1.0 - smoothstep(1.0 - 1.2 * px / mw, 1.0, md);
  float outline = 1.0 - smoothstep(1.0 + 0.6 * px / mw, 1.0 + 2.0 * px / mw, md);
  col = mix(col, uDark, (outline - marker) * (1.0 - band));
  col = mix(col, uYellow * mix(0.95, 1.25, 1.0 - clamp(md, 0.0, 1.0)), marker);
  a = max(a, outline * step(0.001, uAmount));

  // keyboard focus: a yellow outline around the band
  float ring = (1.0 - smoothstep(1.0 * px, 2.2 * px, abs(d - 3.0 * px))) * uFocus;
  col = mix(col, uYellow, ring);
  a = max(a, ring);

  a *= smoothstep(0.0, 0.25, uAmount);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;
