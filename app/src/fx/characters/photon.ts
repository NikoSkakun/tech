/**
 * Photon — a short wavy packet of light (STYLE_GUIDE §2.2: `yellow` → white, wavy).
 *
 * One instanced ribbon per photon: a sine carrier under a gaussian envelope, drawn in the plane that faces
 * the camera, with constant thickness along the curve, a white-hot centre line and a soft coloured glow.
 * The wiggles run through the envelope, so even a photon at rest looks alive. In *stream* mode the packets
 * fly along their direction and respawn (a looping beam of photons: lamp, sunlight on a PV cell, laser).
 */
import {
  AdditiveBlending,
  type Color,
  DoubleSide,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Vector4,
  type InstancedBufferAttribute,
  type InstancedBufferGeometry,
} from 'three';
import { col, kGlobals, SEMANTIC, type ColorLike } from '@/style';
import { wavelengthToColor } from '../core/color';
import { FX_COMMON, FX_OBJECT_SCALE } from '../core/glsl';
import { instanced, instancedStrip } from '../core/quad';
import { onTick } from '../core/tick';
import type { Vec3 } from '../particles/emitters';
import { hotCore } from './orb';

export interface PhotonOptions {
  /** Number of packets. Default 1 (a hero photon travelling along the object's +X). */
  count?: number;
  /** Wavelength in nm: sets the colour and the number of wiggles. Default: `yellow` photon, 5 wiggles. */
  wavelength?: number;
  /** Explicit colour (overrides the wavelength colour). */
  color?: ColorLike;
  /** Packet length, units. Default 1.6. */
  length?: number;
  /** Wave amplitude, units. Default 0.13. */
  amplitude?: number;
  /** Thickness of the bright line, units. Default 0.05. */
  width?: number;
  /** Wiggles inside the packet. Default from `wavelength`, else 5. */
  waves?: number;
  /** Brightness (> 1 blooms). Default 1.7. */
  intensity?: number;
  /** Stream mode: distance each packet flies before it respawns at its origin. Default 0 (no travel). */
  travel?: number;
  /** Stream mode: flight speed, units/s (tweenable through `.speed`). Default 3. */
  speed?: number;
  /**
   * Keep the colour on screen: no white core, the core covers the backdrop and is pre-compensated for the white
   * bleed (as `K.glow({ keepHue })`). Default: true when `wavelength` is given (the hue is the message — red vs
   * violet light), false otherwise (the default photon is yellow with a white-hot core).
   */
  keepHue?: boolean;
  name?: string;
}

const VERTEX = /* glsl */ `
attribute vec4 aOrigin; // xyz origin, w phase 0…1
attribute vec4 aDir;    // xyz unit direction, w scale
uniform float uKTime;
uniform vec4 uShape; // length, amplitude, half thickness, waves
uniform vec4 uAnim;  // carrier angular speed, travel distance, stream phase (cycles), unused
varying vec2 vRib;
varying float vEnv;
${FX_OBJECT_SCALE}
void main() {
  float s = position.x;
  float os = fxObjectScale() * aDir.w;
  float travel = uAnim.y;
  float u = fract( aOrigin.w + uAnim.z );
  vec3 c = aOrigin.xyz + aDir.xyz * ( travel > 0.0 ? u * travel : 0.0 );
  float streamFade = travel > 0.0 ? smoothstep( 0.0, 0.1, u ) * smoothstep( 1.0, 0.86, u ) : 1.0;
  vec3 C = ( modelViewMatrix * vec4( c, 1.0 ) ).xyz;
  vec3 D = normalize( ( modelViewMatrix * vec4( aDir.xyz, 0.0 ) ).xyz );
  vec3 side = cross( D, normalize( - C ) );
  float sl = length( side );
  vec3 S = sl > 1e-4 ? side / sl : vec3( 0.0, 1.0, 0.0 );
  float len = uShape.x * os;
  float x = s - 0.5;
  const float SIGMA2 = 0.19 * 0.19;
  float env = exp( - x * x / ( 2.0 * SIGMA2 ) );
  float k = 6.2832 * uShape.w;
  float ph = k * s - uKTime * uAnim.x - aOrigin.w * 40.0;
  float amp = uShape.y * os;
  float w = sin( ph ) * amp * env;
  // slope of the centre line → offset along its normal keeps the ribbon equally thick on steep flanks
  float dw = ( cos( ph ) * k - sin( ph ) * x / SIGMA2 ) * env * amp / len;
  vec2 nrm = normalize( vec2( - dw, 1.0 ) );
  float off = position.y * 2.0 * uShape.z * os * 3.2 * ( 0.35 + 0.65 * env );
  vec3 P = C + D * ( x * len + nrm.x * off ) + S * ( w + nrm.y * off );
  vRib = vec2( s, position.y * 2.0 );
  vEnv = env * streamFade * step( 1e-4, aDir.w );
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uCore;
uniform vec4 uOut; // intensity, fade
varying vec2 vRib;
varying float vEnv;
${FX_COMMON}
void main() {
  float a = 1.0 - abs( vRib.y );
  // the quad is 3.2× the line thickness: a crisp core in the middle, a soft glow around it
  float core = smoothstep( 0.62, 0.78, a );
  float glow = a * a * 0.4;
  #ifdef FX_PHOTON_KEEP_HUE
    vec3 c = uColor * ( core + glow ) * ( vEnv * uOut.x * uOut.y );
    // premultiplied "over": the core hides the backdrop in proportion to its brightness (the glow stays additive)
    gl_FragColor = vec4( fxKeepHue( c, 1.3 ), core * saturate( max( c.r, max( c.g, c.b ) ) ) * 0.9 );
  #else
    vec3 c = mix( uColor, uCore, core * 0.8 ) * ( core + glow );
    gl_FragColor = vec4( c * ( vEnv * uOut.x * uOut.y ), 0.0 );
  #endif
}
`;

