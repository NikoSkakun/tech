/**
 * Gluon — a springy `lime` string between two points (STYLE_GUIDE §2.2: "lime springy").
 *
 * An instanced ribbon drawn as the 2D projection of a helix: the strand passing in front is brighter and
 * thicker than the strand behind, which reads as a coil. The spring keeps its number of turns and loses
 * amplitude when stretched, jitters constantly, and small flashes (virtual gluons) run along it.
 */
import {
  AdditiveBlending,
  type Color,
  DoubleSide,
  Mesh,
  ShaderMaterial,
  Vector4,
  type InstancedBufferAttribute,
  type InstancedBufferGeometry,
} from 'three';
import { col, kGlobals, SEMANTIC, type ColorLike } from '@/style';
import { FX_COMMON, FX_OBJECT_SCALE } from '../core/glsl';
import { instanced, instancedStrip } from '../core/quad';
import type { Vec3 } from '../particles/emitters';
import { hotCore } from './orb';

export interface GluonOptions {
  /** Number of springs. Default 1. */
  count?: number;
  color?: ColorLike;
  /** Number of coil turns. Default 7. */
  turns?: number;
  /** Coil radius at rest length, units. Default 0.1. */
  amplitude?: number;
  /** Strand thickness, units. Default 0.035. */
  width?: number;
  /** Distance between the ends at which the coil has its full amplitude, units. Default 1. */
  restLength?: number;
  /** Brightness (> 1 blooms). Default 1.25. */
  intensity?: number;
  name?: string;
}

const VERTEX = /* glsl */ `
attribute vec4 aA; // xyz end A, w seed
attribute vec4 aB; // xyz end B, w strength (0 hides)
uniform float uKTime;
uniform vec4 uSpring; // turns, amplitude, half thickness, rest length
varying vec3 vRib; // s, across, front (−1 behind … +1 in front)
varying float vSeed;
varying float vStrength;
${FX_OBJECT_SCALE}
void main() {
  float s = position.x;
  float os = fxObjectScale();
  vec3 A = ( modelViewMatrix * vec4( aA.xyz, 1.0 ) ).xyz;
  vec3 B = ( modelViewMatrix * vec4( aB.xyz, 1.0 ) ).xyz;
  vec3 AB = B - A;
  float len = max( length( AB ), 1e-4 );
  vec3 D = AB / len;
  vec3 C = mix( A, B, s );
  vec3 side = cross( D, normalize( - C ) );
  float sl = length( side );
  vec3 S = sl > 1e-4 ? side / sl : vec3( 0.0, 1.0, 0.0 );
  float seed = aA.w;
  float t = uKTime;
  // a stretched spring keeps its turns and gets slimmer; a compressed one bulges
  float tension = clamp( uSpring.w * os / len, 0.3, 1.5 );
  float jitter = 1.0 + 0.16 * sin( t * 9.0 + seed * 40.0 ) + 0.08 * sin( t * 14.3 + seed * 17.0 );
  float taper = pow( sin( 3.14159 * s ), 0.6 );
  float amp = uSpring.y * os * tension * jitter * taper;
  float k = 6.2832 * uSpring.x;
  float ph = k * s + 0.5 * sin( t * 6.0 + seed * 23.0 ) - t * 1.7;
  float w = sin( ph ) * amp;
  float front = cos( ph );
  float dw = cos( ph ) * k * amp / len;
  vec2 nrm = normalize( vec2( - dw, 1.0 ) );
  float off = position.y * 2.0 * uSpring.z * os * 2.6 * mix( 0.75, 1.15, front * 0.5 + 0.5 );
  vec3 P = C + D * ( nrm.x * off ) + S * ( w + nrm.y * off );
  P.z += front * amp * 0.5; // the front strand really is nearer: it wins the depth test against orbs
  vRib = vec3( s, position.y * 2.0, front );
  vSeed = seed;
  vStrength = aB.w;
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec3 uCore;
uniform vec4 uOut; // intensity, fade
varying vec3 vRib;
varying float vSeed;
varying float vStrength;
${FX_COMMON}
void main() {
  float a = 1.0 - abs( vRib.y );
  float core = smoothstep( 0.55, 0.75, a );
  float glow = a * a * 0.4;
  float depthCue = mix( 0.4, 1.0, vRib.z * 0.5 + 0.5 );
  // virtual gluons: bright beads running from end to end
  float bead = pow( max( sin( 6.2832 * ( vRib.x * 1.5 - uKTime * 0.9 + vSeed ) ), 0.0 ), 14.0 );
  vec3 c = mix( uColor, uCore, saturate( core * 0.7 + bead ) ) * ( core + glow ) * ( depthCue + bead * 1.6 );
  gl_FragColor = vec4( c * ( uOut.x * uOut.y * vStrength ), 0.0 );
}
`;

