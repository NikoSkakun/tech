/**
 * Binding of the wake model (`simulateFarm`, document M5) to the diorama farm: whenever wind direction, row
 * spacing, steering or wind speed change, the 16 turbines are laid out again, every rotor gets the speed of
 * its own inflow, the collector strings are re-routed and the wind streaks learn the new wake sources.
 */
import { FARM_DEFAULTS, TURBINE_6MW, rotorRpm, simulateFarm, type FarmResult } from '@electricity/sim/plant-wind';
import { FARM } from '../layout';
import type { Chain } from '../parts/chain';
import type { Farm } from '../parts/farm';
import type { WindField } from '../parts/wind-field';
import type { Live } from '../state';

export interface FarmParams {
  windFromDeg: number;
  rowSpacingD: number;
  steering: boolean;
  vMs: number;
}

export interface FarmBinding {
  /** What is currently laid out. */
  readonly params: Readonly<FarmParams>;
  /**
   * What the scene wants: reset to the defaults every frame (`defaults`), then overridden by the current step.
   * `update` recomputes the farm only when this differs from `params`.
   */
  readonly want: FarmParams;
  defaults(vMs: number): void;
  result: FarmResult;
  update(): void;
  /** Called after every recomputation (wake ribbons, power bars). */
  onChange: (() => void) | null;
}

/** First wake slot of the farm in `WindField` (slot 0 is the hero). */
export const FARM_WAKE_SLOT = 1;

export function bindFarm(farm: Farm, chain: Chain, wind: WindField, live: Live): FarmBinding {
  const params: FarmParams = {
    windFromDeg: FARM_DEFAULTS.windFromDeg,
    rowSpacingD: FARM_DEFAULTS.rowSpacingD,
    steering: false,
    vMs: FARM_DEFAULTS.vMs,
  };
  const want: FarmParams = { ...params };
  let first = true;
  const n = FARM.rows * FARM.perRow;
  const binding: FarmBinding = {
    params,
    want,
    result: simulateFarm(params),
    onChange: null,
    defaults(vMs) {
      want.windFromDeg = FARM_DEFAULTS.windFromDeg;
      want.rowSpacingD = FARM_DEFAULTS.rowSpacingD;
      want.steering = false;
      want.vMs = Math.round(vMs * 4) / 4; // quarter-m/s steps: no recomputation for every flutter of the wind
    },
    update() {
      const same = (Object.keys(want) as (keyof FarmParams)[]).every((k) => want[k] === params[k]);
      if (same && !first) return;
      first = false;
      Object.assign(params, want);
      const r = (binding.result = simulateFarm(params));
      farm.apply(r, params.rowSpacingD, params.windFromDeg);
      r.turbines.forEach((t, i) => {
        farm.speed[i] = (rotorRpm(TURBINE_6MW, t.inflowMs) * Math.PI) / 30;
        // wake sources at the layout scale (a drawn rotor is `enlarged`× the layout rotor)
        wind.setWake(FARM_WAKE_SLOT + i, farm.hub(i), FARM.layoutD / 2, t.yawed ? 0.8 : 1);
      });
      wind.setWakeCount(FARM_WAKE_SLOT + n);
      chain.layoutCollector();
      live.farmPower = r.totalW / (n * TURBINE_6MW.ratedW);
      binding.onChange?.();
    },
  };
  return binding;
}
