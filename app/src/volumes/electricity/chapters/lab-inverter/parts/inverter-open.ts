/**
 * Hero model: the hybrid inverter «ЛІ-6» opened up and lying on the bench (see `inverter-layout.ts` for the
 * plan). Built with the kit `Builder`: everything static merges into one draw call per material slot; the
 * cover is a part (it lifts off). Things the chapter animates one by one — switch outlines, capacitor glow,
 * LEDs — are separate meshes created in `inverter-live.ts`.
 */
import { Builder, addRivets, type KitModel } from '@/kit';
import { col } from '@/style';
import { COPPER } from '../world';
import { addCan, addHeatSink, addRelay, addToroid, addTransistor } from './components';
import { COVER_Y, RIVER_Y, STAGE, SWITCH_X, SWITCH_Z, TRAY } from './inverter-layout';

const PCB = col('teal').lerp(col('bg.indigo'), 0.6);

function tray(b: Builder): void {
  const { w, d, wall, floor } = TRAY;
  b.box(w, floor, d, { r: 0.03, slot: 'metal', c: 'slate', at: [0, -floor, 0] });
  // rim walls (the back one is lower in the middle: the bridge heat sink looks out there)
  b.box(w, wall, 0.07, { r: 0.02, slot: 'metal', c: ['slate', 'steel'], at: [0, 0, d / 2 - 0.035] });
  b.box(0.07, wall, d, { r: 0.02, slot: 'metal', c: ['slate', 'steel'], at: [-w / 2 + 0.035, 0, 0] });
  b.box(0.07, wall, d, { r: 0.02, slot: 'metal', c: ['slate', 'steel'], at: [w / 2 - 0.035, 0, 0] });
  b.box(w * 0.44, wall, 0.07, {
    r: 0.02,
    slot: 'metal',
    c: ['slate', 'steel'],
    at: [-w * 0.28, 0, -d / 2 + 0.035],
  });
  b.box(w * 0.2, wall, 0.07, {
    r: 0.02,
    slot: 'metal',
    c: ['slate', 'steel'],
    at: [w * 0.4, 0, -d / 2 + 0.035],
  });
  // main power board under the stages
  b.box(w - 0.5, 0.035, d - 0.5, { r: 0.01, slot: 'gloss', c: PCB, at: [0, 0, 0] });
  addRivets(b, [-w / 2 + 0.3, 0.04, d / 2 - 0.3], [w / 2 - 0.3, 0.04, d / 2 - 0.3], 6, {
    r: 0.045,
    normal: [0, 1, 0],
  });
  addRivets(b, [-w / 2 + 0.3, 0.04, -d / 2 + 0.3], [-0.6, 0.04, -d / 2 + 0.3], 3, {
    r: 0.045,
    normal: [0, 1, 0],
  });
  // busbars of the "river": DC+ / DC− strips from the boost stage to the bridge, AC strip to the terminals
  const y = RIVER_Y - 0.09;
  b.box(1.5, 0.03, 0.1, { r: 0.01, slot: 'metal', c: COPPER, at: [-0.35, y, -1.32] });
  b.box(1.5, 0.03, 0.1, { r: 0.01, slot: 'metal', c: COPPER, at: [-0.35, y, 0.08] });
  b.box(0.12, 0.034, 0.12, { r: 0.01, c: 'coral', at: [-1.1, y, -1.32] });
  b.box(0.12, 0.034, 0.12, { r: 0.01, c: 'blue', at: [-1.1, y, 0.08] });
}

/** PV and battery terminals on the left wall, AC terminals on the right. */
function terminals(b: Builder): void {
  for (const name of ['pvA', 'pvB'] as const) {
    const { at } = STAGE[name];
    for (const [k, c] of [
      [-1, 'coral'],
      [1, 'blue'],
    ] as const) {
      b.cyl(0.075, 0.5, {
        axis: 'x',
        seg: 16,
        slot: 'gloss',
        c: 'ink',
        at: [at.x - 0.42, 0.17, at.z + k * 0.13],
      });
      b.cyl(0.085, 0.06, { axis: 'x', seg: 16, slot: 'gloss', c, at: [at.x - 0.2, 0.17, at.z + k * 0.13] });
    }
    b.anchor(name, at.x - 0.4, 0.3, at.z);
  }
  // battery studs: big, bolted (135 A continuous)
  const bat = STAGE.bat.at;
  for (const [k, c] of [
    [-1, 'coral'],
    [1, 'blue'],
  ] as const) {
    b.box(0.3, 0.1, 0.24, { r: 0.03, slot: 'gloss', c, at: [bat.x, 0.03, bat.z + k * 0.2] });
    b.cyl(0.07, 0.2, { seg: 12, slot: 'metal', c: 'mist', at: [bat.x, 0.13, bat.z + k * 0.2] });
    b.cyl(0.11, 0.06, { seg: 6, bevel: 0.01, slot: 'metal', c: 'steel', at: [bat.x, 0.17, bat.z + k * 0.2] });
  }
  b.anchor('bat', bat.x, 0.4, bat.z);
  // AC terminal block: grid (L, N) and backup (L, N) + PE
  const ac = STAGE.ac.at;
  b.box(0.36, 0.2, 1.0, { r: 0.03, slot: 'gloss', c: 'green', at: [ac.x, 0.03, ac.z] });
  for (let i = 0; i < 5; i++)
    b.cyl(0.05, 0.03, { seg: 10, slot: 'metal', c: 'mist', at: [ac.x, 0.23, ac.z - 0.38 + i * 0.19] });
  b.anchor('ac', ac.x, 0.4, ac.z);
}

