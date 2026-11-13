/**
 * Visible ageing of the step 11 module, exaggerated to read at a glance (the step carries the «illustrative»
 * chip): micro-crack webs that appear one after another and branch, and milky delamination blisters that
 * grow from the edges of the laminate in the second half of the module's life. `set(age)` with age 0…1
 * (0 = new, 1 = thirty years) is a pure function of age. Lives in the module frame (XZ = glass, +Y out).
 */
import { CircleGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '@/engine/api';
import { RibbonLines } from '@/fx';
import { K } from '@/style';
import { M } from './lm440-layout';

const WEBS = 9;
const BLISTERS = 10;

export interface Ageing {
  group: Group;
  set(age: number): void;
}

export function createAgeing(rng: Rng): Ageing {
  const group = new Group();
  group.name = 'ageing';
  // each web: a trunk and two branches, all starting at one impact point (hail, a careless foot)
  const webs = Array.from({ length: WEBS }, () => {
    const o = new Vector3(rng.range(-M.iw / 2 + 0.12, M.iw / 2 - 0.12), 0.006, rng.range(-M.il / 2 + 0.12, M.il / 2 - 0.12));
    const arm = (angle: number, n: number): Vector3[] => {
      const p = o.clone();
      let a = angle;
      return [p.clone(), ...Array.from({ length: n }, () => {
        a += rng.range(-0.5, 0.5);
        return p.add(new Vector3(Math.cos(a) * 0.045, 0, Math.sin(a) * 0.045)).clone();
      })];
    };
    const a0 = rng.range(0, Math.PI * 2);
    return [arm(a0, 6), arm(a0 + 2.1, 4), arm(a0 - 2.1, 4)];
  });
  const cracks = new RibbonLines({ capacity: WEBS * 20, color: 'white', width: 0.012, intensity: 0, blend: 'normal' });
  group.add(cracks);

  // blisters: flat milky discs hugging the edges of the laminate
  const blisters = new InstancedMesh(new CircleGeometry(1, 20).rotateX(-Math.PI / 2), K.glass({ color: 'white', opacity: 0.55, edgeOpacity: 0.8 }), BLISTERS);
  const spots = Array.from({ length: BLISTERS }, (_, i) => {
    const side = i % 4;
    const u = rng.range(-0.42, 0.42);
    const x = side < 2 ? (side ? 1 : -1) * (M.iw / 2 - 0.05) : u * M.iw;
    const z = side < 2 ? u * M.il : (side === 2 ? 1 : -1) * (M.il / 2 - 0.05);
    return { at: new Vector3(x, 0.008, z), size: rng.range(0.05, 0.1), start: rng.range(0.4, 0.8) };
  });
  group.add(blisters);
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  let shown = -1;

  return {
    group,
    set(age) {
      if (age === shown) return;
      shown = age;
      // webs appear one by one over the 30 years; each grows its arms as it ages
      const lines: { points: Vector3[] }[] = [];
      webs.forEach((web, k) => {
        const local = Math.min(1, Math.max(0, age * WEBS * 0.8 - k * 0.7));
        if (local <= 0) return;
        for (const arm of web) lines.push({ points: arm.slice(0, Math.max(2, Math.round(arm.length * local))) });
      });
      cracks.setLines(lines);
      cracks.intensity = lines.length ? 1.1 : 0;
      spots.forEach((b, i) => {
        const g = Math.min(1, Math.max(0, (age - b.start) / 0.25));
        m.compose(b.at, q, s.setScalar(Math.max(1e-4, g * b.size)));
        blisters.setMatrixAt(i, m);
      });
      blisters.instanceMatrix.needsUpdate = true;
      blisters.visible = age > 0.4;
    },
  };
}
