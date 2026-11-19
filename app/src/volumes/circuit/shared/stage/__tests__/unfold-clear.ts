/**
 * Clearance of the wires during the unfolding (owner 2026-11-19: «дріт в анімації часто перетинає частини»):
 * every solid of the stand and of the housing as a simple primitive in its own object's frame, and the depth by
 * which any wire piece (its centre line plus its current half thickness) enters one of them at a given `u`.
 * Used by `unfold-clear.test.ts`; also handy for a printout while tuning (`clashes(u)`).
 */
import { Group, Matrix4, Vector3, type Object3D } from 'three';
import { createStand } from '../stand';
import { createTorch, TORCH } from '../torch';
import { createUnfold } from '../unfold';
import { BULB } from '../bulb';
import { BATTERY, BOARD, LAMP, LOOP, SWITCH, WIRE } from '../layout';
import { WIRE_IDS, type WireId, type WireShape } from '../wires';

type Shape =
  | { kind: 'box'; min: [number, number, number]; max: [number, number, number] }
  | { kind: 'cyl'; axis: 'x' | 'y'; c: [number, number, number]; r: number; lo: number; hi: number }
  | { kind: 'ball'; c: [number, number, number]; r: number }
  | { kind: 'hull' };

interface Solid {
  name: string;
  object: Object3D;
  shapes: Shape[];
  /** Wire ends that legitimately touch this solid: [piece, 0 = start | 1 = end]. */
  touch: [WireId, 0 | 1][];
  /** Length along the wire from such an end within which this solid is not checked. */
  reach?: number;
}

export interface Clash {
  u: number;
  wire: WireId;
  solid: string;
  depth: number;
  at: number;
}

const STRIP_HALF = 0.02;
const box = (min: [number, number, number], max: [number, number, number]): Shape => ({
  kind: 'box',
  min,
  max,
});

/** Depth of a ball of radius `r` at `p` inside the shape (≤ 0: clear). */
function depthIn(s: Shape, p: Vector3, r: number): number {
  switch (s.kind) {
    case 'box': {
      const d = Math.max(
        s.min[0] - p.x,
        p.x - s.max[0],
        s.min[1] - p.y,
        p.y - s.max[1],
        s.min[2] - p.z,
        p.z - s.max[2],
      );
      return r - d;
    }
    case 'ball':
      return s.r + r - p.distanceTo(new Vector3(...s.c));
    case 'cyl': {
      const a = s.axis === 'x' ? p.x : p.y;
      const rad =
        s.axis === 'x' ? Math.hypot(p.y - s.c[1], p.z - s.c[2]) : Math.hypot(p.x - s.c[0], p.z - s.c[2]);
      return r - Math.max(rad - s.r, s.lo - a, a - s.hi);
    }
    case 'hull': {
      // the housing's wall (torch frame, this half only: near z ≥ 0 after `sideOf`): between the inner and outer
      // radius of the profile, plus the tail floor
      const T = TORCH;
      const x = p.x;
      if (x < T.tail - r || x > T.front + r) return -1;
      const outer =
        x < T.flare
          ? T.body
          : x < T.headStart
            ? T.body + ((x - T.flare) / (T.headStart - T.flare)) * (T.head - T.body)
            : T.head;
      const rad = Math.hypot(p.y, p.z);
      const wall = Math.min(rad - (outer - T.wall), outer - rad);
      const floor = x < T.tail + 0.3 ? T.tail + 0.3 - x : -1;
      return r + Math.max(wall, floor > 0 && rad < outer ? Math.min(floor, outer - rad) : -1);
    }
  }
}

