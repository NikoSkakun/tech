/**
 * The contract between `scene.ts` and the step modules of this chapter.
 *
 * Every step is one module `steps/<nn>-<id>.ts` exporting a `StepFactory`. The factory builds the step's *set*
 * (its 3D objects, added under `bench.top`) and returns what the scene needs to wire it: camera shots, the
 * declarative stage state, the step UI and an `update` that runs while the set is on screen. Steps never talk
 * to each other; the workbench, the compass carpet, shared materials and the step UI live in `Bench`.
 *
 * Units: 1 world unit = 10 cm (`S` in `world.ts`); the table plane is y = 0 of `bench.top`; the simulation's
 * table plane (x east, y north) maps to world (x, −z): north is "away from the camera" on the table.
 */
import type { Group, Object3D } from 'three';
import type { Actor, ChapterContext, Shot, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { CompassCarpet } from './parts/carpet';
import type { Mats } from './world';

export type StepId =
  | 'magnet-field'
  | 'domains'
  | 'oersted'
  | 'solenoid'
  | 'lorentz'
  | 'dc-motor'
  | 'induction'
  | 'lenz'
  | 'inductance'
  | 'maxwell'
  | 'to-generator';

/** Loop gains 0…1 requested by the step on screen (reset to 0 after every frame). */
export interface LiveState {
  /** Electric buzz: a supply under load, a coil with current. */
  buzz: number;
  /** Motor / crank whir; `whirPitch` follows the speed. */
  whir: number;
  whirPitch: number;
  /** Mains-like hum (AC from the generator, the neon). */
  hum: number;
  humPitch: number;
}

export interface Bench {
  ctx: ChapterContext;
  ui: StepUiApi;
  /** Parent of all sets: origin = centre of the table top, y up. */
  top: Group;
  mats: Mats;
  /** The live «килим компасів» (shown by the steps that list `carpet.group`). */
  carpet: CompassCarpet;
  /** "Wanted this frame" audio state: the step on screen writes it in `update`, `sound.ts` reads and resets it. */
  live: LiveState;
  /** True while step `id` is the current one. */
  isCurrent(id: StepId): boolean;
}

export interface StepModule {
  id: StepId;
  /** Camera shots owned by the step; the one named like the step id is its default. */
  shots: Record<string, Shot>;
  /** Stage state; `camera` defaults to the shot named like the step. */
  stage: Omit<StepSpec, 'show'> & { show: readonly (Actor | Object3D)[] };
  ui?: StepUiSpec;
  /** Runs every frame while the step is current or its set is still fading out. */
  update?(dt: number, t: number): void;
}

export type StepFactory = (bench: Bench) => StepModule;
