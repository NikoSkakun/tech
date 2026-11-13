/**
 * Steam, smoke and plumes — presets of the GPU particle system with the toon "puff" sprite. Colours follow
 * the semantic code: wet steam / vapour `white` → `mist`, hot (superheated) steam white with a `pink` tint,
 * smoke and flue gas `slate` → `steel`.
 */
import type { ColorLike } from '@/style';
import type { FxEnv } from '../core/env';
import { discEmitter, type Vec3 } from '../particles/emitters';
import { ParticleSystem, type ParticleOptions } from '../particles/system';

export interface VapourOptions {
  /** Radius of the outlet (nozzle, chimney mouth, tower rim), units. Default 0.15. */
  radius?: number;
  /** How high the puffs rise before they fade, units. Default 2. */
  height?: number;
  /** Direction of the jet. Default up. */
  axis?: Vec3;
  /** Wind velocity carrying the puffs away, units/s. Default none. */
  wind?: Vec3;
  /** Nominal puff count at quality `high`. */
  count?: number;
  color?: ParticleOptions['color'];
  opacity?: number;
}

function vapour(env: FxEnv, o: VapourOptions, p: Partial<ParticleOptions> & { rise: number; grow: number }): ParticleSystem {
  const radius = o.radius ?? 0.15;
  const height = o.height ?? 2;
  const life = height / p.rise;
  const system = new ParticleSystem(env, {
    count: o.count ?? 40,
    emitter: discEmitter(radius, { axis: o.axis ?? [0, 1, 0], spread: 0.18 }),
    sprite: 'puff',
    blend: 'normal',
    life: [life * 0.8, life * 1.2],
    speed: [p.rise * 1.5, p.rise * 2.1],
    // drag lets the jet shoot out and then drift with the wind while buoyancy keeps it rising
    drag: 1.1,
    gravity: [0, p.rise * 0.9, 0],
    wind: o.wind ?? [0, 0, 0],
    turbulence: { amplitude: radius * 0.9, frequency: 0.7, speed: 1.3 },
    size: [radius * 1.6, radius * p.grow, radius * p.grow * 1.5],
    sizeJitter: 0.35,
    mid: 0.35,
    fadeIn: 0.08,
    fadeOut: 0.55,
    spin: 0.4,
    reseed: radius * 0.4,
    opacity: o.opacity ?? 0.9,
    ...p,
    color: o.color ?? p.color,
  });
  return system;
}

/** White wet steam from a valve, kettle, turbine exhaust. `setEmitting(false)` lets the last puffs rise. */
export function createSteam(env: FxEnv, o: VapourOptions = {}): ParticleSystem {
  const s = vapour(env, o, { rise: 0.9, grow: 4.5, color: ['white', 'white', 'mist'], seed: 'steam' });
  s.name = 'steam';
  return s;
}

/** Hot (superheated) steam: white with a pink tint (STYLE_GUIDE §2.2), faster and thinner. */
export function createHotSteam(env: FxEnv, o: VapourOptions = {}): ParticleSystem {
  const s = vapour(env, o, { rise: 1.5, grow: 4, color: ['white', 'pink.light', 'pink.light'], seed: 'hot-steam' });
  s.name = 'hot-steam';
  return s;
}

/** Smoke / flue gas: slate puffs that lighten as they thin out. */
export function createSmoke(env: FxEnv, o: VapourOptions = {}): ParticleSystem {
  const s = vapour(env, o, { rise: 0.7, grow: 5, color: ['slate', 'steel', 'mist'], opacity: o.opacity ?? 0.8, seed: 'smoke' });
  s.name = 'smoke';
  return s;
}

/**
 * Cooling-tower plume: big, slow, billowing white cloud that leans with the wind. `radius` is the tower
 * mouth radius; the plume rises `height` (default 5 radii).
 */
export function createPlume(env: FxEnv, o: VapourOptions = {}): ParticleSystem {
  const radius = o.radius ?? 1;
  const s = vapour(
    env,
    { count: 70, height: radius * 5, wind: [radius * 0.25, 0, 0], ...o, radius },
    { rise: radius * 0.45, grow: 2.6, color: ['white', 'white', 'mist'], spin: 0.15, seed: 'plume' },
  );
  s.name = 'plume';
  return s;
}

/** Colour of a fluid by "temperature" 0…1 for custom vapour: cold vapour → hot steam. */
export function vapourColor(t: number): [ColorLike, ColorLike, ColorLike] {
  return t > 0.6 ? ['white', 'pink.light', 'pink.light'] : ['white', 'white', 'mist'];
}
