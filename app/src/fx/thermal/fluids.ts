/**
 * Small fluid effects built on the particle system: splashes, foam, bubbles, falling droplets, ripples.
 */
import type { ColorLike } from '@/style';
import type { FxEnv } from '../core/env';
import { createPulseRings, type Glow } from '../drama/glows';
import { boxEmitter, discEmitter, type Vec3 } from '../particles/emitters';
import { ParticleSystem } from '../particles/system';

/** Splash droplets: a pool for one-shot bursts (`splash.burst(position)`), falling back under gravity. */
export class Splash extends ParticleSystem {
  constructor(env: FxEnv, o: { count?: number; color?: ColorLike; size?: number; gravity?: number } = {}) {
    const s = o.size ?? 0.07;
    super(env, {
      count: o.count ?? 90,
      loop: false,
      sprite: 'drop',
      blend: 'normal',
      color: [o.color ?? 'white', o.color ?? 'sky.light', o.color ?? 'sky'],
      size: [s, s, s * 0.6],
      life: [0.5, 0.9],
      speed: [1.4, 3.2],
      gravity: [0, -(o.gravity ?? 7), 0],
      stretch: 0.035,
      fadeIn: 0.02,
      fadeOut: 0.3,
      seed: 'splash',
    });
    this.name = 'splash';
  }

  /** Throw droplets up and outward from `position` (a cone around `direction`, default straight up). */
  burst(position: Vec3, count = 18, direction: Vec3 = [0, 1, 0], spread = 0.75): void {
    this.emit(count, { position, direction, spread });
  }
}

export function createSplash(env: FxEnv, o: ConstructorParameters<typeof Splash>[1] = {}): Splash {
  return new Splash(env, o);
}

/** Foam: churning white puffs that stay where they are born (foot of a waterfall, turbine outlet). */
export function createFoam(env: FxEnv, o: { radius?: number; count?: number; size?: number } = {}): ParticleSystem {
  const r = o.radius ?? 0.5;
  const s = o.size ?? r * 0.55;
  const foam = new ParticleSystem(env, {
    count: o.count ?? 26,
    emitter: discEmitter(r, { spread: 0.9 }),
    sprite: 'puff',
    blend: 'normal',
    color: ['white', 'white', 'sky.light'],
    size: [s * 0.4, s, s * 0.8],
    life: [0.7, 1.3],
    speed: [0.05, 0.3],
    drag: 2,
    turbulence: { amplitude: r * 0.12, speed: 3 },
    fadeIn: 0.15,
    fadeOut: 0.5,
    spin: 1.2,
    reseed: r * 0.3,
    fog: false,
    seed: 'foam',
  });
  foam.name = 'foam';
  return foam;
}

/** Bubbles rising and wobbling inside a box volume (boiling water, electrolyte, cooling pool). */
export function createBubbles(
  env: FxEnv,
  o: { size?: Vec3; count?: number; radius?: number; rise?: number; color?: ColorLike } = {},
): ParticleSystem {
  const box = o.size ?? [1, 1, 1];
  const rise = o.rise ?? 0.6;
  const r = o.radius ?? 0.07;
  const bubbles = new ParticleSystem(env, {
    count: o.count ?? 40,
    // born on the floor of the volume; life is set so that they pop at the top
    emitter: boxEmitter([box[0], 0, box[2]], { center: [0, -box[1] / 2, 0], axis: [0, 1, 0] }),
    sprite: 'bubble',
    blend: 'normal',
    color: o.color ?? 'white',
    size: [r * 0.6, r * 1.6, r * 2],
    sizeJitter: 0.5,
    life: [(box[1] / rise) * 0.8, box[1] / rise],
    speed: [rise * 0.85, rise * 1.15],
    turbulence: { amplitude: r * 1.2, speed: 4 },
    fadeIn: 0.1,
    fadeOut: 0.04,
    opacity: 0.9,
    fog: false,
    seed: 'bubbles',
  });
  bubbles.name = 'bubbles';
  return bubbles;
}

/** Droplets raining inside a box volume (condenser, cooling-tower fill, rain on a diorama). */
export function createRain(
  env: FxEnv,
  o: { size?: Vec3; count?: number; speed?: number; color?: ColorLike; dropSize?: number } = {},
): ParticleSystem {
  const box = o.size ?? [2, 2, 2];
  const speed = o.speed ?? 4;
  const rain = new ParticleSystem(env, {
    count: o.count ?? 80,
    emitter: boxEmitter([box[0], 0, box[2]], { center: [0, box[1] / 2, 0], axis: [0, -1, 0] }),
    sprite: 'drop',
    blend: 'normal',
    color: o.color ?? 'sky',
    size: o.dropSize ?? 0.05,
    life: box[1] / speed,
    speed,
    stretch: 0.03,
    fadeIn: 0.08,
    fadeOut: 0.06,
    seed: 'rain',
  });
  rain.name = 'rain';
  return rain;
}

/** Ripples: flat rings spreading on a water surface (lies in the XZ plane; seamless loop). */
export function createRipples(o: { size?: number; color?: ColorLike; rings?: number; intensity?: number } = {}): Glow {
  const ripples = createPulseRings({
    size: o.size ?? 1.5,
    color: o.color ?? 'white',
    amount: o.rings ?? 2,
    intensity: o.intensity ?? 0.7,
    billboard: false,
    speed: 0.8,
  });
  ripples.rotation.x = -Math.PI / 2;
  ripples.name = 'ripples';
  return ripples;
}
