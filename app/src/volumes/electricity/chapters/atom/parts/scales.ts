/**
 * Toy beam balance (step `electron`): chunky base and column, a beam on a pivot with a pointer over a dial,
 * two hanging pans that stay level, and an indicator lamp that lights up at equilibrium. Origin = centre of
 * the base on the ground; the beam's pivot is at height `PIVOT_Y`. `tilt` > 0 lowers the left pan.
 */
import { CylinderGeometry, Group, LatheGeometry, Mesh, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { K, type KGlowMaterial } from '@/style';

export const PIVOT_Y = 4.3;
const ARM = 2.5;
const DROP = 2.3;
export const PAN_RADIUS = 1.05;

export interface Scales {
  group: Group;
  /** Pan groups: origin on the pan's floor, +Y up. Put loads here. */
  left: Group;
  right: Group;
  lamp: KGlowMaterial;
  /** Beam angle, rad (positive: left pan down). */
  tilt: number;
}

export function createScales(): Scales {
  const group = new Group();
  group.name = 'scales';
  const body = K.toon({ gradient: { bottom: 'bg.indigo', top: 'slate', range: [0, 1.2] }, rim: 0.9 });
  const metal = K.metal({ color: 'mist', specular: 0.8 });
  const brass = K.metal({ color: 'amber', specular: 0.7 });

  // base: stepped plinth (lathe with fillets), column with a collar, dial plate with tick marks
  const plinth = [
    [0, 0],
    [1.5, 0],
    [1.56, 0.07],
    [1.5, 0.22],
    [1.05, 0.3],
    [0.95, 0.42],
    [0.42, 0.52],
    [0, 0.52],
  ].map(([x, y]) => new Vector2(x, y));
  const base = new Mesh(new LatheGeometry(plinth, 56), body);
  const column = new Mesh(new CylinderGeometry(0.13, 0.19, PIVOT_Y - 0.5, 24), metal);
  column.position.y = 0.5 + (PIVOT_Y - 0.5) / 2;
  const collar = new Mesh(new TorusGeometry(0.2, 0.06, 10, 32), brass);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.62;
  const dial = new Mesh(new RoundedBoxGeometry(1.3, 0.62, 0.08, 3, 0.05), body);
  dial.position.set(0, PIVOT_Y - 1.35, 0.16);
  const tickMaterial = K.flat('mist');
  const ticks: Mesh[] = [];
  for (let i = -3; i <= 3; i++) {
    const tick = new Mesh(new RoundedBoxGeometry(0.03, i === 0 ? 0.24 : 0.14, 0.02, 1, 0.008), tickMaterial);
    const a = i * 0.14;
    tick.position.set(Math.sin(a) * 1.25, PIVOT_Y - Math.cos(a) * 1.25 - 0.02, 0.21);
    tick.rotation.z = -a;
    ticks.push(tick);
  }
  const lamp = K.glow({ color: 'green', intensity: 0.25, keepHue: true, whiten: 0 });
  const bulb = new Mesh(new SphereGeometry(0.11, 16, 12), lamp);
  bulb.position.set(0, PIVOT_Y + 0.42, 0);

  // beam with a pointer; it turns around the pivot
  const beam = new Group();
  beam.position.y = PIVOT_Y;
  const bar = new Mesh(new RoundedBoxGeometry(ARM * 2 + 0.3, 0.16, 0.2, 3, 0.07), metal);
  const hub = new Mesh(new SphereGeometry(0.24, 24, 16), brass);
  const pointer = new Mesh(
    new CylinderGeometry(0.012, 0.04, 1.25, 8),
    K.glow({ color: 'coral', intensity: 1.3, keepHue: true }),
  );
  pointer.position.set(0, -0.62, 0.2);
  beam.add(bar, hub, pointer);

  const makePan = (side: -1 | 1): { hanger: Group; pan: Group } => {
    const hanger = new Group(); // hangs from the beam end and stays vertical
    hanger.position.x = side * ARM;
    const knob = new Mesh(new SphereGeometry(0.1, 16, 12), brass);
    const rodGeometry = new CylinderGeometry(0.018, 0.018, 1, 6);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + Math.PI / 2;
      const rod = new Mesh(rodGeometry, metal);
      const ex = Math.cos(a) * PAN_RADIUS * 0.96;
      const ez = Math.sin(a) * PAN_RADIUS * 0.96;
      const length = Math.hypot(ex, DROP - 0.1, ez);
      rod.scale.y = length;
      rod.position.set(ex / 2, -(DROP - 0.1) / 2, ez / 2);
      rod.lookAt(ex, -(DROP - 0.1), ez);
      rod.rotateX(Math.PI / 2);
      hanger.add(rod);
    }
    const dish = [
      [0, 0],
      [PAN_RADIUS * 0.82, 0],
      [PAN_RADIUS, 0.14],
      [PAN_RADIUS + 0.04, 0.2],
      [PAN_RADIUS - 0.02, 0.2],
      [PAN_RADIUS * 0.8, 0.06],
      [0, 0.06],
    ].map(([x, y]) => new Vector2(x, y));
    const pan = new Group();
    pan.position.y = -DROP;
    const bowl = new Mesh(new LatheGeometry(dish, 48), metal);
    bowl.position.y = -0.06;
    pan.add(bowl);
    hanger.add(knob, pan);
    beam.add(hanger);
    return { hanger, pan };
  };
  const l = makePan(-1);
  const r = makePan(1);
  for (const m of [base, column, dial, bar]) m.castShadow = true;
  group.add(base, column, collar, dial, ...ticks, bulb, beam);

  let tilt = 0;
  return {
    group,
    left: l.pan,
    right: r.pan,
    lamp,
    get tilt() {
      return tilt;
    },
    set tilt(v: number) {
      tilt = v;
      beam.rotation.z = v;
      l.hanger.rotation.z = -v;
      r.hanger.rotation.z = -v;
    },
  };
}
