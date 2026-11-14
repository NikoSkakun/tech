import { describe, expect, it } from 'vitest';
import { DEFAULT_HUD, parseFlags } from '@/engine/app';
import { EASE } from '@/engine/tween';
import { MOTION } from '@/style/motion';
import {
  ACCENT,
  BG,
  FLOW,
  NEUTRAL,
  PLANT_TYPE,
  SEMANTIC,
  STANDARD,
  UI_STATUS,
  hex,
  type ColorLike,
} from '@/style/palette';
import { applyTokens, cssEase } from '../core/tokens';

/** `applyTokens` on a stand-in element (the unit tests run without a DOM). */
function tokens(): Map<string, string> {
  const vars = new Map<string, string>();
  const root = { style: { setProperty: (k: string, v: string) => vars.set(k, v) } };
  applyTokens(root as unknown as HTMLElement);
  return vars;
}

describe('DOM tokens (hud-dom/core/tokens.ts)', () => {
  const vars = tokens();
  const has = (name: string, token: string): void => {
    expect(vars.get(`--c-${name}`), `--c-${name}`).toBe(hex(token as ColorLike));
    expect(vars.get(`--c-${name}-rgb`), `--c-${name}-rgb`).toMatch(/^\d+ \d+ \d+$/);
  };

  it('has a variable for every palette colour, with its light / dark variants', () => {
    for (const k of Object.keys(BG)) has(`bg-${k}`, `bg.${k}`);
    for (const k of [...Object.keys(ACCENT), ...Object.keys(NEUTRAL)]) {
      has(k, k);
      has(`${k}-light`, `${k}.light`);
      has(`${k}-dark`, `${k}.dark`);
    }
    for (const k of Object.keys(STANDARD)) has(k, k);
  });

  it('has the named groups ui-*, plantType-*, flow-*, phase-*', () => {
    for (const k of Object.keys(UI_STATUS)) has(`ui-${k}`, `ui.${k}`);
    for (const k of Object.keys(PLANT_TYPE)) has(`plantType-${k}`, `plantType.${k}`);
    for (const k of Object.keys(FLOW)) has(`flow-${k}`, `flow.${k}`);
    has('phase-L1', SEMANTIC.phaseL1);
    has('phase-L2', SEMANTIC.phaseL2);
    has('phase-L3', SEMANTIC.phaseL3);
  });

  it('can express every semantic colour through a variable', () => {
    const values = new Set([...vars.entries()].filter(([k]) => !k.endsWith('-rgb')).map(([, v]) => v));
    for (const [name, token] of Object.entries(SEMANTIC)) expect(values.has(hex(token)), name).toBe(true);
  });

  it('carries the motion presets as durations and easings', () => {
    for (const [k, p] of Object.entries(MOTION)) {
      expect(vars.get(`--dur-${k}`)).toBe(`${Math.round(p.duration * 1000)}ms`);
      expect(vars.get(`--ease-${k}`)).toMatch(/^linear\(0, .*, 1\)$/);
    }
    // the sampled curve passes through the engine's easing
    const css = cssEase(EASE['power2.out'], 4);
    expect(css).toBe(`linear(0, ${[0.25, 0.5, 0.75].map((t) => Math.round(EASE['power2.out'](t) * 1000) / 1000).join(', ')}, 1)`);
  });
});

describe('flags.hud (?hud=dom|gl)', () => {
  it('reads the renderer from the address and defaults to DEFAULT_HUD', () => {
    expect(parseFlags('?hud=dom').hud).toBe('dom');
    expect(parseFlags('?hud=gl').hud).toBe('gl');
    expect(parseFlags('?hud=svg').hud).toBe(DEFAULT_HUD);
    expect(parseFlags('').hud).toBe(DEFAULT_HUD);
    expect(DEFAULT_HUD).toBe('gl'); // until the cut-over (D9)
  });
});
