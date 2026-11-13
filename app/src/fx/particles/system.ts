/**
 * ParticleSystem — instanced billboard sprites simulated entirely in the vertex shader.
 *
 * Every particle carries its spawn position, initial velocity, birth time, lifetime and a random seed; the
 * shader derives age from the engine clock and evaluates the closed-form trajectory (gravity + linear drag +
 * wind + a cheap turbulence wobble). Consequences:
 *   - zero CPU cost per frame, one draw call per system;
 *   - deterministic under the debug clock (`?freeze`, `__app.step`) — the picture is a pure function of time;
 *   - continuous emitters loop seamlessly: each particle is reborn the moment it dies (`loop: true`);
 *   - one-shot bursts (`emit()`) write new spawn data into a ring buffer.
 *
 * Trajectory with drag k, gravity g, wind w, initial velocity v0 (all in local units, seconds):
 *   v∞   = w + g / k                                   terminal velocity
 *   p(t) = p0 + v∞·t + (v0 − v∞)·(1 − e^(−k·t)) / k
 *   k → 0:  p(t) = p0 + v0·t + g·t² / 2
 */
import {
  AdditiveBlending,
  type Color,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  Vector4,
  type InstancedBufferAttribute,
  type InstancedBufferGeometry,
  type IUniform,
} from 'three';
import type { Rng } from '@/engine/api';
import { col, kGlobals, type ColorLike } from '@/style';
import { capacityFor, followQuality, type FxEnv } from '../core/env';
import {
  FX_COMMON,
  FX_FOG_PARS_FRAGMENT,
  FX_FOG_PARS_VERTEX,
  FX_FOG_VERTEX,
  FX_NOISE,
  FX_OBJECT_SCALE,
} from '../core/glsl';
import { instanced, instancedQuad } from '../core/quad';
import { fxTime } from '../core/tick';
import { pointEmitter, type Emitter, type Vec3 } from './emitters';

export type SpriteShape =
  /** Soft round glow (additive energy motes, embers, dust). */
  | 'soft'
  /** Crisp flat disc with a soft edge (toon droplets, pellets). */
  | 'disc'
  /** Toon cloud puff with a lumpy edge and two-tone shading (steam, smoke, foam). */
  | 'puff'
  /** Streak aligned with the velocity (sparks, rain). Implies velocity stretching. */
  | 'spark'
  /** Elongated droplet with a highlight, aligned with the velocity. */
  | 'drop'
  /** Bubble: thin rim + highlight. */
  | 'bubble'
  /** Thin ring (ripples, shock rings). */
  | 'ring';

export type Range = number | readonly [number, number];
export type Curve3 = number | readonly [number, number] | readonly [number, number, number];
export type ColorCurve = ColorLike | readonly [ColorLike, ColorLike] | readonly [ColorLike, ColorLike, ColorLike];

export interface ParticleOptions {
  /** Nominal particle count at quality `high`; scaled by the tier (`quality.count`). */
  count: number;
  /** Do not scale `count` with the quality tier. Default false. */
  exactCount?: boolean;
  /** Where particles are born and which way they start. Default: point at the origin, random direction. */
  emitter?: Emitter;
  /** Continuous emission (every particle is reborn when it dies). Default true. `false` = `emit()` bursts. */
  loop?: boolean;
  /** Lifetime in seconds (range = per-particle random). Default 2. */
  life?: Range;
  /** Initial speed along the emitter direction, units/s. Default 1. */
  speed?: Range;
  /** Constant acceleration, units/s². Default none. */
  gravity?: Vec3;
  /** Linear drag coefficient k, 1/s (velocity relaxes toward the wind as e^(−k·t)). Default 0. */
  drag?: number;
  /** Velocity the air carries particles with (needs `drag` > 0). Default none. */
  wind?: Vec3;
  /** Wobble: amplitude (units), spatial frequency, temporal speed. Default none. */
  turbulence?: { amplitude: number; frequency?: number; speed?: number };
  /** Size (diameter, units) over life: constant, [start, end] or [start, mid, end]. Default 0.1. */
  size?: Curve3;
  /** Per-particle size variation, 0…1. Default 0.3. */
  sizeJitter?: number;
  /** Colour over life: one, two or three palette colours. Default `white`. */
  color?: ColorCurve;
  /** Position (0…1 of life) of the middle key of the size / colour curves. Default 0.5. */
  mid?: number;
  /** Fraction of life spent fading in / out. Defaults 0.1 / 0.35. */
  fadeIn?: number;
  fadeOut?: number;
  /** Brightness multiplier (> ~1.2 blooms with additive blending). Default 1. */
  intensity?: number;
  /** Overall opacity. Default 1. */
  opacity?: number;
  /** Sprite look. Default `soft`. */
  sprite?: SpriteShape;
  /** `add` (glowing; default for soft / spark / ring) or `normal` (opaque-ish toon; default for the rest). */
  blend?: 'add' | 'normal';
  /** Streak length in seconds of travel (velocity-aligned). Default 0.05 for `spark`/`drop`, else 0. */
  stretch?: number;
  /** Sprite rotation speed, rad/s (random direction per particle). Default 0. */
  spin?: number;
  /** Radius of the random offset applied to the spawn point on every rebirth (breaks visible repetition). */
  reseed?: number;
  /** Affected by scene fog. Default: true for `normal` blending, false for `add`. */
  fog?: boolean;
  depthTest?: boolean;
  /** Draw order among transparent objects. */
  renderOrder?: number;
  /** Seed label for the random sub-stream. Default `particles`. */
  seed?: string;
}

