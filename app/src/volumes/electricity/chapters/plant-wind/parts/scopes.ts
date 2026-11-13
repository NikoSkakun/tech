/**
 * Step 6 oscilloscopes: left the raw generator voltage whose frequency floats with the wind (`amber`), right
 * the converter output — a steady 50 Hz sine (`green`). Both share one time base, so a lower raw frequency is
 * visibly a longer wave. The traces are slowed down for the eye (the step carries the «сповільнено» chip).
 */
import { Group, Vector3 } from 'three';
import { createScope, type Scope } from '@/fx';
import { createBadge } from './badge';

const SAMPLES = 160;
/** Periods of a 50 Hz wave across the screen, and how much slower than real time the traces scroll. */
const CYCLES_50 = 3;
export const SCOPE_SLOWDOWN = 40;

export interface Scopes {
  group: Group;
  raw: Scope;
  grid: Scope;
  /** Captions over the two screens (e.g. with the live frequency). */
  setLabels(raw: string, grid: string): void;
  /** Scratch vector for callers. */
  tmp: Vector3;
  update(dt: number, rawHz: number, outHz: number): void;
}

export function buildScopes(rawLabel: string, gridLabel: string, size = 2.9): Scopes {
  const group = new Group();
  group.name = 'scopes';
  const captions: ReturnType<typeof createBadge>[] = [];
  const make = (x: number, color: 'amber' | 'green', label: string): Scope => {
    const scope = createScope({ width: size, height: size * 0.56, channels: [color], samples: SAMPLES, lineWidth: size * 0.011 });
    scope.position.x = x;
    const badge = createBadge(label, color, 16, 64);
    badge.position.set(0, size * 0.33, 0);
    scope.add(badge);
    captions.push(badge);
    group.add(scope);
    return scope;
  };
  const raw = make(-size * 0.56, 'amber', rawLabel);
  const grid = make(size * 0.56, 'green', gridLabel);
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
    tmp: new Vector3(),
    setLabels(a, b) {
      if (captions[0]!.text !== a) captions[0]!.text = a;
      if (captions[1]!.text !== b) captions[1]!.text = b;
    },
    update(dt, rawHz, outHz) {
      phaseRaw = (phaseRaw + (dt * rawHz * Math.PI * 2) / SCOPE_SLOWDOWN) % (Math.PI * 2);
      phaseGrid = (phaseGrid + (dt * outHz * Math.PI * 2) / SCOPE_SLOWDOWN) % (Math.PI * 2);
      draw(raw, rawHz, phaseRaw);
      draw(grid, outHz, phaseGrid);
    },
  };
}
