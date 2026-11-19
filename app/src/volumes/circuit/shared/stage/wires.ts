/**
 * The loop of wire (VISUAL.md §2): three pieces that together with the battery, the switch and the lamp close the
 * rounded rectangle.
 *
 *   m   minus clamp → near left corner → left side → far left corner → far side → lamp socket (thread)  (`blue`)
 *   p1  plus clamp → switch — the stretch under the magnifier, extra smooth                              (`coral`)
 *   p2  switch → near right corner → right side → lamp socket (bottom contact)                           (`coral`)
 *
 * The far wire `m` is ONE tube: where `flow/loop` raises the second switch seat on the board the tube parts
 * between the seat's two terminals (`setSeat`: its section collapses there, flat copper ends, stripped copper
 * into each terminal) and closes again when the seat sinks. `resistance/shape` thins its far stretch into the
 * snake (`thin`), the practicum breaks its copper (`gap`).
 *
 * Copper core with a sharp glint inside a translucent sheath (the look of `atom/dive-in`). Nothing ever runs
 * along the wires on this floor. In the flashlight the same pieces are its flat metal strips; the unfolding
 * morphs path and section continuously (`setShape`).
 */
import { BufferAttribute, Group, Mesh, Vector3, type Color } from 'three';
import { G } from '@/kit';
import { K, K_EMISSIVE_ATTRIBUTE, SEMANTIC, col, type KToonMaterial } from '@/style';
import { DynTube, resample } from './dyn-tube';
import { BATTERY, LAMP, LOOP, SEAT, SWITCH, WIRE } from './layout';
import { sheath } from './materials';

export type WireId = 'm' | 'p1' | 'p2';
export const WIRE_IDS: readonly WireId[] = ['m', 'p1', 'p2'];

/** `m` has rings enough for the snake's folds at full stretch (`resistance/shape`, ≈ 29 units of wire). */
const RINGS: Record<WireId, number> = { m: 900, p1: 28, p2: 96 };
const RADIAL: Record<WireId, number> = { m: 14, p1: 56, p2: 14 };
/** How far a wire's end sits inside its screw terminal. */
const INSET = 0.07;
const y = LOOP.y;
const v = (x: number, z: number): Vector3 => new Vector3(x, y, z);

/** The stand's wire paths (board frame), dense polylines with rounded corners. */
export function standPath(id: WireId): Vector3[] {
  switch (id) {
    case 'm':
      return G.roundPath(
        [
          v(BATTERY.minusX + INSET, LOOP.near),
          v(LOOP.left, LOOP.near),
          v(LOOP.left, LOOP.far),
          v(LAMP.x - LAMP.term + INSET, LOOP.far),
        ],
        LOOP.corner,
        12,
      );
    case 'p1':
      return [v(BATTERY.plusX - INSET, LOOP.near), v(SWITCH.inX + INSET, LOOP.near)];
    case 'p2':
      return G.roundPath(
        [
          v(SWITCH.outX - INSET, LOOP.near),
          v(LOOP.right, LOOP.near),
          v(LOOP.right, LAMP.z + LAMP.term - INSET),
        ],
        LOOP.corner,
        12,
      );
  }
}

export interface WireShape {
  /** Any polyline; it is resampled to the piece's ring count. */
  path: readonly Vector3[];
  /** 0 = flat metal strip … 1 = round wire. */
  round: number;
  /** Sheath coverage 0…1, growing from the piece's START (the clamp or terminal it leaves). */
  cover: number;
  /** 0…1: the strip's steel turns into the wire's copper. */
  copper: number;
  /** Normal of the strip's flat side at its start (transported along the path). Default: the board's up. */
  up?: Vector3;
  /** Length of stripped copper at the start and at the end (default `BARE` both): 0 = sheath to the very tip. */
  bare?: readonly [number, number];
  /**
   * A break in the copper under the intact sheath: centre (share of the length 0…1) and width (units). The copper
   * ends are flat cut faces (the core's rings are re-laid around the gap; the sheath is untouched).
   */
  gap?: { at: number; width: number };
  /**
   * The wire thins from the length `from` (units from its start) on, after a short taper, to these radii (round
   * wire only; the snake of `resistance/shape`). `setEmber` warms only this thin stretch.
   */
  thin?: { from: number; core: number; sheath: number };
  /**
   * Draw the piece with this many rings along it instead of its own count — for a moving shape with more bends
   * than the piece has on the stand (the unfolding's way of `p1` round the battery). The stand's own shapes never
   * set it, so the finished stand is drawn exactly as before. Not with `gap`, `thin` or the second seat.
   */
  rings?: number;
}