export interface EmitOptions {
  /** Spawn point (local). Default origin. */
  position?: Vec3;
  /** Central direction; particles spread around it. Default: the system's emitter decides. */
  direction?: Vec3;
  /** Half-angle of the spread around `direction`, radians. Default π (all directions). */
  spread?: number;
  /** Speed override. */
  speed?: Range;
  /** Lifetime override. */
  life?: Range;
  /** Velocity added to every particle (e.g. the emitter's own motion). */
  inherit?: Vec3;
}

const VERTEX = /* glsl */ `
attribute vec4 aPosBirth;
attribute vec4 aVelLife;
attribute vec4 aSeed;
uniform float uKTime;
uniform float uLoop;
uniform vec2 uGate;
uniform float uRate;
uniform vec3 uGravity;
uniform vec3 uWind;
uniform float uDrag;
uniform vec3 uTurb;
uniform vec4 uSize;
uniform vec4 uCurve;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec4 uLook;
varying vec2 vUv;
varying vec4 vColor;
varying vec2 vSeed;
${FX_FOG_PARS_VERTEX}
${FX_NOISE}
${FX_OBJECT_SCALE}
void main() {
  float life = max( aVelLife.w, 1e-3 );
  float cyc = ( uKTime - aPosBirth.w ) / life;
  float cycle = floor( cyc );
  float a01 = uLoop > 0.5 ? cyc - cycle : cyc;
  float alive = step( 0.0, cyc ) * ( uLoop > 0.5 ? 1.0 : step( cyc, 1.0 ) );
  float age = a01 * life;
  // gate: a looping particle is visible only if its current life began while the emitter was switched on,
  // so switching off lets living particles finish their flight instead of popping
  float bornAt = uKTime - age;
  float gate = step( uGate.x, bornAt ) * ( uGate.y < uGate.x ? 1.0 : 1.0 - step( uGate.y, bornAt ) );
  alive *= mix( 1.0, gate, uLoop );
  alive *= smoothstep( aSeed.w - 0.06, aSeed.w + 0.06, uRate * 1.12 - 0.06 );

  vec3 rnd = fxHash33( vec3( aSeed.xy * 97.0, cycle + 3.0 ) ) - 0.5;
  vec3 p0 = aPosBirth.xyz + rnd * ( 2.0 * uCurve.w * uLoop );
  vec3 v0 = aVelLife.xyz;
  vec3 p;
  vec3 vel;
  if ( uDrag > 1e-3 ) {
    vec3 vInf = uWind + uGravity / uDrag;
    float e = exp( - uDrag * age );
    p = p0 + vInf * age + ( v0 - vInf ) * ( 1.0 - e ) / uDrag;
    vel = vInf + ( v0 - vInf ) * e;
  } else {
    p = p0 + v0 * age + 0.5 * uGravity * age * age;
    vel = v0 + uGravity * age;
  }
  if ( uTurb.x > 0.0 ) {
    float ph = dot( p0, vec3( uTurb.y ) );
    vec3 w = vec3(
      sin( age * uTurb.z * ( 0.7 + aSeed.x ) + aSeed.y * 6.2832 + ph ),
      cos( age * uTurb.z * ( 0.9 + aSeed.z ) + aSeed.x * 6.2832 + ph * 1.3 ),
      sin( age * uTurb.z * ( 1.1 + aSeed.y ) + aSeed.z * 6.2832 + ph * 0.7 ) );
    p += w * ( uTurb.x * smoothstep( 0.0, 0.35, a01 ) );
  }

  float mid = uCurve.x;
  float k = a01 < mid ? a01 / max( mid, 1e-3 ) : ( a01 - mid ) / max( 1.0 - mid, 1e-3 );
  float size = a01 < mid ? mix( uSize.x, uSize.y, k ) : mix( uSize.y, uSize.z, k );
  size *= ( 1.0 + ( aSeed.z - 0.5 ) * 2.0 * uSize.w ) * fxObjectScale() * alive;
  vec3 color = a01 < mid ? mix( uColor0, uColor1, k ) : mix( uColor1, uColor2, k );
  float alpha = smoothstep( 0.0, max( uCurve.y, 1e-3 ), a01 ) * ( 1.0 - smoothstep( 1.0 - uCurve.z, 1.0, a01 ) );
  vColor = vec4( color, alpha * alive );
  vSeed = aSeed.xy;
  vUv = uv;

  vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
  vec2 corner = position.xy;
  #ifdef FX_STRETCH
    vec3 vView = ( modelViewMatrix * vec4( vel, 0.0 ) ).xyz;
    float sp = length( vView.xy );
    vec2 dir = sp > 1e-5 ? vView.xy / sp : vec2( 0.0, 1.0 );
    float along = size + uLook.z * length( vView );
    mvPosition.xy += dir * ( corner.y * along ) + vec2( dir.y, - dir.x ) * ( corner.x * size );
  #else
    float ang = aSeed.x * 6.2832 + uLook.w * age * ( aSeed.y - 0.5 ) * 2.0;
    float cs = cos( ang );
    float sn = sin( ang );
    mvPosition.xy += vec2( corner.x * cs - corner.y * sn, corner.x * sn + corner.y * cs ) * size;
  #endif
  gl_Position = projectionMatrix * mvPosition;
  ${FX_FOG_VERTEX}
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec4 uLook;
uniform vec2 uOut; // intensity, opacity
varying vec2 vUv;
varying vec4 vColor;
varying vec2 vSeed;
${FX_COMMON}
${FX_FOG_PARS_FRAGMENT}
${FX_NOISE}
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float d = length( q );
  vec3 rgb = vColor.rgb;
  float a = 0.0;
  #if defined( FX_SPRITE_SOFT )
    float g = saturate( 1.0 - d );
    a = g * g;
    rgb *= 1.0 + 1.5 * g * g * g;
  #elif defined( FX_SPRITE_DISC )
    float aa = fwidth( d ) * 1.5;
    a = 1.0 - smoothstep( 0.9 - aa, 0.9, d );
    rgb *= mix( 0.86, 1.0, smoothstep( 0.2, -0.5, q.y - q.x * 0.3 ) );
    rgb = mix( rgb, vec3( 1.0 ), 0.75 * ( 1.0 - smoothstep( 0.1, 0.2, length( q - vec2( -0.3, 0.34 ) ) ) ) );
  #elif defined( FX_SPRITE_PUFF )
    // lumpy silhouette: the radius wobbles with the angle (fixed per particle), edge kept soft
    float ang = atan( q.y, q.x );
    float lump = 0.82 + 0.1 * sin( ang * 3.0 + vSeed.x * 6.2832 ) + 0.06 * sin( ang * 5.0 + vSeed.y * 6.2832 );
    a = 1.0 - smoothstep( lump - 0.22, lump, d );
    // two-tone cel shading: lighter crown, tinted belly (never grey)
    float crown = smoothstep( -0.25, 0.3, q.y + 0.25 * sin( q.x * 2.4 + vSeed.x * 6.2832 ) );
    rgb *= mix( 0.8, 1.0, crown );
  #elif defined( FX_SPRITE_SPARK )
    float w = saturate( 1.0 - abs( q.x ) );
    a = w * w * smoothstep( -1.0, -0.2, q.y ) * smoothstep( 1.0, 0.7, q.y ) * mix( 0.25, 1.0, vUv.y );
    rgb *= 1.0 + 2.0 * w * w * vUv.y;
  #elif defined( FX_SPRITE_DROP )
    // teardrop: round head (top = flight direction), tapering tail
    float r = mix( 0.28, 0.85, smoothstep( -1.0, 0.45, q.y ) ) * ( 1.0 - smoothstep( 0.45, 1.0, q.y ) * 0.35 );
    float sd = abs( q.x ) - r * sqrt( saturate( 1.0 - q.y * q.y ) );
    float aa = fwidth( sd ) * 1.5;
    a = 1.0 - smoothstep( - aa, aa, sd );
    rgb = mix( rgb, vec3( 1.0 ), 0.7 * ( 1.0 - smoothstep( 0.1, 0.22, length( q - vec2( -0.22, 0.35 ) ) ) ) );
  #elif defined( FX_SPRITE_BUBBLE )
    float aa = fwidth( d ) * 1.5;
    float rim = smoothstep( 0.7 - aa, 0.78, d ) * ( 1.0 - smoothstep( 0.92 - aa, 0.92, d ) );
    float fill = ( 1.0 - smoothstep( 0.9 - aa, 0.9, d ) ) * 0.16;
    float spot = 1.0 - smoothstep( 0.1, 0.2, length( q - vec2( -0.34, 0.36 ) ) );
    a = saturate( rim * 0.9 + fill + spot * 0.9 );
    rgb = mix( rgb, vec3( 1.0 ), saturate( spot + rim * 0.35 ) );
  #elif defined( FX_SPRITE_RING )
    float aa = fwidth( d ) * 1.5;
    a = smoothstep( 0.74 - aa, 0.8, d ) * ( 1.0 - smoothstep( 0.92, 0.98 + aa, d ) );
  #endif
  a *= vColor.a * uOut.y;
  if ( a < 0.003 ) discard;
  rgb *= uOut.x;
  float fogF = fxFogFactor();
  #ifdef FX_ADDITIVE
    gl_FragColor = vec4( rgb * a * ( 1.0 - fogF ), 0.0 );
  #else
    #ifdef USE_FOG
      rgb = mix( rgb, fogColor, fogF );
    #endif
    gl_FragColor = vec4( rgb * a, a );
  #endif
}
`;

