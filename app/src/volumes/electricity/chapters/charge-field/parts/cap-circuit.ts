/**
 * The circuit around the capacitor of step 7: the battery "pump" that moves electrons from the upper plate to
 * the lower one, the lamp for «Розрядити через лампочку», four wires that follow the plates when their size or
 * gap changes, and the `cyan` electrons running in them (fx flow; they move only while the charge changes).
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, createHalo, createWire, curveThrough, wireGeometry, type Flow, type Wire } from '@/fx';
import { Builder } from '@/kit';
import { K } from '@/style';
import { CAPACITOR } from '../layout';

export interface CapCircuit {
  group: Group;
  flow: Flow;
  /** 0…1 lamp glow. */
  lamp: number;
  /** 0…1 activity of the charging wires / the discharge wires (density of the electron streams). */
  charging: number;
  discharging: number;
  /** The supercapacitor can of the hotspot (it stands next to the battery and moves with it). */
  supercap: Group;
  /**
   * Place the props next to plates of half side `h` and re-route the wires to them (y of lower / upper plate).
   * The props are secondary: smaller than the plates and as close to them as the plate size allows.
   */
  route(h: number, yBottom: number, yTop: number): void;
  update(t: number): void;
}

/** Battery with a `coral` «+» cap and a `blue` «−» end (DC pole colours), lying on a cradle. */
function battery(): Group {
  const b = new Builder('pump');
  b.box(2.3, 0.2, 1.3, { r: 0.08, c: ['bg.plum', 'slate'] });
  b.cyl(0.5, 1.9, { seg: 28, bevel: 0.06, slot: 'gloss', c: 'slate', axis: 'x', at: [-0.95, 0.72, 0] });
  b.cyl(0.51, 0.5, { seg: 28, slot: 'gloss', c: 'coral', axis: 'x', at: [0.45, 0.72, 0] });
  b.cyl(0.51, 0.35, { seg: 28, slot: 'gloss', c: 'blue', axis: 'x', at: [-0.95, 0.72, 0] });
  b.cyl(0.18, 0.16, { seg: 16, slot: 'metal', c: 'steel.light', axis: 'x', at: [0.95, 0.72, 0] });
  b.cyl(0.2, 0.06, { seg: 14, slot: 'glow', c: 'amber', at: [0, 1.22, 0] });
  return b.build().group;
}

/** The props are drawn smaller than life next to the plates: the plates are the hero of the step. */
const PROP = 0.72;

