/**
 * Contract between `scene.ts` and the step modules. One file per step in `steps/`: the factory receives the
 * built world and returns the step's declarative stage state, its step UI and an optional per-frame `update`
 * that runs only while the step is on screen. Random access rule: everything a step shows is a function of its
 * own closure state, re-derived in `stage.enter(info)`.
 */
import type { ChapterContext, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { StepId } from './content';
import type { World } from './world';

export interface Chapter {
  ctx: ChapterContext;
  ui: StepUiApi;
  world: World;
}

export interface StepModule {
  id: StepId;
  /** Actors shown, params, camera shot, post (ENGINE_API §5). */
  stage: StepSpec;
  /** Controls, callouts, hotspots, honesty chips, board (UI_API §3). */
  ui?: StepUiSpec;
  /** Every frame while this step is the current one. */
  update?(dt: number, t: number): void;
}

export type StepFactory = (chapter: Chapter) => StepModule;

/** Smoothstep 0…1 of `x` between `a` and `b`. */
export function smooth(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

export const clamp = (x: number, a: number, b: number): number => Math.min(Math.max(x, a), b);
