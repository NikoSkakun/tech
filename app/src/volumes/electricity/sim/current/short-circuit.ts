/**
 * `current` «Модель симуляції» §5 (step `circuit`): ℰ = 1,5 V, r = 0,2 Ω, lamp 5 Ω, jumper 0,01 Ω, ideal wires.
 * Topology: battery «+» → fuse (1 A, optional) → switch → lamp → battery «−». Jumper either across the lamp
 * (current goes through switch and fuse — the fuse blows) or across the battery terminals (bypasses switch and
 * fuse — the fuse survives, the battery heats). Fuse: blows if I > 2·I_n for 0,3 s or I > 1,25·I_n for 3 s.
 * Battery "temperature" while it is short-circuited: T_b = 20 °C + 8 °C/s·t (scenic), warning at 60 °C;
 * resets to 20 °C when the short is removed (not specified by the document).
 */
import { solveDc, type CircuitElement } from '../core/S1-sim/mna';
import { createFuse } from '../core/S1-sim/protection';

export const SHORT_CIRCUIT = {
  emfV: 1.5,
  internalOhm: 0.2,
  lampOhm: 5,
  jumperOhm: 0.01,
  fuseRatedA: 1,
  heatingCPerS: 8,
  ambientC: 20,
  warningC: 60,
  /** Battery current above which the battery counts as short-circuited (normal load is 0,29 A). */
  shortThresholdA: 2,
} as const;

export type JumperPosition = 'none' | 'lamp' | 'battery';

export interface ShortCircuitParams {
  switchClosed: boolean;
  jumper: JumperPosition;
  fuseInstalled: boolean;
}

export interface ShortCircuitState {
  batteryCurrentA: number;
  batteryTerminalV: number;
  lampV: number;
  lampCurrentA: number;
  lampPowerW: number;
  /** Current through the fuse branch, A. */
  fuseCurrentA: number;
  fuseBlown: boolean;
  /** Heat dissipated inside the battery I²·r, W. */
  batteryInternalW: number;
  batteryShorted: boolean;
  batteryTemperatureC: number;
  overheatWarning: boolean;
}

export interface ShortCircuitModel {
  readonly state: ShortCircuitState;
  readonly params: ShortCircuitParams;
  step(dt: number): ShortCircuitState;
  set(params: Partial<ShortCircuitParams>): void;
  /** «Новий запобіжник». */
  replaceFuse(): void;
}

export function createShortCircuit(initial: Partial<ShortCircuitParams> = {}): ShortCircuitModel {
  const params: ShortCircuitParams = { switchClosed: false, jumper: 'none', fuseInstalled: true, ...initial };
  const fuse = createFuse({ ratedCurrentA: SHORT_CIRCUIT.fuseRatedA, curve: [{ multiple: 2, timeS: 0.3 }, { multiple: 1.25, timeS: 3 }] });
  const state = {} as ShortCircuitState;
  let temperature: number = SHORT_CIRCUIT.ambientC;

  const solve = (): void => {
    const els: CircuitElement[] = [
      { kind: 'source', id: 'bat', plus: 'bp', minus: 'bm', emfV: SHORT_CIRCUIT.emfV, internalResistanceOhm: SHORT_CIRCUIT.internalOhm },
      params.fuseInstalled
        ? { kind: 'fuse', id: 'fuse', a: 'bp', b: 'f', blown: fuse.state.blown }
        : { kind: 'wire', id: 'fuse', a: 'bp', b: 'f' },
      { kind: 'switch', id: 'sw', a: 'f', b: 'la', closed: params.switchClosed },
      { kind: 'resistor', id: 'lamp', a: 'la', b: 'bm', resistanceOhm: SHORT_CIRCUIT.lampOhm },
    ];
    if (params.jumper === 'lamp') els.push({ kind: 'resistor', id: 'jumper', a: 'la', b: 'bm', resistanceOhm: SHORT_CIRCUIT.jumperOhm });
    if (params.jumper === 'battery') els.push({ kind: 'resistor', id: 'jumper', a: 'bp', b: 'bm', resistanceOhm: SHORT_CIRCUIT.jumperOhm });
    const s = solveDc(els);
    const bat = s.elements.get('bat')!;
    const lamp = s.elements.get('lamp')!;
    state.batteryCurrentA = bat.currentA;
    state.batteryTerminalV = bat.voltageV;
    state.lampV = lamp.voltageV;
    state.lampCurrentA = lamp.currentA;
    state.lampPowerW = lamp.powerW;
    state.fuseCurrentA = s.elements.get('fuse')!.currentA;
    state.fuseBlown = params.fuseInstalled && fuse.state.blown;
    state.batteryInternalW = bat.currentA * bat.currentA * SHORT_CIRCUIT.internalOhm;
    state.batteryShorted = bat.currentA > SHORT_CIRCUIT.shortThresholdA;
    state.batteryTemperatureC = temperature;
    state.overheatWarning = temperature >= SHORT_CIRCUIT.warningC;
  };

  solve();
  return {
    state,
    params,
    step(dt: number): ShortCircuitState {
      if (params.fuseInstalled && fuse.step(state.fuseCurrentA, dt)) solve();
      temperature = state.batteryShorted ? temperature + SHORT_CIRCUIT.heatingCPerS * Math.max(dt, 0) : SHORT_CIRCUIT.ambientC;
      solve();
      return state;
    },
    set(next: Partial<ShortCircuitParams>): void {
      Object.assign(params, next);
      solve();
    },
    replaceFuse(): void {
      fuse.reset();
      solve();
    },
  };
}
