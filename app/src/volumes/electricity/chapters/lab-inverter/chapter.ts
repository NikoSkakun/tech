/**
 * The contract between `scene.ts` and the step modules of this chapter.
 *
 * Every step is one module `steps/<nn>-<id>.ts` exporting a `StepFactory`. The factory builds the step's *set*
 * (its 3D objects, added under `lab.stageRoot`) and returns what the scene needs to wire it: the declarative
 * stage state, camera shots, the step UI, a probe for the interaction test and an `update` that runs only while
 * the set is visible. Steps never talk to each other; shared things (bench, materials, the opened inverter)
 * live in `Lab`.
 */
import type { Group, Object3D } from 'three';
import type { Actor, ChapterContext, Shot, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { Sound } from './sound';
import type { Mats } from './world';

export const STEP_IDS = [
  'why-inverter',
  'switches',
  'h-bridge',
  'pwm',
  'lc-filter',
  'dc-link',
  'mppt-controller',
  'grid-tie',
  'inverter-types',
  'ups',
  'three-phase-and-scale',
  'choosing',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Lab {
  ctx: ChapterContext;
  ui: StepUiApi;
  /** Audio levels "wanted this frame" and one-shots (`sound.ts`). */
  sound: Sound;
  /** Parent of all sets: origin = centre of the bench top, +X right, +Z toward the viewer. */
  stageRoot: Group;
  /** The workbench (an actor: hidden in the micro-world step). */
  bench: Actor;
  mats: Mats;
  /**
   * Objects shared by several steps (the opened inverter of steps 1, 6, 7): the first caller builds, the others
   * reuse. A shared object may be listed in several steps' `show`; only the current step drives it.
   */
  share<T>(key: string, make: () => T): T;
  /** True while step `id` is the current one. */
  isCurrent(id: StepId): boolean;
}

export interface StepModule {
  id: StepId;
  /** Camera shots owned by the step; the one named like the step id is its default. */
  shots: Record<string, Shot>;
  /**
   * Stage state (`enter(info)` / `leave()` / `envTune` live here too). `camera` defaults to the shot named like
   * the step; the bench is added to `show` unless `noBench`.
   */
  stage: Omit<StepSpec, 'show'> & { show: readonly (Actor | Object3D)[] };
  noBench?: boolean;
  ui?: StepUiSpec;
  /**
   * Observable state of the step for the interaction test (`__app.read('step')`): plain numbers / strings that
   * must change when a control is used.
   */
  probe?(): Record<string, unknown>;
  /** Runs every frame while the step is current or its set is still fading out. */
  update?(dt: number, t: number): void;
}

export type StepFactory = (lab: Lab) => StepModule;
