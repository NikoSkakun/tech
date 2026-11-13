/**
 * «Збери модуль» (step 4): six toy cell bricks (0.7 V, 7 A each; `coral` plus cap, `blue` minus cap) on a
 * breadboard. The board's state is a list of rows of bricks: a row is a series chain, rows of equal length
 * sit between the two bus bars and are in parallel. Bricks are dragged from row to row (or into a new row);
 * `setLayout` lays out the three presets (6 in series, 3 × 2, 6 in parallel). A row that is shorter or longer
 * than the connected ones is not plugged in (it hovers, tilted) and does not count. Positions ease toward a
 * pure function of the rows.
 */
import { BoxGeometry, Group, Mesh, type Object3D, type Vector3 } from 'three';
import { damp } from '@/engine/api';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';
import { shadows } from '../world';

export type BrickLayout = 's6' | 's3p2' | 'p6';
/** Series count and parallel count of every preset. */
export const BRICK_LAYOUTS: Record<BrickLayout, { series: number; parallel: number }> = {
  s6: { series: 6, parallel: 1 },
  s3p2: { series: 3, parallel: 2 },
  p6: { series: 1, parallel: 6 },
};

const LEN = 0.5;
const STEP_X = LEN + 0.03;
const PITCH_Z = 0.36;
const N = 6;

export interface BrickBoard {
  group: Group;
  bricks: Object3D[];
  /** Invisible, generous pick targets (one per brick). */
  grips: Mesh[];
  /** Connected chain: bricks in series per row × rows in parallel (0 × 0 never happens: one brick is a chain). */
  circuit(): { series: number; parallel: number; loose: number };
  /** The preset the rows currently form, or `''`. */
  preset(): BrickLayout | '';
  setLayout(layout: BrickLayout): void;
  /** Drag gesture of brick `i`: `at` = point on the board in the board's frame (x, z); `drop` ends it. */
  drag(i: number, at: Vector3): void;
  drop(i: number): void;
  hover(i: number, over: boolean): void;
  update(dt: number, t: number): void;
}

/** Rows of brick ids for a preset. */
function presetRows(layout: BrickLayout): number[][] {
  const { series } = BRICK_LAYOUTS[layout];
  const rows: number[][] = [];
  for (let i = 0; i < N; i++) (rows[Math.floor(i / series)] ??= []).push(i);
  return rows;
}

/** The connected length = the length most bricks share (ties: the longer chain). */
function connectedLength(rows: number[][]): number {
  let best = 0;
  let bestBricks = -1;
  for (const r of rows) {
    const bricks = rows.filter((q) => q.length === r.length).length * r.length;
    if (bricks > bestBricks || (bricks === bestBricks && r.length > best)) [best, bestBricks] = [r.length, bricks];
  }
  return best;
}