function range(v: Range | undefined, fallback: number): readonly [number, number] {
  if (v === undefined) return [fallback, fallback];
  return typeof v === 'number' ? [v, v] : v;
}

function curve3(v: Curve3 | undefined, fallback: number): [number, number, number] {
  if (v === undefined) return [fallback, fallback, fallback];
  if (typeof v === 'number') return [v, v, v];
  if (v.length === 2) return [v[0], (v[0] + v[1]) / 2, v[1]];
  return [v[0], v[1], v[2]];
}

function colors3(v: ColorCurve | undefined): [Color, Color, Color] {
  if (v === undefined) return [col('white'), col('white'), col('white')];
  if (!Array.isArray(v)) return [col(v as ColorLike), col(v as ColorLike), col(v as ColorLike)];
  const list = v as readonly ColorLike[];
  if (list.length === 2) return [col(list[0]!), col(list[0]!).lerp(col(list[1]!), 0.5), col(list[1]!)];
  return [col(list[0]!), col(list[1]!), col(list[2]!)];
}

const _p = new Vector3();
const _d = new Vector3();
const _axis = new Vector3();
const _u = new Vector3();
const _v = new Vector3();

/** GPU particle system (see the file header). Add it under `ctx.root`; it animates by itself. */
export class ParticleSystem extends Mesh<InstancedBufferGeometry, ShaderMaterial> {
  /** Allocated particle slots. */
  readonly capacity: number;
  private readonly rng: Rng;
  private readonly emitter: Emitter;
  private readonly life: readonly [number, number];
  private readonly speed: readonly [number, number];
  private readonly posBirth: InstancedBufferAttribute;
  private readonly velLife: InstancedBufferAttribute;
  private readonly seeds: InstancedBufferAttribute;
  private readonly unfollow: () => void;
  private readonly looping: boolean;
  private cursor = 0;
  private on = true;

