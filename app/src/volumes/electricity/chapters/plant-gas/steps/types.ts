/**
 * Contract between `scene.ts` and the step modules. One file per step in `steps/`: it receives the built
 * world (`Deps`) and returns its declarative stage state, its step UI (controls, board, callouts, hotspots,
 * honesty chips) and an optional per-frame `update` that runs only while the step is on screen.
 */
import type { Actor, ChapterContext, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { L } from '../content';
import type { KitModel } from '@/kit';
import type { GtFlow } from '../parts/gt-flow';
import type { Island } from '../parts/island';
import type { WorkArrows } from '../parts/work-arrows';
import type { GtBinding } from '../sim-bindings/gt';
import type { World } from '../parts/world';
import type { Live } from '../state';

export type StepId =
  | 'overview'
  | 'natural-gas'
  | 'gas-turbine'
  | 'brayton-sim'
  | 'hot-section'
  | 'combined-cycle'
  | 'flexibility'
  | 'gas-engines'
  | 'emissions-hydrogen'
  | 'role';

export interface Deps {
  ctx: ChapterContext;
  ui: StepUiApi;
  L: typeof L;
  live: Live;
  world: World;
  isl: Island;
  /**
   * Actors of the outside view: hall roof and south wall, boiler wall, the air-intake house and the exhaust duct
   * (the steps inside the hall hide some of them). `outside` = all of them (+ the engine hall's roof and wall);
   * `inside` = the machines of the main hall, `engines` = the eight engines (shown only where the roof is off).
   */
  /** The hero gas turbine's flows, work arrows, model sample and the turbofan for comparison (steps 3–5). */
  gt: { flow: GtFlow; arrows: WorkArrows; sim: GtBinding; fan: KitModel; flows: Actor[]; arrowActor: Actor };
  shell: { roof: Actor; front: Actor; hrsgFront: Actor; intake: Actor; duct: Actor; outside: Actor[]; inside: Actor; engines: Actor; engineRoof: Actor; engineFront: Actor };
}

export interface StepModule {
  id: StepId;
  /** Declarative state: actors shown, params, camera shot, env, post (ENGINE_API §5). */
  stage: StepSpec;
  /** Controls, board, callouts, hotspots, honesty chips (UI_API §3). */
  ui?: StepUiSpec;
  /** Runs every frame while this step is the current one (after the stage applied it). */
  update?(dt: number, t: number): void;
}

export type StepFactory = (d: Deps) => StepModule;
