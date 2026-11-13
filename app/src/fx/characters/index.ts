/**
 * The particle "characters" of the course (STYLE_GUIDE §2.2, §3) — one look everywhere:
 *
 *   electron e⁻   glowing cyan marble with a dark "−", flowing shell, soft halo
 *   proton p⁺     glossy coral sphere with a white "+"
 *   neutron n⁰    glossy mist → steel sphere
 *   ion           glossy sphere with a sign (Li⁺ lime by default; pass a colour for other species)
 *   quark u / d   amber / violet sphere with the wandering colour-charge halo
 *   hole h⁺       hollow dashed coral ring with a "+" (an absence, not a ball)
 *   photon γ      wavy light packet (yellow → white, or coloured by wavelength)
 *   gluon         springy lime coil with running beads
 *
 * Every orb exists as a hero (`createElectron()` → move the object) and as a swarm (`createOrbs({ count })`,
 * `createGas()`, `createFlow()` in `fx/flow`).
 */
import type { ColorLike } from '@/style';
import { createOrbs, type Glyph, type Orbs } from './orb';

export interface HeroOptions {
  /** Radius in local units. */
  radius?: number;
  /** Draw the halo layer. Default true. */
  halo?: boolean;
  fog?: boolean;
}

/** Hero electron e⁻. */
export function createElectron(opts: HeroOptions = {}): Orbs {
  return createOrbs({ kind: 'electron', radius: 0.17, ...opts });
}

/** Hero proton p⁺. */
export function createProton(opts: HeroOptions = {}): Orbs {
  return createOrbs({ kind: 'proton', radius: 0.5, ...opts });
}

/** Hero neutron n⁰. */
export function createNeutron(opts: HeroOptions = {}): Orbs {
  return createOrbs({ kind: 'neutron', radius: 0.5, ...opts });
}

/** Hero ion: Li⁺ (lime, "+") by default; e.g. `{ color: 'sky', sign: 'minus' }` for an anion. */
export function createIon(opts: HeroOptions & { color?: ColorLike; sign?: Glyph } = {}): Orbs {
  const { sign, ...rest } = opts;
  return createOrbs({ kind: 'ion', radius: 0.3, glyph: sign, ...rest });
}

/** Hero quark: `up` (amber) or `down` (violet). */
export function createQuark(flavour: 'up' | 'down', opts: HeroOptions = {}): Orbs {
  return createOrbs({ kind: flavour === 'up' ? 'quarkUp' : 'quarkDown', radius: 0.22, ...opts });
}

/** Hero hole h⁺. */
export function createHole(opts: HeroOptions = {}): Orbs {
  return createOrbs({ kind: 'hole', radius: 0.17, ...opts });
}

export {
  createOrbs,
  hotCore,
  Orbs,
  ORB_STYLES,
  type Glyph,
  type OrbHalo,
  type OrbKind,
  type OrbMotion,
  type OrbOptions,
  type OrbStyle,
} from './orb';
export { createGas, OrbGas, type GasOptions } from './gas';
export { createPhoton, createPhotons, Photons, type PhotonOptions } from './photon';
export { createGluons, Gluons, type GluonOptions } from './gluon';
