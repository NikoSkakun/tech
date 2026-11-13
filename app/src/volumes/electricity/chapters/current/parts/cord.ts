/**
 * Step 8: the long extension cord — two parallel conductors laid in a serpentine on the table between the
 * source and the cottage. Its laid-out length follows the length slider in five stages (1, 3, 5, 7, 9 rows —
 * a 100 m cord is not to scale); all five shapes are prebuilt and only one pair is visible. `heat` (0…1,
 * ∝ loss per metre) tints both conductors along the heat ramp. The pulses of the outgoing conductor dim
 * along the way from the power sent to the power that arrives: energy leaves the line as heat.
 */
import { CatmullRomCurve3, Color, Group, Vector3 } from 'three';
import { G } from '@/kit';
import { col, heatRamp } from '@/style';
import { LEAD_Y, REPEAT, createLead, type Lead } from './leads';

export interface Cord {
  group: Group;
  /** Middle of the visible cord (hotspot). */
  mid: Vector3;
  /** 0…1 position of the length slider → number of rows. */
  setLength(fraction: number): void;
  readonly rows: number;
  /**
   * `flow`: pulse speed factor (∝ current); `sent` / `arrived`: pulse brightness at the source and at the
   * cottage end of the outgoing conductor (the return conductor shows `arrived`).
   */
  drive(flow: number, sent: number, arrived: number, heat: number, t: number): void;
}

const X0 = -1.85;
const X1 = 1.95;
const GAP = 0.13; // spacing of the two conductors
const PIECES = 8;

/**
 * `from` / `back`: the source's «+» and «−» terminals; `to`: where the cord enters the cottage. All in set space;
 * `from` must lie left of the rows and `to` right of them.
 */
export function createCord(from: Vector3, back: Vector3, to: Vector3): Cord {
  const group = new Group();
  group.name = 'cord';
  const shapes: { out: Lead[]; ret: Lead; mid: Vector3 }[] = [];
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
    const bend = Math.min(0.22, dz ? dz * 0.45 : 0.22);
    // the outgoing conductor in PIECES consecutive leads, each continuing the pulse train of the one before
    // (phase = distance × repeat), so their brightness can step down along the line
    const path = new CatmullRomCurve3(G.roundPath(pts, bend, 5), false, 'centripetal');
    const total = path.getLength();
    const out = Array.from({ length: PIECES }, (_, j) => {
      const sub = Array.from({ length: 28 }, (_, i) => path.getPointAt((j + i / 27) / PIECES));
      return createLead(sub, { bend: 0, radius: 0.05, phase: ((total * j) / PIECES) * REPEAT });
    });
    const retLead = createLead(ret, { bend, radius: 0.05 });
    group.add(...out.map((l) => l.mesh), retLead.mesh);
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
      shapes.forEach((s, k) => {
        for (const l of [...s.out, s.ret]) l.mesh.visible = k === index;
      });
      self.mid.copy(shapes[index]!.mid);
    },
    drive(flow, sent, arrived, heat, t) {
      const s = shapes[index];
      if (!s) return;
      const k = Math.min(Math.max(heat, 0), 1);
      tint.copy(base).lerp(heatRamp(k, hot), Math.min(k * 1.4, 1) * (0.9 + 0.1 * Math.sin(t * 5)));
      s.out.forEach((lead, j) => {
        lead.drive(flow, sent + ((arrived - sent) * (j + 0.5)) / PIECES);
        lead.tint(tint);
      });
      s.ret.drive(flow, arrived);
      s.ret.tint(tint);
    },
  };
  self.setLength(0.5);
  return self;
}