/** Two MPPT inputs: a choke each, then switch + diode pairs on a small heat sink. */
function boostStage(b: Builder): void {
  for (const name of ['chokeA', 'chokeB'] as const) {
    const { at } = STAGE[name];
    addToroid(b, [at.x, 0.04, at.z], 0.2, 0.085, 12);
    b.anchor(name, at.x, STAGE[name].top, at.z);
  }
  const { at } = STAGE.boost;
  addHeatSink(b, [at.x - 0.2, 0.04, at.z], 0.5, 0.62, 0.22, 5);
  for (const [k, c] of [
    [-1, 'ink'],
    [1, 'slate'],
  ] as const)
    addTransistor(b, [at.x - 0.2 + k * 0.12, 0.04, at.z + 0.07], 0.5, c);
  b.anchor('boost', at.x, STAGE.boost.top, at.z);
}

/** DC link: six electrolytic cans (two rows of three) between the busbars. */
function dcLink(b: Builder): void {
  const { at } = STAGE.link;
  for (const dx of [-0.24, 0.24])
    for (const dz of [-0.46, 0, 0.46]) addCan(b, [at.x + dx, 0.04, at.z + dz], 0.2, 0.66);
  b.anchor('link', at.x, STAGE.link.top, at.z);
  // bleeder resistor across the link (the hotspot's «розрядний резистор»)
  b.capsule(0.05, 0.36, { axis: 'z', slot: 'gloss', c: 'sky', at: [at.x - 0.55, 0.12, at.z] });
  for (const k of [-1, 0, 1])
    b.ring(0.052, 0.012, {
      axis: 'z',
      seg: 12,
      c: k ? 'coral' : 'ink',
      at: [at.x - 0.55, 0.12, at.z + k * 0.07],
    });
}

/** H-bridge: four transistors S1…S4 on the big finned heat sink, gate-driver strip in front of them. */
function bridge(b: Builder): void {
  const { at } = STAGE.bridge;
  addHeatSink(b, [at.x, 0.04, SWITCH_Z - 0.06], 1.75, 0.98, 0.62, 13);
  SWITCH_X.forEach((x, i) => {
    addTransistor(b, [x, 0.04, SWITCH_Z + 0.02], 0.7);
    b.anchor(`s${i + 1}`, x, 0.5, SWITCH_Z + 0.1);
    // clamp bar screw
    b.cyl(0.04, 0.03, { axis: 'z', seg: 8, slot: 'metal', c: 'mist', at: [x, 0.83, SWITCH_Z - 0.04] });
  });
  b.anchor('bridge', at.x, STAGE.bridge.top, SWITCH_Z);
  b.anchor('heatsink', at.x + 0.5, 1.02, SWITCH_Z - 0.4);
  // gate drivers: one small board, an opto-driver chip and a gate resistor per switch
  const dz = STAGE.drivers.at.z;
  b.box(1.75, 0.03, 0.3, { r: 0.01, slot: 'gloss', c: 'blue.dark', at: [at.x, 0.06, dz] });
  SWITCH_X.forEach((x) => {
    b.box(0.2, 0.07, 0.14, { r: 0.012, slot: 'gloss', c: 'ink', at: [x, 0.09, dz] });
    b.capsule(0.022, 0.12, { axis: 'z', slot: 'gloss', c: 'sky', at: [x + 0.15, 0.1, dz] });
    b.box(0.03, 0.02, 0.03, { r: 0, slot: 'glow', c: 'cyan', at: [x - 0.13, 0.09, dz + 0.1] });
  });
  b.anchor('drivers', at.x, STAGE.drivers.top, dz);
}

