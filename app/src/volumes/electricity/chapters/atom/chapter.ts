/**
 * Chapter-wide contract between `scene.ts` and the step modules.
 *
 * Every step lives in `steps/<step-id>.ts` and exports one factory `(chapter) => StepModule`. The factory
 * builds the step's own objects, registers its camera shots, its declarative stage state (`ctx.stage.define`)
 * and its step UI (`ui.define`), and returns the per-frame hook. Nothing else is shared between steps except
 * the `World` (objects that several steps show).
 */

import type { ChapterContext } from '@/engine/api';
import type { StepUiApi } from '@/hud';
import type { World } from './world';

/**
 * Step ids in order. The eager manifest takes ids and titles from the generated `atom.manifest.json` (plain
 * strings), so the typed list lives here; `__tests__/manifest.test.ts` keeps the two identical.
 */
export const STEP_IDS = [
  'dive-in',
  'anatomy',
  'nucleus',
  'quarks',
  'electron',
  'models',
  'shells',
  'ions-photons',
  'atom-builder',
  'standard-model',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Chapter {
  ctx: ChapterContext;
  ui: StepUiApi<StepId>;
  world: World;
}

export interface StepModule {
  /** Runs every frame while this step is on screen (engine-clock seconds). */
  update?(dt: number, t: number): void;
}

export type StepFactory = (chapter: Chapter) => StepModule;

/** Smoothstep 0…1 of `x` between `a` and `b`. */
export function smooth(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
