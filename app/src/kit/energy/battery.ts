/**
 * Home battery cabinet — the labs' shared LFP battery: 51.2 V (16 cells in series), two 100 Ah modules in
 * parallel = 10.24 kWh, BMS unit on top. The front cover is a separate part (`cover`): take it off to see the
 * 2 × 16 prismatic cells with their series busbars and the BMS board. Generic design, no real brand.
 * Origin: centre of the footprint on the floor, front toward +Z. Units: metres (0.6 × 1.08 × 0.26).
 *
 * Anchors: `plus`, `minus` (DC terminals, coral / blue), `can` (BMS link to the inverter), `display`,
 * `module1`, `module2`, `bms`.
 */
import { Mesh } from 'three';
import { K, col, type KGlowMaterial } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';

export interface BatteryHandles {
  /** Show the state of charge 0…1 on the five-segment LED bars of both modules. */
  setSoc(soc: number): void;
  socLeds: KGlowMaterial[];
}

export function addBatteryCabinet(b: Builder): BatteryHandles {
  const W = 0.6;
  const H = 1.08;
  const D = 0.26;
  const body = col('white');
  const dark = col('slate').lerp(col('ink'), 0.35);
  // open cabinet: base, back, sides, top; internals; then the cover as a part
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) b.box(0.07, 0.05, D * 0.8, { r: 0.015, slot: 'gloss', c: dark, at: [x, 0, 0] });
  b.box(W, 0.03, D, { r: 0.01, slot: 'gloss', c: dark, at: [0, 0.05, 0] });
  b.box(W, H - 0.05, 0.02, { r: 0, slot: 'gloss', c: body.clone().multiplyScalar(0.9), at: [0, 0.05, -D / 2 + 0.01] });
  for (const x of [-W / 2 + 0.01, W / 2 - 0.01]) b.box(0.02, H - 0.05, D, { r: 0, slot: 'gloss', c: body, at: [x, 0.05, 0] });
  b.box(W, 0.03, D, { r: 0.01, slot: 'gloss', c: body, at: [0, H - 0.03, 0] });
  const cellC = col('blue').lerp(col('sky'), 0.25);
  for (let m = 0; m < 2; m++) {
    const y0 = 0.1 + m * 0.4;
    b.box(W - 0.06, 0.02, D - 0.04, { r: 0, slot: 'metal', c: 'steel', at: [0, y0 - 0.02, 0] });
    // 16 prismatic cells: two rows of eight, terminals on top, series busbars zig-zagging along the rows
    for (let i = 0; i < 16; i++) {
      const row = i < 8 ? 0 : 1;
      const k = row === 0 ? i : 15 - i;
      const x = -W / 2 + 0.065 + k * 0.067;
      const z = row === 0 ? -0.055 : 0.055;
      b.box(0.058, 0.3, 0.1, { r: 0.008, slot: 'gloss', c: [cellC.clone().multiplyScalar(0.8), cellC], at: [x, y0, z] });
      const flip = (i % 2 === 0) === (row === 0) ? 1 : -1;
      b.cyl(0.012, 0.014, { seg: 6, slot: 'metal', c: 'coral', at: [x, y0 + 0.3, z + flip * 0.03], bevel: 0 });
      b.cyl(0.012, 0.014, { seg: 6, slot: 'metal', c: 'blue', at: [x, y0 + 0.3, z - flip * 0.03], bevel: 0 });
      if (i < 15) {
        const nextRow = i + 1 < 8 ? 0 : 1;
        const nk = nextRow === 0 ? i + 1 : 14 - i;
        const nx = -W / 2 + 0.065 + nk * 0.067;
        const nz = nextRow === 0 ? -0.055 : 0.055;
        b.beam([x, y0 + 0.32, z - flip * 0.03], [nx, y0 + 0.32, nz - flip * 0.03], 0.016, { h: 0.006, slot: 'metal', c: 'orange' });
      }
    }
    b.anchor(`module${m + 1}`, 0, y0 + 0.15, D / 2);
  }
  // BMS unit: board with a few components
  b.box(W - 0.1, 0.012, D - 0.08, { r: 0, slot: 'gloss', c: 'teal.dark', at: [0, 0.93, 0] });
  for (const [x, c] of [[-0.18, 'ink'], [-0.05, 'ink'], [0.1, 'yellow'], [0.19, 'slate']] as const) b.box(0.05, 0.03, 0.05, { r: 0.006, slot: 'gloss', c, at: [x, 0.942, 0] });
  b.anchor('bms', 0, 0.95, D / 2);
  // front cover (part): module fronts with handles and SOC bars, BMS panel with display and breaker
  const cover = b.part('cover', { at: [0, 0.05, D / 2] });
  cover.box(W, H - 0.05, 0.03, { r: 0.012, slot: 'gloss', c: [body.clone().multiplyScalar(0.9), body], at: [0, 0, -0.005] });
  const socLeds: KGlowMaterial[] = [];
  for (let i = 0; i < 5; i++) socLeds.push(K.glow({ color: 'lime', whiten: 0, keepHue: true, intensity: 1.6, falloff: 0 }));
  for (let m = 0; m < 2; m++) {
    const y = 0.07 + m * 0.4;
    cover.box(W - 0.08, 0.34, 0.012, { r: 0.02, slot: 'gloss', c: col('mist').lerp(col('white'), 0.5), at: [0, y, 0.012] });
    for (const x of [-0.2, 0.2]) cover.box(0.1, 0.022, 0.03, { r: 0.01, slot: 'gloss', c: dark, at: [x, y + 0.28, 0.02] });
    for (let i = 0; i < 5; i++) {
      const led = new Mesh(G.box(0.03, 0.012, 0.004), socLeds[i]!);
      led.position.set(-0.08 + i * 0.04, y + 0.17, 0.02);
      cover.attach(led);
    }
  }
  cover.box(W - 0.08, 0.16, 0.012, { r: 0.02, slot: 'gloss', c: dark, at: [0, 0.84, 0.012] });
  cover.box(0.16, 0.07, 0.006, { r: 0.008, slot: 'gloss', c: 'ink', at: [-0.12, 0.885, 0.02] });
  cover.box(0.04, 0.07, 0.03, { r: 0.006, slot: 'gloss', c: 'white', at: [0.1, 0.885, 0.02] });
  cover.box(0.02, 0.03, 0.02, { r: 0, slot: 'gloss', c: 'blue', at: [0.1, 0.92, 0.035] });
  cover.sphere(0.01, { seg: 6, slot: 'glow', c: 'green', at: [0.2, 0.92, 0.02] });
  b.anchor('display', -0.12, 0.97, D / 2 + 0.03);
  // DC terminals and the CAN port on the right side
  for (const [name, y, c] of [['plus', 0.96, 'coral'], ['minus', 0.9, 'blue']] as const) {
    b.cyl(0.02, 0.04, { axis: 'x', seg: 8, slot: 'gloss', c, at: [W / 2, y, 0] });
    b.anchor(name, W / 2 + 0.05, y, 0);
  }
  b.box(0.02, 0.03, 0.04, { r: 0, slot: 'gloss', c: 'ink', at: [W / 2, 0.82, 0.04] });
  b.anchor('can', W / 2 + 0.02, 0.835, 0.04);
  return {
    socLeds,
    setSoc(soc) {
      socLeds.forEach((m, i) => (m.intensity = soc > i / 5 + 0.02 ? 1.6 : 0.15));
    },
  };
}

export function batteryCabinet(): KitModel & BatteryHandles {
  const b = new Builder('battery-cabinet');
  const handles = addBatteryCabinet(b);
  return Object.assign(b.build(), handles);
}
