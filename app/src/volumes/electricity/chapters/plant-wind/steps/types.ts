/**
 * Contract between `scene.ts` and the step modules. One file per step in `steps/`: it receives the built
 * world (`Deps`) and returns its declarative stage state, its step UI (controls, board, callouts, hotspots,
 * honesty chips) and an optional per-frame `update` that runs only while the step is on screen.
 */
import type { ChapterContext, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { L } from '../content';
import type { Chain } from '../parts/chain';
import type { Farm } from '../parts/farm';
import type { Grid } from '../parts/grid';
import type { Hero } from '../parts/hero';
import type { Lights } from '../parts/lights';
import type { NacelleRig } from '../parts/nacelle-rig';
import type { Offshore } from '../parts/offshore';
import type { WindField } from '../parts/wind-field';
import type { World } from '../parts/world';
import type { FarmBinding } from '../sim-bindings/farm';
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
  ui: StepUiApi;
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
  /** Controls, board, callouts, hotspots, honesty chips (UI_API §3). */
  ui?: StepUiSpec;
  /** Runs every frame while this step is the current one (after the stage applied it). */
  update?(dt: number, t: number): void;
}

export type StepFactory = (d: Deps) => StepModule;
