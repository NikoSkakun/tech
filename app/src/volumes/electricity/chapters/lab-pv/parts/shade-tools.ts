/**
 * Shadow silhouettes of step 7 (leaf, chimney stripe, snow patch, bird) and the mapping between the
 * simulation's module millimetres (`halfCellRectMm`: cells tile 1134 × 1722 mm, x right, y down) and the hero
 * module's frame (metres, with its frame margin and centre gap). The polygons given to `shadeFromShapes` and
 * the meshes drawn over the glass come from the same outline, so the picture is the model's input.
 */
import { Group, Mesh, Shape, ShapeGeometry, type Material, Vector3 } from 'three';
import { HALF_CELL_COLS, HALF_CELL_ROWS, MODULE_SIZE_MM, type ShadowShape } from '@electricity/sim/lab-pv';
import { K } from '@/style';
import { M, columnX } from './lm440-layout';

const CELL_W = MODULE_SIZE_MM.width / HALF_CELL_COLS;
const CELL_H = MODULE_SIZE_MM.height / HALF_CELL_ROWS;
const HALF = HALF_CELL_ROWS / 2;

/** Simulation millimetres → module frame (x, z), metres. */
export function mmToLocal(xMm: number, yMm: number, out = new Vector3(), y = 0.012): Vector3 {
  const r = yMm / CELL_H;
  return out.set(columnX(0) + (xMm / CELL_W - 0.5) * M.cw, y, r < HALF ? -M.gap - (HALF - r) * M.ch : M.gap + (r - HALF) * M.ch);
}

/** Module frame (x, z) → simulation millimetres [x, y]. */
export function localToMm(x: number, z: number): [number, number] {
  const r = z < 0 ? HALF - (-z - M.gap) / M.ch : HALF + (z - M.gap) / M.ch;
  return [((x - columnX(0)) / M.cw + 0.5) * CELL_W, r * CELL_H];
}

export type ShadeKind = 'leaf' | 'stripe' | 'snow' | 'bird';

type Pt = readonly [number, number];
const ellipse = (a: number, b: number, turn: number, n = 18): Pt[] =>
  Array.from({ length: n }, (_, k) => {
    const t = (k / n) * Math.PI * 2;
    const x = Math.cos(t) * a * (1 - 0.25 * Math.cos(t)); // pointed at one end, like a leaf
    const y = Math.sin(t) * b;
    return [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)] as const;
  });
const rect = (w: number, h: number, turn = 0): Pt[] =>
  ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as const).map(([x, y]) => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)] as const);

/** Outline (mm, relative to the centre), opacity and start position of every silhouette (document, step 7). */
export const SHADES: Record<ShadeKind, { outline: Pt[]; opacity: number; start: Pt; snap?: boolean; axis?: 'y' }> = {
  // ≈ 1.5 half-cells of area, fully opaque
  leaf: { outline: ellipse(150, 62, 0.5), opacity: 1, start: [CELL_W * 4.6, CELL_H * 4.4] },
  // a diagonal band, 0.7 opaque
  stripe: { outline: rect(1500, 150, -0.62), opacity: 0.7, start: [CELL_W * 3, CELL_H * 9] },
  // the bottom rows under snow
  snow: { outline: rect(MODULE_SIZE_MM.width + 40, CELL_H * 2.4), opacity: 1, start: [MODULE_SIZE_MM.width / 2, MODULE_SIZE_MM.height - CELL_H * 1.1], axis: 'y' },
  // exactly one half-cell (the bird hops from cell to cell)
  bird: { outline: rect(CELL_W, CELL_H), opacity: 1, start: [CELL_W * 1.5, CELL_H * 12.5], snap: true },
};

export interface Silhouette {
  kind: ShadeKind;
  mesh: Mesh;
  /** Centre in simulation millimetres. */
  at: [number, number];
  /** Move the centre (clamped to the module, snapped for the bird) and re-place the mesh. */
  moveTo(xMm: number, yMm: number): void;
  /** The polygon for `shadeFromShapes`. */
  shape(): ShadowShape;
}

const LOOK: Record<ShadeKind, () => Material> = {
  leaf: () => K.toon({ color: 'green.dark', rim: 0.6 }),
  stripe: () => K.glass({ color: 'ink', opacity: 0.6, edgeOpacity: 0.7 }),
  snow: () => K.toon({ color: 'white', highlight: 0.2 }),
  bird: () => K.toon({ color: 'ink', rim: 1.2 }),
};

/** The four silhouettes as children of one group in the module frame (add it to the module's group). */
export function createSilhouettes(): { group: Group; items: Record<ShadeKind, Silhouette> } {
  const group = new Group();
  group.name = 'silhouettes';
  const sx = M.cw / CELL_W;
  const sz = M.ch / CELL_H;
  const make = (kind: ShadeKind, order: number): Silhouette => {
    const def = SHADES[kind];
    // the drawn bird is a little body, not the full cell rectangle the model uses
    const drawn = kind === 'bird' ? [...ellipse(62, 34, 0, 14)] : def.outline;
    const shape = new Shape();
    drawn.forEach(([x, y], i) => (i ? shape.lineTo(x * sx, -y * sz) : shape.moveTo(x * sx, -y * sz)));
    const mesh = new Mesh(new ShapeGeometry(shape, 6).rotateX(-Math.PI / 2), LOOK[kind]());
    mesh.renderOrder = 3 + order;
    mesh.visible = false;
    group.add(mesh);
    const s: Silhouette = {
      kind,
      mesh,
      at: [def.start[0], def.start[1]],
      moveTo(xMm, yMm) {
        let x = def.axis === 'y' ? def.start[0] : Math.min(MODULE_SIZE_MM.width, Math.max(0, xMm));
        let y = Math.min(MODULE_SIZE_MM.height, Math.max(0, yMm));
        if (def.snap) {
          x = (Math.min(HALF_CELL_COLS - 1, Math.floor(x / CELL_W)) + 0.5) * CELL_W;
          y = (Math.min(HALF_CELL_ROWS - 1, Math.floor(y / CELL_H)) + 0.5) * CELL_H;
        }
        s.at = [x, y];
        mmToLocal(x, y, mesh.position, 0.014 + order * 0.004);
      },
      shape: () => ({ polygon: def.outline.map(([x, y]) => [x + s.at[0], y + s.at[1]] as const), opacity: def.opacity }),
    };
    s.moveTo(def.start[0], def.start[1]);
    return s;
  };
  return { group, items: { leaf: make('leaf', 0), stripe: make('stripe', 1), snow: make('snow', 2), bird: make('bird', 3) } };
}
