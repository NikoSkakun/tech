/**
 * Motor terminal box (step 5) with six brass studs — top row U1 V1 W1 (winding starts), bottom row W2 U2 V2
 * (winding ends, shifted by one as on real motors) — and three copper jumpers that sit in slots: three vertical
 * slots (one per column: Δ) or the two bottom-row links plus a parking slot (Y: the ends W2–U2–V2 joined).
 * Box-local plane XY, face toward +Z. Jumper positions are eased toward their slots in `update`.
 */
import { Group, Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { G } from '@/kit';
import { K } from '@/style';
import { COPPER, tag } from '../world';

export type Layout = 'star' | 'delta';
const COLS = [-0.6, 0, 0.6];
const TOP = 0.3;
const BOTTOM = -0.3;
/** Slots: 0–2 vertical (columns), 3–4 bottom-row links, 5 parking. */
export const SLOTS: readonly { at: Vector3; vertical: boolean }[] = [
  ...COLS.map((x) => ({ at: new Vector3(x, 0, 0.14), vertical: true })),
  { at: new Vector3(-0.3, BOTTOM, 0.14), vertical: false },
  { at: new Vector3(0.3, BOTTOM, 0.14), vertical: false },
  { at: new Vector3(0, -0.66, 0.14), vertical: false },
];
const LAYOUT: Record<Layout, readonly number[]> = { delta: [0, 1, 2], star: [3, 4, 5] };

export interface TerminalBox {
  group: Group;
  jumpers: Mesh[];
  /** Slot of each jumper (−1 while dragged). */
  slots: number[];
  setLayout(l: Layout, instant?: boolean): void;
  /** The layout the jumpers form, or null if mixed / incomplete. */
  layout(): Layout | null;
  /** Drop jumper j at a box-local point: snaps to the nearest free slot (< 0.45) or returns to its old slot. */
  drop(j: number, local: Vector3): void;
  /** Move a dragged jumper to a box-local point. */
  hold(j: number, local: Vector3): void;
  update(dt: number): void;
}

export function createTerminalBox(): TerminalBox {
  const group = new Group();
  group.name = 'terminal-box';
  const body = new Mesh(new RoundedBoxGeometry(2.0, 1.75, 0.3, 3, 0.1), K.toon({ color: 'slate', rim: 0.6 }));
  body.position.set(0, -0.12, -0.1);
  const base = new Mesh(new RoundedBoxGeometry(1.75, 1.5, 0.06, 2, 0.04), K.toon({ color: 'ink' }));
  base.position.set(0, -0.12, 0.06);
  group.add(body, base);
  const studGeo = G.cyl(0.075, 0.1, { seg: 20 });
  const names = [['U1', 'V1', 'W1'], ['W2', 'U2', 'V2']] as const;
  [TOP, BOTTOM].forEach((y, r) =>
    COLS.forEach((x, c) => {
      const stud = new Mesh(studGeo, K.metal({ color: 'amber.dark' }));
      stud.rotation.x = Math.PI / 2;
      stud.position.set(x, y, 0.08);
      group.add(stud);
      const t = tag(names[r]![c]!, 16, 'mist', 'mono');
      t.position.set(x + 0.24, y + (r === 0 ? 0.17 : -0.17), 0.12);
      group.add(t);
    }),
  );
  const jumperGeo = new RoundedBoxGeometry(0.16, 0.78, 0.05, 2, 0.02);
  const mat = K.metal({ color: COPPER, specular: 0.9 });
  const jumpers = [0, 1, 2].map(() => {
    const j = new Mesh(jumperGeo, mat);
    j.castShadow = true;
    group.add(j);
    return j;
  });
  const slots = [3, 4, 5];
  const held: (Vector3 | null)[] = [null, null, null];
  const place = (j: number, instant: boolean): void => {
    const s = SLOTS[slots[j]!];
    if (!s) return;
    const jm = jumpers[j]!;
    const rz = s.vertical ? 0 : Math.PI / 2;
    if (instant) {
      jm.position.copy(s.at);
      jm.rotation.z = rz;
    }
  };
  const setLayout = (l: Layout, instant = false): void => {
    LAYOUT[l].forEach((s, j) => (slots[j] = s));
    for (let j = 0; j < 3; j++) {
      held[j] = null;
      place(j, instant);
    }
  };
  setLayout('star', true);
  return {
    group,
    jumpers,
    slots,
    setLayout,
    layout() {
      const used = [...slots].sort((a, b) => a - b).join(',');
      if (used === '0,1,2') return 'delta';
      if (used === '3,4,5') return 'star';
      return null;
    },
    hold(j, local) {
      held[j] = local.clone().setZ(0.3);
    },
    drop(j, local) {
      held[j] = null;
      let best = -1;
      let bestD = 0.45;
      SLOTS.forEach((s, i) => {
        const taken = slots.some((x, k) => x === i && k !== j);
        const dd = s.at.distanceTo(local.clone().setZ(s.at.z));
        if (!taken && dd < bestD) {
          bestD = dd;
          best = i;
        }
      });
      if (best >= 0) slots[j] = best;
    },
    update(dt) {
      const k = Math.min(1, dt * 12);
      jumpers.forEach((jm, j) => {
        const h = held[j];
        const s = SLOTS[slots[j]!]!;
        const target = h ?? s.at;
        jm.position.lerp(target, k);
        const rz = h ? jm.rotation.z : s.vertical ? 0 : Math.PI / 2;
        jm.rotation.z += (rz - jm.rotation.z) * k;
      });
    },
  };
}
