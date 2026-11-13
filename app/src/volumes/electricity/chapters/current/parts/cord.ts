/**
 * Step 8: the long extension cord — two parallel conductors laid in a serpentine on the table between the
 * source and the cottage. Its laid-out length follows the length slider in five stages (1, 3, 5, 7, 9 rows —
 * a 100 m cord is not to scale); all five shapes are prebuilt and only one pair is visible. `heat` (0…1,
 * ∝ loss per metre) tints both conductors along the heat ramp.
 */
import { Color, Group, Vector3 } from 'three';
import { col, heatRamp } from '@/style';
import { LEAD_Y, createLead, type Lead } from './leads';

export interface Cord {
  group: Group;
  /** Middle of the visible cord (hotspot). */
  mid: Vector3;
  /** 0…1 position of the length slider → number of rows. */
  setLength(fraction: number): void;
  readonly rows: number;
  /** `flow`: pulse speed factor (∝ current), `power`: pulse brightness (∝ power sent). */
  drive(flow: number, power: number, heat: number, t: number): void;
}

const X0 = -1.85;
const X1 = 1.95;
const GAP = 0.13; // spacing of the two conductors

/**
 * `from` / `back`: the source's «+» and «−» terminals; `to`: where the cord enters the cottage. All in set space;
 * `from` must lie left of the rows and `to` right of them.
 */
export function createCord(from: Vector3, back: Vector3, to: Vector3): Cord {
  const group = new Group();
  group.name = 'cord';
  const shapes: { out: Lead; ret: Lead; mid: Vector3 }[] = [];
  for (const k of [1, 3, 5, 7, 9]) {
    const dz = k > 1 ? Math.min(0.5, 3.3 / (k - 1)) : 0;
    const pts: Vector3[] = [from.clone(), new Vector3(from.x, LEAD_Y, from.z)];
    for (let j = 0; j < k; j++) {
      const z = from.z + j * dz;
      const right = j % 2 === 0;
      if (j > 0) pts.push(new Vector3(right ? X0 : X1, LEAD_Y, z));
      pts.push(new Vector3(right ? X1 : X0, LEAD_Y, z));
    }
    const zLast = from.z + (k - 1) * dz;
    pts.push(new Vector3(to.x - 0.1, LEAD_Y, zLast), new Vector3(to.x - 0.1, LEAD_Y, to.z), to.clone());
    // the return conductor: the same polyline shifted diagonally (parallel on every run), back to «−»
    const shift = new Vector3(GAP, 0, GAP);
    const ret = pts
      .slice(1)
      .map((p) => p.clone().add(shift))
      .reverse();
    ret[0]!.copy(to).add(shift);
    ret.push(new Vector3(from.x + GAP, LEAD_Y, back.z), new Vector3(back.x, LEAD_Y, back.z), back.clone());
    const out = createLead(pts, { bend: Math.min(0.22, dz ? dz * 0.45 : 0.22), radius: 0.05 });
    const retLead = createLead(ret, { bend: Math.min(0.22, dz ? dz * 0.45 : 0.22), radius: 0.05 });
    group.add(out.mesh, retLead.mesh);
    shapes.push({ out, ret: retLead, mid: new Vector3(0, LEAD_Y, from.z + Math.floor(k / 2) * dz) });
  }
  let index = -1;
  const base = col('steel').lerp(col('slate'), 0.55);
  const tint = new Color();
  const hot = new Color();
  const self: Cord = {
    group,
    mid: new Vector3(),
    get rows() {
      return 1 + 2 * index;
    },
    setLength(fraction) {
      const next = Math.round(Math.min(Math.max(fraction, 0), 1) * (shapes.length - 1));
      if (next === index) return;
      index = next;
      shapes.forEach((s, k) => (s.out.mesh.visible = s.ret.mesh.visible = k === index));
      self.mid.copy(shapes[index]!.mid);
    },
    drive(flow, power, heat, t) {
      const s = shapes[index];
      if (!s) return;
      const k = Math.min(Math.max(heat, 0), 1);
      tint.copy(base).lerp(heatRamp(k, hot), Math.min(k * 1.4, 1) * (0.9 + 0.1 * Math.sin(t * 5)));
      for (const lead of [s.out, s.ret]) {
        lead.drive(flow, power);
        lead.tint(tint);
      }
    },
  };
  self.setLength(0.5);
  return self;
}
