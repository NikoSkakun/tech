/**
 * Orbs — the sphere-like particle "characters" (electron, proton, neutron, ion, quark, hole, blob, pulse).
 *
 * An orb is an *impostor*: one camera-facing quad whose fragment shader shades an analytic sphere and writes
 * the sphere's true depth (`gl_FragDepth`). That gives a perfectly round silhouette at any zoom, correct
 * intersections with other geometry and with each other (nucleus clusters), ambient occlusion and depth of
 * field like real meshes — at two triangles per particle, so a hero close-up and a swarm of thousands are
 * the *same* object with the same look (STYLE_GUIDE §3: "particles are characters").
 *
 * Shading follows the K.toon model (`light = fill + key − fill·key`, highlight band, gloss spot, coloured
 * rim) with light directions and colours read from the scene's real rig, so lit orbs sit in a chapter's
 * lighting like `K.toon` spheres. Self-lit orbs (electron, pulse) ignore scene light and bloom softly.
 * A separate additive halo layer (second draw call, same instance buffers) adds the soft glow.
 *
 * Where the centres come from is pluggable (`OrbMotion`): static instances set from the CPU, a gas in a box,
 * or flow along baked paths (see `fx/flow`).
 */
import {
  AdditiveBlending,
  Color,
  Mesh,
  type Intersection,
  type Raycaster,
  ShaderMaterial,
  Sphere,
  UniformsLib,
  UniformsUtils,
  Vector3,
  Vector4,
  type InstancedBufferAttribute,
  type InstancedBufferGeometry,
  type IUniform,
} from 'three';
import { col, kGlobals, type ColorLike } from '@/style';
import {
  FX_COMMON,
  FX_FOG_PARS_FRAGMENT,
  FX_FOG_PARS_VERTEX,
  FX_FOG_VERTEX,
  FX_NOISE,
  FX_OBJECT_SCALE,
} from '../core/glsl';
import { instanced, instancedQuad } from '../core/quad';

/* ------------------------------------------------------------------------------------------- styles */

export type Glyph = 'none' | 'plus' | 'minus';

export interface OrbHalo {
  color: ColorLike;
  /** Outer radius of the halo in orb radii. */
  size: number;
  /** Peak brightness of the glow next to the body. */
  strength: number;
  /** Cycle the hue through three "colour charge" tints (quarks). */
  cycle?: boolean;
}

export interface OrbStyle {
  /** Body colour. */
  color: ColorLike;
  /** Lit orbs: colour of the lower half (vertical gradient). Self-lit orbs: the deeper limb colour. */
  shade: ColorLike;
  /** 0 = lit by the scene rig like `K.toon`, 1 = self-luminous (independent of scene lighting). */
  selfLit: number;
  /** Brightness of the self-lit part (> ~1.2 blooms). */
  intensity: number;
  /** 0…1 crisp gloss spot (lit part). */
  gloss: number;
  /** Rim light strength (lit part). */
  rim: number;
  /** Sign sticker that always faces the viewer. */
  glyph: Glyph;
  glyphColor: ColorLike;
  /** Glyph half-extent in orb radii. */
  glyphSize: number;
  /** 0…1 strength of the living shimmer (flowing shell, breathing brightness). */
  shimmer: number;
  /** Draw as a hollow dashed ring (the hole: a missing electron). */
  hollow: boolean;
  halo?: OrbHalo;
}

