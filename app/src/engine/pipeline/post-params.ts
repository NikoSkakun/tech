/**
 * Tweenable post-processing parameters. Flat numeric object on purpose: any subset can be tweened with
 * `tweens.to(post.params, { … })`, per chapter and per step.
 */
export interface PostParams {
  /** Linear exposure multiplier before the display transform. */
  exposure: number;
  /** Ambient occlusion strength 0…1 (subtle; contact areas only). */
  aoIntensity: number;
  /** AO radius in world units — set it to ~3–5 % of the subject size. */
  aoRadius: number;
  /** Bloom strength. Only pixels brighter than `bloomThreshold` (emissive / K.glow) bloom. */
  bloomIntensity: number;
  bloomThreshold: number;
  bloomKnee: number;
  /** 0…1 — how much the wide mips contribute (bigger = wider, softer glow). */
  bloomRadius: number;
  /** Master depth-of-field amount 0…1 (0 disables the pass). */
  dofAmount: number;
  /** How fast blur grows with relative depth difference: CoC = aperture · (z − focus) / z. */
  dofAperture: number;
  /** Half-depth (world units) of the perfectly sharp zone around the focus distance. */
  dofRange: number;
  /** Maximum blur radius in px at 1080p. */
  dofMaxBlur: number;
  /** Focus distance in world units. Written every frame by the camera director (focus tracking). */
  dofFocus: number;
  /**
   * Cap of the foreground blur as a fraction of `dofMaxBlur` (0…1). Things between the camera and the subject
   * may soften, but never turn into blobs that cover the frame. Default 0.3.
   */
  dofNearMax: number;
  /**
   * Distance (world units) at which depth of field and tilt-shift reach full strength — the "overview" distance
   * of the chapter. Closer shots get proportionally milder DOF and no tilt-shift band, so close-ups stay crisp
   * without per-shot tuning. 0 = automatic (2.2 × the environment's subject scale, `ctx.env.setScale`).
   */
  dofReference: number;
  /** Fraction of the aperture that remains in the closest close-ups (0…1). Default 0.3. */
  dofCloseup: number;
  /** Tilt-shift: extra screen-space band blur 0…1 (miniature look for dioramas). */
  tiltAmount: number;
  /** Vertical screen position (0 bottom … 1 top) of the sharp band. */
  tiltCenter: number;
  /** Half-height of the sharp band (uv). */
  tiltSpread: number;
  /** Distance (uv) over which the band blur ramps up. */
  tiltFalloff: number;
  /** Shadows lifted toward violet. */
  gradeLift: number;
  /** Gentle S-curve amount. */
  gradeContrast: number;
  /** Saturation boost of muted colours only. */
  gradeVibrance: number;
  /** Global saturation (1 = neutral). */
  gradeSaturation: number;
  /** Vignette strength 0…1. */
  vignette: number;
  /** Normalised radius where the vignette starts (1 = frame corner). */
  vignetteRadius: number;
  vignetteSoftness: number;
  /** Film grain amplitude (display-space). */
  grain: number;
  /** Chromatic aberration — the engine animates it during chapter transitions; keep 0 otherwise. */
  chroma: number;
}

export type PostOverrides = Partial<PostParams>;

/** Neutral baseline shared by all moods. */
export const POST_BASE: PostParams = {
  exposure: 1,
  aoIntensity: 0.55,
  aoRadius: 0.5,
  bloomIntensity: 0.9,
  bloomThreshold: 1.0,
  bloomKnee: 0.25,
  bloomRadius: 0.75,
  dofAmount: 1,
  dofAperture: 1,
  dofRange: 0.5,
  dofMaxBlur: 10,
  dofFocus: 10,
  dofNearMax: 0.3,
  dofReference: 0,
  dofCloseup: 0.3,
  tiltAmount: 0,
  tiltCenter: 0.5,
  tiltSpread: 0.22,
  tiltFalloff: 0.35,
  gradeLift: 0.012,
  gradeContrast: 0.05,
  gradeVibrance: 0.06,
  gradeSaturation: 1,
  vignette: 0.42,
  vignetteRadius: 0.55,
  vignetteSoftness: 0.75,
  grain: 0.022,
  chroma: 0,
};

export type Mood = 'micro' | 'studio' | 'diorama';

/** Mood defaults (STYLE_GUIDE §2.3): chapters start from these and override per chapter / per step. */
export const POST_MOODS: Record<Mood, PostOverrides> = {
  /** Inner space: glowing particles, shallow depth of field with big soft bokeh. */
  micro: {
    bloomIntensity: 1.15,
    bloomRadius: 0.85,
    dofAperture: 1.25,
    dofRange: 0.6,
    dofMaxBlur: 13,
    aoIntensity: 0.45,
    aoRadius: 0.35,
    vignette: 0.5,
  },
  /** Clean studio void: restrained post, subject fully readable. */
  studio: {
    bloomIntensity: 0.8,
    dofAperture: 0.7,
    dofRange: 1.5,
    dofMaxBlur: 8,
    aoIntensity: 0.6,
    aoRadius: 0.4,
    vignette: 0.38,
  },
  /** Tabletop diorama: tilt-shift miniature look. */
  diorama: {
    bloomIntensity: 0.85,
    dofAperture: 1.0,
    dofRange: 2.5,
    dofMaxBlur: 10,
    tiltAmount: 0.4,
    tiltSpread: 0.27,
    tiltFalloff: 0.3,
    aoIntensity: 0.6,
    aoRadius: 0.7,
    vignette: 0.36,
  },
};

export function postForMood(mood: Mood, overrides: PostOverrides = {}): PostParams {
  return { ...POST_BASE, ...POST_MOODS[mood], ...overrides };
}
