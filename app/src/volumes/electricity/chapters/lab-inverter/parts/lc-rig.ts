/**
 * `lcFilterRig` — the output filter as a bench circuit, in the real order: bridge → choke in series → node →
 * film capacitor across the output → load. The choke is wrapped in the lines of its field **B** (`magenta`,
 * real streamlines of a solenoid), the capacitor shows its field **E** between the plates (`amber` arrows).
 * Both "breathe": B with the choke current's ripple, E with the output voltage. Origin = centre of the plinth.
 */
import { Group, Vector3 } from 'three';
import {
  createFieldLines,
  createVectorArrow,
  createWire,
  seedsOnLine,
  solenoidField,
  type FieldLines,
  type VectorArrow,
  type Wire,
} from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { SEMANTIC, col } from '@/style';
import { COPPER } from '../world';

export interface LcRig {
  group: Group;
  model: KitModel;
  fieldB: FieldLines;
  /** Choppy pulses into the choke, smooth ones out to the load. */
  wireIn: Wire;
  wireOut: Wire;
  /**
   * Drive the fields: `ripple` 0…1 (relative ripple of the choke current), `u` −1…1 (output voltage now),
   * `size` 0.6…1.6 visual scale of the choke (∝ ∛L — a bigger inductance is a bigger coil).
   */
  set(ripple: number, u: number, t: number, lSize: number, cSize: number): void;
  points: Record<'choke' | 'cap' | 'in' | 'out', Vector3>;
}

const Y = 0.75; // height of the conductor line above the plinth

export function createLcRig(): LcRig {
  const b = new Builder('lc-rig');
  b.box(5.4, 0.14, 2.1, { r: 0.06, c: ['bg.indigo', 'slate'] });
  b.box(5.1, 0.02, 1.8, { r: 0.01, slot: 'matte', c: 'ink', at: [0, 0.14, 0] });
  // return conductor along the front, posts under the upper conductor
  b.rod([-2.4, 0.26, 0.6], [2.4, 0.26, 0.6], 0.05, { slot: 'metal', c: COPPER, seg: 10 });
  for (const x of [-2.4, 2.4])
    b.cyl(0.07, Y - 0.14, { seg: 12, slot: 'metal', c: 'slate', at: [x, 0.14, -0.2] });
  b.box(0.2, 0.12, 0.2, { r: 0.03, c: SEMANTIC.dcMinus, at: [-2.4, 0.2, 0.6] });
  const model = b.build();

  // the choke is its own model: its size follows the inductance
  const c = new Builder('lc-choke');
  c.cyl(0.2, 1.7, { axis: 'x', seg: 28, c: 'ink', at: [-0.85, 0, 0] });
  for (let i = 0; i < 12; i++)
    c.ring(0.27, 0.055, {
      axis: 'x',
      seg: 28,
      tubeSeg: 8,
      slot: 'metal',
      c: COPPER,
      at: [-0.66 + i * 0.12, 0, 0],
    });
  for (const x of [-0.92, 0.92]) c.box(0.12, 0.62, 0.5, { r: 0.04, c: 'slate', at: [x, -0.62, 0] });
  const choke = c.build();
  choke.group.position.set(-0.95, Y, -0.2);

  // film capacitor: two plates with the film between them, standing across the output
  const k = new Builder('lc-cap');
  for (const s of [-1, 1])
    k.box(0.07, 0.9, 0.9, { r: 0.02, slot: 'metal', c: 'steel', at: [s * 0.24, -0.45, 0] });
  k.box(0.4, 0.84, 0.84, { r: 0.02, slot: 'glass', at: [0, -0.42, 0] });
  k.box(0.06, 0.02, 0.86, { r: 0, c: col('yellow').lerp(col('amber'), 0.5), at: [0, 0.43, 0] });
  k.rod([-0.24, -0.45, 0], [-0.24, -0.62, 0.55], 0.04, { slot: 'metal', c: COPPER, seg: 8 });
  const cap = k.build();
  cap.group.position.set(1.25, Y, -0.2);
  cap.group.rotation.y = Math.PI / 2;

  const group = new Group();
  group.name = 'lc-rig';
  group.add(model.group, choke.group, cap.group);

  // field of the choke: streamlines of a solenoid through its bore, closing around the outside
  const centre = new Vector3(-0.95, Y, -0.2);
  const field = solenoidField(centre, new Vector3(1, 0, 0), 0.27, 1.4, 1, 7);
  const seeds = [
    ...seedsOnLine(new Vector3(-0.95, Y + 0.05, -0.2), new Vector3(-0.95, Y + 0.2, -0.2), 3),
    ...seedsOnLine(new Vector3(-0.95, Y - 0.05, -0.2), new Vector3(-0.95, Y - 0.2, -0.2), 3),
    ...seedsOnLine(new Vector3(-0.95, Y, -0.1), new Vector3(-0.95, Y, 0.0), 2),
  ];
  const fieldB = createFieldLines({
    field,
    kind: 'B',
    seeds,
    width: 0.03,
    dashRepeat: 2.2,
    dashSpeed: 0.9,
    trace: { step: 0.05, maxLength: 9, bothWays: true, bounds: { center: centre, radius: 1.9 } },
  });
  group.add(fieldB);

  // field of the capacitor: arrows from the + plate to the − plate (they flip with the voltage)
  const arrows: VectorArrow[] = [];
  for (const dy of [-0.26, 0, 0.26])
    for (const dx of [-0.26, 0.26]) {
      const a = createVectorArrow({
        color: SEMANTIC.fieldE,
        radius: 0.022,
        headLength: 0.11,
        headRadius: 0.055,
        intensity: 1.3,
      });
      a.position.set(1.25 + dx, Y - 0.42 + dy, -0.2);
      group.add(a);
      arrows.push(a);
    }

  const wire = (pts: Vector3[], repeat: number, length: number): Wire =>
    createWire(pts, { radius: 0.05, color: 'ink', repeat, length, speed: 1.6, power: 0.9, detail: 10 });
  const wireIn = wire(
    [new Vector3(-3.4, Y, -0.2), new Vector3(-2.4, Y, -0.2), new Vector3(-1.9, Y, -0.2)],
    4.5,
    0.3,
  );
  const wireOut = wire(
    [
      new Vector3(0, Y, -0.2),
      new Vector3(1.25, Y, -0.2),
      new Vector3(2.4, Y, -0.2),
      new Vector3(3.4, Y, -0.2),
    ],
    1.0,
    0.75,
  );
  group.add(wireIn, wireOut);

  const o = new Vector3();
  const d = new Vector3();
  return {
    group,
    model,
    fieldB,
    wireIn,
    wireOut,
    set(ripple, u, t, lSize, cSize) {
      choke.group.scale.setScalar(lSize);
      cap.group.scale.setScalar(cSize);
      // B swells and relaxes with every carrier period (slowed) on top of the 50 Hz current
      fieldB.intensity = 0.45 + 0.5 * Math.abs(u) + 0.6 * ripple * (0.5 + 0.5 * Math.sin(t * 9));
      const len = 0.34 * u * cSize;
      for (const a of arrows) {
        a.visible = Math.abs(len) > 0.02;
        a.set(o.set(0, 0, -len / 2), d.set(0, 0, len));
      }
    },
    points: {
      choke: new Vector3(-0.95, Y + 0.5, -0.2),
      cap: new Vector3(1.25, Y + 0.25, -0.2),
      in: new Vector3(-2.9, Y, -0.2),
      out: new Vector3(2.9, Y, -0.2),
    },
  };
}