/** The character sheet: one look per particle, identical in every chapter (STYLE_GUIDE §2.2). */
export const ORB_STYLES = {
  /** e⁻ — glowing cyan marble: deeper limb, light core, white glint, flowing shell, dark "−". */
  electron: {
    color: 'cyan',
    shade: 'cyan.dark',
    selfLit: 1,
    intensity: 1.12,
    gloss: 0,
    rim: 0,
    glyph: 'minus',
    glyphColor: 'bg.indigo',
    glyphSize: 0.36,
    shimmer: 1,
    hollow: false,
    halo: { color: 'cyan', size: 3.2, strength: 0.6 },
  },
  /** p⁺ — glossy coral toy sphere with a white "+". */
  proton: {
    color: 'coral',
    shade: 'coral',
    selfLit: 0.12,
    intensity: 1,
    gloss: 0.7,
    rim: 1.3,
    glyph: 'plus',
    glyphColor: 'white',
    glyphSize: 0.4,
    shimmer: 0,
    hollow: false,
  },
  /** n⁰ — glossy mist → steel sphere, no sign. */
  neutron: {
    color: 'mist',
    shade: 'steel',
    selfLit: 0.06,
    intensity: 1,
    gloss: 0.7,
    rim: 1.1,
    glyph: 'none',
    glyphColor: 'white',
    glyphSize: 0.4,
    shimmer: 0,
    hollow: false,
  },
  /** Positive ion (default Li⁺ lime; pass `color` for other species). */
  ion: {
    color: 'lime',
    shade: 'lime',
    selfLit: 0.22,
    intensity: 1,
    gloss: 0.6,
    rim: 1.2,
    glyph: 'plus',
    glyphColor: 'bg.indigo',
    glyphSize: 0.4,
    shimmer: 0.25,
    hollow: false,
    halo: { color: 'lime', size: 2.2, strength: 0.28 },
  },
  /** Up quark — amber, with the colour-charge halo. */
  quarkUp: {
    color: 'amber',
    shade: 'orange',
    selfLit: 0.55,
    intensity: 1.15,
    gloss: 0.8,
    rim: 1,
    glyph: 'none',
    glyphColor: 'white',
    glyphSize: 0.4,
    shimmer: 0.6,
    hollow: false,
    halo: { color: 'amber', size: 2.6, strength: 0.75, cycle: true },
  },
  /** Down quark — violet, with the colour-charge halo. */
  quarkDown: {
    color: 'violet',
    shade: 'violet.dark',
    selfLit: 0.55,
    intensity: 1.2,
    gloss: 0.8,
    rim: 1,
    glyph: 'none',
    glyphColor: 'white',
    glyphSize: 0.4,
    shimmer: 0.6,
    hollow: false,
    halo: { color: 'violet', size: 2.6, strength: 0.75, cycle: true },
  },
  /** h⁺ — the hole: a hollow dashed coral ring with a small "+" (an absence, not a ball). */
  hole: {
    color: 'coral',
    shade: 'coral.dark',
    selfLit: 1,
    intensity: 1.3,
    gloss: 0,
    rim: 0,
    glyph: 'plus',
    glyphColor: 'coral.light',
    glyphSize: 0.3,
    shimmer: 0.8,
    hollow: true,
    halo: { color: 'coral', size: 2.4, strength: 0.3 },
  },
  /** Generic lit toon blob (water, coolant, fuel pellets…): pass `color`. */
  blob: {
    color: 'sky',
    shade: 'blue',
    selfLit: 0.1,
    intensity: 1,
    gloss: 0.8,
    rim: 1,
    glyph: 'none',
    glyphColor: 'white',
    glyphSize: 0.4,
    shimmer: 0,
    hollow: false,
  },
  /** Energy pulse: self-lit yellow mote with a halo (current / power flow markers). */
  pulse: {
    color: 'yellow',
    shade: 'amber',
    selfLit: 1,
    intensity: 1.7,
    gloss: 0,
    rim: 0,
    glyph: 'none',
    glyphColor: 'white',
    glyphSize: 0.4,
    shimmer: 0.5,
    hollow: false,
    halo: { color: 'yellow', size: 3.2, strength: 0.8 },
  },
} as const satisfies Record<string, OrbStyle>;

export type OrbKind = keyof typeof ORB_STYLES;

/* ------------------------------------------------------------------------------------------- motion */

/**
 * Source of the orb centres, as GLSL. `main` must assign `center` (local space), `scale` (0 hides the orb)
 * and `seed` (0…1, stable per orb).
 */
export interface OrbMotion {
  pars: string;
  main: string;
  uniforms: Record<string, IUniform>;
  /** Extra defines for both layers. */
  defines?: Record<string, string>;
  /** Add the instanced attributes the GLSL reads. */
  attributes(geometry: InstancedBufferGeometry, capacity: number): void;
}

