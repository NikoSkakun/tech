/**
 * Contract between `scene.ts` and the step modules. One file per step in `steps/`: it receives the built world
 * (`Deps`) and returns its declarative stage state, its step UI (controls, board, callouts, hotspots, honesty
 * chips) and an optional per-frame `update` that runs only while the step is on screen.
 */
import type { ChapterContext, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { L } from '../content';
import type { Plant } from '../parts/plant';
import type { World } from '../parts/world';
import type { Live } from '../state';
import type { Hot } from './hot';

export type StepId =
  | 'overview'
  | 'coal'
  | 'coal-to-dust'
  | 'boiler'
  | 'steam-params'
  | 'turbine'
  | 'feedwater'
  | 'flue-gas'
  | 'ash-co2'
  | 'chp-flex'
  | 'role-ukraine';

export interface Deps {
  ctx: ChapterContext;
  ui: StepUiApi;
  L: typeof L;
  live: Live;
  world: World;
  plant: Plant;
  /** Hotspot marker bound by content id (probe `hs.<id>`). */
  hot: Hot;
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