/** LC filter (copper choke + film capacitor), the two relays, and the fan that cools the fins. */
function filterAndRelays(b: Builder): void {
  const l = STAGE.filterL.at;
  addToroid(b, [l.x, 0.04, l.z], 0.3, 0.14, 16);
  b.anchor('filterL', l.x, STAGE.filterL.top, l.z);
  const c = STAGE.filterC.at;
  b.box(0.56, 0.5, 0.26, { r: 0.05, slot: 'gloss', c: ['amber', 'yellow'], at: [c.x, 0.04, c.z] });
  b.box(0.3, 0.012, 0.12, { r: 0, c: 'white', at: [c.x, 0.541, c.z] });
  b.anchor('filterC', c.x, STAGE.filterC.top, c.z);
  addRelay(b, [STAGE.relayGrid.at.x, 0.04, STAGE.relayGrid.at.z], 1.05, 'blue');
  addRelay(b, [STAGE.relayBackup.at.x, 0.04, STAGE.relayBackup.at.z], 1.05, 'teal');
  b.anchor('relays', STAGE.relayGrid.at.x, 0.62, (STAGE.relayGrid.at.z + STAGE.relayBackup.at.z) / 2);
  // current sensor ring on the AC line (the controller measures its own output current)
  b.ring(0.12, 0.045, { axis: 'z', seg: 20, c: 'blue', at: [2.3, RIVER_Y, -0.85] });
}

/** Battery side: low-voltage bridge → high-frequency transformer on a ferrite E-core → rectifier. */
function batteryConverter(b: Builder): void {
  const d = STAGE.dcdc.at;
  b.box(0.7, 0.03, 0.62, { r: 0.01, slot: 'metal', c: COPPER, at: [d.x, 0.04, d.z] });
  for (const dx of [-0.17, 0.17])
    for (const dz of [-0.15, 0.15]) {
      b.box(0.24, 0.07, 0.22, { r: 0.015, slot: 'gloss', c: 'ink', at: [d.x + dx, 0.07, d.z + dz] });
      b.box(0.2, 0.02, 0.06, { r: 0, slot: 'metal', c: 'mist', at: [d.x + dx, 0.07, d.z + dz + 0.13] });
    }
  b.anchor('dcdc', d.x, STAGE.dcdc.top, d.z);
  // E-core: two ferrite halves around a bobbin; primary — few thick turns, secondary — many thin ones
  const t = STAGE.transformer.at;
  b.box(0.86, 0.14, 0.52, { r: 0.03, c: 'ink', at: [t.x, 0.04, t.z] });
  b.box(0.86, 0.14, 0.52, { r: 0.03, c: 'ink', at: [t.x, 0.6, t.z] });
  for (const k of [-1, 1]) b.box(0.14, 0.44, 0.52, { r: 0.03, c: 'ink', at: [t.x + k * 0.36, 0.17, t.z] });
  b.cyl(0.13, 0.44, { seg: 20, c: 'white', at: [t.x, 0.17, t.z] });
  for (let i = 0; i < 3; i++)
    b.ring(0.2, 0.05, {
      seg: 28,
      tubeSeg: 8,
      slot: 'metal',
      c: col('coral').lerp(COPPER, 0.55),
      at: [t.x, 0.24 + i * 0.105, t.z],
    });
  for (let i = 0; i < 9; i++)
    b.ring(0.29, 0.02, {
      seg: 28,
      tubeSeg: 6,
      slot: 'metal',
      c: col('sky').lerp(COPPER, 0.45),
      at: [t.x, 0.2 + i * 0.045, t.z],
    });
  b.box(0.3, 0.02, 0.56, { r: 0, c: 'yellow', at: [t.x, 0.745, t.z] }); // tape over the gap
  b.anchor('transformer', t.x, STAGE.transformer.top, t.z);
  const r = STAGE.rectifier.at;
  addHeatSink(b, [r.x, 0.04, r.z - 0.1], 0.5, 0.5, 0.2, 5);
  for (const k of [-1, 1]) addTransistor(b, [r.x + k * 0.12, 0.04, r.z - 0.03], 0.42, 'slate');
  b.anchor('rectifier', r.x, STAGE.rectifier.top, r.z);
}