/** Centres set from the CPU with `setPosition()` (the default). */
function staticMotion(): OrbMotion {
  return {
    pars: /* glsl */ `
      attribute vec4 aInst; // xyz centre, w scale
      attribute float aSeed;
    `,
    main: /* glsl */ `
      center = aInst.xyz;
      scale = aInst.w;
      seed = aSeed;
    `,
    uniforms: {},
    attributes(geometry, capacity) {
      const inst = new Float32Array(capacity * 4);
      const seed = new Float32Array(capacity);
      for (let i = 0; i < capacity; i++) {
        inst[i * 4 + 3] = 1;
        const h = Math.sin((i + 1) * 12.9898) * 43758.5453; // fixed per index: no RNG needed
        seed[i] = h - Math.floor(h);
      }
      instanced(geometry, 'aInst', inst, 4);
      instanced(geometry, 'aSeed', seed, 1);
    },
  };
}

/* ------------------------------------------------------------------------------------------ shaders */

function vertexShader(motion: OrbMotion): string {
  return /* glsl */ `
uniform float uKTime;
uniform float uRadius;
uniform float uQuad;
varying vec2 vUv;
varying vec3 vCenter;
varying float vRadius;
varying float vSeed;
${FX_FOG_PARS_VERTEX}
${FX_NOISE}
${FX_OBJECT_SCALE}
${motion.pars}
#ifdef FX_ORB_TINT
  attribute vec4 aTint; // per-instance body colour (linear rgb) + brightness
  varying vec3 vOrbColor;
  varying float vOrbBright;
#endif
void main() {
  vec3 center;
  float scale;
  float seed;
  ${motion.main}
  #ifdef FX_ORB_TINT
    vOrbColor = aTint.rgb;
    vOrbBright = aTint.w;
  #endif
  vec4 mvPosition = modelViewMatrix * vec4( center, 1.0 );
  float R = uRadius * scale * fxObjectScale();
  vCenter = mvPosition.xyz;
  vRadius = R;
  vSeed = seed;
  vUv = position.xy * 2.0 * uQuad;
  mvPosition.xy += vUv * R;
  gl_Position = projectionMatrix * mvPosition;
  ${FX_FOG_VERTEX}
}
`;
}

