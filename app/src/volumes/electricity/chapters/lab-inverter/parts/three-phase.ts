/**
 * Parts of step 11: the three-phase bridge (three legs = six switches on one heat sink, DC-link capacitors,
 * three outputs in the phase colours L1 / L2 / L3) and the cabinet of a variable-frequency drive.
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { createWire, type Wire } from '@/fx';
import { Builder, G } from '@/kit';
import { K, SEMANTIC, type KGlowMaterial } from '@/style';
import { COPPER } from '../world';
import { addCan, addHeatSink, addTransistor } from './components';

export interface ThreePhaseBridge {
  group: Group;
  /** Outlines of the six switches: [L1 top, L1 bottom, L2 top, L2 bottom, L3 top, L3 bottom]. */
  switches: KGlowMaterial[];
  /** Output conductors L1…L3 (pulses in the phase colours). */
  outputs: Wire[];
  points: { top: Vector3; out: Vector3 };
}

const PHASES = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;
const LEG_X = [-0.75, 0, 0.75] as const;

export function createThreePhaseBridge(): ThreePhaseBridge {
  const b = new Builder('three-phase-bridge');
  b.box(3.0, 0.14, 2.0, { r: 0.05, c: ['bg.indigo', 'slate'] });
  b.box(2.8, 0.03, 1.8, { r: 0.01, slot: 'gloss', c: 'teal.dark', at: [0, 0.14, 0] });
  addHeatSink(b, [0, 0.17, -0.45], 2.5, 1.5, 0.45, 15);
  // DC link in front, + and − rails feeding the three legs
  for (const x of [-0.95, -0.45]) addCan(b, [x, 0.17, 0.55], 0.2, 0.6);
  b.box(2.4, 0.04, 0.08, { r: 0.01, slot: 'metal', c: COPPER, at: [0, 1.52, -0.36] });
  b.box(2.4, 0.04, 0.08, { r: 0.01, slot: 'metal', c: COPPER, at: [0, 0.2, -0.36] });
  b.box(0.16, 0.08, 0.1, { r: 0.02, c: SEMANTIC.dcPlus, at: [-1.15, 1.5, -0.36] });
  b.box(0.16, 0.08, 0.1, { r: 0.02, c: SEMANTIC.dcMinus, at: [-1.15, 0.18, -0.36] });
  LEG_X.forEach((x, k) => {
    addTransistor(b, [x, 0.95, -0.36], 0.56); // upper switch of the leg
    addTransistor(b, [x, 0.3, -0.36], 0.56); // lower switch
    // the leg's midpoint terminal in its phase colour
    b.cyl(0.07, 0.1, { axis: 'z', seg: 14, slot: 'gloss', c: PHASES[k]!, at: [x + 0.3, 0.9, -0.3] });
  });
  const model = b.build();
  const group = new Group();
  group.name = 'three-phase-bridge';
  group.add(model.group);

  const bars: BoxGeometry[] = [];
  const t = 0.028;
  for (const [w, h, x, y] of [
    [0.36, t, 0, 0.19],
    [0.36, t, 0, -0.19],
    [t, 0.38, -0.18, 0],
    [t, 0.38, 0.18, 0],
  ] as const)
    bars.push(new BoxGeometry(w, h, t).translate(x, y, 0) as BoxGeometry);
  const frame = G.mergeGeometries(bars);
  const switches: KGlowMaterial[] = [];
  LEG_X.forEach((x) => {
    for (const y of [1.3, 0.65]) {
      const m = K.glow({ color: SEMANTIC.electron, intensity: 0.05, whiten: 0, keepHue: true, falloff: 0 });
      const f = new Mesh(frame, m);
      f.position.set(x, y, -0.24);
      group.add(f);
      switches.push(m);
    }
  });
  const outputs = LEG_X.map((x, k) =>
    createWire(
      [
        new Vector3(x + 0.3, 0.9, -0.2),
        new Vector3(x + 0.45, 0.6, 0.5),
        new Vector3(1.2 + k * 0.12, 0.3, 0.75 - k * 0.2),
        new Vector3(2.4, 0.3, 0.75 - k * 0.2),
      ],
      {
        radius: 0.045,
        color: 'ink',
        pulseColor: PHASES[k],
        repeat: 1.6,
        speed: 1.4,
        power: 0.9,
        phase: k / 3,
        detail: 10,
      },
    ),
  );
  group.add(...outputs);
  return {
    group,
    switches,
    outputs,
    points: { top: new Vector3(0, 1.95, -0.4), out: new Vector3(2.0, 0.6, 0.5) },
  };
}

