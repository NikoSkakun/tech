/**
 * Per-step looks (`StepSpec.envTune` + `post`). The chapter's backdrop kind is `sky` (the island); the inner
 * sets far below it re-tune the same dome into the document's moods: the «inner space» of the micro-world
 * (steps 2–4, as in `atom`) and a half-dark hall with a violet back light (fuel, control room, safety exhibit,
 * gallery, fuel cycle). Fog is off down there (it is tuned for the island's distances) and so is tilt-shift.
 */
import type { StepSpec } from '@/engine/api';
import { col } from '@/style';

type Tune = NonNullable<StepSpec['envTune']>;
type Post = NonNullable<StepSpec['post']>;

const DARK_DOME: Tune = {
  sunSize: 0,
  sunGlow: 0,
  clouds: 0,
  silhouettes: 0,
  fogDensity: 0,
  harmony: 0,
  gradeTintAmount: 0,
};

/** Steps 2–4: deep indigo with stars and motes, violet rim. */
export const MICRO_TUNE: Tune = {
  ...DARK_DOME,
  top: 'bg.deep',
  mid: col('bg.indigo').lerp(col('bg.violet'), 0.45),
  bottom: 'bg.void',
  horizon: -0.05,
  horizonWidth: 0.55,
  stars: 0.35,
  motes: 0.7,
  moteColor: col('sky').lerp(col('white'), 0.5),
  fillSky: col('bg.violet').lerp(col('white'), 0.35),
  rimColor: col('violet.light').lerp(col('cyan'), 0.3),
  rimIntensity: 0.55,
};

/** Fuel, control room, safety, gallery, fuel cycle: a dark hall with a violet back light. */
export const HALL_TUNE: Tune = {
  ...DARK_DOME,
  top: col('bg.deep').lerp(col('bg.void'), 0.4),
  mid: col('bg.indigo').lerp(col('bg.violet'), 0.35),
  bottom: col('bg.deep').lerp(col('bg.void'), 0.5),
  horizon: -0.1,
  horizonWidth: 0.5,
  stars: 0,
  motes: 0.3,
  rimColor: 'violet.light',
  rimIntensity: 0.6,
};

/** Inside the opened containment (steps 6–7): a half-dark reactor hall with a violet back light. */
export const CONTAINMENT_TUNE: Tune = { keyIntensity: 0.55, fillIntensity: 0.75, rimColor: 'violet.light', rimIntensity: 0.9, fogDensity: 0 };

/** No tilt-shift on the inner sets: a mild depth of field around the subject instead. */
export const INNER_POST: Post = { tiltAmount: 0, dofAmount: 0.35, bloomIntensity: 1.1 };
export const MICRO_POST: Post = { tiltAmount: 0, dofAmount: 0.5, bloomIntensity: 1.25 };