const BODY_FRAGMENT = /* glsl */ `
uniform mat4 projectionMatrix;
uniform float uKTime;
uniform vec3 uKRimColor;
uniform vec3 uKRimDir;
uniform vec3 uColor;
uniform vec3 uShade;
#ifdef FX_ORB_TINT
  // per-instance colours (M3): every later use of uColor / uShade reads the instance's colour; the shade keeps
  // the style's shade / colour brightness ratio
  uniform float uShadeK;
  varying vec3 vOrbColor;
  varying float vOrbBright;
  #define uColor vOrbColor
  #define uShade ( vOrbColor * uShadeK )
#endif
uniform vec3 uGlyphColor;
uniform vec4 uStyle;  // selfLit, gloss, glyph (0 none, 1 plus, 2 minus), shimmer
uniform vec4 uStyle2; // hollow, intensity, rim, glyph size
uniform float uFade;
varying vec2 vUv;
varying vec3 vCenter;
varying float vRadius;
varying float vSeed;
#include <common>
#include <lights_pars_begin>
${FX_FOG_PARS_FRAGMENT}
${FX_NOISE}

float orbLuma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
float orbIGN( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
float orbBox( vec2 p, vec2 b, float r ) {
  vec2 q = abs( p ) - b + r;
  return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - r;
}

void main() {
  float r2 = dot( vUv, vUv );
  float r = sqrt( r2 );
  float px = fwidth( r ); // 1 / (orb radius in pixels)
  float cover = 1.0 - smoothstep( 1.0 - 1.5 * px, 1.0, r );
  if ( cover <= 0.0 ) discard;
  // screen-door dissolve, same convention as the K materials' fade
  if ( uFade < 0.999 && uFade <= orbIGN( gl_FragCoord.xy + fract( uKTime ) * 37.0 ) * 0.998 + 0.001 ) discard;

  float hollow = uStyle2.x;
  float nz = sqrt( max( 1.0 - r2, 0.0 ) );
  vec3 n = vec3( vUv, nz );
  float ang = atan( vUv.y, vUv.x );
  float t = uKTime;

  /* ---- lit part: K.toon model with the scene's real rig ---- */
  vec3 viewPos = vCenter + vec3( vUv * vRadius, nz * vRadius );
  vec3 viewDir = normalize( - viewPos );
  vec3 base = mix( uShade, uColor, smoothstep( -0.45, 0.4, n.y ) );
  vec3 key = vec3( 0.0 );
  vec3 fill = ambientLightColor;
  float hi = 0.0;
  float spec = 0.0;
  #if NUM_DIR_LIGHTS > 0
    for ( int i = 0; i < NUM_DIR_LIGHTS; i++ ) {
      vec3 L = directionalLights[ i ].direction;
      vec3 lc = directionalLights[ i ].color;
      float ndl = dot( n, L );
      float band = smoothstep( -0.1, 0.14, ndl );
      key += lc * band;
      hi += smoothstep( 0.68, 0.92, ndl ) * min( orbLuma( lc ), 1.0 );
      float ndh = saturate( dot( n, normalize( L + viewDir ) ) );
      spec += smoothstep( 0.44, 0.56, pow( ndh, 90.0 ) ) * min( orbLuma( lc ), 1.0 ) * band;
    }
  #endif
  #if NUM_POINT_LIGHTS > 0
    for ( int i = 0; i < NUM_POINT_LIGHTS; i++ ) {
      vec3 lv = pointLights[ i ].position - viewPos;
      float dist = length( lv );
      vec3 lc = pointLights[ i ].color * getDistanceAttenuation( dist, pointLights[ i ].distance, pointLights[ i ].decay );
      key += lc * smoothstep( -0.1, 0.14, dot( n, lv / dist ) );
    }
  #endif
  #if NUM_HEMI_LIGHTS > 0
    for ( int i = 0; i < NUM_HEMI_LIGHTS; i++ ) fill += getHemisphereLightIrradiance( hemisphereLights[ i ], n );
  #endif
  vec3 light = fill + key - fill * min( key, vec3( 1.0 ) );
  vec3 lit = base * light;
  lit = mix( lit, mix( base, vec3( 1.0 ), 0.3 ) * min( light, vec3( 1.0 ) ), saturate( hi ) * 0.55 );
  lit = mix( lit, mix( base, vec3( 1.0 ), 0.72 ), saturate( spec ) * uStyle.y );
  float fres = 1.0 - saturate( dot( n, viewDir ) );
  vec3 rimDir = normalize( ( viewMatrix * vec4( uKRimDir, 0.0 ) ).xyz );
  lit += uKRimColor * ( smoothstep( 0.5, 0.74, fres ) * saturate( dot( n, rimDir ) * 0.7 + 0.5 ) * uStyle2.z );
  lit = min( lit, vec3( 1.0 ) );

  /* ---- self-lit part: a marble of light — deeper limb, light heart, white glint, flowing shell ---- */
  float flow = fxNoise( vUv * 2.6 + vec2( t * 0.35, - t * 0.27 ) + vSeed * 31.0 );
  float breathe = 1.0 + 0.07 * uStyle.w * sin( t * 4.3 + vSeed * 61.0 );
  vec3 orb = mix( uShade * 1.05, uColor, smoothstep( 0.12, 0.5, nz ) );
  orb = mix( orb, mix( uColor, vec3( 1.0 ), 0.38 ), smoothstep( 0.62, 0.98, nz + ( flow - 0.5 ) * 0.35 * uStyle.w ) );
  float glint = 1.0 - smoothstep( 0.13, 0.24, length( vUv - vec2( -0.38, 0.42 ) ) );
  glint += 0.6 * ( 1.0 - smoothstep( 0.04, 0.09, length( vUv - vec2( -0.62, 0.12 ) ) ) );
  orb = mix( orb, vec3( 1.25 ), saturate( glint ) * 0.92 );
  // shell: a thin bright band hugging the silhouette whose gaps drift round — the orb never sits still
  float shell = smoothstep( 0.8, 0.9, r ) * ( 1.0 - smoothstep( 0.94, 1.0, r ) );
  float gaps = 0.5 + 0.5 * sin( ang * 3.0 + t * 1.9 + vSeed * 40.0 ) * sin( ang * 2.0 - t * 1.3 + vSeed * 17.0 );
  orb += mix( uColor, vec3( 1.0 ), 0.5 ) * ( shell * gaps * 0.9 * uStyle.w );
  orb *= uStyle2.y * breathe;

  vec3 color = mix( lit, orb, uStyle.x );
  // lit orbs with a little self-light keep a gentle inner warmth in the shade
  color = max( color, uColor * uStyle.x * 0.5 );

  /* ---- hollow ring (hole) ---- */
  if ( hollow > 0.5 ) {
    float ring = smoothstep( 0.64 - 1.5 * px, 0.64, r );
    float dash = smoothstep( -0.25, 0.1, sin( ang * 7.0 + t * 1.2 + vSeed * 20.0 ) );
    float inner = 0.2 * ( 1.0 - ring );
    cover *= max( ring * mix( 0.45, 1.0, dash ), inner );
    color = mix( uShade * 0.6, uColor * uStyle2.y * breathe, ring );
    nz = 0.0;
  }

  /* ---- sign sticker, fades out when the orb is only a few pixels big ---- */
  if ( uStyle.z > 0.5 ) {
    float gs = uStyle2.w;
    float bar = orbBox( vUv, vec2( gs, gs * 0.27 ), gs * 0.12 );
    if ( uStyle.z < 1.5 ) bar = min( bar, orbBox( vUv, vec2( gs * 0.27, gs ), gs * 0.12 ) );
    float mask = ( 1.0 - smoothstep( - px, px, bar ) ) * smoothstep( 0.25, 0.11, px );
    color = mix( color, uGlyphColor, mask );
    cover = max( cover, mask * step( 0.5, hollow ) );
  }

  if ( cover < 0.02 ) discard;
  #ifdef USE_FOG
    color = mix( color, fogColor, fxFogFactor() );
  #endif
  vec4 clip = projectionMatrix * vec4( vCenter.xy + vUv * vRadius, vCenter.z + nz * vRadius, 1.0 );
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  #ifdef FX_ORB_TINT
    color *= vOrbBright;
  #endif
  gl_FragColor = vec4( color, cover );
}
`;

