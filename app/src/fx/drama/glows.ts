/**
 * Glow sprites: one camera-facing (or flat) quad with a procedural additive pattern.
 *   halo    soft round glow (lamps, hot spots, indicator lights)
 *   corona  fuzzy flickering discharge crown around a high-voltage conductor
 *   rings   concentric rings expanding in a seamless loop (affordance ping, radio waves, ripples)
 *   flash   one-shot burst: bright core + expanding ring, triggered with `fire()` (short circuit, strike)
 */
import { AdditiveBlending, type Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from 'three';
import { col, kGlobals, type ColorLike } from '@/style';
import { FX_COMMON, FX_NOISE } from '../core/glsl';
import { fxTime } from '../core/tick';

export type GlowKind = 'halo' | 'corona' | 'rings' | 'flash';

export interface GlowOptions {
  color?: ColorLike;
  /** Diameter of the effect, units. Default 1. */
  size?: number;
  /** Brightness (> 1 blooms). Default 1.5. */
  intensity?: number;
  /** Face the camera. Default true; `false` = lies in the object's local XY plane (ground rings). */
  billboard?: boolean;
  /** rings: number of rings visible at once (default 3); halo: pulse depth 0…1 (default 0.12). */
  amount?: number;
  /** rings / halo / corona: animation speed multiplier. flash: duration in seconds (default 0.5). */
  speed?: number;
  depthTest?: boolean;
}

const VERTEX = /* glsl */ `
uniform vec4 uGlow; // size, billboard, unused, unused
varying vec2 vQ;
void main() {
  vQ = position.xy * 2.0;
  float os = length( modelMatrix[ 0 ].xyz );
  vec4 mv = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
  if ( uGlow.y > 0.5 ) mv.xy += position.xy * uGlow.x * os;
  else mv = modelViewMatrix * vec4( position.xy * uGlow.x, 0.0, 1.0 );
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec4 uAnim; // intensity, fade, amount, speed
uniform float uStart; // flash: fire time
varying vec2 vQ;
${FX_COMMON}
${FX_NOISE}
void main() {
  float r = length( vQ );
  if ( r > 1.0 ) discard;
  float ang = atan( vQ.y, vQ.x );
  float t = uKTime * uAnim.w;
  float g = 0.0;
  vec3 color = uColor;
  #if defined( FX_GLOW_HALO )
    float fall = 1.0 - r;
    g = fall * fall * ( 1.0 + uAnim.z * sin( t * 2.6 ) ) + 0.6 * exp( - r * r * 30.0 );
    color = mix( uColor, vec3( 1.0 ), 0.5 * exp( - r * r * 40.0 ) );
  #elif defined( FX_GLOW_CORONA )
    // streamers: angular noise that crawls and flickers, strongest right at the conductor
    float n = fxNoise( vec2( ang * 3.2, t * 2.3 ) ) * 0.6 + fxNoise( vec2( ang * 9.0 + 4.0, t * 5.1 ) ) * 0.4;
    float reach = 0.35 + 0.65 * n;
    g = smoothstep( reach, 0.05, r ) * ( 0.55 + 0.45 * fxNoise( vec2( t * 9.0, ang * 2.0 ) ) );
    g += 0.5 * exp( - r * r * 26.0 );
    color = mix( uColor, vec3( 1.0 ), 0.6 * exp( - r * r * 20.0 ) );
  #elif defined( FX_GLOW_RINGS )
    // each ring is born at the centre, grows and fades: fract() makes the loop seamless
    float k = max( uAnim.z, 1.0 );
    float ph = fract( r * k - t * 0.5 );
    float w = fwidth( r * k ) * 1.5;
    float line = smoothstep( 0.0, w, ph ) * ( 1.0 - smoothstep( 0.1, 0.1 + w + 0.06, ph ) );
    g = line * ( 1.0 - r ) * smoothstep( 0.0, 0.12, r );
  #elif defined( FX_GLOW_FLASH )
    float age = ( uKTime - uStart ) / max( uAnim.w, 1e-3 );
    if ( age < 0.0 || age > 1.0 ) discard;
    float core = exp( - r * r * mix( 60.0, 6.0, age ) ) * ( 1.0 - age ) * ( 1.0 - age ) * 2.0;
    float ringR = mix( 0.1, 0.92, 1.0 - ( 1.0 - age ) * ( 1.0 - age ) );
    float ring = ( 1.0 - smoothstep( 0.0, 0.07, abs( r - ringR ) ) ) * ( 1.0 - age );
    float rays = 0.6 + 0.4 * sin( ang * 9.0 + uStart * 13.0 ) * sin( ang * 5.0 - uStart * 7.0 );
    g = core * rays + ring * 0.8;
    color = mix( uColor, vec3( 1.0 ), saturate( core ) );
  #endif
  g *= 1.0 - smoothstep( 0.9, 1.0, r );
  gl_FragColor = vec4( color * ( g * uAnim.x * uAnim.y ), 0.0 );
}
`;

/** A glow sprite. Create through `createHalo()`, `createCorona()`, `createPulseRings()`, `createFlash()`. */
export class Glow extends Mesh<PlaneGeometry, ShaderMaterial> {
  constructor(kind: GlowKind, o: GlowOptions = {}) {
    const defaults = { halo: [0.12, 1], corona: [0, 1], rings: [3, 1], flash: [0, 0.5] }[kind];
    const material = new ShaderMaterial({
      name: `fx.glow.${kind}`,
      uniforms: {
        uKTime: kGlobals.uKTime,
        uColor: { value: col(o.color ?? 'white') },
        uGlow: { value: new Vector4(o.size ?? 1, (o.billboard ?? true) ? 1 : 0, 0, 0) },
        uAnim: { value: new Vector4(o.intensity ?? 1.5, 1, o.amount ?? defaults[0], o.speed ?? defaults[1]) },
        uStart: { value: -1e9 },
      },
      defines: { [`FX_GLOW_${kind.toUpperCase()}`]: '' },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: o.depthTest ?? true,
      blending: AdditiveBlending,
      premultipliedAlpha: true,
      side: DoubleSide,
    });
    super(new PlaneGeometry(1, 1), material);
    this.name = `glow:${kind}`;
    this.frustumCulled = false;
    this.raycast = () => undefined; // shader-shaped: the base geometry is not where the effect is
  }

  /** Flash only: trigger the burst now. */
  fire(): void {
    this.material.uniforms.uStart!.value = fxTime();
  }

  get color(): Color {
    return this.material.uniforms.uColor!.value as Color;
  }
  /** Diameter, units (tweenable). */
  get size(): number {
    return (this.material.uniforms.uGlow!.value as Vector4).x;
  }
  set size(v: number) {
    (this.material.uniforms.uGlow!.value as Vector4).x = v;
  }
  get intensity(): number {
    return (this.material.uniforms.uAnim!.value as Vector4).x;
  }
  set intensity(v: number) {
    (this.material.uniforms.uAnim!.value as Vector4).x = v;
  }
  get fade(): number {
    return (this.material.uniforms.uAnim!.value as Vector4).y;
  }
  set fade(v: number) {
    (this.material.uniforms.uAnim!.value as Vector4).y = v;
  }
}

export const createHalo = (o: GlowOptions = {}): Glow => new Glow('halo', o);
export const createCorona = (o: GlowOptions = {}): Glow => new Glow('corona', { color: 'violet.light', ...o });
export const createPulseRings = (o: GlowOptions = {}): Glow => new Glow('rings', { color: 'cyan', ...o });
export const createFlash = (o: GlowOptions = {}): Glow => new Glow('flash', { intensity: 3, ...o });
