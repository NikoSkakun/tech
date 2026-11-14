/**
 * The contract between `scene.ts` and the step modules of this chapter.
 *
 * Every step is one module `steps/<nn>-<id>.ts` exporting a `StepFactory`. The factory builds the step's *set*
 * (its own 3D objects, added under `hub.stageRoot`) and returns what the scene needs to wire it: the declarative
 * stage state, camera shots, the step UI, a probe for the interaction test and an `update` that runs only while
 * the set is visible. Steps never talk to each other; the shared archipelago (hub island, machine hall with the
 * turbine-generator set, the nine plant islands, the world ring and the island lines) lives in `Archipelago`.
 */
import type { Group, Object3D } from 'three';
import type { Actor, ChapterContext, Shot, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { Archipelago } from './parts/archipelago';
import type { Sound } from './sound';
import type { Mats } from './world';

export const STEP_IDS = [
  'intro',
  'turbine-generator',
  'energy-chains',
  'heat-engine',
  'rankine',
  'brayton',
  'steam-island',
  'metrics',
  'flexibility',
  'mix',
  'gallery',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Hub {
  ctx: ChapterContext;
  ui: StepUiApi;
  /** Audio levels "wanted this frame" and one-shots (`sound.ts`). */
  sound: Sound;
  /** Parent of all step sets; world origin = centre of the hub island's machine-hall floor, metres, +Z to the viewer. */
  stageRoot: Group;
  /** The shared world (always on screen; steps drive its "wanted this frame" fields). */
  arch: Archipelago;
  /** The turbine-generator set in the machine hall (an actor: some steps put their own rig there). */
  turboSet: Actor;
  /** The machine hall around it (hidden in the close-up steps: «the roof dissolves»). */
  hall: Actor;
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
   * the step; the turbine-generator set is added to `show` when `turboSet` is true.
   */
  stage: Omit<StepSpec, 'show'> & { show: readonly (Actor | Object3D)[] };
  turboSet?: boolean;
  /** Show the machine hall (walls, columns, crane). */
  hall?: boolean;
  /** Hide the island → ring lines (they are shown by default). */
  noLines?: boolean;
  ui?: StepUiSpec;
  /** Observable state of the step for the interaction test (`__app.read('step')`). */
  probe?(): Record<string, unknown>;
  /** Runs every frame while the step is current or its set is still fading out. */
  update?(dt: number, t: number): void;
}

export type StepFactory = (hub: Hub) => StepModule;
