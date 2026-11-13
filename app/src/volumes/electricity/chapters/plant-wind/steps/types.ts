/**
 * Contract between `scene.ts` and the step modules. One file per step in `steps/`: it receives the built
 * world (`Deps`) and returns its declarative stage state, its step UI (controls, callouts, hotspots, honesty
 * chips) and an optional per-frame `update` that runs only while the step is on screen.
 */
import type { ChapterContext, StepSpec } from '@/engine/api';
import type { StepUi, StepUiSpec } from '@/hud';
import type { L } from '../content';
import { type Chain, type Farm, type Grid, type Hero, type Lights, type NacelleRig, type Offshore, type WindField, type World } from '../parts';
import { type FarmBinding } from '../sim-bindings';
import type { Live } from '../state';

export type StepId =
  | 'overview'
  | 'wind-power'
  | 'betz'
  | 'blade'
  | 'nacelle'
  | 'drivetrain'
  | 'power-curve'
  | 'wind-farm'
  | 'capacity-factor'
  | 'offshore'
  | 'role';

export interface Deps {
  ctx: ChapterContext;
  ui: StepUi;
  L: typeof L;
  live: Live;
  world: World;
  hero: Hero;
  farm: Farm;
  farmSim: FarmBinding;
  grid: Grid;
  offshore: Offshore;
  wind: WindField;
  chain: Chain;
  lights: Lights;
  rig: NacelleRig;
}

export interface StepModule {
  id: StepId;
  /** Declarative state: actors shown, params, camera shot, env, post (ENGINE_API §5). */
  stage: StepSpec;
  /** Controls, callouts, hotspots, honesty chips (UI_API §3). */
  ui?: StepUiSpec;
  /** Runs every frame while this step is the current one (after the stage applied it). */
  update?(dt: number, t: number): void;
}

export type StepFactory = (d: Deps) => StepModule;