  constructor(env: FxEnv, opts: ParticleOptions) {
    const sprite = opts.sprite ?? 'soft';
    const loop = opts.loop ?? true;
    const additive = (opts.blend ?? (sprite === 'soft' || sprite === 'spark' || sprite === 'ring' ? 'add' : 'normal')) === 'add';
    const stretch = opts.stretch ?? (sprite === 'spark' || sprite === 'drop' ? 0.05 : 0);
    const capacity = opts.exactCount ? opts.count : capacityFor(env, opts.count);
    const geometry = instancedQuad(capacity);
    const [c0, c1, c2] = colors3(opts.color);
    const size = curve3(opts.size, 0.1);
    const own: Record<string, IUniform> = {
      uLoop: { value: loop ? 1 : 0 },
      uGate: { value: new Vector2(-1e9, -2e9) },
      uRate: { value: 1 },
      uGravity: { value: new Vector3(...(opts.gravity ?? [0, 0, 0])) },
      uWind: { value: new Vector3(...(opts.wind ?? [0, 0, 0])) },
      uDrag: { value: opts.drag ?? 0 },
      uTurb: {
        value: new Vector3(
          opts.turbulence?.amplitude ?? 0,
          opts.turbulence?.frequency ?? 1,
          opts.turbulence?.speed ?? 1,
        ),
      },
      uSize: { value: new Vector4(size[0], size[1], size[2], opts.sizeJitter ?? 0.3) },
      uCurve: {
        value: new Vector4(opts.mid ?? 0.5, opts.fadeIn ?? 0.1, opts.fadeOut ?? 0.35, opts.reseed ?? 0),
      },
      uColor0: { value: c0 },
      uColor1: { value: c1 },
      uColor2: { value: c2 },
      uLook: { value: new Vector4(0, 0, stretch, opts.spin ?? 0) },
      uOut: { value: new Vector2(opts.intensity ?? 1, opts.opacity ?? 1) },
    };
    const material = new ShaderMaterial({
      name: `fx.particles.${sprite}`,
      uniforms: UniformsUtils.merge([UniformsLib.fog, own]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      defines: {
        [`FX_SPRITE_${sprite.toUpperCase()}`]: '',
        ...(additive ? { FX_ADDITIVE: '' } : {}),
        ...(stretch > 0 ? { FX_STRETCH: '' } : {}),
      },
      transparent: true,
      depthWrite: false,
      depthTest: opts.depthTest ?? true,
      blending: additive ? AdditiveBlending : NormalBlending,
      premultipliedAlpha: true,
      fog: opts.fog ?? !additive,
    });
    material.uniforms.uKTime = kGlobals.uKTime;
    super(geometry, material);
    this.name = `particles:${sprite}`;
    this.frustumCulled = false;
    this.raycast = () => undefined; // shader-shaped: the base geometry is not where the effect is
    this.renderOrder = opts.renderOrder ?? 0;
    this.capacity = capacity;
    this.looping = loop;
    this.rng = env.random.fork(opts.seed ?? 'particles');
    this.emitter = opts.emitter ?? pointEmitter();
    this.life = range(opts.life, 2);
    this.speed = range(opts.speed, 1);
    this.posBirth = instanced(geometry, 'aPosBirth', new Float32Array(capacity * 4), 4);
    this.velLife = instanced(geometry, 'aVelLife', new Float32Array(capacity * 4), 4);
    this.seeds = instanced(geometry, 'aSeed', new Float32Array(capacity * 4), 4);
    const rng = this.rng;
    for (let i = 0; i < capacity; i++) {
      this.seeds.setXYZW(i, rng.next(), rng.next(), rng.next(), rng.next());
      if (loop) {
        this.emitter(rng, _p, _d);
        const life = rng.range(this.life[0], this.life[1]);
        const speed = rng.range(this.speed[0], this.speed[1]);
        // births are spread over one lifetime in the past, so the system starts in its steady state
        this.posBirth.setXYZW(i, _p.x, _p.y, _p.z, -rng.next() * life);
        this.velLife.setXYZW(i, _d.x * speed, _d.y * speed, _d.z * speed, life);
      } else {
        this.posBirth.setXYZW(i, 0, 0, 0, -1e9);
        this.velLife.setXYZW(i, 0, 0, 0, 1);
      }
    }
    this.unfollow = opts.exactCount
      ? () => undefined
      : followQuality(env, opts.count, capacity, (n) => (geometry.instanceCount = n));
  }

  /**
   * One-shot burst of `count` particles (for systems created with `loop: false`; on a looping system the
   * slots return to the loop after their flight). The count is scaled by the quality tier like `count`.
   */
  emit(count: number, opts: EmitOptions = {}): void {
    const n = Math.min(Math.max(1, Math.round(count)), this.geometry.instanceCount);
    const now = fxTime();
    const life = range(opts.life, 0);
    const speed = range(opts.speed, 0);
    const useDir = opts.direction !== undefined;
    if (useDir) {
      _axis.set(...opts.direction!).normalize();
      _u.set(Math.abs(_axis.y) < 0.99 ? 0 : 1, Math.abs(_axis.y) < 0.99 ? 1 : 0, 0)
        .cross(_axis)
        .normalize();
      _v.crossVectors(_axis, _u);
    }
    const spread = opts.spread ?? Math.PI;
    const rng = this.rng;
    const limit = this.geometry.instanceCount;
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % limit;
      this.emitter(rng, _p, _d);
      if (opts.position) _p.set(...opts.position);
      if (useDir) {
        const cos = 1 - rng.next() * (1 - Math.cos(spread));
        const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
        const phi = rng.next() * Math.PI * 2;
        _d.copy(_axis)
          .multiplyScalar(cos)
          .addScaledVector(_u, sin * Math.cos(phi))
          .addScaledVector(_v, sin * Math.sin(phi));
      }
      const s = opts.speed !== undefined ? rng.range(speed[0], speed[1]) : rng.range(this.speed[0], this.speed[1]);
      const l = opts.life !== undefined ? rng.range(life[0], life[1]) : rng.range(this.life[0], this.life[1]);
      const inh = opts.inherit ?? [0, 0, 0];
      this.posBirth.setXYZW(i, _p.x, _p.y, _p.z, now);
      this.velLife.setXYZW(i, _d.x * s + inh[0], _d.y * s + inh[1], _d.z * s + inh[2], l);
    }
    this.posBirth.needsUpdate = true;
    this.velLife.needsUpdate = true;
  }