export function createCapCircuit(ctx: ChapterContext): CapCircuit {
  const group = new Group();
  const pump = battery();
  pump.rotation.y = 0.25;
  pump.scale.setScalar(PROP);
  // the supercapacitor of the second hotspot: a labelled can
  const sb = new Builder('supercap');
  sb.cyl(0.42, 1.25, { seg: 28, bevel: 0.06, slot: 'gloss', c: ['blue.dark', 'blue'] });
  sb.cyl(0.43, 0.3, { seg: 28, slot: 'gloss', c: 'mist', at: [0, 0.5, 0] });
  for (const x of [-0.16, 0.16])
    sb.cyl(0.07, 0.16, { seg: 10, slot: 'metal', c: 'steel.light', at: [x, 1.25, 0] });
  const supercap = sb.build().group;
  supercap.scale.setScalar(PROP);
  const lb = new Builder('lamp');
  lb.cyl(0.55, 0.18, { seg: 24, bevel: 0.05, c: ['bg.plum', 'slate'] });
  lb.cyl(0.26, 0.42, { seg: 18, slot: 'metal', c: 'steel.light', at: [0, 0.18, 0] });
  const lampBase = lb.build().group;
  const bulbGlow = K.glow({ color: 'yellow', intensity: 0.2, whiten: 0.6 });
  const bulb = new Mesh(new SphereGeometry(0.46, 28, 20), bulbGlow);
  bulb.position.y = 1.0;
  const shell = new Mesh(
    new SphereGeometry(0.5, 28, 20),
    K.glass({ color: 'white', opacity: 0.2, edgeOpacity: 0.7 }),
  );
  shell.position.copy(bulb.position);
  const halo = createHalo({ color: 'yellow', size: 4.5, intensity: 0, amount: 0.1 });
  halo.position.copy(bulb.position);
  const lamp = new Group();
  lamp.add(lampBase, bulb, shell, halo);
  lamp.scale.setScalar(PROP);
  group.add(pump, supercap, lamp);

  const minus = new Vector3();
  const plusT = new Vector3();
  const lampA = new Vector3();
  const lampB = new Vector3();
  const place = (h: number): void => {
    const side = Math.max(h, CAPACITOR.propsFrom);
    pump.position.set(-side - CAPACITOR.pump.x, 0, CAPACITOR.pump.z);
    supercap.position.set(-side - CAPACITOR.supercap.x, 0, CAPACITOR.supercap.z);
    lamp.position.set(side + CAPACITOR.lamp.x, 0, CAPACITOR.lamp.z);
    pump.updateMatrix();
    lamp.updateMatrix();
    minus.set(-0.95, 0.72, -0.2).applyMatrix4(pump.matrix);
    plusT.set(1.15, 0.72, 0.3).applyMatrix4(pump.matrix);
    lampA.set(-0.2, 0.3, -0.2).applyMatrix4(lamp.matrix);
    lampB.set(0.2, 0.3, -0.2).applyMatrix4(lamp.matrix);
  };
  place(1.8);
  // wire k: 0 pump «−» → lower plate, 1 upper plate → pump «+», 2 lower plate → lamp, 3 lamp → upper plate
  const paths = (h: number, yb: number, yt: number): Vector3[][] => [
    [
      minus.clone(),
      new Vector3(minus.x - 0.35, 0.18, minus.z - 0.75),
      new Vector3(-h - 0.75, 0.22, -1.5),
      new Vector3(-h - 0.4, yb - 0.12, -0.5),
      new Vector3(-h, yb - 0.06, -0.3),
    ],
    [
      new Vector3(-h, yt + 0.06, 0.5),
      new Vector3(-h - 0.45, yt + 0.45, 0.7),
      new Vector3(plusT.x + 0.5, Math.max(1.5, yt * 0.6), plusT.z + 0.5),
      plusT.clone(),
    ],
    [
      new Vector3(h, yb - 0.06, 0),
      new Vector3(h + 0.5, yb - 0.1, -0.2),
      new Vector3(lampA.x - 0.4, 0.22, lampA.z - 0.4),
      lampA.clone(),
    ],
    [
      lampB.clone(),
      new Vector3(lampB.x + 0.5, 1.2, lampB.z + 0.3),
      new Vector3(h + 0.6, yt + 0.5, 0.9),
      new Vector3(h, yt + 0.06, 0.5),
    ],
  ];
  const opts = { radius: 0.045, color: 'ink' as const, power: 0, detail: 5 };
  const first = paths(1.8, CAPACITOR.y, CAPACITOR.y + 1);
  const wires: Wire[] = first.map((p) => createWire(curveThrough(p), opts));
  const flow = createFlow(ctx, {
    kind: 'electron',
    paths: first.map((path) => ({ path })),
    count: 56,
    radius: 0.07,
    speed: 2.4,
    spread: 0.02,
  });
  group.add(...wires, flow);
  const circuit: CapCircuit = {
    group,
    flow,
    lamp: 0,
    charging: 0,
    discharging: 0,
    supercap,
    route(h, yb, yt) {
      place(h);
      const next = paths(h, yb, yt);
      next.forEach((p, i) => {
        wires[i]!.geometry.dispose();
        wires[i]!.geometry = wireGeometry(curveThrough(p), opts);
      });
      flow.setPaths(next.map((path) => ({ path })));
    },
    update(t) {
      flow.setPathDensity(0, circuit.charging);
      flow.setPathDensity(1, circuit.charging);
      flow.setPathDensity(2, circuit.discharging);
      flow.setPathDensity(3, circuit.discharging);
      bulbGlow.intensity = 0.15 + 3.2 * circuit.lamp;
      halo.intensity = 1.6 * circuit.lamp;
      pump.position.y = 0.02 * Math.sin(t * 9) * circuit.charging; // the pump hums while it works
    },
  };
  return circuit;
}
