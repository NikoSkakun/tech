/**
 * Shader of `RibbonLines`: polylines drawn as camera-facing ribbons of constant world width with a bright
 * core, a soft glow and animated chevron dashes that show direction.
 */
import { FX_COMMON } from './glsl';

export const RIBBON_VERTEX = /* glsl */ `
attribute vec3 aTangent;
attribute vec4 aLine; // x = arc length (units), y = 0…1 along its own line, z = brightness, w = side ∓1
uniform vec4 uRibbon; // half width, quad scale, min pixel half width, viewport height (px)
varying vec4 vLine;
varying float vWidthScale;
void main() {
  vec3 C = ( modelViewMatrix * vec4( position, 1.0 ) ).xyz;
  vec3 T = normalize( ( modelViewMatrix * vec4( aTangent, 0.0 ) ).xyz );
  float mitre = length( aTangent ); // 1, or the mitre length of a mitred joint (RibbonOptions.mitre)
  vec3 side = cross( T, normalize( - C ) );
  float sl = length( side );
  vec3 S = sl > 1e-4 ? side / sl : vec3( 0.0, 1.0, 0.0 );
  float os = length( modelMatrix[ 0 ].xyz );
  float halfW = uRibbon.x * os;
  // never thinner than a few pixels: distant lines stay continuous instead of crawling
  float pxPerUnit = 0.5 * uRibbon.w * projectionMatrix[ 1 ][ 1 ] / max( - C.z, 1e-3 );
  float minW = uRibbon.z / max( pxPerUnit, 1e-6 );
  float w = max( halfW, minW );
  vWidthScale = halfW / w; // dim lines that were widened, so their energy stays the same
  vec3 P = C + S * ( aLine.w * w * mitre * uRibbon.y );
  vLine = aLine;
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`;

export const RIBBON_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uCore;
uniform vec4 uDash;  // repeat (dashes per unit), phase, strength 0…1, chevron slant
uniform vec4 uOut;   // intensity, fade, reveal 0…1, base brightness between dashes
uniform vec3 uEnds;  // fade length at line start / end (fractions of the line), core whitening 0…1
varying vec4 vLine;
varying float vWidthScale;
${FX_COMMON}
void main() {
  if ( vLine.y > uOut.z ) discard;
  float a = 1.0 - abs( vLine.w );
  // the quad is wider than the line (uRibbon.y): crisp core inside, soft glow outside
  float core = smoothstep( 0.55, 0.72, a );
  float glow = a * a * 0.35;
  // chevrons: the dash phase lags toward the edges, so every dash is an arrowhead pointing along +u
  float ph = fract( vLine.x * uDash.x - uDash.y + abs( vLine.w ) * uDash.w );
  float dash = smoothstep( 0.0, 0.08, ph ) * smoothstep( 0.62, 0.38, ph );
  float bright = mix( 1.0, uOut.w + ( 1.0 - uOut.w ) * dash * 1.45, uDash.z );
  float ends = smoothstep( 0.0, max( uEnds.x, 1e-4 ), vLine.y ) * smoothstep( 1.0, 1.0 - max( uEnds.y, 1e-4 ), vLine.y );
  // growing tip while the line is being revealed
  float tip = uOut.z < 0.999 ? 1.0 + 1.5 * smoothstep( uOut.z - 0.06, uOut.z, vLine.y ) : 1.0;
  vec3 c = mix( uColor, uCore, core * uEnds.z * bright ) * ( core + glow );
  vec3 rgb = c * ( bright * ends * tip * vLine.z * vWidthScale * uOut.x * uOut.y );
  #if defined( FX_RIBBON_NORMAL )
    // alpha-blended paint (premultiplied): coverage from the crisp core plus a little of the glow; dashes and
    // end fades thin it out instead of darkening it, so the colour stays the palette colour on any backdrop
    float dashCover = mix( 1.0, uOut.w + ( 1.0 - uOut.w ) * dash, uDash.z );
    float alpha = saturate( core + glow * 0.6 ) * dashCover * ends * min( tip, 1.0 ) * vLine.z * vWidthScale * uOut.y;
    vec3 paint = mix( uColor, uCore, core * uEnds.z ) * uOut.x;
    gl_FragColor = vec4( paint * alpha, saturate( alpha ) );
  #elif defined( FX_RIBBON_KEEP_HUE )
    // premultiplied "over": the crisp core hides what is behind it in proportion to its own brightness, so the
    // backdrop does not tint it (amber over indigo read as peach); the soft glow around it stays additive
    float cover = core * saturate( max( rgb.r, max( rgb.g, rgb.b ) ) ) * 0.9;
    gl_FragColor = vec4( fxKeepHue( rgb, 1.3 ), cover );
  #else
    gl_FragColor = vec4( rgb, 0.0 );
  #endif
}
`;