/** Gluon springs (instanced). Create through `createGluons()`. */
export class Gluons extends Mesh<InstancedBufferGeometry, ShaderMaterial> {
  readonly capacity: number;
  private readonly a: InstancedBufferAttribute;
  private readonly b: InstancedBufferAttribute;

  constructor(opts: GluonOptions = {}) {
    const capacity = Math.max(1, opts.count ?? 1);
    const geometry = instancedStrip(96, capacity);
    const color = col(opts.color ?? SEMANTIC.gluon);
    const material = new ShaderMaterial({
      name: 'fx.gluon',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uSpring: {
          value: new Vector4(
            opts.turns ?? 7,
            opts.amplitude ?? 0.1,
            (opts.width ?? 0.035) / 2,
            opts.restLength ?? 1,
          ),
        },
        uColor: { value: color },
        uCore: { value: hotCore(color, 0.45) },
        uOut: { value: new Vector4(opts.intensity ?? 1.25, 1, 0, 0) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      premultipliedAlpha: true,
      side: DoubleSide, // the strip's winding depends on its direction on screen
    });
    super(geometry, material);
    this.name = opts.name ?? 'gluons';
    this.frustumCulled = false;
    this.raycast = () => undefined; // shader-shaped: the base geometry is not where the effect is
    this.capacity = capacity;
    this.a = instanced(geometry, 'aA', new Float32Array(capacity * 4), 4);
    this.b = instanced(geometry, 'aB', new Float32Array(capacity * 4), 4);
    for (let i = 0; i < capacity; i++) {
      this.a.setXYZW(i, -0.5, 0, 0, (i * 0.7548) % 1);
      this.b.setXYZW(i, 0.5, 0, 0, 1);
    }
  }

  /** Attach spring `i` between two points (local space). `strength` 0 hides it, 1 = full brightness. */
  setEnds(i: number, a: Vec3, b: Vec3, strength = 1): void {
    this.a.setXYZ(i, a[0], a[1], a[2]);
    this.b.setXYZW(i, b[0], b[1], b[2], strength);
  }

  /** Upload changes made with `setEnds`. */
  commit(): void {
    this.a.needsUpdate = true;
    this.b.needsUpdate = true;
  }

  get color(): Color {
    return this.material.uniforms.uColor!.value as Color;
  }

  /** Brightness (tweenable). */
  get intensity(): number {
    return (this.material.uniforms.uOut!.value as Vector4).x;
  }
  set intensity(v: number) {
    (this.material.uniforms.uOut!.value as Vector4).x = v;
  }

  /** Visibility 0…1 (tweenable). */
  get fade(): number {
    return (this.material.uniforms.uOut!.value as Vector4).y;
  }
  set fade(v: number) {
    (this.material.uniforms.uOut!.value as Vector4).y = v;
  }
}

/** Gluon springs: `setEnds(i, a, b)` every time the quarks move, then `commit()`. */
export function createGluons(opts: GluonOptions = {}): Gluons {
  return new Gluons(opts);
}