const HALO_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uHaloColor;
#ifdef FX_ORB_TINT
  varying vec3 vOrbColor;
  varying float vOrbBright;
  #ifndef FX_ORB_TINT_KEEP_HALO
    #define uHaloColor vOrbColor
  #endif
#endif
uniform vec4 uHalo; // size (radii), strength, cycle, glow multiplier
uniform float uFade;
varying vec2 vUv;
varying float vSeed;
${FX_COMMON}
${FX_FOG_PARS_FRAGMENT}
void main() {
  float r = length( vUv );
  float size = uHalo.x;
  if ( r > size ) discard;
  float t = uKTime;
  float ang = atan( vUv.y, vUv.x );
  // tight bright corona + wide faint veil, both reaching zero at the quad's edge
  float edge = saturate( ( r - 0.9 ) / ( size - 0.9 ) );
  float corona = exp( - edge * edge * 26.0 );
  float veil = ( 1.0 - edge ) * ( 1.0 - edge ) * 0.22;
  float rays = 1.0 + 0.22 * sin( ang * 5.0 + t * 1.1 + vSeed * 30.0 ) * sin( ang * 3.0 - t * 0.7 + vSeed * 11.0 );
  float twinkle = 1.0 + 0.1 * sin( t * 3.1 + vSeed * 53.0 );
  float glow = ( corona * rays + veil ) * smoothstep( 0.82, 1.0, r ) * uHalo.y * uHalo.w * twinkle * uFade;
  vec3 color = uHaloColor;
  if ( uHalo.z > 0.5 ) {
    // colour charge: the hue wanders between three tints, each quark with its own phase
    float ph = t * 0.9 + vSeed * 6.2832;
    vec3 w = max( vec3( sin( ph ), sin( ph + 2.0944 ), sin( ph + 4.1888 ) ), 0.0 );
    color = mix( color, ( vec3( 1.0, 0.37, 0.36 ) * w.x + vec3( 0.48, 0.89, 0.42 ) * w.y + vec3( 0.24, 0.48, 1.0 ) * w.z ) / max( w.x + w.y + w.z, 1e-3 ), 0.7 );
  }
  #ifdef FX_ORB_TINT
    glow *= vOrbBright;
  #endif
  gl_FragColor = vec4( color * glow * ( 1.0 - fxFogFactor() ), 0.0 );
}
`;

/* -------------------------------------------------------------------------------------------- class */

export interface OrbOptions {
  /** Character kind (look from `ORB_STYLES`) or a custom style. */
  kind: OrbKind | OrbStyle;
  /** Number of instances. Default 1 (a hero). */
  count?: number;
  /** Orb radius in local units. Default 0.1. */
  radius?: number;
  /** Override the body colour (ions of other species, blobs). The halo follows unless it cycles. */
  color?: ColorLike;
  /** Override the shade / gradient colour. */
  shade?: ColorLike;
  /** Override the sign sticker. */
  glyph?: Glyph;
  /** Draw the additive halo layer (if the style has one). Default true. */
  halo?: boolean;
  /** Affected by scene fog. Default true. */
  fog?: boolean;
  /** Custom source of centres (gas, flow). Default: static instances. */
  motion?: OrbMotion;
  /**
   * Per-instance body colour and brightness (M3): mixed swarms in one draw call, "one brighter electron".
   * Set with `setInstanceColor(i, colour, brightness)` + `commit()`; instances start at the style colour.
   * Works with flows and gas too (instance = particle). Default false.
   */
  instanceColors?: boolean;
  name?: string;
}

const GLYPH_ID: Record<Glyph, number> = { none: 0, plus: 1, minus: 2 };
const _sphere = new Sphere();
const _tint = new Color();
const _hit = new Vector3();

/**
 * A set of identical character orbs: `count` 1 = a hero (move the object itself), more = a swarm
 * (`setPosition(i, …)` + `commit()`), or driven by a motion module (gas, flow along paths).
 */
export class Orbs extends Mesh<InstancedBufferGeometry, ShaderMaterial> {
  readonly capacity: number;
  /** The additive glow layer (null for characters without a halo). */
  readonly haloMesh: Mesh<InstancedBufferGeometry, ShaderMaterial> | null;
  readonly style: OrbStyle;
  /** Uniforms of the motion module (flow / gas controllers write here). */
  readonly motionUniforms: Record<string, IUniform>;
  private readonly inst: InstancedBufferAttribute | null;

  constructor(opts: OrbOptions) {
    const style: OrbStyle = { ...(typeof opts.kind === 'string' ? ORB_STYLES[opts.kind] : opts.kind) };
    if (opts.color !== undefined) {
      style.color = opts.color;
      if (opts.shade === undefined && typeof opts.kind === 'string' && opts.kind !== 'neutron')
        style.shade = style.selfLit > 0.9 ? col(opts.color).multiplyScalar(0.55) : opts.color;
      if (style.halo && !style.halo.cycle) style.halo = { ...style.halo, color: opts.color };
    }
    if (opts.shade !== undefined) style.shade = opts.shade;
    if (opts.glyph !== undefined) style.glyph = opts.glyph;
    const capacity = Math.max(1, opts.count ?? 1);
    const motion = opts.motion ?? staticMotion();
    const geometry = instancedQuad(capacity);
    motion.attributes(geometry, capacity);
    const tintDefines: Record<string, string> = opts.instanceColors ? { FX_ORB_TINT: '' } : {};
    if (opts.instanceColors) {
      const c = col(style.color);
      const tint = new Float32Array(capacity * 4);
      for (let i = 0; i < capacity; i++) tint.set([c.r, c.g, c.b, 1], i * 4);
      instanced(geometry, 'aTint', tint, 4);
    }
    const lum = (c: Color): number => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
    const shared: Record<string, IUniform> = {
      uRadius: { value: opts.radius ?? 0.1 },
      uFade: { value: 1 },
      ...motion.uniforms,
    };
    const body = new ShaderMaterial({
      name: 'fx.orb',
      uniforms: UniformsUtils.merge([
        UniformsLib.lights,
        UniformsLib.fog,
        {
          uQuad: { value: 1.02 },
          uColor: { value: col(style.color) },
          uShade: { value: col(style.shade) },
          uGlyphColor: { value: col(style.glyphColor) },
          uStyle: { value: new Vector4(style.selfLit, style.gloss, GLYPH_ID[style.glyph], style.shimmer) },
          uStyle2: { value: new Vector4(style.hollow ? 1 : 0, style.intensity, style.rim, style.glyphSize) },
          uShadeK: { value: lum(col(style.shade)) / Math.max(lum(col(style.color)), 1e-3) },
        },
      ]),
      vertexShader: vertexShader(motion),
      fragmentShader: BODY_FRAGMENT,
      defines: { ...motion.defines, ...tintDefines },
      lights: true,
      fog: opts.fog ?? true,
      alphaToCoverage: true,
    });
    // shared (by reference) uniforms: engine globals, radius / fade, motion state
    Object.assign(body.uniforms, shared, {
      uKTime: kGlobals.uKTime,
      uKRimColor: kGlobals.uKRimColor,
      uKRimDir: kGlobals.uKRimDir,
    });
    super(geometry, body);
    this.name = opts.name ?? `orbs:${typeof opts.kind === 'string' ? opts.kind : 'custom'}`;
    this.frustumCulled = false;
    this.capacity = capacity;
    this.style = style;
    this.motionUniforms = motion.uniforms;
    this.inst = (geometry.getAttribute('aInst') as InstancedBufferAttribute | undefined) ?? null;

    if (style.halo && (opts.halo ?? true)) {
      const halo = new ShaderMaterial({
        name: 'fx.orb.halo',
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          {
            uQuad: { value: style.halo.size },
            uHaloColor: { value: col(style.halo.color) },
            uHalo: { value: new Vector4(style.halo.size, style.halo.strength, style.halo.cycle ? 1 : 0, 1) },
          },
        ]),
        vertexShader: vertexShader(motion),
        fragmentShader: HALO_FRAGMENT,
        defines: {
          ...motion.defines,
          // a cycling halo (quarks) keeps its colour-charge hues; the brightness still applies
          ...tintDefines,
          ...(style.halo.cycle && opts.instanceColors ? { FX_ORB_TINT_KEEP_HALO: '' } : {}),
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        premultipliedAlpha: true,
        fog: opts.fog ?? true,
      });
      Object.assign(halo.uniforms, shared, { uKTime: kGlobals.uKTime });
      this.haloMesh = new Mesh(geometry, halo);
      this.haloMesh.name = `${this.name}:halo`;
      this.haloMesh.frustumCulled = false;
      this.haloMesh.raycast = () => undefined; // picking goes through the body's sphere test
      this.add(this.haloMesh);
    } else {
      this.haloMesh = null;
    }
  }

  /** Number of orbs drawn (≤ capacity). */
  get instances(): number {
    return this.geometry.instanceCount;
  }
  set instances(n: number) {
    this.geometry.instanceCount = Math.min(Math.max(0, Math.round(n)), this.capacity);
  }

  /** Orb radius in local units (tweenable). */
  get radius(): number {
    return this.material.uniforms.uRadius!.value as number;
  }
  set radius(v: number) {
    this.material.uniforms.uRadius!.value = v;
  }

  /** Dissolve 0…1 (tweenable; `ctx.stage` actors with `appear: 'fade'` drive it). */
  get fade(): number {
    return this.material.uniforms.uFade!.value as number;
  }
  set fade(v: number) {
    this.material.uniforms.uFade!.value = v;
  }

  /** Brightness of the self-lit part (tweenable; hover feedback, excitation). */
  get intensity(): number {
    return (this.material.uniforms.uStyle2!.value as Vector4).y;
  }
  set intensity(v: number) {
    (this.material.uniforms.uStyle2!.value as Vector4).y = v;
  }

  /** Halo strength multiplier (tweenable). */
  get glow(): number {
    return this.haloMesh ? (this.haloMesh.material.uniforms.uHalo!.value as Vector4).w : 0;
  }
  set glow(v: number) {
    if (this.haloMesh) (this.haloMesh.material.uniforms.uHalo!.value as Vector4).w = v;
  }

  /** Live body colour. */
  get color(): Color {
    return this.material.uniforms.uColor!.value as Color;
  }

  /** Change the body colour (and the matching shade / halo). */
  setColor(color: ColorLike, shade?: ColorLike): this {
    col(color, this.material.uniforms.uColor!.value as Color);
    const s = this.material.uniforms.uShade!.value as Color;
    if (shade !== undefined) col(shade, s);
    else if (this.style.selfLit > 0.9) col(color, s).multiplyScalar(0.55);
    else col(color, s);
    if (this.haloMesh && !this.style.halo?.cycle)
      col(color, this.haloMesh.material.uniforms.uHaloColor!.value as Color);
    return this;
  }

  /** Static swarms: place orb `i` (local space); call `commit()` after a batch. */
  setPosition(i: number, x: number, y: number, z: number, scale = 1): void {
    this.inst?.setXYZW(i, x, y, z, scale);
  }

  /** Static swarms: change only the scale of orb `i` (0 hides it). */
  setScale(i: number, scale: number): void {
    this.inst?.setW(i, scale);
  }

  /**
   * Per-instance colour and brightness (needs `instanceColors: true`); call `commit()` after a batch.
   * Brightness multiplies body and halo (1 = as styled; 2 = "the excited one").
   */
  setInstanceColor(i: number, color: ColorLike, brightness = 1): void {
    const tint = this.geometry.getAttribute('aTint') as InstancedBufferAttribute | undefined;
    if (!tint) throw new Error('Orbs.setInstanceColor: create the orbs with { instanceColors: true }');
    const c = col(color, _tint);
    tint.setXYZW(i, c.r, c.g, c.b, brightness);
  }

  /** Upload positions written with `setPosition` / `setScale` (and colours from `setInstanceColor`). */
  commit(): void {
    if (this.inst) this.inst.needsUpdate = true;
    const tint = this.geometry.getAttribute('aTint') as InstancedBufferAttribute | undefined;
    if (tint) tint.needsUpdate = true;
  }

  /**
   * Picking: the quad geometry says nothing about where the orbs are, so rays are tested against the real
   * spheres (heroes and CPU-positioned swarms; `instanceId` tells which orb). Orbs driven by a GPU motion
   * module (gas, flow) are not pickable.
   */
  override raycast(raycaster: Raycaster, intersects: Intersection[]): void {
    if (!this.inst) return;
    const scale = this.matrixWorld.getMaxScaleOnAxis();
    for (let i = 0; i < this.geometry.instanceCount; i++) {
      const k = this.inst.getW(i);
      if (k <= 0) continue;
      _sphere.center.set(this.inst.getX(i), this.inst.getY(i), this.inst.getZ(i)).applyMatrix4(this.matrixWorld);
      _sphere.radius = this.radius * k * scale;
      if (!raycaster.ray.intersectSphere(_sphere, _hit)) continue;
      const distance = raycaster.ray.origin.distanceTo(_hit);
      if (distance < raycaster.near || distance > raycaster.far) continue;
      intersects.push({ distance, point: _hit.clone(), object: this, instanceId: i });
    }
  }
}

/** Create character orbs (see `OrbOptions`). */
export function createOrbs(opts: OrbOptions): Orbs {
  return new Orbs(opts);
}

const _white = new Color(1, 1, 1);
/** Palette colour pushed toward white — used by ribbons for their hot cores. */
export function hotCore(color: Color, amount = 0.7): Color {
  return color.clone().lerp(_white, amount);
}
