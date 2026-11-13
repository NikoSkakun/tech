/**
 * The contract between `scene.ts` and the step modules of this chapter.
 *
 * Every step is one module `steps/<nn>-<id>.ts` exporting a `StepFactory`. The factory builds the step's *set*
 * (its 3D objects, added under `hall.stageRoot`) and returns what the scene needs to wire it: the declarative
 * stage state, camera shots, the step UI, a probe for the interaction test and an `update` that runs only while
 * the set is visible. Steps never talk to each other; shared things (the turntable floor, materials) live in
 * `Hall`.
 */
import type { Group, Object3D } from 'three';
import type { Actor, ChapterContext, Shot, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { Sound } from './sound';
import type { Mats } from './world';

export const STEP_IDS = [
  'rotating-loop',
  'ac-anatomy',
  'war-of-currents',
  'three-phase',
  'star-delta',
  'rotating-field',
  'synchronous-generator',
  'synchronization',
  'rlc',
  'ac-power',
  'to-transformer',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Hall {
  ctx: ChapterContext;
  ui: StepUiApi;
  /** Audio levels "wanted this frame" and one-shots (`sound.ts`). */
  sound: Sound;
  /** Parent of all sets: origin = centre of the turntable floor, +X right, +Z toward the viewer. */
  stageRoot: Group;
  /** The turntable floor with its degree scale (an actor: some steps hide it). */
  floor: Actor;
  mats: Mats;
  /** True while step `id` is the current one. */
  isCurrent(id: StepId): boolean;
}

export interface StepModule {
  id: StepId;
  /** Camera shots owned by the step; the one named like the step id is its default. */
  shots: Record<string, Shot>;
  /**
   * Stage state (`enter(info)` / `leave()` / `envTune` live here too). `camera` defaults to the shot named like
   * the step; the floor is added to `show` unless `noFloor`.
   */
  stage: Omit<StepSpec, 'show'> & { show: readonly (Actor | Object3D)[] };
  noFloor?: boolean;
  ui?: StepUiSpec;
  /** Observable state of the step for the interaction test (`__app.read('step')`). */
  probe?(): Record<string, unknown>;
  /** Runs every frame while the step is current or its set is still fading out. */
  update?(dt: number, t: number): void;
}

export type StepFactory = (hall: Hall) => StepModule;