export function createBrickBoard(): BrickBoard {
  const group = new Group();
  group.name = 'brick-board';
  const base = new Builder('breadboard');
  base.box(3.5, 0.1, 2.3, { r: 0.05, slot: 'gloss', c: ['bg.indigo', 'slate'] });
  for (let i = 0; i < 12; i++) for (let j = 0; j < 7; j++) base.cyl(0.025, 0.012, { seg: 8, c: 'ink', at: [(i - 5.5) * 0.28, 0.1, (j - 3) * 0.3] });
  group.add(shadows(base.build().group, false));

  const one = new Builder('brick');
  one.box(LEN - 0.12, 0.16, 0.26, { r: 0.04, slot: 'gloss', c: ['bg.indigo', 'blue'] });
  one.box(0.07, 0.17, 0.27, { r: 0.03, slot: 'gloss', c: SEMANTIC.dcPlus, at: [LEN / 2 - 0.035, 0, 0] });
  one.box(0.07, 0.17, 0.27, { r: 0.03, slot: 'gloss', c: SEMANTIC.dcMinus, at: [-LEN / 2 + 0.035, 0, 0] });
  for (const z of [-0.07, 0, 0.07]) one.box(LEN - 0.14, 0.006, 0.012, { r: 0, slot: 'metal', c: 'mist', at: [0, 0.16, z] });
  const proto = one.build();
  const meshes = proto.group.children.filter((o): o is Mesh => (o as Mesh).isMesh);
  const gripGeo = new BoxGeometry(STEP_X, 0.3, PITCH_Z);
  const gripMat = K.flat('cyan');
  gripMat.colorWrite = false;
  gripMat.depthWrite = false;
  const bricks: Object3D[] = [];
  const grips: Mesh[] = [];
  for (let i = 0; i < N; i++) {
    const g = new Group();
    for (const m of meshes) g.add(Object.assign(new Mesh(m.geometry, m.material), { castShadow: true }));
    const grip = new Mesh(gripGeo, gripMat);
    grip.position.y = 0.06;
    g.add(grip);
    g.position.set((i - 2.5) * STEP_X, 0.1, 0);
    bricks.push(g);
    grips.push(grip);
    group.add(g);
  }
  // bus bars of parallel branches (plus side and minus side)
  const bar = (color: string): Mesh => {
    const m = new Mesh(new Builder('bus').box(0.06, 0.1, 1, { r: 0.02, slot: 'gloss', c: 'white' }).geometry('gloss'), K.toon({ color, gloss: 0.5 }));
    m.position.y = 0.1;
    m.scale.z = 0.001;
    group.add(m);
    return m;
  };
  const plusBar = bar(SEMANTIC.dcPlus);
  const minusBar = bar(SEMANTIC.dcMinus);

  let rows = presetRows('s6');
  let series = N;
  let parallel = 1;
  const target: Vector3[] = bricks.map((b) => b.position.clone());
  const loose: boolean[] = bricks.map(() => false);
  const lift: number[] = bricks.map(() => 0);
  const hovered: boolean[] = bricks.map(() => false);
  let held = -1;
  const bus = { x: 0, z: 0, len: 0.001 };
  const rowZ = (r: number, n: number): number => (r - (n - 1) / 2) * PITCH_Z;

  /** Normalise the rows (no empty rows, connected rows first) and recompute every brick's target. */
  const relayout = (): void => {
    rows = rows.filter((r) => r.length > 0);
    series = connectedLength(rows);
    const on = rows.filter((r) => r.length === series);
    rows = [...on, ...rows.filter((r) => r.length !== series)];
    parallel = on.length;
    rows.forEach((row, r) =>
      row.forEach((id, k) => {
        target[id]!.set((k - (row.length - 1) / 2) * STEP_X, 0.1, rowZ(r, rows.length));
        loose[id] = row.length !== series;
      }),
    );
    bus.x = (series * STEP_X) / 2 + 0.04;
    bus.z = (rowZ(0, rows.length) + rowZ(parallel - 1, rows.length)) / 2;
    bus.len = parallel > 1 ? (parallel - 1) * PITCH_Z + 0.3 : 0.001;
  };
  relayout();

  return {
    group,
    bricks,
    grips,
    circuit: () => ({ series, parallel, loose: loose.filter(Boolean).length }),
    preset: () => (Object.keys(BRICK_LAYOUTS) as BrickLayout[]).find((k) => BRICK_LAYOUTS[k].series === series && BRICK_LAYOUTS[k].parallel === parallel && rows.length === parallel) ?? '',
    setLayout(layout) {
      rows = presetRows(layout);
      held = -1;
      relayout();
    },
    drag(i, at) {
      held = i;
      target[i]!.set(Math.max(-1.6, Math.min(1.6, at.x)), 0.1, Math.max(-1.1, Math.min(1.1, at.z)));
    },
    drop(i) {
      held = -1;
      const from = rows.findIndex((r) => r.includes(i));
      const drop = target[i]!;
      // the row under the brick; above the first row or below the last one opens a new row
      const at = Math.round(drop.z / PITCH_Z + (rows.length - 1) / 2);
      rows[from] = rows[from]!.filter((id) => id !== i);
      if (at < 0) rows.unshift([i]);
      else if (at >= rows.length) rows.push([i]);
      else {
        // insert at the column under the brick (by x among the row's current bricks)
        const row = rows[at]!;
        const k = row.filter((id) => target[id]!.x < drop.x).length;
        row.splice(k, 0, i);
      }
      relayout();
    },
    hover(i, over) {
      hovered[i] = over;
    },
    update(dt, t) {
      bricks.forEach((b, i) => {
        const up = i === held ? 0.35 : hovered[i] ? 0.08 : loose[i] ? 0.05 : 0;
        lift[i] = damp(lift[i]!, up, 10, dt);
        b.position.x = damp(b.position.x, target[i]!.x, i === held ? 18 : 6, dt);
        b.position.z = damp(b.position.z, target[i]!.z, i === held ? 18 : 6, dt);
        b.position.y = 0.1 + lift[i]! + Math.abs(Math.sin(t * 1.6 + i * 0.9)) * 0.012; // idle life
        // a brick that is not plugged in hangs crooked
        b.rotation.z = damp(b.rotation.z, loose[i] && i !== held ? 0.18 : 0, 6, dt);
      });
      for (const [m, s] of [[plusBar, 1], [minusBar, -1]] as const) {
        m.position.x = damp(m.position.x, s * bus.x, 6, dt);
        m.position.z = damp(m.position.z, bus.z, 6, dt);
        m.scale.z = damp(m.scale.z, bus.len, 6, dt);
      }
    },
  };
}
