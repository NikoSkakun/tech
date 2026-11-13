/**
 * Environment presets — backdrop + light rig + fog per mood (STYLE_GUIDE §2.3, §4).
 *
 * Three backdrop kinds:
 *   `space`  — micro-world "inner space": nebula gradient, soft bokeh, drifting motes;
 *   `studio` — clean void with a soft floor disc and gradient backdrop (machines, labs);
 *   `sky`    — diorama skies: gradient dome, sun glow, stars, painted cloud bands, layered silhouettes.
 * Presets of the same kind can be blended at run time (`day → golden → dusk → night`).
 */
import { Color, Vector3 } from 'three';
import { col, type ColorLike } from '../palette';

export type EnvKind = 'space' | 'studio' | 'sky';

export interface EnvParams {
  kind: EnvKind;
  /** Backdrop gradient: colour straight up, at the horizon line, and straight down. */
  top: Color;
  mid: Color;
  bottom: Color;
  /** Elevation (−1…1, sine of the angle) of the horizon line where the `mid` colour sits. */
  horizon: number;
  /** Half-width (in elevation) of the band in which `mid` blends into the top/bottom gradient. */
  horizonWidth: number;
  /** Direction towards the key light / sun (world space, normalised). */
  sunDir: Vector3;
  /** Sun disc + glow colour on the dome. */
  sunColor: Color;
  /** Angular radius of the stylised sun disc in radians (0 = none). */
  sunSize: number;
  /** Strength of the wide glow around the sun direction. */
  sunGlow: number;
  /** Star field amount 0…1. */
  stars: number;
  /** Painted cloud bands on the dome 0…1 (`sky`), nebula clouds (`space`). */
  clouds: number;
  cloudColor: Color;
  /** Second nebula colour (`space`). */
  cloudColorB: Color;
  /** Distant layered silhouettes along the horizon 0…1 (`sky`). */
  silhouettes: number;
  silhouetteColor: Color;
  /** Background bokeh discs 0…1 (`space`, `studio`). */
  bokeh: number;
  /** Drifting motes / dust / fireflies 0…1. */
  motes: number;
  moteColor: Color;
  /** Key light (soft, warm white by default). */
  keyColor: Color;
  keyIntensity: number;
  /** Hemisphere fill — this is what tints the shadows (indigo/violet, never grey). */
  fillSky: Color;
  fillGround: Color;
  fillIntensity: number;
  /** Coloured rim light. */
  rimColor: Color;
  rimIntensity: number;
  rimDir: Vector3;
  /** 0…1 — how dark the cast shadows are (1 = fill light only). */
  shadowStrength: number;
  fogColor: Color;
  /** Exponential-squared fog density (0 = none). */
  fogDensity: number;
  /** Soft floor disc opacity 0…1 (`studio`). */
  floor: number;
  floorColor: Color;
  /**
   * Mood grade — colour discipline for strongly coloured light (golden hour, dusk, night). The whole frame is
   * pulled into a palette analogous to `harmonyColor`: `gradeTint` multiplies the image (give it as raw
   * display-space RGB, e.g. `new Color(1, 0.91, 0.8)`; `gradeTintAmount` 0…1), then hues that are not analogous to `harmonyColor` are desaturated and partly
   * rotated toward it (`harmony` 0…1) — greens turn olive, blues slate — while `accentColor` hues are left
   * alone. All zero for `day`, `studio`, `micro`, where palette tokens must land exactly.
   */
  gradeTint: Color;
  gradeTintAmount: number;
  harmonyColor: Color;
  harmony: number;
  accentColor: Color;
}

export type EnvPresetName = 'micro' | 'studio' | 'day' | 'golden' | 'dusk' | 'night';

type Spec = {
  [K in keyof EnvParams]: EnvParams[K] extends Color
    ? ColorLike
    : EnvParams[K] extends Vector3
      ? [number, number, number]
      : EnvParams[K];
};

const mix = (a: ColorLike, b: ColorLike, t: number): Color => col(a).lerp(col(b), t);

const COMMON = {
  horizon: 0,
  horizonWidth: 0.4,
  sunDir: [0.45, 0.78, 0.44],
  sunColor: 'white',
  sunSize: 0,
  sunGlow: 0,
  stars: 0,
  clouds: 0,
  cloudColor: 'bg.plum',
  cloudColorB: 'bg.violet',
  silhouettes: 0,
  silhouetteColor: 'bg.indigo',
  bokeh: 0,
  motes: 0,
  moteColor: 'white',
  keyColor: new Color(1, 0.985, 0.95),
  keyIntensity: 1,
  fillSky: new Color(0.47, 0.45, 0.82),
  fillGround: new Color(0.3, 0.24, 0.6),
  fillIntensity: 1,
  rimColor: 'violet.light',
  rimIntensity: 0.35,
  rimDir: [-0.55, 0.35, -0.75],
  shadowStrength: 1,
  fogColor: 'bg.deep',
  fogDensity: 0,
  floor: 0,
  floorColor: 'bg.violet',
  gradeTint: 'white',
  gradeTintAmount: 0,
  harmonyColor: 'amber',
  harmony: 0,
  accentColor: 'yellow',
} satisfies Omit<Spec, 'kind' | 'top' | 'mid' | 'bottom'>;