  /** Kill every live one-shot particle (e.g. when a step is left). */
  reset(): void {
    if (this.looping) return;
    for (let i = 0; i < this.capacity; i++) this.posBirth.setW(i, -1e9);
    this.posBirth.needsUpdate = true;
  }

  /**
   * Switch a looping emitter on or off. Living particles finish their flight; pass `instant` (deep links,
   * `info.instant`) to apply the state as if it had always been so.
   */
  setEmitting(on: boolean, instant = false): void {
    const gate = this.material.uniforms.uGate!.value as Vector2;
    if (instant) {
      // on: an open window that began long ago; off: a window that closed long ago
      if (on) gate.set(-1e9, -2e9);
      else gate.set(-2e9, -1e9);
    } else if (on !== this.on) {
      const now = fxTime();
      if (on) gate.set(now, now - 1);
      else gate.y = Math.max(now, gate.x);
    }
    this.on = on;
  }

  get emitting(): boolean {
    return this.on;
  }

  /** 0…1 share of particles that are active (thins the stream smoothly; tweenable). */
  get rate(): number {
    return this.material.uniforms.uRate!.value as number;
  }
  set rate(v: number) {
    this.material.uniforms.uRate!.value = v;
  }

  /** Brightness multiplier (tweenable). */
  get intensity(): number {
    return (this.material.uniforms.uOut!.value as Vector2).x;
  }
  set intensity(v: number) {
    (this.material.uniforms.uOut!.value as Vector2).x = v;
  }

