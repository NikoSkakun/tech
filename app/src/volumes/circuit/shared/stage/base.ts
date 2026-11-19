/**
 * The base of the stand (VISUAL.md §2): a thick rounded slab, 3 : 2, whose rear edge is raised so that the face
 * leans 15° toward the reader — built as one chunky wedge on four low feet. Matte `bg.violet` face (one tone
 * lighter than the table, so the lamp's light shows on it), `slate` chamfer, a thin pressed-in line along the
 * edge. No perforation, grid, screws or dials.
 *
 * `frame` is the BOARD FRAME of `layout.ts`: everything that stands on the stand is added to it.
 */
import { BufferAttribute, Color, Group, Mesh, Path, ShapeGeometry, type BufferGeometry } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from '@/kit';
import { K, col } from '@/style';
import { BOARD, SHELF_WORLD } from './layout';
import { surface } from './materials';
import { TABLE } from './room';

const FRONT = BOARD.thickness; // height of the front face
const COS = Math.cos(BOARD.tilt);
const SIN = Math.sin(BOARD.tilt);
/** World height of the board frame's origin (centre of the face). */
export const BOARD_Y = TABLE.y + BOARD.feet + FRONT + (BOARD.depth / 2) * SIN;

/** Wedge: a rounded-rectangle prism whose top is sheared into the tilted face. World coordinates. */
function wedgeGeometry(): BufferGeometry {
  const bevel = 0.07;
  const plan = G.rrectShape(BOARD.width, BOARD.depth * COS, BOARD.corner);
  const g = G.extrude(plan, 1, { bevel, bevelSeg: 4, curveSeg: 14 });
  g.rotateX(-Math.PI / 2); // thickness along y, −0.5 … 0.5
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const low = col('bg.indigo').lerp(col('bg.deep'), 0.35);
  const high = col('bg.violet').lerp(col('bg.indigo'), 0.35);
  const chamfer = col('slate').lerp(col('bg.violet'), 0.25);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const s = pos.getY(i) + 0.5; // 0 bottom … 1 top
    const top = BOARD_Y - pos.getZ(i) * (SIN / COS); // height of the face above this plan point
    const bottom = TABLE.y + BOARD.feet;
    // the bevel bands (s within `bevel` of 0 or 1) keep their absolute size instead of stretching with the wedge
    const y =
      s > 1 - bevel
        ? top - (1 - s)
        : s < bevel
          ? bottom + s
          : bottom + bevel + ((s - bevel) / (1 - 2 * bevel)) * (top - bottom - 2 * bevel);
    pos.setY(i, y);
    if (s > 1 - bevel * 1.01) c.copy(chamfer);
    else c.copy(low).lerp(high, Math.min(Math.max((y - bottom) / FRONT, 0), 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  return toCreasedNormals(g, 0.95);
}

/**
 * DEV (owner 2026-11-19: «додай dev перемикач, щоб прибрати візуальну лінію по всьому периметру стенду»): the
 * pressed-in line along the edge can be hidden for the whole session — every base built now or later follows
 * (`setEdgeLine`, the switch on `prologue/click`). On by default.
 */
let edgeLineOn = true;
const edgeLines = new Set<WeakRef<Mesh>>();
export function setEdgeLine(on: boolean): void {
  edgeLineOn = on;
  for (const ref of edgeLines) {
    const line = ref.deref();
    if (line) line.visible = on;
    else edgeLines.delete(ref);
  }
}
export const edgeLineShown = (): boolean => edgeLineOn;

export interface Base {
  /** World-space group: wedge and feet. */
  group: Group;
  /** The board frame (tilted): add the stand's parts here. */
  frame: Group;
  face: Mesh;
}

export function createBase(): Base {
  const group = new Group();
  group.name = 'base';
  const faceMaterial = surface({
    color: 'bg.violet',
    scatter: 0.2,
    scatterTint: col('amber').lerp(col('yellow.light'), 0.45),
    shoulder: 0.16,
  });
  const body = K.toon({ color: 'white', vertexColors: true, rim: 0.5, highlight: 0.25 });
  const wedge = new Mesh(wedgeGeometry(), [faceMaterial, body]);
  wedge.name = 'board';
  wedge.castShadow = true;
  wedge.receiveShadow = true;
  group.add(wedge);

  const foot = G.cyl(0.3, BOARD.feet + 0.06, { seg: 28, bevel: 0.04 });
  const footMaterial = K.toon({ color: 'ink', rim: 0.4 });
  const fx = BOARD.width / 2 - 0.62;
  const fz = (BOARD.depth * COS) / 2 - 0.55;
  for (const [x, z] of [
    [-fx, fz],
    [fx, fz],
    [-fx, -fz],
    [fx, -fz],
  ] as const) {
    const m = new Mesh(foot, footMaterial);
    m.position.set(x, TABLE.y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // shelf behind the rear edge (level): a ledge with a low back rail, on two brackets from the wedge's back
  const shelfMaterial = K.toon({ color: col('bg.indigo').lerp(col('slate'), 0.3), rim: 0.4, highlight: 0.2 });
  const ledge = new Mesh(G.rbox(SHELF_WORLD.width, 0.14, SHELF_WORLD.depth, 0.06, 2), shelfMaterial);
  ledge.position.set(0, SHELF_WORLD.y - 0.07, SHELF_WORLD.z);
  const rail = new Mesh(G.rbox(SHELF_WORLD.width, 0.2, 0.1, 0.045, 2), shelfMaterial);
  rail.position.set(0, SHELF_WORLD.y + 0.08, SHELF_WORLD.z - SHELF_WORLD.depth / 2 + 0.05);
  for (const m of [ledge, rail]) {
    m.castShadow = m.receiveShadow = true;
    m.name = 'shelf';
    group.add(m);
  }

  const frame = new Group();
  frame.name = 'board-frame';
  frame.position.set(0, BOARD_Y, 0);
  frame.rotation.x = BOARD.tilt;
  group.add(frame);

  // pressed-in line along the edge: a hair-thin darker band a little inside the chamfer
  const inset = 0.19;
  const outer = G.rrectShape(BOARD.width - 2 * inset, BOARD.depth - 2 * inset, BOARD.corner - inset * 0.6);
  const w = 0.028;
  const hole = G.rrectShape(
    BOARD.width - 2 * inset - 2 * w,
    BOARD.depth - 2 * inset - 2 * w,
    BOARD.corner - inset * 0.6 - w,
  );
  outer.holes.push(new Path(hole.getPoints(14)));
  const line = new Mesh(new ShapeGeometry(outer, 14), surface({ color: 'bg.indigo', scatter: 0.02 }));
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.0025;
  line.receiveShadow = true;
  line.name = 'edge-line';
  line.visible = edgeLineOn;
  edgeLines.add(new WeakRef(line));
  frame.add(line);
  return { group, frame, face: wedge };
}
