/**
 * Beam — a straight ray of light / laser / particle beam between two points: a camera-facing ribbon with a
 * white-hot core, a coloured glow and brightness ripples running along it. For individual photons flying
 * along a line use `createPhotons({ travel })`.
 */
import { AdditiveBlending, type Color, DoubleSide, Mesh, ShaderMaterial, Vector3, Vector4 } from 'three';
import { col, kGlobals, SEMANTIC, type ColorLike } from '@/style';
import { FX_COMMON } from '../core/glsl';
import { instancedStrip } from '../core/quad';
import { hotCore } from '../characters/orb';
import type { Vec3 } from '../particles/emitters';

export interface BeamOptions {
  from?: Vec3;
  to?: Vec3;
  color?: ColorLike;
  /** Width of the bright core, units. Default 0.05. */
  width?: number;
  /** Brightness (> 1 blooms). Default 2.2. */
  intensity?: number;
  /** Speed of the ripples along the beam, units/s. Default 6. */
  speed?: number;
  /** Ripple strength 0…1 (0 = steady laser). Default 0.35. */
  ripple?: number;
}

const VERTEX = /* glsl */ `
uniform vec3 uFrom;
uniform vec3 uTo;
uniform vec4 uBeam; // half core width, reach 0…1, unused, unused
varying vec2 vRib;
varying float vLen;
void main() {
  vec3 A = ( modelViewMatrix * vec4( uFrom, 1.0 ) ).xyz;
  vec3 B = ( modelViewMatrix * vec4( mix( uFrom, uTo, uBeam.y ), 1.0 ) ).xyz;
  vec3 D = B - A;
  float len = max( length( D ), 1e-5 );
  vec3 C = mix( A, B, position.x );
  vec3 side = cross( D / len, normalize( - C ) );
  float sl = length( side );
  vec3 S = sl > 1e-4 ? side / sl : vec3( 0.0, 1.0, 0.0 );
  float os = length( modelMatrix[ 0 ].xyz );
  vec3 P = C + S * ( position.y * 2.0 * uBeam.x * os * 4.0 );
  vRib = vec2( position.x, position.y * 2.0 );
  vLen = len;
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec3 uCore;
uniform vec4 uOut; // intensity, fade, ripple speed, ripple strength
varying vec2 vRib;
varying float vLen;
${FX_COMMON}
void main() {
  float a = 1.0 - abs( vRib.y );
  float core = smoothstep( 0.68, 0.8, a );
  float glow = a * a * 0.4;
  float d = vRib.x * vLen;
  float ripple = 1.0 + uOut.w * ( sin( d * 5.0 - uKTime * uOut.z * 5.0 ) * 0.6 + sin( d * 1.7 - uKTime * uOut.z * 1.9 ) * 0.4 );
  // soft start and end caps
  float caps = smoothstep( 0.0, 0.03, vRib.x ) * smoothstep( 1.0, 0.985, vRib.x );
  vec3 c = mix( uColor, uCore, core ) * ( core + glow ) * ripple;
  gl_FragColor = vec4( c * ( caps * uOut.x * uOut.y ), 0.0 );
}
`;

/** A light beam. Create through `createBeam()`. */
export class Beam extends Mesh<ReturnType<typeof instancedStrip>, ShaderMaterial> {
  constructor(o: BeamOptions = {}) {
    const color = col(o.color ?? SEMANTIC.photon);
    const material = new ShaderMaterial({
      name: 'fx.beam',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uFrom: { value: new Vector3(...(o.from ?? [0, 0, 0])) },
        uTo: { value: new Vector3(...(o.to ?? [1, 0, 0])) },
        uBeam: { value: new Vector4((o.width ?? 0.05) / 2, 1, 0, 0) },
        uColor: { value: color },
        uCore: { value: hotCore(color, 0.8) },
        uOut: { value: new Vector4(o.intensity ?? 2.2, 1, o.speed ?? 6, o.ripple ?? 0.35) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      premultipliedAlpha: true,
      side: DoubleSide,
    });
    super(instancedStrip(1, 1), material);
    this.name = 'beam';
    this.frustumCulled = false;
    this.raycast = () => undefined; // shader-shaped: the base geometry is not where the effect is
  }

  /** Start point (live vector, local space). */
  get from(): Vector3 {
    return this.material.uniforms.uFrom!.value as Vector3;
  }
  /** End point (live vector, local space). */
  get to(): Vector3 {
    return this.material.uniforms.uTo!.value as Vector3;
  }
  get color(): Color {
    return this.material.uniforms.uColor!.value as Color;
  }
  /** 0…1 how far the beam has reached from `from` toward `to` (tween it to "fire" the beam). */
  get reach(): number {
    return (this.material.uniforms.uBeam!.value as Vector4).y;
  }
  set reach(v: number) {
    (this.material.uniforms.uBeam!.value as Vector4).y = v;
  }
  get intensity(): number {
    return (this.material.uniforms.uOut!.value as Vector4).x;
  }
  set intensity(v: number) {
    (this.material.uniforms.uOut!.value as Vector4).x = v;
  }
  get fade(): number {
    return (this.material.uniforms.uOut!.value as Vector4).y;
  }
  set fade(v: number) {
    (this.material.uniforms.uOut!.value as Vector4).y = v;
  }
}

/** A light / laser beam between two points (see `BeamOptions`). */
export function createBeam(o: BeamOptions = {}): Beam {
  return new Beam(o);
}
