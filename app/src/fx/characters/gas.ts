/**
 * Gas motion for orbs: particles wander around home positions inside a box (thermal motion) and, on top of
 * that, drift together with a common velocity, wrapping through the box (electron gas in a metal, ions in an
 * electrolyte, molecules of a hot gas). Entirely in the vertex shader; the controller only integrates two
 * phases, so `thermal` and `drift` can be tweened without jumps.
 */
import { Vector3, Vector4 } from 'three';
import type { Rng } from '@/engine/api';
import { capacityFor, followQuality, type FxEnv } from '../core/env';
import { instanced } from '../core/quad';
import { onTick } from '../core/tick';
import type { Vec3 } from '../particles/emitters';
import { Orbs, type OrbMotion, type OrbOptions } from './orb';

export interface GasOptions extends Omit<OrbOptions, 'motion' | 'count'> {
  /** Nominal number of particles at quality `high`. */
  count: number;
  /** Do not scale `count` with the quality tier. */
  exactCount?: boolean;
  /** Box size (local units), centred on the object's origin. */
  box: Vec3;
  /** How far a particle wanders from its home position, units. Default 12 % of the smallest box side. */
  wander?: number;
  /** Thermal agitation speed multiplier (1 = lively, 0 = frozen). Default 1. */
  thermal?: number;
  /** Common drift velocity, units/s (e.g. opposite to the field for electrons). Default none. */
  drift?: Vec3;
  /** Seed label. Default `gas`. */
  seed?: string;
}

function gasMotion(rng: Rng, box: Vec3, wander: number): OrbMotion {
  return {
    pars: /* glsl */ `
      attribute vec4 aInst; // xyz home position in box coordinates 0…1, w scale
      attribute vec4 aVel;  // xyz wander frequencies, w seed
      uniform vec3 uBox;
      uniform vec4 uGas;    // xyz drift displacement (units), w thermal phase
      uniform float uWander;
    `,
    main: /* glsl */ `
      float tau = uGas.w;
      vec3 f = aVel.xyz;
      float s0 = aVel.w * 6.2832;
      // bounded wandering: two incommensurate sines per axis read as random thermal jitter, never wrap
      vec3 wob = vec3(
        sin( tau * f.x + s0 ) + 0.55 * sin( tau * f.y * 2.3 + s0 * 3.1 ),
        sin( tau * f.y + s0 * 1.7 ) + 0.55 * sin( tau * f.z * 2.1 + s0 * 2.3 ),
        sin( tau * f.z + s0 * 2.9 ) + 0.55 * sin( tau * f.x * 1.9 + s0 * 1.3 ) ) * ( uWander / 1.55 );
      vec3 q = fract( aInst.xyz + ( uGas.xyz + wob ) / uBox );
      // particles carried through a wall by the drift shrink out and grow back in on the other side
      vec3 edge = smoothstep( 0.0, 0.05, q ) * smoothstep( 1.0, 0.95, q );
      center = ( q - 0.5 ) * uBox;
      scale = aInst.w * edge.x * edge.y * edge.z;
      seed = aVel.w;
    `,
    uniforms: {
      uBox: { value: new Vector3(...box) },
      uGas: { value: new Vector4(0, 0, 0, 0) },
      uWander: { value: wander },
    },
    attributes(geometry, capacity) {
      const inst = new Float32Array(capacity * 4);
      const vel = new Float32Array(capacity * 4);
      for (let i = 0; i < capacity; i++) {
        inst.set([rng.next(), rng.next(), rng.next(), 1], i * 4);
        vel.set([rng.range(1.2, 3.2), rng.range(1.2, 3.2), rng.range(1.2, 3.2), rng.next()], i * 4);
      }
      instanced(geometry, 'aInst', inst, 4);
      instanced(geometry, 'aVel', vel, 4);
    },
  };
}

/** Orbs moving like a gas in a box. Create through `createGas()`. */
export class OrbGas extends Orbs {
  /** Thermal agitation speed multiplier (tweenable). */
  thermal: number;
  /** Common drift velocity in local units/s (live vector; tween its components). */
  readonly drift: Vector3;
  private readonly unfollow: () => void;

  constructor(env: FxEnv, opts: GasOptions) {
    const capacity = opts.exactCount ? opts.count : capacityFor(env, opts.count);
    const wander = opts.wander ?? Math.min(...opts.box) * 0.12;
    super({
      ...opts,
      count: capacity,
      motion: gasMotion(env.random.fork(opts.seed ?? 'gas'), opts.box, wander),
      name: opts.name ?? 'gas',
    });
    this.thermal = opts.thermal ?? 1;
    this.drift = new Vector3(...(opts.drift ?? [0, 0, 0]));
    this.unfollow = opts.exactCount
      ? () => undefined
      : followQuality(env, opts.count, capacity, (n) => (this.instances = n));
    const gas = this.motionUniforms.uGas!.value as Vector4;
    const box = this.motionUniforms.uBox!.value as Vector3;
    onTick(this, (_t, dt) => {
      gas.w += dt * this.thermal;
      // keep the displacement bounded (wrapping by whole boxes is invisible) so precision never degrades
      gas.x = (gas.x + this.drift.x * dt) % box.x;
      gas.y = (gas.y + this.drift.y * dt) % box.y;
      gas.z = (gas.z + this.drift.z * dt) % box.z;
    });
  }

  /** Wander range around the home position, units (tweenable: "temperature" as amplitude). */
  get wander(): number {
    return this.motionUniforms.uWander!.value as number;
  }
  set wander(v: number) {
    this.motionUniforms.uWander!.value = v;
  }

  override dispose(): void {
    this.unfollow();
  }
}

/** Character orbs as a gas in a box (electron gas, ions in an electrolyte…). */
export function createGas(env: FxEnv, opts: GasOptions): OrbGas {
  return new OrbGas(env, opts);
}