/** Stripped copper at each end of a piece (the part that goes into a terminal, and a little more). */
export const BARE = 0.11;
/** Length over which a `thin` wire tapers to its thin radii. */
const TAPER = 0.14;

export interface Wires {
  group: Group;
  setShape(id: WireId, shape: WireShape): void;
  /** Lay the pieces (all, or one) on the stand as finished wires. */
  setStand(id?: WireId): void;
  /**
   * The second seat 0…1 (`Stand.setSeat`): 0 — none, the far wire runs whole; above 0 the far wire `m` parts
   * between the seat's two terminals, wider as the seat rises (1: its ends in them). Applies to any shape of `m`
   * whose path ends with the straight far stretch (the stand's own, `flow/connect`'s loose end).
   */
  setSeat(seat: number): void;
  readonly seat: number;
  /** 0 = the sheaths nearly one neutral tint … 1 = coral from the plus, blue from the minus. */
  setPoles(amount: number): void;
  /** 0…1: the warm ember the `thin` stretch of `m` keeps while the lamp dims (`resistance/shape`). */
  setEmber(amount: number): void;
  /**
   * The dive 0…1 as the piece under the lens (`p1`) shows it: its sheath dissolves smoothly over the second half
   * of the flight, and its bare core turns into ONE copper that does not depend on the room's light — the same
   * muted copper with the lamp on or off (the lamp only adds a warm top), so the lower floor has one colour to
   * continue from.
   */
  setDive(dive: number): void;
  /** @deprecated use `setDive`; kept for callers of the first version (1 = solid sheath). */
  setLensSheath(fade: number): void;
  /** The shape object a piece was last given (a chapter can tell when the stand re-laid its piece). */
  shapeOf(id: WireId): WireShape | null;
  core(id: WireId): Mesh;
  sheath(id: WireId): Mesh;
}

const UP = new Vector3(0, 1, 0);
/** Indices of the two collapsed rings of the last `relay` (nothing between them). */
const breakAt: [number, number] = [-1, -1];
const HAIR = 0.002;
/**
 * `n` rings along `pts` (already even, of total `length`) with a break between the lengths `s0` and `s1`: rings
 * spread evenly up to `s0`, one collapsed ring a hair after it, one collapsed a hair before `s1`, evenly on from
 * it. A full ring and a collapsed one a hair apart give a flat cut face. `along` gets each ring's length.
 */
function relay(pts: readonly Vector3[], n: number, length: number, s0: number, s1: number, along: number[]): Vector3[] {
  const rest = n - 2;
  const k0 = Math.max(2, Math.min(rest - 2, Math.round((rest * s0) / (length - (s1 - s0)))));
  along.length = 0;
  for (let i = 0; i < k0; i++) along.push((s0 * i) / (k0 - 1));
  along.push(s0 + HAIR, s1 - HAIR);
  const k1 = rest - k0;
  for (let i = 0; i < k1; i++) along.push(s1 + ((length - s1) * i) / (k1 - 1));
  breakAt[0] = k0;
  breakAt[1] = k0 + 1;
  const step = length / (n - 1);
  return along.map((d) => {
    const f = Math.min(Math.max(d / step, 0), n - 1);
    const i = Math.min(Math.floor(f), n - 2);
    return pts[i]!.clone().lerp(pts[i + 1]!, f - i);
  });
}
/** Flat strip: 2.1 wire radii wide, a quarter of one thick. */
const STRIP: [number, number] = [WIRE.core * 2.1, WIRE.core * 0.3];
const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);

