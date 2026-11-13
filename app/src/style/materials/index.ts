/**
 * The K material family — STYLE_GUIDE §4. Every surface in the course uses one of these; do not use
 * `MeshStandardMaterial` & co. (PBR realism is off-style and would bypass the tinted-shadow model).
 *
 * All K materials: work with `InstancedMesh` (incl. per-instance colour) and `BatchedMesh`, respect scene
 * fog and local clipping planes, expose a tweenable `fade` (dithered dissolve). The lit ones (toon, metal,
 * energy, water) receive the key light's soft shadow, tinted by the rig's fill light.
 */
import type { Material } from 'three';
import { KToonMaterial, type EnergyParams, type MetalParams, type ToonParams } from './toon';
import {
  KGlassMaterial,
  KGlowMaterial,
  KHologramMaterial,
  type GlassParams,
  type GlowParams,
  type HologramParams,
} from './unlit';
import { KWaterMaterial, type WaterParams } from './water';
import type { ColorLike } from '../palette';

export const K = {
  /** 2–3 soft cel bands + rim + optional vertical gradient. The default material for everything solid. */
  toon: (params: ToonParams = {}): KToonMaterial => new KToonMaterial(params, 'toon'),
  /** Toon with a sharp stylised specular streak and horizon band (machined metal, pipes, rails). */
  metal: (params: MetalParams = {}): KToonMaterial =>
    new KToonMaterial({ color: 'steel', ...params }, 'metal'),
  /** Toon body with emissive pulses flowing along `uv.x` (cables, pipes, beams). */
  energy: (params: EnergyParams = {}): KToonMaterial =>
    new KToonMaterial({ color: 'ink', ...params }, 'energy'),
  /** Emissive, bloom-driving (particles, plasma, indicators). */
  glow: (params: GlowParams = {}): KGlowMaterial => new KGlowMaterial(params),
  /** Unlit flat colour that lands on screen exactly as the token (backdrops, decals, swatches). */
  flat: (
    color: ColorLike,
    params: Omit<GlowParams, 'color' | 'intensity' | 'falloff' | 'core'> = {},
  ): KGlowMaterial =>
    new KGlowMaterial({ ...params, color, core: color, intensity: 1, falloff: 0, edge: 1, name: 'K.flat' }),
  /** Tinted translucent with fresnel edge (no refraction). */
  glass: (params: GlassParams = {}): KGlassMaterial => new KGlassMaterial(params),
  /** Stylised water surface. */
  water: (params: WaterParams = {}): KWaterMaterial => new KWaterMaterial(params),
  /** "Hologlass" rounded UI panel. */
  hologram: (params: HologramParams): KHologramMaterial => new KHologramMaterial(params),
} as const;

/** Any material able to dissolve through `fade`. */
export interface Fadable {
  fade: number;
}

export function isFadable(m: Material | Fadable): m is Material & Fadable {
  return typeof (m as Fadable).fade === 'number';
}

export { KToonMaterial, KGlowMaterial, KGlassMaterial, KHologramMaterial, KWaterMaterial };
export type { ToonParams, MetalParams, EnergyParams, GlowParams, GlassParams, HologramParams, WaterParams };
export { kGlobals } from './globals';
export { K_EMISSIVE_ATTRIBUTE, paintEmissive } from './toon';
