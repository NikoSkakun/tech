/**
 * The contract between `scene.ts` and the step modules of this chapter.
 *
 * Every step is one module `steps/<nn>-<id>.ts` exporting a `StepFactory`. The factory builds the step's *set*
 * (its 3D objects, added under `lab.stageRoot`), and returns everything the scene needs to wire it:
 * the declarative stage state, camera shots, the step UI and an `update` that runs only while the set is
 * visible. Steps never talk to each other; shared things (podium, materials, sound) live in `Lab`.
 */
import type { Group, Object3D } from 'three';
import type { Actor, ChapterContext, Shot, StepSpec } from '@/engine/api';
import type { StepUiSpec } from '@/hud';
import type { EnvOverrides } from '@/style';
import type { HoloBoard } from './holo';
import type { LabUi } from './lab-ui';
import type { Mats } from './world';

export type StepId =
  | 'what-is-battery'
  | 'cell-anatomy'
  | 'intercalation'
  | 'why-lithium'
  | 'chemistries'
  | 'voltage-capacity'
  | 'charging'
  | 'pack'
  | 'bms'
  | 'degradation'
  | 'safety'
  | 'scale-and-future';

export interface Lab {
  ctx: ChapterContext;
  ui: LabUi;
  /** Parent of all sets: origin = centre of the podium top. */
  stageRoot: Group;
  /** The podium (an actor: hidden in the micro-world step). */
  podium: Actor;
  mats: Mats;
  /** Holographic instrument board (big charts) — see `holo.ts`. */
  holo: HoloBoard;
  /**
   * Objects shared by consecutive steps (the bench of steps 6–7): the first caller builds, the others reuse.
   * A shared object may be listed in several steps' `show`; only the current step drives and updates it.
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
   * Stage state (`enter(info)` / `leave()` live here too). `camera` defaults to the shot named like the step;
   * the podium is added to `show` unless `noPodium`.
   */
  stage: Omit<StepSpec, 'show'> & { show: readonly (Actor | Object3D)[] };
  noPodium?: boolean;
  /** Environment overrides on top of the `studio` preset (a complete set: applied on every entry). */
  env?: EnvOverrides;
  ui?: StepUiSpec;
  /**
   * Observable state of the step for the interaction test (`window.__lab.probe()`): plain numbers / strings /
   * world points that must change when a control is used.
   */
  probe?(): Record<string, unknown>;
  /** Runs every frame while the step is current or its set is still fading out. */
  update?(dt: number, t: number): void;
}

export type StepFactory = (lab: Lab) => StepModule;