export function createClearance() {
  const stand = createStand(BULB);
  const torch = createTorch(TORCH, BULB);
  const root = new Group();
  root.add(stand.group, ...torch.parts);
  const unfold = createUnfold(stand, torch, TORCH, BULB);
  const shapes: Partial<Record<WireId, WireShape & { pts: Vector3[] }>> = {};
  const set = stand.wires.setShape.bind(stand.wires);
  stand.wires.setShape = (id, shape) => {
    shapes[id] = { ...shape, pts: shape.path.map((q) => q.clone()) };
    set(id, shape);
  };
  const M = stand.mounts;
  const G = BULB;
  const solids: Solid[] = [
    {
      name: 'battery',
      object: stand.battery.group,
      shapes: [
        {
          kind: 'cyl',
          axis: 'x',
          c: [0, 0, 0],
          r: BATTERY.radius,
          lo: -BATTERY.length / 2,
          hi: BATTERY.length / 2 + 0.06,
        },
      ],
      touch: [['p1', 0]],
      reach: 0.12,
    },
    {
      name: 'bulb',
      object: stand.bulb.group,
      shapes: [
        { kind: 'ball', c: [0, G.globeY, 0], r: G.globe },
        { kind: 'cyl', axis: 'y', c: [0, 0, 0], r: G.threadRadius, lo: 0.02, hi: G.thread + 0.1 },
      ],
      touch: [
        ['m', 1],
        ['p2', 1],
      ],
      reach: 0.12,
    },
    {
      name: 'slider',
      object: stand.slider,
      shapes: [box([-0.15, -0.02, -0.21], [0.15, 0.2, 0.21])],
      touch: [
        ['p1', 1],
        ['p2', 0],
      ],
      reach: 0.12,
    },
    {
      name: 'switchBlock',
      object: M.switchBlock!,
      shapes: [box([-0.36, 0, -0.3], [0.36, 0.2, 0.3])],
      touch: [
        ['p1', 1],
        ['p2', 0],
      ],
      reach: 0.12,
    },
    {
      name: 'lampPost',
      object: M.lampPost!,
      shapes: [
        { kind: 'cyl', axis: 'y', c: [0, 0, 0], r: 0.3, lo: 0, hi: 0.11 },
        { kind: 'cyl', axis: 'y', c: [0, 0, 0], r: 0.27, lo: LAMP.socketY - 0.3, hi: LAMP.socketY },
        { kind: 'cyl', axis: 'y', c: [0, 0, 0], r: 0.1, lo: 0, hi: LAMP.socketY },
      ],
      touch: [
        ['m', 1],
        ['p2', 1],
      ],
      reach: 0.1,
    },
    {
      name: 'cradle',
      object: M.cradle!,
      shapes: [
        box([-0.82, 0, -0.28], [0.82, 0.09, 0.28]),
        box([-0.62, 0, -0.3], [-0.42, 0.3, 0.3]),
        box([0.42, 0, -0.3], [0.62, 0.3, 0.3]),
      ],
      touch: [],
    },
    ...(['clampMinus', 'clampPlus'] as const).map((name): Solid => {
      const sign = name === 'clampPlus' ? 1 : -1;
      const leafX = sign < 0 ? BATTERY.x - BATTERY.length / 2 - 0.2 : BATTERY.x + BATTERY.length / 2 + 0.105;
      const termX = sign < 0 ? BATTERY.minusX : BATTERY.plusX;
      const blockX = (leafX + termX) / 2 + sign * 0.02;
      const half = (Math.abs(termX - leafX) + 0.1) / 2;
      const lx = leafX - blockX;
      return {
        name,
        object: M[name]!,
        shapes: [
          box([-half, 0, -0.36], [half, 0.13, 0.36]),
          box([lx - 0.03, 0, -0.2], [lx + 0.03, BATTERY.y + BATTERY.radius + 0.14, 0.2]),
        ],
        touch: [[sign > 0 ? 'p1' : 'm', 0]],
        reach: 0.15,
      };
    }),
    ...Object.keys(M)
      .filter((n) => n.startsWith('staple'))
      .map((name): Solid => ({
        name,
        object: M[name]!,
        shapes: [box([-0.1, 0, -0.13], [0.1, LOOP.y - 0.075, 0.13])],
        touch: [],
      })),
    { name: 'housingNear', object: torch.near, shapes: [{ kind: 'hull' }], touch: [] },
    { name: 'housingFar', object: torch.far, shapes: [{ kind: 'hull' }], touch: [] },
  ];
  const inv = new Matrix4();
  const local = new Vector3();
  const clashes = (u: number): Clash[] => {
    unfold.set(u, 0);
    root.updateMatrixWorld(true);
    const out: Clash[] = [];
    for (const id of WIRE_IDS) {
      const s = shapes[id];
      if (!s) continue;
      const pts = s.pts;
      const along = [0];
      for (let i = 1; i < pts.length; i++) along.push(along[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
      const length = along[along.length - 1]!;
      // half thickness: a flat strip (thin, its flat side toward what it runs along; 0.02 allows for a slant) →
      // round core → sheath as it covers
      const r =
        STRIP_HALF + (WIRE.core - STRIP_HALF) * s.round + (WIRE.sheath - WIRE.core) * s.round * s.cover;
      for (const solid of solids) {
        if (!solid.object.visible || solid.object.scale.x < 0.05) continue;
        inv.copy(solid.object.matrixWorld).invert();
        let worst: Clash | null = null;
        pts.forEach((p, i) => {
          const d = along[i]!;
          for (const [w, e] of solid.touch)
            if (w === id && (e === 0 ? d : length - d) < (solid.reach ?? 0.2)) return;
          local.copy(p).applyMatrix4(inv);
          // the hull is a half: only the side this half covers (near +z, far −z); the strips themselves are thin.
          // The minus strip begins as the contact on the tail's floor (under the spring), split with it
          if (solid.shapes[0]!.kind === 'hull' && (solid.name === 'housingNear' ? local.z : -local.z) < -0.01)
            return;
          if (solid.shapes[0]!.kind === 'hull' && id === 'm' && d < 0.35) return;
          const rr = solid.shapes[0]!.kind === 'hull' ? 0.006 : r;
          for (const shape of solid.shapes) {
            const k = depthIn(shape, local, rr);
            if (k > 0.01 && (!worst || k > worst.depth))
              worst = { u, wire: id, solid: solid.name, depth: k, at: d / length };
          }
        });
        if (worst) out.push(worst);
      }
      // the board's face (board frame y = 0) under the whole piece
      let low: Clash | null = null;
      pts.forEach((p, i) => {
        if (Math.abs(p.x) > BOARD.width / 2 || Math.abs(p.z) > BOARD.depth / 2) return;
        const k = r - p.y;
        if (k > 0.01 && (!low || k > low.depth))
          low = { u, wire: id, solid: 'board', depth: k, at: along[i]! / length };
      });
      if (low) out.push(low);
    }
    return out;
  };
  return { clashes, stand, torch, unfold, solids, switchX: SWITCH.x };
}