/** Photon packets (hero or instanced). Create through `createPhoton()` / `createPhotons()`. */
export class Photons extends Mesh<InstancedBufferGeometry, ShaderMaterial> {
  readonly capacity: number;
  /** Stream flight speed, units/s (tweenable; sign reverses). */
  speed: number;
  private readonly origin: InstancedBufferAttribute;
  private readonly dir: InstancedBufferAttribute;

  constructor(opts: PhotonOptions = {}) {
    const capacity = Math.max(1, opts.count ?? 1);
    const geometry = instancedStrip(56, capacity);
    const spectral = opts.wavelength !== undefined ? wavelengthToColor(opts.wavelength) : null;
    const color = opts.color !== undefined ? col(opts.color) : (spectral?.color ?? col(SEMANTIC.photon));
    const faint = spectral && spectral.band !== 'visible' ? 0.6 : 1;
    const keepHue = opts.keepHue ?? spectral !== null;
    const material = new ShaderMaterial({
      name: 'fx.photon',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uShape: {
          value: new Vector4(
            opts.length ?? 1.6,
            opts.amplitude ?? 0.13,
            (opts.width ?? 0.05) / 2,
            opts.waves ?? spectral?.waves ?? 5,
          ),
        },
        uAnim: { value: new Vector4(14, opts.travel ?? 0, 0, 0) },
        uColor: { value: color },
        uCore: { value: hotCore(color, 0.5) },
        uOut: { value: new Vector4((opts.intensity ?? 1.7) * faint, 1, 0, 0) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      defines: keepHue ? { FX_PHOTON_KEEP_HUE: '' } : {},
      transparent: true,
      depthWrite: false,
      // premultiplied NormalBlending = (ONE, ONE_MINUS_SRC_ALPHA): alpha 0 keeps the glow additive
      blending: keepHue ? NormalBlending : AdditiveBlending,
      premultipliedAlpha: true,
      side: DoubleSide, // the strip's winding depends on its direction on screen
    });
    super(geometry, material);
    this.name = opts.name ?? 'photons';
    this.frustumCulled = false;
    this.raycast = () => undefined; // shader-shaped: the base geometry is not where the effect is
    this.capacity = capacity;
    this.speed = opts.speed ?? 3;
    this.origin = instanced(geometry, 'aOrigin', new Float32Array(capacity * 4), 4);
    this.dir = instanced(geometry, 'aDir', new Float32Array(capacity * 4), 4);
    for (let i = 0; i < capacity; i++) {
      this.origin.setXYZW(i, 0, 0, 0, (i * 0.61803) % 1);
      this.dir.setXYZW(i, 1, 0, 0, 1);
    }
    // stream phase is integrated so that tweening `speed` never makes packets jump
    onTick(this, (_t, dt) => {
      const anim = material.uniforms.uAnim!.value as Vector4;
      if (anim.y > 0) anim.z = (anim.z + (this.speed * dt) / anim.y) % 1024;
    });
  }

  /** Place packet `i`: origin, flight direction (normalised here), optional phase 0…1 and scale. */
  setPhoton(i: number, origin: Vec3, direction: Vec3, phase?: number, scale = 1): void {
    const l = Math.hypot(direction[0], direction[1], direction[2]) || 1;
    this.origin.setXYZW(i, origin[0], origin[1], origin[2], phase ?? this.origin.getW(i));
    this.dir.setXYZW(i, direction[0] / l, direction[1] / l, direction[2] / l, scale);
  }

  /** Upload changes made with `setPhoton`. */
  commit(): void {
    this.origin.needsUpdate = true;
    this.dir.needsUpdate = true;
  }

  /** Change colour by wavelength (nm): colour and wiggle count follow. */
  setWavelength(nm: number): this {
    const s = wavelengthToColor(nm);
    this.setColor(s.color);
    (this.material.uniforms.uShape!.value as Vector4).w = s.waves;
    return this;
  }

  setColor(color: ColorLike): this {
    const c = col(color, this.material.uniforms.uColor!.value as Color);
    (this.material.uniforms.uCore!.value as Color).copy(hotCore(c, 0.5));
    return this;
  }

  /** Stream travel distance, units. */
  get travel(): number {
    return (this.material.uniforms.uAnim!.value as Vector4).y;
  }
  set travel(v: number) {
    (this.material.uniforms.uAnim!.value as Vector4).y = v;
  }

  /** Brightness (tweenable). */
  get intensity(): number {
    return (this.material.uniforms.uOut!.value as Vector4).x;
  }
  set intensity(v: number) {
    (this.material.uniforms.uOut!.value as Vector4).x = v;
  }

  /** Visibility 0…1 (tweenable; `appear: 'fade'` actors drive it). */
  get fade(): number {
    return (this.material.uniforms.uOut!.value as Vector4).y;
  }
  set fade(v: number) {
    (this.material.uniforms.uOut!.value as Vector4).y = v;
  }
}

/** A single hero photon: it points along the object's local +X — move / rotate the object. */
export function createPhoton(opts: Omit<PhotonOptions, 'count'> = {}): Photons {
  return new Photons({ ...opts, count: 1 });
}

/** Instanced photons (`setPhoton(i, origin, direction)`), optionally as a looping stream (`travel`). */
export function createPhotons(opts: PhotonOptions): Photons {
  return new Photons(opts);
}
