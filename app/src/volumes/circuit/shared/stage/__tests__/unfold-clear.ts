/**
 * Clearance of the wires during the unfolding (owner 2026-11-19: «дріт в анімації часто перетинає частини»; «все
 * рівно є перетин»): every solid of the stand and of the housing in its own object's frame — the battery, the
 * spring and the lamp with their true profiles (`battery.ts`, `small-parts.ts`, `bulb.ts`), the rest as boxes and
 * cylinders — and the depth by which any wire piece enters one of them, or another piece, at a given `u`. A piece
 * is its true section (a flat strip's width and thickness turned as `dyn-tube.ts` turns it, rounding into the wire
 * and its sheath), checked along its whole length; only the literal contact at a touching end is exempt (`CONTACT`).
 * Used by `unfold-clear.test.ts`; also handy for a printout while tuning (`clashes(u)`, `CLEAR_PRINT=1`).
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
  /** A body of revolution about the local x or y axis: its true profile, [position on the axis, radius]. */
  | { kind: 'lathe'; axis: 'x' | 'y'; prof: [number, number][]; wall?: number }
  | { kind: 'hull' };

interface Solid {
  name: string;
  object: Object3D;
  shapes: Shape[];
  /** Wire ends that legitimately touch this solid: [piece, 0 = start | 1 = end, contact radius if not `CONTACT`]. */
  touch: [WireId, 0 | 1, number?][];
}

/**
 * Only the literal contact is exempt: the points of a piece within this distance of an end that touches the solid
 * (the end sits on the part's surface, so its own half thickness reaches into it). Everything farther along the
 * piece — the attachment's whole neighbourhood included — must clear the part.
 */
const CONTACT = 0.07;
/** Depth that counts as a clash: the strips are 0.02 thick, a sliver of a millimetre is a touch, not a cut. */
const TOLERANCE = 0.004;
/** Radius of a profile at `a` (the widest of its pieces there; a step in the profile is two points at one `a`). */
function radiusAt(prof: [number, number][], a: number): number {
  let r = -1;
  for (let i = 1; i < prof.length; i++) {
    const [a0, r0] = prof[i - 1]!;
    const [a1, r1] = prof[i]!;
    if (a < Math.min(a0, a1) || a > Math.max(a0, a1)) continue;
    r = Math.max(r, a1 === a0 ? Math.max(r0, r1) : r0 + ((a - a0) / (a1 - a0)) * (r1 - r0));
  }
  return r;
}

export interface Clash {
  u: number;
  wire: WireId;
  solid: string;
  depth: number;
  at: number;
  /** Where (in the solid's own frame) the worst ball of the piece is. */
  where?: number[];
}

