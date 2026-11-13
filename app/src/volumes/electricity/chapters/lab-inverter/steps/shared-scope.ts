/**
 * The scope station shared by steps 4 (`pwm`) and 5 (`lc-filter`): the bench scope with its spectrum rows, the
 * waveform laboratory behind it and a small copy of the H-bridge whose keys follow the controller at the
 * "now" cursor. One model drives the traces, the bars, the board charts and the readouts.
 *
 * Time: the window scrolls through the 20 ms period in slow motion. Above 2 kHz a whole period would be a
 * solid block of pulses, so the scope switches to a 2 ms «лупа» window (the steps show a chip for both).
 */
import type { Group } from 'three';
import type { Actor } from '@/engine/api';
import type { Lab } from '../chapter';
import { createBenchScope, type BenchScope } from '../parts/bench-scope';
import { KEYS, createHBridgeRig, type HBridgeRig } from '../parts/hbridge-rig';
import { PERIOD_S, createWaveLab, isPwm, type WaveLab } from '../sim-bindings/wave-lab';
import { group } from '../world';

/** Screen seconds for the window to travel one full window width. */
const SWEEP_S = { full: 9, magnified: 3.6 } as const;
export const MAGNIFIER_SPAN_S = 0.002;
/** Default x of the small bridge on the bench (pose `miniBridge`). */
export const MINI_X = -2.3;
/** Slow-motion factors shown on the chips: screen time / signal time. */
export const SLOWED = {
  full: Math.round(SWEEP_S.full / PERIOD_S),
  magnified: Math.round(SWEEP_S.magnified / MAGNIFIER_SPAN_S),
} as const;

export interface ScopeStation {
  group: Group;
  actor: Actor;
  scope: BenchScope;
  mini: HBridgeRig;
  miniActor: Actor;
  waves: WaveLab;
  /** True while the 2 ms magnifier window is in use (step 4 with a carrier above 2 kHz). */
  readonly magnified: boolean;
  /** The carrier is too fast to resolve over a whole period (magnifier in step 4, fence in step 5). */
  readonly fast: boolean;
  /** Signal time at the cursor, s. */
  readonly now: number;
  /** Advance the window, redraw the traces, refresh the spectrum if the model changed, drive the mini bridge. */
  run(dt: number): void;
}

export function scopeStation(lab: Lab): ScopeStation {
  return lab.share('scope', () => {
    const scope = createBenchScope();
    scope.group.scale.setScalar(0.8);
    scope.group.position.set(0, 4.0, -1.2);
    const mini = createHBridgeRig();
    mini.group.scale.setScalar(0.36);
    mini.group.rotation.y = 0.18;
    const set = group('set:scope', 0, 0, 0, [scope.group]);
    // the small bridge stands front-left (step 5 puts the filter to its right); step 4 poses it in the middle
    const miniSet = group('set:mini-bridge', MINI_X, 0.02, 1.7, [mini.group]);
    lab.stageRoot.add(set, miniSet);
    lab.ctx.stage.pose('miniBridge', miniSet);
    const waves = createWaveLab();
    let centre = 0.004;
    let drawn = -1;
    let drawnMode = scope.mode;
    const self: ScopeStation = {
      group: set,
      actor: lab.ctx.stage.actor(set),
      scope,
      mini,
      miniActor: lab.ctx.stage.actor(miniSet),
      waves,
      get magnified() {
        return scope.mode === 'pwm' && self.fast;
      },
      get fast() {
        return isPwm(waves.settings.kind) && waves.settings.fcHz > 2000;
      },
      get now() {
        return centre;
      },
      run(dt) {
        const span = self.magnified ? MAGNIFIER_SPAN_S : PERIOD_S;
        centre = (centre + (dt * span) / (self.magnified ? SWEEP_S.magnified : SWEEP_S.full)) % PERIOD_S;
        scope.draw(waves, centre - span / 2, span, self.fast && !self.magnified);
        if (drawn !== waves.version || drawnMode !== scope.mode) {
          drawn = waves.version;
          drawnMode = scope.mode;
          scope.setSpectrum(waves.barsBefore, scope.mode === 'filter' ? waves.barsAfter : null, waves.udcV);
        }
        const gates = waves.gates(centre);
        KEYS.forEach((name, i) => mini.setKey(name, gates[i]!));
        mini.setNeedle(waves.before(centre) / waves.udcV);
      },
    };
    return self;
  });
}
