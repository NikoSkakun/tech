/**
 * Step 6 oscilloscopes: left the raw generator voltage whose frequency floats with the wind (`amber`), right
 * the converter output — a steady 50 Hz sine (`green`). Both share one time base, so a lower raw frequency is
 * visibly a longer wave. The traces are slowed down for the eye (the step carries the «сповільнено» chip).
 * The step names the two screens with callouts.
 */
import { Group } from 'three';
import { createScope, type Scope } from '@/fx';

const SAMPLES = 160;
/** Periods of a 50 Hz wave across the screen, and how much slower than real time the traces scroll. */
const CYCLES_50 = 3;
export const SCOPE_SLOWDOWN = 40;

export interface Scopes {
  group: Group;
  raw: Scope;
  grid: Scope;
  update(dt: number, rawHz: number, outHz: number): void;
}

export function buildScopes(size = 2.9): Scopes {
  const group = new Group();
  group.name = 'scopes';
  const make = (x: number, color: 'amber' | 'green'): Scope => {
    const scope = createScope({ width: size, height: size * 0.56, channels: [color], samples: SAMPLES, lineWidth: size * 0.011 });
    scope.position.x = x;
    group.add(scope);
    return scope;
  };
  const raw = make(-size * 0.56, 'amber');
  const grid = make(size * 0.56, 'green');
  const buf = new Float32Array(SAMPLES);
  let phaseRaw = 0;
  let phaseGrid = 0;
  const draw = (scope: Scope, hz: number, phase: number): void => {
    const cycles = (CYCLES_50 * hz) / 50;
    const amp = hz > 0 ? 0.82 : 0;
    for (let i = 0; i < SAMPLES; i++) buf[i] = amp * Math.sin((i / (SAMPLES - 1)) * cycles * Math.PI * 2 - phase);
    scope.setSamples(0, buf);
  };
  return {
    group,
    raw,
    grid,
    update(dt, rawHz, outHz) {
      phaseRaw = (phaseRaw + (dt * rawHz * Math.PI * 2) / SCOPE_SLOWDOWN) % (Math.PI * 2);
      phaseGrid = (phaseGrid + (dt * outHz * Math.PI * 2) / SCOPE_SLOWDOWN) % (Math.PI * 2);
      draw(raw, rawHz, phaseRaw);
      draw(grid, outHz, phaseGrid);
    },
  };
}
