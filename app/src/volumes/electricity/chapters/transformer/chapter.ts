/**
 * The contract between `scene.ts` and the step modules of this chapter.
 *
 * Every step is one module `steps/<nn>-<id>.ts` exporting a `StepFactory`. The factory builds the step's *set*
 * (its 3D objects, added under `tx.stageRoot`) and returns what the scene needs to wire it: the declarative stage
 * state, camera shots, the step UI, a probe for the interaction test and an `update` that runs only while the set
 * is visible. Steps never talk to each other; shared things (materials, the teaching transformer of steps 1–2,
 * the power transformer of steps 4–6) live in `Tx`.
 */
import type { Group, Object3D } from 'three';
import type { Actor, ChapterContext, Shot, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { Sound } from './sound';
import type { Mats } from './world';

export const STEP_IDS = [
  'mutual-induction',
  'turns-ratio',
  'why-high-voltage',
  'anatomy',
  'tap-changer',
  'losses-efficiency',
  'three-phase-groups',
  'types',
  'voltage-ladder',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Tx {
  ctx: ChapterContext;
  ui: StepUiApi;
  /** Audio levels "wanted this frame" and one-shots (`sound.ts`). */
  sound: Sound;
  /** Parent of all sets: origin = centre of the studio floor, +X right, +Z toward the viewer, 1 unit ≈ 1 m of the diorama. */
  stageRoot: Group;
  mats: Mats;
  /**
   * Objects shared by several steps: the first caller builds, the others reuse. A shared object may be listed in
   * several steps' `show`; only the current step drives it.
   */
  share<T>(key: string, make: () => T): T;
  /** True while step `id` is the current one. */
  isCurrent(id: StepId): boolean;
}

export interface StepModule {
  id: StepId;
  /** Camera shots owned by the step; the one named like the step id is its default. */
  shots: Record<string, Shot>;
  /** Stage state (`enter(info)` / `leave()` / `envTune` live here too). `camera` defaults to the shot named like the step. */
  stage: Omit<StepSpec, 'show'> & { show: readonly (Actor | Object3D)[] };
  ui?: StepUiSpec;
  /** Observable state of the step for the interaction test (`__app.read('step')`). */
  probe?(): Record<string, unknown>;
  /** Runs every frame while the step is current or its set is still fading out. */
  update?(dt: number, t: number): void;
}

export type StepFactory = (tx: Tx) => StepModule;
