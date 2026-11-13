/**
 * The contract between `scene.ts` and the step modules of this chapter.
 *
 * Every step is one module `steps/NN-<id>.ts` exporting a `StepFactory`. The factory builds the step's *set*
 * (its 3D objects, added under `lab.stageRoot`) and returns what the scene needs to wire it: camera shots, the
 * declarative stage state, the step UI and an `update` that runs while the set is on screen. Steps never talk to
 * each other; shared things (podium, materials, the hero module, the bench) live in `Lab` or behind `lab.share`.
 */
import type { Group, Object3D } from 'three';
import type { Actor, ChapterContext, Shot, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { StepId } from './content';
import type { Mats } from './world';

export type { StepId };

export interface Lab {
  ctx: ChapterContext;
  ui: StepUiApi;
  /** Parent of all sets: origin = centre of the podium top. */
  stageRoot: Group;
  /** The podium (an actor: hidden in the micro-world and roof steps). */
  podium: Actor;
  mats: Mats;
  /**
   * Objects shared by several steps (the hero module, the bench): the first caller builds, the others reuse.
   * A shared object may be listed in several steps' `show`; only the current step drives it.
   */
  share<T>(key: string, make: () => T): T;
  /** True while step `id` is the current one. */
  isCurrent(id: StepId): boolean;
}

export interface StepModule {
  id: StepId;
  /** Camera shots owned by the step; the one named like the step id is its default. Every shot declares `fit`. */
  shots: Record<string, Shot>;
  /**
   * Stage state (`enter(info)` lives here too). `camera` defaults to the shot named like the step; the podium
   * is added to `show` unless `noPodium`.
   */
  stage: Omit<StepSpec, 'show'> & { show: readonly (Actor | Object3D)[] };
  noPodium?: boolean;
  ui?: StepUiSpec;
  /** Runs every frame while the step is current or its set is still fading out. */
  update?(dt: number, t: number): void;
}

export type StepFactory = (lab: Lab) => StepModule;