/** Control board on standoffs: signal-processor chip, small parts, glowing tracks, header toward the drivers. */
function controlBoard(b: Builder): void {
  const { at } = STAGE.control;
  const w = 2.5;
  const d = 1.2;
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    b.cyl(0.05, at.y - 0.04, {
      seg: 8,
      slot: 'metal',
      c: 'mist',
      at: [at.x + sx * (w / 2 - 0.1), 0.04, at.z + sz * (d / 2 - 0.1)],
    });
  b.box(w, 0.04, d, { r: 0.012, slot: 'gloss', c: PCB, at: [at.x, at.y, at.z] });
  const y = at.y + 0.04;
  // the signal processor with its pins
  b.box(0.42, 0.06, 0.42, { r: 0.015, slot: 'gloss', c: 'teal', at: [at.x - 0.2, y, at.z] });
  b.box(0.5, 0.02, 0.5, { r: 0, slot: 'metal', c: 'mist', at: [at.x - 0.2, y, at.z] });
  b.cyl(0.03, 0.012, { seg: 10, c: 'teal.light', at: [at.x - 0.34, y + 0.06, at.z - 0.14] });
  // neighbours: memory, isolators, a crystal, a row of small capacitors, the display connector
  b.box(0.3, 0.05, 0.16, { r: 0.01, slot: 'gloss', c: 'ink', at: [at.x + 0.45, y, at.z + 0.3] });
  b.box(0.22, 0.05, 0.22, { r: 0.01, slot: 'gloss', c: 'ink', at: [at.x + 0.5, y, at.z - 0.15] });
  b.capsule(0.05, 0.2, { axis: 'x', slot: 'metal', c: 'mist', at: [at.x - 0.75, y + 0.05, at.z + 0.3] });
  for (let i = 0; i < 5; i++)
    b.cyl(0.05, 0.14, {
      seg: 12,
      slot: 'gloss',
      c: i % 2 ? 'violet' : 'slate',
      at: [at.x - 1.05 + i * 0.13, y, at.z - 0.4],
    });
  b.box(0.5, 0.1, 0.12, { r: 0.02, c: 'white', at: [at.x + 0.9, y, at.z + 0.42] });
  b.box(0.7, 0.1, 0.1, { r: 0.02, c: 'ink', at: [at.x - 0.2, y, at.z - 0.52] }); // header toward the gate drivers
  // tracks: thin always-on cyan lines fanning out of the processor
  for (let i = 0; i < 6; i++) {
    const z = at.z - 0.2 + i * 0.08;
    b.box(0.5 + (i % 3) * 0.12, 0.006, 0.014, {
      r: 0,
      slot: 'glow',
      c: 'cyan',
      at: [at.x + 0.36 + (i % 3) * 0.06, y + 0.002, z],
    });
  }
  for (let i = 0; i < 4; i++)
    b.box(0.014, 0.006, 0.28, {
      r: 0,
      slot: 'glow',
      c: 'cyan',
      at: [at.x - 0.36 + i * 0.1, y + 0.002, at.z - 0.38],
    });
  b.anchor('control', at.x, at.y + STAGE.control.top, at.z);
  b.anchor('dsp', at.x - 0.2, y + 0.1, at.z);
}

/** The cover (front shell of the wall unit): white, dark band, display window, isolator knob. A part: it lifts. */
function cover(b: Builder): void {
  const c = b.part('cover', { at: [0, COVER_Y.closed, 0] });
  const { w, d } = TRAY;
  const white = col('white');
  c.box(w + 0.1, 0.4, d + 0.1, {
    r: 0.16,
    seg: 3,
    slot: 'gloss',
    c: [white.clone().multiplyScalar(0.86), white],
  });
  c.box(w + 0.11, 0.3, d * 0.22, {
    r: 0.1,
    slot: 'gloss',
    c: col('slate').lerp(col('ink'), 0.3),
    at: [0, 0.05, d * 0.4],
  });
  c.box(w * 0.9, 0.02, 0.06, { r: 0, slot: 'gloss', c: 'teal', at: [0, 0.395, d * 0.27] });
  c.box(w * 0.36, 0.02, d * 0.2, { r: 0.01, slot: 'gloss', c: 'ink', at: [-w * 0.2, 0.395, -d * 0.2] });
  c.cyl(0.28, 0.1, { seg: 24, slot: 'gloss', c: 'yellow', at: [-w * 0.34, 0.36, d * 0.4] });
  c.box(0.14, 0.14, 0.44, { r: 0.04, slot: 'gloss', c: 'red', at: [-w * 0.34, 0.44, d * 0.4] });
  c.anchor('display', -w * 0.2, 0.45, -d * 0.2);
  c.anchor('nameplate', w * 0.3, 0.45, -d * 0.3);
  c.anchor('led', w * 0.16, 0.42, -d * 0.2);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    c.anchor(`corner${sx > 0 ? 'R' : 'L'}${sz > 0 ? 'F' : 'B'}`, sx * (w / 2 - 0.2), 0, sz * (d / 2 - 0.2));
}

/** The opened «ЛІ-6». Parts: `cover`. Anchors: one per stage (`link`, `bridge`, `s1`…`s4`, `relays`, …). */
export function createInverterOpen(): KitModel {
  const b = new Builder('li6-open');
  tray(b);
  terminals(b);
  boostStage(b);
  dcLink(b);
  bridge(b);
  filterAndRelays(b);
  batteryConverter(b);
  controlBoard(b);
  cover(b);
  return b.build();
}