/** Half width and half height of a flat strip's section (`wires.ts`). */
const STRIP: [number, number] = [WIRE.core * 2.1, WIRE.core * 0.3];
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
    case 'lathe': {
      // the ball reaches the profile's widest radius within ±r along the axis (a step or a shoulder included)
      const a = s.axis === 'x' ? p.x : p.y;
      const rad = s.axis === 'x' ? Math.hypot(p.y, p.z) : Math.hypot(p.x, p.z);
      let wide = -1;
      let narrow = Infinity;
      for (let k = -4; k <= 4; k++) {
        const w = radiusAt(s.prof, a + (k / 4) * r);
        wide = Math.max(wide, w);
        if (w >= 0) narrow = Math.min(narrow, w);
      }
      if (wide < 0) return -1;
      // a hollow one (the coil) is only its wall
      return r - Math.max(rad - wide, s.wall ? narrow - s.wall - rad : -1);
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
    // `unfold.ts` reuses one vector for every piece's `up`: keep a copy
    shapes[id] = { ...shape, up: shape.up?.clone(), pts: shape.path.map((q) => q.clone()) };
    set(id, shape);
  };
  const M = stand.mounts;
  const G = BULB;
  const L = BATTERY.length;
  /** Where the globe's lathe starts (−52° below its equator, `bulb.ts`). */
  const DEG52 = (52 * Math.PI) / 180;
  const solids: Solid[] = [
    {
      name: 'battery',
      object: stand.battery.group,
      // `battery.ts`: the «−» plate, the can with its metal ring, the steel shoulder and the «+» nub
      shapes: [
        {
          kind: 'lathe',
          axis: 'x',
          prof: [
            [-L / 2 - 0.02, 0.22],
            [-L / 2, 0.22],
            [-L / 2, BATTERY.radius + 0.007],
            [L / 2 - 0.05, BATTERY.radius + 0.007],
            [L / 2 - 0.05, BATTERY.radius * 0.94],
            [L / 2, BATTERY.radius * 0.94],
            [L / 2, 0.105],
            [L / 2 + 0.095, 0.105],
          ],
        },
      ],
      touch: [['p1', 0]],
    },
    {
      // `small-parts.ts`: the conical coil, wide end (0.2 + its wire) at the origin, along +x (scaled with it)
      name: 'spring',
      object: stand.spring.group,
      shapes: [
        {
          kind: 'lathe',
          axis: 'x',
          prof: [
            [-0.021, 0.221],
            [stand.spring.length + 0.021, 0.131],
          ],
          wall: 0.042,
        },
      ],
      // the minus strip's contact runs under the whole wide end ring: the spring presses it to the tail's floor
      touch: [['m', 0, 0.24]],
    },
    {
      // `bulb.ts`: bottom contact, insulating ring, thread and collar, the neck flaring into the globe
      name: 'bulb',
      object: stand.bulb.group,
      shapes: [
        { kind: 'ball', c: [0, G.globeY, 0], r: G.globe },
        {
          kind: 'lathe',
          axis: 'y',
          prof: [
            [0, 0.085],
            [0.06, 0.085],
            [0.06, 0.155],
            [0.11, 0.155],
            [0.11, G.threadRadius + 0.012],
            [G.thread, G.threadRadius + 0.012],
            [G.thread + 0.1, G.threadRadius + 0.03],
            [G.globeY - G.globe * Math.sin(DEG52), G.globe * Math.cos(DEG52)],
          ],
        },
      ],
      touch: [
        ['m', 1],
        ['p2', 1],
      ],
    },
    {
      name: 'slider',
      object: stand.slider,
      shapes: [box([-0.15, -0.02, -0.21], [0.15, 0.2, 0.21])],
      touch: [
        ['p1', 1],
        ['p2', 0],
      ],
    },
    {
      name: 'switchBlock',
      object: M.switchBlock!,
      shapes: [box([-0.36, 0, -0.3], [0.36, 0.2, 0.3])],
      touch: [
        ['p1', 1],
        ['p2', 0],
      ],
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
  /**
   * A piece as balls that fill its true section (`wires.ts`, `dyn-tube.ts`): a flat strip is an ellipse STRIP[0]
   * wide and STRIP[1] high whose height axis is `up` transported along the path, rounding into the core, plus the
   * sheath as it covers. Five balls across the width (radius = the half height) on a path 4× denser than its
   * samples, so neither a strip's edge nor a sparse piece can step over a thin part.
   */
  const ballsOf = (s: WireShape & { pts: Vector3[] }) => {
    const r = Math.min(Math.max(s.round, 0), 1);
    const w = STRIP[0] + (WIRE.core - STRIP[0]) * r;
    const h = STRIP[1] + (WIRE.core - STRIP[1]) * r;
    const radius = h + (WIRE.sheath - WIRE.core) * r * s.cover;
    const src = s.pts;
    const normal = (s.up ?? new Vector3(0, 1, 0)).clone();
    const tangent = new Vector3();
    const sides: Vector3[] = [];
    src.forEach((_, i) => {
      tangent
        .copy(src[Math.min(i + 1, src.length - 1)]!)
        .sub(src[Math.max(i - 1, 0)]!)
        .normalize();
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
      sides.push(new Vector3().crossVectors(tangent, normal));
    });
    const line: Vector3[] = [src[0]!.clone()];
    const side: Vector3[] = [sides[0]!];
    for (let i = 1; i < src.length; i++)
      for (let k = 1; k <= 4; k++) {
        line.push(src[i - 1]!.clone().lerp(src[i]!, k / 4));
        side.push(
          sides[i - 1]!.clone()
            .lerp(sides[i]!, k / 4)
            .normalize(),
        );
      }
    const along = [0];
    for (let i = 1; i < line.length; i++) along.push(along[i - 1]! + line[i]!.distanceTo(line[i - 1]!));
    const length = along[along.length - 1]!;
    const balls = line.flatMap((c, i) =>
      [-1, -0.5, 0, 0.5, 1].map((k) => ({
        c: c.clone().addScaledVector(side[i]!, k * (w - h)),
        on: c,
        mid: k === 0,
        d: along[i]!,
        at: along[i]! / length,
      })),
    );
    return { balls, radius, reach: w - h + radius, ends: [line[0]!, line[line.length - 1]!] as const };
  };
  const clashes = (u: number): Clash[] => {
    unfold.set(u, 0);
    root.updateMatrixWorld(true);
    const out: Clash[] = [];
    const pieces: Partial<Record<WireId, ReturnType<typeof ballsOf>>> = {};
    for (const id of WIRE_IDS) {
      const s = shapes[id];
      if (!s) continue;
      const piece = (pieces[id] = ballsOf(s));
      const { balls, radius, ends } = piece;
      for (const solid of solids) {
        if (!solid.object.visible || solid.object.scale.x < 0.05) continue;
        inv.copy(solid.object.matrixWorld).invert();
        const hull = solid.shapes[0]!.kind === 'hull';
        let worst: Clash | null = null;
        for (const b of balls) {
          if (solid.touch.some(([w, e, c]) => w === id && b.on.distanceTo(ends[e]) < (c ?? CONTACT)))
            continue;
          local.copy(b.c).applyMatrix4(inv);
          // the hull is a half: only the side this half covers (near +z, far −z); in the torch the strips lie
          // flat on its inner wall, so only their centre line counts. The minus strip begins as the contact on
          // the tail's floor (under the spring), split with it
          if (hull && ((solid.name === 'housingNear' ? local.z : -local.z) < -0.01 || !b.mid)) continue;
          if (hull && id === 'm' && b.d < 0.35) continue;
          for (const shape of solid.shapes) {
            const k = depthIn(shape, local, hull ? 0.006 : radius);
            if (k > TOLERANCE && (!worst || k > worst.depth))
              worst = { u, wire: id, solid: solid.name, depth: k, at: b.at, where: local.toArray() };
          }
        }
        if (worst) out.push(worst);
      }
      // the board's face (board frame y = 0) under the whole piece
      let low: Clash | null = null;
      for (const b of balls) {
        if (Math.abs(b.c.x) > BOARD.width / 2 || Math.abs(b.c.z) > BOARD.depth / 2) continue;
        const k = radius - b.c.y;
        if (k > TOLERANCE && (!low || k > low.depth))
          low = { u, wire: id, solid: 'board', depth: k, at: b.at };
      }
      if (low) out.push(low);
    }
    // wire against wire: no ball of one piece into a ball of another
    WIRE_IDS.forEach((ia, n) =>
      WIRE_IDS.slice(n + 1).forEach((ib) => {
        const A = pieces[ia];
        const B = pieces[ib];
        if (!A || !B) return;
        const near = A.reach + B.reach;
        let worst: Clash | null = null;
        for (let i = 0; i < A.balls.length; i += 5)
          for (let j = 2; j < B.balls.length; j += 5) {
            if (A.balls[i + 2]!.c.distanceTo(B.balls[j]!.c) > near) continue;
            for (let a = i; a < i + 5; a++)
              for (let b = j - 2; b < j + 3; b++) {
                const k = A.radius + B.radius - A.balls[a]!.c.distanceTo(B.balls[b]!.c);
                if (k > TOLERANCE && (!worst || k > worst.depth))
                  worst = { u, wire: ia, solid: `wire ${ib}`, depth: k, at: A.balls[a]!.at };
              }
          }
        if (worst) out.push(worst);
      }),
    );
    return out;
  };
  return { clashes, stand, torch, unfold, solids, switchX: SWITCH.x };
}