const SPECS: Record<EnvPresetName, Spec> = {
  micro: {
    ...COMMON,
    kind: 'space',
    top: 'bg.deep',
    mid: mix('bg.indigo', 'bg.violet', 0.45),
    bottom: 'bg.void',
    horizon: -0.05,
    horizonWidth: 0.55,
    stars: 0.3,
    clouds: 1,
    cloudColor: mix('bg.plum', 'magenta', 0.18),
    cloudColorB: mix('bg.violet', 'blue', 0.3),
    bokeh: 1,
    motes: 0.8,
    moteColor: mix('sky', 'white', 0.5),
    sunDir: [0.5, 0.7, 0.5],
    fillSky: new Color(0.4, 0.38, 0.8),
    fillGround: new Color(0.26, 0.17, 0.56),
    rimColor: mix('violet.light', 'cyan', 0.35),
    rimIntensity: 0.5,
    fogColor: 'bg.deep',
    fogDensity: 0,
  },
  studio: {
    ...COMMON,
    kind: 'studio',
    top: mix('bg.deep', 'bg.void', 0.35),
    mid: mix('bg.indigo', 'bg.violet', 0.3),
    bottom: mix('bg.deep', 'bg.void', 0.5),
    horizon: -0.1,
    horizonWidth: 0.5,
    bokeh: 0.35,
    motes: 0.35,
    moteColor: mix('violet.light', 'white', 0.4),
    sunDir: [0.42, 0.8, 0.43],
    fillSky: new Color(0.46, 0.44, 0.82),
    fillGround: new Color(0.3, 0.23, 0.62),
    rimColor: 'sky',
    rimIntensity: 0.3,
    floor: 1,
    floorColor: mix('bg.violet', 'bg.plum', 0.85),
  },
  day: {
    ...COMMON,
    kind: 'sky',
    top: mix('blue', 'bg.violet', 0.12),
    mid: mix('sky', 'white', 0.5),
    bottom: mix('blue', 'sky', 0.3),
    horizon: 0.0,
    horizonWidth: 0.3,
    sunDir: [0.48, 0.74, 0.47],
    sunColor: mix('yellow', 'white', 0.6),
    sunSize: 0.045,
    sunGlow: 0.55,
    clouds: 0.9,
    cloudColor: 'white',
    silhouettes: 0.8,
    silhouetteColor: mix('blue', 'violet', 0.4),
    motes: 0.2,
    moteColor: 'white',
    keyColor: new Color(1, 0.99, 0.96),
    keyIntensity: 1,
    fillSky: new Color(0.5, 0.55, 0.92),
    fillGround: new Color(0.36, 0.3, 0.7),
    rimColor: mix('sky', 'white', 0.3),
    rimIntensity: 0.3,
    fogColor: mix('sky', 'white', 0.35),
    fogDensity: 0.006,
  },
  golden: {
    ...COMMON,
    kind: 'sky',
    top: mix('bg.plum', 'coral', 0.35),
    mid: mix('amber', 'coral', 0.35).lerp(col('white'), 0.15),
    bottom: mix('bg.plum', 'coral', 0.28),
    gradeTint: new Color(1, 0.91, 0.8),
    gradeTintAmount: 0.6,
    harmonyColor: mix('amber', 'coral', 0.3),
    harmony: 0.52,
    accentColor: 'yellow',
    horizon: -0.02,
    horizonWidth: 0.28,
    sunDir: [0.74, 0.3, 0.6],
    sunColor: mix('amber', 'white', 0.35),
    sunSize: 0.06,
    sunGlow: 1,
    clouds: 0.85,
    cloudColor: mix('amber', 'white', 0.45),
    silhouettes: 0.9,
    silhouetteColor: mix('bg.plum', 'coral', 0.4),
    motes: 0.3,
    moteColor: 'amber.light',
    keyColor: new Color(1, 0.84, 0.62),
    keyIntensity: 1,
    fillSky: new Color(0.5, 0.42, 0.8),
    fillGround: new Color(0.42, 0.27, 0.6),
    rimColor: 'pink',
    rimIntensity: 0.4,
    fogColor: mix('coral', 'amber', 0.4),
    fogDensity: 0.007,
  },
  dusk: {
    ...COMMON,
    kind: 'sky',
    top: mix('bg.indigo', 'bg.deep', 0.3),
    mid: mix('coral', 'magenta', 0.3).lerp(col('bg.plum'), 0.5),
    bottom: mix('bg.indigo', 'bg.plum', 0.35),
    gradeTint: new Color(0.97, 0.88, 1),
    gradeTintAmount: 0.5,
    harmonyColor: mix('magenta', 'violet', 0.55),
    harmony: 0.58,
    accentColor: 'yellow',
    horizon: -0.03,
    horizonWidth: 0.2,
    sunDir: [0.8, 0.16, 0.58],
    sunColor: mix('coral', 'pink', 0.4),
    sunSize: 0,
    sunGlow: 0.6,
    stars: 0.6,
    clouds: 0.7,
    cloudColor: mix('bg.plum', 'magenta', 0.5),
    silhouettes: 0.9,
    silhouetteColor: 'bg.indigo',
    motes: 0.3,
    moteColor: 'yellow.light',
    keyColor: new Color(0.9, 0.62, 0.74),
    keyIntensity: 0.6,
    fillSky: new Color(0.33, 0.31, 0.68),
    fillGround: new Color(0.25, 0.17, 0.48),
    rimColor: 'magenta',
    rimIntensity: 0.4,
    shadowStrength: 0.85,
    fogColor: mix('bg.violet', 'magenta', 0.15),
    fogDensity: 0.008,
  },
  night: {
    ...COMMON,
    kind: 'sky',
    top: 'bg.void',
    mid: mix('bg.indigo', 'bg.violet', 0.4),
    bottom: mix('bg.void', 'bg.deep', 0.6),
    harmonyColor: mix('blue', 'violet', 0.4),
    harmony: 0.35,
    accentColor: 'yellow',
    horizon: -0.03,
    horizonWidth: 0.3,
    sunDir: [-0.4, 0.72, 0.56],
    sunColor: mix('sky', 'white', 0.6),
    sunSize: 0.035,
    sunGlow: 0.35,
    stars: 1,
    clouds: 0.5,
    cloudColor: 'bg.violet',
    silhouettes: 0.85,
    silhouetteColor: 'bg.deep',
    motes: 0.3,
    moteColor: 'lime.light',
    keyColor: new Color(0.6, 0.7, 1),
    keyIntensity: 0.5,
    fillSky: new Color(0.19, 0.2, 0.5),
    fillGround: new Color(0.13, 0.1, 0.34),
    rimColor: 'blue',
    rimIntensity: 0.5,
    shadowStrength: 0.8,
    fogColor: 'bg.deep',
    fogDensity: 0.007,
  },
};

