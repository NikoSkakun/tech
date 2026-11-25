/**
 * The contract between `scene.ts` and the step modules (`steps/NN-<id>.ts`).
 *
 * A step factory gets the chapter, registers what it needs (input handlers, probes) and returns its stage
 * state (`spec`: camera, params, …), its step UI and its per-frame hook. Steps share nothing but the copper
 * world (`world.ts`) and the session memory of reached goals.
 */
import type { ChapterContext, StepInfo, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { WireWorld } from './world';

/** Step ids in script order; `__tests__/manifest.test.ts` keeps them equal to the generated manifest. */
export const STEP_IDS = ['atoms', 'inside-atom', 'outer', 'shared', 'restless', 'plastic'] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Chapter {
  ctx: ChapterContext;
  ui: StepUiApi<StepId>;
  world: WireWorld;
  /** The goal of the step is reached (this session): the panel shows the takeaway; captions «→ X» appear. */
  reached(step: StepId): boolean;
  /** Record that the goal of the step holds now. */
  reach(step: StepId): void;
}

export interface StepModule {
  /** The declarative stage state of the step (camera, params, env, post). */
  spec: StepSpec;
  /** Controls, callouts and the goal of the step. */
  ui: StepUiSpec;
  /** After the stage applied the step (also on deep links: honour `info.instant`). */
  enter?(info: StepInfo): void;
  leave?(): void;
  /** Every frame while the step is on screen. */
  update?(dt: number, t: number): void;
  /** Every frame whatever step is on screen, after the world (a lens mode's ring fades out when its step goes). */
  always?(dt: number): void;
}

export type StepFactory = (chapter: Chapter) => StepModule;

/** Goals reached in this session (the panel keeps the takeaway for the session too; module state survives a
 *  rebuild of the scene when the reader leaves the chapter and comes back). */
const REACHED = new Set<StepId>();
export const sessionGoals = {
  has: (s: StepId): boolean => REACHED.has(s),
  add: (s: StepId): void => void REACHED.add(s),
};
