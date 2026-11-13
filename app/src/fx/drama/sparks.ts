/**
 * Sparks, short-circuit flash and fake light shafts.
 */
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Group, Mesh, ShaderMaterial, Vector4 } from 'three';
import { col, kGlobals, type ColorLike } from '@/style';
import type { FxEnv } from '../core/env';
import { FX_COMMON, FX_NOISE } from '../core/glsl';
import type { Vec3 } from '../particles/emitters';
import { ParticleSystem } from '../particles/system';
import { createFlash, type Glow } from './glows';

export interface SparksOptions {
  /** Pool size (sparks alive at once). Default 160. */
  count?: number;
  /**
   * Colours over life [birth, middle, death]. Default white-hot → `yellow` → `orange`. A single colour (M3)
   * becomes white-hot → that colour → that colour at 55 % (e.g. `'cyan'` for an arc in a vacuum tube).
   */
  color?: readonly [ColorLike, ColorLike, ColorLike] | ColorLike;
  /** Spark thickness, units. Default 0.035. */
  size?: number;
  /** Downward acceleration, units/s². Default 5. */
  gravity?: number;
  intensity?: number;
}

function sparkColors(c: SparksOptions['color']): [ColorLike, ColorLike, ColorLike] {
  if (c === undefined) return ['white', 'yellow', 'orange'];
  if (Array.isArray(c)) return [c[0], c[1], c[2]] as [ColorLike, ColorLike, ColorLike];
  const base = col(c as ColorLike);
  return [base.clone().lerp(new Color(1, 1, 1), 0.65), base, base.clone().multiplyScalar(0.55)];
}

/** A pool of streak sparks. `burst()` throws a handful from a point. */
export class Sparks extends ParticleSystem {
  constructor(env: FxEnv, o: SparksOptions = {}) {
    const s = o.size ?? 0.035;
    super(env, {
      count: o.count ?? 160,
      loop: false,
      sprite: 'spark',
      color: sparkColors(o.color),
      mid: 0.3,
      size: [s, s * 0.8, s * 0.3],
      life: [0.35, 0.9],
      speed: [1.5, 4.5],
      gravity: [0, -(o.gravity ?? 5), 0],
      drag: 0.6,
      stretch: 0.06,
      fadeIn: 0.02,
      fadeOut: 0.5,
      intensity: o.intensity ?? 3,
      seed: 'sparks',
    });
    this.name = 'sparks';
  }

  /** Throw `count` sparks from `position`, optionally around a direction (half-angle `spread`). */
  burst(position: Vec3, count = 24, direction?: Vec3, spread = 0.9): void {
    this.emit(count, { position, direction, spread: direction ? spread : Math.PI });
  }
}

export function createSparks(env: FxEnv, o: SparksOptions = {}): Sparks {
  return new Sparks(env, o);
}

export interface ShortCircuit extends Group {
  readonly flash: Glow;
  readonly sparks: Sparks;
  /** Flash + sparks at `position` (local space of the group). */
  fire(position?: Vec3): void;
}

/** Short-circuit burst: a white-hot flash with an expanding ring and a shower of sparks. */
export function createShortCircuit(env: FxEnv, o: { size?: number; color?: ColorLike } = {}): ShortCircuit {
  const group = new Group() as ShortCircuit;
  group.name = 'short-circuit';
  const flash = createFlash({ size: o.size ?? 2.2, color: o.color ?? 'yellow', intensity: 3.2, speed: 0.45 });
  const sparks = createSparks(env);
  group.add(flash, sparks);
  Object.assign(group, {
    flash,
    sparks,
    fire(position: Vec3 = [0, 0, 0]): void {
      flash.position.set(...position);
      flash.fire();
      sparks.burst(position, 40);
    },
  });
  return group;
}

export interface LightShaftOptions {
  color?: ColorLike;
  /** Length of the shaft, units. Default 3. */
  length?: number;
  /** Radius at the source / at the far end, units. Defaults 0.1 / 0.9. */
  radiusTop?: number;
  radiusBottom?: number;
  /** Brightness. Default 0.5 (shafts are seasoning, not searchlights). */
  intensity?: number;
}

/**
 * Fake volumetric light shaft: an additive cone that is bright where you look along its surface and fades
 * toward the far end, with slow dust streaks. The source is at the object's origin, the light falls along −Y.
 */
export function createLightShaft(o: LightShaftOptions = {}): Mesh<CylinderGeometry, ShaderMaterial> {
  const length = o.length ?? 3;
  const r0 = o.radiusTop ?? 0.1;
  const r1 = o.radiusBottom ?? 0.9;
  // open truncated cone, source at y = 0, light falling along −Y
  const geometry = new CylinderGeometry(r0, r1, length, 40, 1, true).translate(0, -length / 2, 0);
  const material = new ShaderMaterial({
    name: 'fx.light-shaft',
    uniforms: {
      uKTime: kGlobals.uKTime,
      uColor: { value: col(o.color ?? 'yellow.light') },
      uShaft: { value: new Vector4(o.intensity ?? 0.5, 1, length, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vView;
      varying vec2 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vN = normalize( normalMatrix * normal );
        vView = normalize( - mv.xyz );
        vP = vec2( atan( position.z, position.x ), - position.y );
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uKTime;
      uniform vec3 uColor;
      uniform vec4 uShaft; // intensity, fade, length
      varying vec3 vN;
      varying vec3 vView;
      varying vec2 vP;
      ${FX_COMMON}
      ${FX_NOISE}
      void main() {
        // soft silhouette: the cone wall is brightest where it faces the viewer and vanishes at the rim
        float facing = abs( dot( normalize( vN ), normalize( vView ) ) );
        float along = vP.y / uShaft.z;
        float streaks = 0.75 + 0.25 * fxNoise( vec2( vP.x * 5.0, uKTime * 0.15 ) );
        float a = facing * facing * ( 1.0 - along ) * ( 1.0 - along ) * smoothstep( 0.0, 0.05, along ) * streaks;
        gl_FragColor = vec4( uColor * ( a * uShaft.x * uShaft.y ), 0.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'light-shaft';
  return mesh;
}