export function createWires(): Wires {
  const group = new Group();
  group.name = 'wires';
  const steel = col('steel').lerp(col('mist'), 0.35);
  const copperLow = col('orange.dark').lerp(col('wireBrown'), 0.5);
  const copperHigh = col('orange.dark').lerp(col('orange'), 0.7);
  const warm = col('orange');
  const tints = {} as Record<WireId, Color>;
  // without poles both sheaths are one soft neutral plastic with a breath of their hue left in it
  const neutral = col('mist').lerp(col('violet'), 0.25);
  let poles = -1;
  let dived = -1;
  let seat = 0;
  // the bare core's own colour at the hand-over: between the two ends of its gradient
  const HANDED = copperLow.clone().lerp(copperHigh, 0.55).multiplyScalar(0.72);
  const pieces = {} as Record<
    WireId,
    {
      core: DynTube;
      skin: DynTube;
      coreMat: KToonMaterial;
      skinMat: KToonMaterial;
      coreMesh: Mesh;
      skinMesh: Mesh;
      pts: Vector3[];
      /** Tubes with another ring count (`WireShape.rings`), made when first asked for: [rings, core, sheath]. */
      fine: [number, DynTube, DynTube] | null;
    }
  >;
  for (const id of WIRE_IDS) {
    const plus = id.startsWith('p');
    const core = new DynTube(RINGS[id], RADIAL[id]);
    const skin = new DynTube(RINGS[id], RADIAL[id]);
    const coreMat = K.metal({
      color: 'orange',
      specular: 0.22,
      shininess: 180,
      rim: 0.3,
      highlight: 0.2,
      vertexEmissive: id === 'm',
    });
    const tint = col(plus ? SEMANTIC.dcPlus : SEMANTIC.dcMinus).lerp(col('white'), 0.12);
    tints[id] = tint.clone();
    const skinMat = sheath({ color: tint, opacity: 0.56, edgeOpacity: 0.96, gloss: 0, highlight: 0.1 });
    const coreMesh = new Mesh(core.geometry, coreMat);
    coreMesh.name = `wire-${id}:core`;
    coreMesh.castShadow = coreMesh.receiveShadow = true;
    const skinMesh = new Mesh(skin.geometry, skinMat);
    skinMesh.name = `wire-${id}:sheath`;
    skinMesh.castShadow = true;
    skinMesh.renderOrder = 2;
    group.add(coreMesh, skinMesh);
    pieces[id] = { core, skin, coreMat, skinMat, coreMesh, skinMesh, pts: [], fine: null };
  }

  // the ember of the far wire's thin stretch: a per-vertex emissive, ring by ring (`thin` share of each ring)
  const cols = RADIAL.m + 1;
  const emberAttr = new BufferAttribute(new Float32Array((RINGS.m * cols + 2) * 3), 3);
  pieces.m.core.geometry.setAttribute(K_EMISSIVE_ATTRIBUTE, emberAttr);
  const thinMask = new Float32Array(RINGS.m);
  let ember = 0;
  let painted = false;
  const paintEmber = (): void => {
    if (ember <= 0 && !painted) return;
    const a = emberAttr.array as Float32Array;
    for (let i = 0; i < RINGS.m; i++) {
      const k = 1.1 * ember * thinMask[i]!;
      for (let j = 0; j < cols; j++) a.set([warm.r * k, warm.g * k, warm.b * k], (i * cols + j) * 3);
    }
    emberAttr.needsUpdate = true;
    painted = ember > 0;
  };

  const along: number[] = [];
  const setShape = (id: WireId, shape: WireShape): void => {
    const p = pieces[id];
    const n = shape.rings ?? RINGS[id];
    // the piece's own tubes, or finer ones for a shape that asks for them (kept for the next frame)
    let core = p.core;
    let skin = p.skin;
    if (n !== RINGS[id]) {
      if (p.fine?.[0] !== n) {
        p.fine?.[1].geometry.dispose();
        p.fine?.[2].geometry.dispose();
        p.fine = [n, new DynTube(n, RADIAL[id]), new DynTube(n, RADIAL[id])];
      }
      core = p.fine[1];
      skin = p.fine[2];
    }
    if (p.coreMesh.geometry !== core.geometry) p.coreMesh.geometry = core.geometry;
    if (p.skinMesh.geometry !== skin.geometry) p.skinMesh.geometry = skin.geometry;
    resample(shape.path, n, p.pts);
    const r = clamp01(shape.round);
    const w = STRIP[0] + (WIRE.core - STRIP[0]) * r;
    const h = STRIP[1] + (WIRE.core - STRIP[1]) * r;
    const up = shape.up ?? UP;
    const length = G.pathLength(p.pts);
    const step = length / (n - 1);
    // the second seat parts the far wire: its stretch between the seat's terminals is gone (core and sheath),
    // `BARE` of copper (scaled with the seat) shows on each side — measured back from the lamp's end, along the
    // far stretch the path ends with
    let cut: [number, number] | null = null;
    if (id === 'm' && seat > 1e-4) {
      const open = (SEAT.width / 2 - INSET) * seat;
      const endX = p.pts[n - 1]!.x;
      cut = [length - (endX - (SEAT.x - open)), length - (endX - (SEAT.x + open))];
    }
    const cutBare = BARE * seat;
    // or a break in the copper only: the core's rings are re-laid around it, the sheath keeps the even rings
    const gap = cut
      ? null
      : shape.gap
        ? ([
            Math.max(shape.gap.at * length - shape.gap.width / 2, 0.05),
            Math.min(shape.gap.at * length + shape.gap.width / 2, length - 0.05),
          ] as const)
        : null;
    const broken = cut ?? gap;
    const corePts = broken ? relay(p.pts, n, length, broken[0], broken[1], along) : p.pts;
    const skinPts = cut ? corePts : p.pts;
    const coreAt = (i: number): number => (broken ? along[i]! : i * step);
    const skinAt = (i: number): number => (cut ? along[i]! : i * step);
    const collapsed = (i: number): boolean => i === breakAt[0] || i === breakAt[1];
    // the snake's thin stretch: 0 … 1 over the taper before `thin.from`
    const thin = shape.thin;
    const thinAt = (d: number): number => {
      if (!thin) return 0;
      const x = clamp01((d - thin.from + TAPER) / TAPER);
      return x * x * (3 - 2 * x);
    };
    const tc = thin?.core ?? WIRE.core;
    const ts = thin?.sheath ?? WIRE.sheath;
    core.update(corePts, up, (i, out) => {
      const f = thinAt(coreAt(i));
      if (id === 'm') thinMask[i] = f;
      if (broken && collapsed(i)) {
        out[0] = out[1] = 0;
        return;
      }
      out[0] = w + (tc - w) * f;
      out[1] = h + (tc - h) * f;
    });
    if (id === 'm') paintEmber();
    // sheath: full radius where covered, tucked just under the core's surface beyond the growth front;
    // a short length at both ends (and at the seat's cut) stays bare — the stripped copper of the terminals
    const front = shape.cover * 1.08;
    const [bare0, bare1] = shape.bare ?? [BARE, BARE];
    skin.update(skinPts, up, (i, out) => {
      if (cut && collapsed(i)) {
        out[0] = out[1] = 0;
        return;
      }
      const d = skinAt(i);
      const stripped = d < bare0 || length - d < bare1 || (cut && d > cut[0] - cutBare && d < cut[1] + cutBare);
      const k = stripped ? 0 : clamp01((front - d / length) / 0.08) * r;
      const f = thinAt(d);
      const cw = (w + (tc - w) * f) * 0.96;
      const ch = (h + (tc - h) * f) * 0.96;
      const full = WIRE.sheath + (ts - WIRE.sheath) * f;
      out[0] = cw + (full - cw) * k;
      out[1] = ch + (full - ch) * k;
    });
    const c = clamp01(shape.copper);
    p.coreMat.setGradient(steel.clone().lerp(copperLow, c), steel.clone().lerp(copperHigh, c), [
      y - WIRE.core,
      y + WIRE.core,
    ]);
    if (id === 'p1') dived = -1; // the dive look is re-applied on top of a new shape
  };

  /** The shape each piece was last given (`setSeat` lays `m`'s again: the stand's, or a chapter's own). */
  const last: Record<WireId, WireShape | null> = { m: null, p1: null, p2: null };
  const lay = (id: WireId, shape: WireShape): void => {
    last[id] = shape;
    setShape(id, shape);
  };
  const layStand = (id: WireId): void =>
    lay(id, { path: standPath(id), round: 1, cover: 1, copper: 1 });

  return {
    group,
    setShape: lay,
    setStand(id) {
      for (const each of id ? [id] : WIRE_IDS) layStand(each);
    },
    setSeat(k) {
      const next = clamp01(k);
      if (next === seat) return;
      seat = next;
      if (last.m) setShape('m', last.m);
      else layStand('m');
    },
    get seat() {
      return seat;
    },
    setPoles(amount) {
      const k = clamp01(amount);
      if (k === poles) return;
      poles = k;
      for (const id of WIRE_IDS) pieces[id].skinMat.color.copy(neutral).lerp(tints[id], 0.18 + 0.82 * k);
    },
    setEmber(amount) {
      const k = clamp01(amount);
      if (k === ember) return;
      ember = k;
      paintEmber();
    },
    setDive(dive) {
      const d = clamp01(dive);
      if (d === dived) return;
      dived = d;
      const s = clamp01((d - 0.45) / 0.5);
      const e = s * s * (3 - 2 * s);
      const p = pieces.p1;
      p.skinMat.fade = 1 - e;
      // lit part down to a third, the rest is the core's own even copper (emissive, below the bloom threshold)
      const lit = 1 - 0.68 * e;
      p.coreMat.setGradient(copperLow.clone().multiplyScalar(lit), copperHigh.clone().multiplyScalar(lit), [
        y - WIRE.core,
        y + WIRE.core,
      ]);
      p.coreMat.setEmissive(HANDED, 0.68 * e);
    },
    setLensSheath(fade) {
      pieces.p1.skinMat.fade = fade;
    },
    shapeOf: (id) => last[id],
    core: (id) => pieces[id].coreMesh,
    sheath: (id) => pieces[id].skinMesh,
  };
}