const COLOR_KEYS = [
  'top',
  'mid',
  'bottom',
  'sunColor',
  'cloudColor',
  'cloudColorB',
  'silhouetteColor',
  'moteColor',
  'keyColor',
  'fillSky',
  'fillGround',
  'rimColor',
  'fogColor',
  'floorColor',
  'gradeTint',
  'harmonyColor',
  'accentColor',
] as const satisfies readonly (keyof EnvParams)[];
const VECTOR_KEYS = ['sunDir', 'rimDir'] as const satisfies readonly (keyof EnvParams)[];
const NUMBER_KEYS = [
  'horizon',
  'horizonWidth',
  'sunSize',
  'sunGlow',
  'stars',
  'clouds',
  'silhouettes',
  'bokeh',
  'motes',
  'keyIntensity',
  'fillIntensity',
  'rimIntensity',
  'shadowStrength',
  'fogDensity',
  'floor',
  'gradeTintAmount',
  'harmony',
] as const satisfies readonly (keyof EnvParams)[];

/** Partial override of a preset; colours accept palette tokens. */
export type EnvOverrides = Partial<Omit<Spec, 'kind'>>;

/** Build a fresh, fully resolved parameter set from a preset (plus optional overrides). */
export function envPreset(name: EnvPresetName, overrides: EnvOverrides = {}): EnvParams {
  const spec = { ...SPECS[name], ...overrides } as Spec;
  const out = { kind: spec.kind } as EnvParams;
  for (const k of COLOR_KEYS) out[k] = col(spec[k]);
  for (const k of VECTOR_KEYS) out[k] = new Vector3(...spec[k]).normalize();
  for (const k of NUMBER_KEYS) out[k] = spec[k];
  return out;
}

export function envKind(name: EnvPresetName): EnvKind {
  return SPECS[name].kind;
}

/** `out = lerp(a, b, t)` for every field (kind is taken from `b`). */
export function lerpEnv(a: EnvParams, b: EnvParams, t: number, out: EnvParams): EnvParams {
  out.kind = b.kind;
  for (const k of COLOR_KEYS) out[k].copy(a[k]).lerp(b[k], t);
  for (const k of VECTOR_KEYS) out[k].copy(a[k]).lerp(b[k], t).normalize();
  for (const k of NUMBER_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

export function cloneEnv(p: EnvParams): EnvParams {
  const out = { kind: p.kind } as EnvParams;
  for (const k of COLOR_KEYS) out[k] = p[k].clone();
  for (const k of VECTOR_KEYS) out[k] = p[k].clone();
  for (const k of NUMBER_KEYS) out[k] = p[k];
  return out;
}