  /** Overall opacity (tweenable). Also used by `ctx.stage` actors with `appear: 'fade'`. */
  get fade(): number {
    return (this.material.uniforms.uOut!.value as Vector2).y;
  }
  set fade(v: number) {
    (this.material.uniforms.uOut!.value as Vector2).y = v;
  }

  /** Wind velocity (live vector; needs drag > 0). */
  get wind(): Vector3 {
    return this.material.uniforms.uWind!.value as Vector3;
  }

  /** Gravity / constant acceleration (live vector). */
  get gravity(): Vector3 {
    return this.material.uniforms.uGravity!.value as Vector3;
  }

  /** Replace the colour curve. */
  setColor(color: ColorCurve): this {
    const [a, b, c] = colors3(color);
    (this.material.uniforms.uColor0!.value as Color).copy(a);
    (this.material.uniforms.uColor1!.value as Color).copy(b);
    (this.material.uniforms.uColor2!.value as Color).copy(c);
    return this;
  }

  /** Scale all sizes (tweenable through a proxy; start/mid/end keep their ratios). */
  setSize(size: Curve3): this {
    const s = curve3(size, 0.1);
    const u = this.material.uniforms.uSize!.value as Vector4;
    u.set(s[0], s[1], s[2], u.w);
    return this;
  }

  /** Called by the engine's disposables tracker. */
  override dispose(): void {
    this.unfollow();
  }
}

/** Create a particle system (see `ParticleOptions`). */
export function createParticles(env: FxEnv, opts: ParticleOptions): ParticleSystem {
  return new ParticleSystem(env, opts);
}
