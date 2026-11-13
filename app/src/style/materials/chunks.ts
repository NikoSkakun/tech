/**
 * GLSL building blocks shared by the K.* materials. They are assembled from three.js' own shader chunks so
 * that instancing, batching, shadows, fog and clipping planes keep working exactly like built-in materials.
 */
import { K_GLOBALS_GLSL } from './globals';

export interface VertexOptions {
  /** Pass `uv` to the fragment shader as `vKUv`. */
  uv?: boolean;
  /** Extra declarations (uniforms, functions) before `main`. */
  pars?: string;
  /** Code that may modify `vec3 transformed` (object space) and `vec3 objectNormal`. */
  transform?: string;
}

export function kVertexShader(opts: VertexOptions = {}): string {
  return /* glsl */ `
#define K_MATERIAL
varying vec3 vViewPosition;
varying vec3 vKObjPos;
varying vec3 vKWorldPos;
${opts.uv ? 'varying vec2 vKUv;' : ''}
#include <common>
#include <batching_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <shadowmap_pars_vertex>
#include <clipping_planes_pars_vertex>
${K_GLOBALS_GLSL}
${opts.pars ?? ''}
void main() {
  #include <color_vertex>
  #include <batching_vertex>
  #include <beginnormal_vertex>
  #include <begin_vertex>
  ${opts.transform ?? ''}
  #include <defaultnormal_vertex>
  #include <normal_vertex>
  vKObjPos = transformed;
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = - mvPosition.xyz;
  vec4 kWorld = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    kWorld = batchingMatrix * kWorld;
  #endif
  #ifdef USE_INSTANCING
    kWorld = instanceMatrix * kWorld;
  #endif
  kWorld = modelMatrix * kWorld;
  vKWorldPos = kWorld.xyz;
  ${opts.uv ? 'vKUv = uv;' : ''}
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>
}
`;
}

/** Declarations common to all K fragment shaders. */
export const K_FRAGMENT_COMMON = /* glsl */ `
#define K_MATERIAL
varying vec3 vViewPosition;
varying vec3 vKObjPos;
varying vec3 vKWorldPos;
uniform float opacity;
uniform float uFade;
${K_GLOBALS_GLSL}
#include <common>
#include <color_pars_fragment>
#include <fog_pars_fragment>
#include <clipping_planes_pars_fragment>

// Interleaved gradient noise (Jimenez 2014): cheap, stable screen-space dither pattern.
float kIGN( vec2 p ) {
  return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) );
}

// Screen-door fade: lets any opaque material fade in/out without sorting or blending problems
// (MSAA + the final AA pass turn the dither into a smooth dissolve).
void kFadeDiscard() {
  if ( uFade < 0.999 ) {
    if ( uFade <= kIGN( gl_FragCoord.xy + fract( uKTime ) * 37.0 ) * 0.998 + 0.001 ) discard;
  }
}

float kLuma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }

// Cheap value noise for stylised surface animation (water glints, hologram grain).
float kHash( vec2 p ) {
  p = fract( p * vec2( 123.34, 456.21 ) );
  p += dot( p, p + 45.32 );
  return fract( p.x * p.y );
}
float kNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( kHash( i ), kHash( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( kHash( i + vec2( 0.0, 1.0 ) ), kHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
`;

/**
 * Cel lighting model (STYLE_GUIDE §4): soft banded key light + hemisphere fill + coloured rim.
 *
 *   light  = fill + key − fill·key      ("screen": fully lit = exactly the palette colour, shadow = colour × fill)
 *   colour = base × light, pushed toward the `*.light` variant inside the highlight band, plus the rim.
 *
 * Because the shade side is `base × fill` and the fill (hemisphere) light is indigo/violet, shadows are tinted
 * and never go grey or black. The lit result is clamped to 1 so that only emissive terms drive bloom.
 *
 * uBand   = ( terminator, softness, highlightThreshold, highlightAmount )
 * uMid    = ( half-tone threshold, half-tone level )   [K_BANDS3]
 * uRim    = ( strength, threshold, softness )
 * uSpec   = ( shininess, strength, softness )           [K_METAL, K_GLOSS]
 */
