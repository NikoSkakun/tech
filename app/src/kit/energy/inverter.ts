/**
 * Wall-mounted hybrid inverter — the labs' shared 6 kW «ЛІ-6» (single-phase, 48 V battery port, two MPPT
 * inputs). Generic design, no real brand. Origin: centre of the back plate on the wall, front toward +Z.
 * Units: metres (0.48 × 0.62 × 0.2).
 *
 * Anchors: `pv1`, `pv2` (PV inputs), `bat` (battery terminals), `grid`, `load` (backup output), `gen`,
 * `display`, `dcSwitch`, `nameplate`, `led.grid`, `led.pv`, `led.bat`, `led.alarm`.
 */
import { Mesh } from 'three';
import { K, col, type KGlowMaterial } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';

export type InverterLed = 'grid' | 'pv' | 'bat' | 'alarm';

export interface InverterHandles {
  /** Status LED materials — set `.intensity` (0.25 = off, 1.7 = on) or use `setLeds`. */
  leds: Record<InverterLed, KGlowMaterial>;
  /** Display bar material (power level): tween `.intensity`. */
  display: KGlowMaterial;
  setLeds(state: Partial<Record<InverterLed, boolean>>): void;
}

const LED_COLORS: Record<InverterLed, string> = { grid: 'sky', pv: 'yellow', bat: 'lime', alarm: 'red' };

export function addHybridInverter(b: Builder): InverterHandles {
  const W = 0.48;
  const H = 0.62;
  const D = 0.2;
  const body = col('white');
  // wall bracket, heat sink at the back, rounded body with a dark lower band
  b.box(W * 0.8, H * 0.9, 0.02, { r: 0, mid: true, slot: 'metal', c: 'steel', at: [0, 0, 0.01] });
  for (let i = 0; i < 9; i++) b.box(0.012, H * 0.8, 0.05, { r: 0, mid: true, slot: 'metal', c: 'steel', at: [(i - 4) * 0.045, 0.02, 0.045] });
  b.box(W, H, D - 0.06, { r: 0.045, seg: 2, mid: true, slot: 'gloss', c: [body.clone().multiplyScalar(0.88), body], at: [0, 0, 0.06 + (D - 0.06) / 2] });
  b.box(W + 0.004, H * 0.2, D - 0.056, { r: 0.04, mid: true, slot: 'gloss', c: col('slate').lerp(col('ink'), 0.3), at: [0, -H * 0.4, 0.06 + (D - 0.06) / 2] });
  b.box(W * 0.9, 0.012, 0.01, { r: 0, mid: true, slot: 'gloss', c: 'teal', at: [0, -H * 0.29, D + 0.002] });
  // display: dark glass with a glowing power bar
  b.box(W * 0.46, H * 0.2, 0.012, { r: 0.012, mid: true, slot: 'gloss', c: 'ink', at: [-W * 0.16, H * 0.18, D + 0.002] });
  const display = K.glow({ color: 'teal', core: 'teal.light', intensity: 1.5, falloff: 0 });
  const bar = new Mesh(G.box(W * 0.36, H * 0.035, 0.004), display);
  bar.position.set(-W * 0.16, H * 0.15, D + 0.009);
  b.attach(bar);
  b.anchor('display', -W * 0.16, H * 0.18, D + 0.02);
  // four status LEDs, each with its own material so a chapter can switch them
  const leds = {} as Record<InverterLed, KGlowMaterial>;
  (['grid', 'pv', 'bat', 'alarm'] as const).forEach((name, i) => {
    // core = the LED's own colour: a whitened core would bloom to plain white and lose the colour code
    const m = K.glow({ color: LED_COLORS[name], whiten: 0, keepHue: true, intensity: name === 'alarm' ? 0.25 : 1.7, falloff: 0.3 });
    const led = new Mesh(G.sphere(0.011, 8), m);
    const y = H * 0.25 - i * 0.045;
    led.position.set(W * 0.3, y, D + 0.004);
    b.attach(led);
    b.box(0.06, 0.006, 0.004, { r: 0, mid: true, slot: 'gloss', c: 'steel', at: [W * 0.2, y, D + 0.002] });
    leds[name] = m;
    b.anchor(`led.${name}`, W * 0.3, y, D + 0.02);
  });
  b.anchor('nameplate', 0, H * 0.38, D + 0.005);
  // rotary DC isolator on the side band, cable glands underneath
  b.cyl(0.04, 0.02, { axis: 'z', seg: 14, slot: 'gloss', c: 'yellow', at: [-W * 0.3, -H * 0.4, D] });
  b.box(0.022, 0.07, 0.022, { r: 0.008, mid: true, slot: 'gloss', c: 'red', at: [-W * 0.3, -H * 0.4, D + 0.03] });
  b.anchor('dcSwitch', -W * 0.3, -H * 0.4, D + 0.05);
  const ports: [string, number, string][] = [
    ['pv1', -0.19, 'coral'],
    ['pv2', -0.13, 'coral'],
    ['bat', -0.04, 'ink'],
    ['grid', 0.06, 'slate'],
    ['load', 0.13, 'slate'],
    ['gen', 0.2, 'slate'],
  ];
  for (const [name, x, c] of ports) {
    b.cyl(name === 'bat' ? 0.022 : 0.014, 0.035, { seg: 8, slot: 'gloss', c, at: [x, -H / 2 - 0.03, 0.13] });
    b.anchor(name, x, -H / 2 - 0.035, 0.13);
  }
  return {
    leds,
    display,
    setLeds(state) {
      for (const [name, on] of Object.entries(state) as [InverterLed, boolean][]) leds[name].intensity = on ? 1.7 : 0.25;
    },
  };
}

export function hybridInverter(): KitModel & InverterHandles {
  const b = new Builder('hybrid-inverter');
  const handles = addHybridInverter(b);
  return Object.assign(b.build(), handles);
}