/** Cabinet of a variable-frequency drive: grey box with a display window, a keypad and vents. */
export function createDriveCabinet(): { group: Group; display: KGlowMaterial } {
  const b = new Builder('drive-cabinet');
  b.box(0.9, 1.5, 0.6, { r: 0.06, slot: 'gloss', c: ['slate', 'mist'] });
  b.box(0.5, 0.26, 0.03, { r: 0.02, slot: 'gloss', c: 'ink', at: [0, 1.05, 0.3] });
  for (let i = 0; i < 6; i++)
    b.box(0.08, 0.06, 0.02, {
      r: 0.01,
      c: i === 5 ? 'green' : 'white',
      at: [-0.18 + (i % 3) * 0.18, 0.72 + Math.floor(i / 3) * 0.12, 0.3],
    });
  for (let i = 0; i < 5; i++) b.box(0.6, 0.03, 0.02, { r: 0, c: 'slate', at: [0, 0.14 + i * 0.08, 0.3] });
  const model = b.build();
  const display = K.glow({ color: 'teal', intensity: 1.4, whiten: 0.1, keepHue: true, falloff: 0 });
  const bar = new Mesh(new BoxGeometry(0.4, 0.16, 0.01), display);
  bar.position.set(0, 1.18, 0.32);
  model.group.add(bar);
  return { group: model.group, display };
}

/**
 * Centrifugal pump end for the drive's motor (shaft along X, at the origin): volute casing with a glass
 * front, an impeller part (`impeller`, spins about X) and inlet / outlet flanges. Water leaves upward.
 */
export function createVolute(): { group: Group; impeller: Group; outlet: Vector3; inlet: Vector3 } {
  const b = new Builder('volute');
  b.cyl(0.55, 0.3, { axis: 'x', seg: 40, slot: 'gloss', c: ['blue', 'sky'], at: [0, 0, 0] });
  b.cyl(0.47, 0.06, { axis: 'x', seg: 40, slot: 'glass', at: [0.28, 0, 0] });
  b.cyl(0.16, 0.5, { axis: 'x', seg: 20, slot: 'gloss', c: 'blue', at: [0.3, 0, 0] }); // suction nozzle
  b.cyl(0.21, 0.05, { axis: 'x', seg: 20, slot: 'metal', c: 'steel', at: [0.78, 0, 0] });
  b.cyl(0.15, 0.7, { seg: 20, slot: 'gloss', c: 'blue', at: [0.15, 0.35, -0.38] }); // discharge, tangential
  b.cyl(0.2, 0.05, { seg: 20, slot: 'metal', c: 'steel', at: [0.15, 1.02, -0.38] });
  b.box(0.5, 0.5, 0.9, { r: 0.04, slot: 'metal', c: 'slate', at: [0.15, -0.95, 0] });
  const imp = b.part('impeller', { at: [0.22, 0, 0] });
  imp.cyl(0.12, 0.08, { axis: 'x', seg: 16, slot: 'metal', c: 'mist' });
  for (let i = 0; i < 6; i++)
    imp.box(0.05, 0.3, 0.06, {
      r: 0.015,
      slot: 'metal',
      c: 'amber',
      at: [0.02, 0.1, 0],
      rot: [(i / 6) * Math.PI * 2, 0, 0],
    });
  const model = b.build();
  return {
    group: model.group,
    impeller: model.part('impeller'),
    outlet: new Vector3(0.15, 1.05, -0.38),
    inlet: new Vector3(0.8, 0, 0),
  };
}