export const K_LIGHTING_PARS = /* glsl */ `
uniform vec4 uBand;
uniform vec2 uMid;
uniform vec3 uRim;
#if defined( K_METAL ) || defined( K_GLOSS )
  uniform vec3 uSpec;
#endif
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <shadowmap_pars_fragment>

struct KMaterial { vec3 diffuseColor; };

float kHighlight = 0.0;
vec3 kSpecular = vec3( 0.0 );

void RE_Direct_K( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in KMaterial material, inout ReflectedLight reflectedLight ) {
  float ndl = dot( geometryNormal, directLight.direction );
  // directLight.color already carries the (soft) shadow term of shadow-casting lights
  float band = smoothstep( uBand.x - uBand.y, uBand.x + uBand.y, ndl );
  #ifdef K_BANDS3
    // second cel edge: a half-tone band between the terminator and uMid.x, so large forms read as
    // shadow / half-tone / light instead of a smooth Lambert ramp
    band *= mix( uMid.y, 1.0, smoothstep( uMid.x - uBand.y, uMid.x + uBand.y, ndl ) );
  #endif
  reflectedLight.directDiffuse += directLight.color * band;
  kHighlight += smoothstep( uBand.z - uBand.y, uBand.z + uBand.y, ndl ) * min( kLuma( directLight.color ), 1.0 );
  #if defined( K_METAL ) || defined( K_GLOSS )
    vec3 halfDir = normalize( directLight.direction + geometryViewDir );
    float ndh = saturate( dot( geometryNormal, halfDir ) );
    float streak = smoothstep( 0.5 - uSpec.z, 0.5 + uSpec.z, pow( ndh, uSpec.x ) );
    kSpecular += directLight.color * streak * uSpec.y * band;
  #endif
}

void RE_IndirectDiffuse_K( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in KMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance;
}

#define RE_Direct RE_Direct_K
#define RE_IndirectDiffuse RE_IndirectDiffuse_K

// Returns the lit (non-emissive) colour of 'base'. Requires 'normal' from <normal_fragment_begin>.
vec3 kShade( vec3 base, vec3 normal ) {
  KMaterial material;
  material.diffuseColor = base;
  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
  #include <lights_fragment_begin>
  #include <lights_fragment_end>
  vec3 key = reflectedLight.directDiffuse;
  vec3 fill = reflectedLight.indirectDiffuse;
  vec3 light = fill + key - fill * min( key, vec3( 1.0 ) );
  vec3 color = base * light;
  // highlight band → the '*.light' variant of the base colour (+lightness, −saturation)
  vec3 lighter = mix( base, vec3( 1.0 ), 0.3 );
  color = mix( color, lighter * min( light, vec3( 1.0 ) ), saturate( kHighlight ) * uBand.w );
  #ifdef K_GLOSS
    // glossy toy plastic: one crisp highlight spot, tinted by the base colour (never pure white)
    color = mix( color, mix( base, vec3( 1.0 ), 0.72 ), saturate( kLuma( kSpecular ) ) );
  #endif
  #ifdef K_METAL
    // stylised metal: darker body with a crisp horizon band and a sharp specular streak
    float horizon = smoothstep( 0.18, 0.32, normal.y ) - smoothstep( 0.55, 0.9, normal.y );
    color *= mix( 0.78, 1.08, horizon );
    color += kSpecular;
  #endif
  // coloured rim light on silhouettes facing the rim direction
  float fres = 1.0 - saturate( dot( normal, geometryViewDir ) );
  vec3 rimDir = normalize( ( viewMatrix * vec4( uKRimDir, 0.0 ) ).xyz );
  float rim = smoothstep( uRim.y - uRim.z, uRim.y + uRim.z, fres ) * saturate( dot( normal, rimDir ) * 0.7 + 0.5 );
  color += uKRimColor * ( rim * uRim.x );
  return min( color, vec3( 1.0 ) );
}
`;
