/**
 * The year carpet of step 8: 365 day tiles (52 weeks × 7 days + 1) on a floating slab; each tile glows `yellow`
 * in proportion to the plant's output that day (`dayTiles`, plants sim M5). One instanced draw call; `set(values)`
 * eases the tiles to new values, `reveal` (0…1) lights them day by day (the «year» run).
 */
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4 } from 'three';
import { Builder } from '@/kit';
import { K, col } from '@/style';

export const TILE = 1.5;
const COLS = 53;

export interface DayTiles {
  group: Group;
  mesh: InstancedMesh;
  /** Target values 0…1 per day. */
  set(values: readonly number[]): void;
  /** Share of the year already lit (0…1). */
  reveal: number;
  update(dt: number): void;
  width: number;
}

export function createDayTiles(): DayTiles {
  const group = new Group();
  group.name = 'day-tiles';
  const width = COLS * TILE;
  const b = new Builder('tile-slab');
  b.box(width + 3, 0.8, 7 * TILE + 3, { r: 0.4, at: [0, -0.8, 0], c: ['ink', 'slate'], slot: 'gloss' });
  group.add(b.build().group);
  const mat = K.glow({ color: 'white', intensity: 1.25, whiten: 0, keepHue: true });
  const mesh = new InstancedMesh(new BoxGeometry(TILE * 0.82, 0.3, TILE * 0.82), mat, 365);
  const m = new Matrix4();
  for (let d = 0; d < 365; d++) {
    const c = Math.floor(d / 7);
    const r = d % 7;
    m.makeTranslation((c - (COLS - 1) / 2) * TILE, 0.1, (r - 3) * TILE);
    mesh.setMatrixAt(d, m);
  }
  group.add(mesh);
  const off = col('slate').multiplyScalar(0.6);
  const on = col('yellow');
  const tmp = new Color();
  const target = new Float32Array(365);
  const shown = new Float32Array(365);
  const tiles: DayTiles = {
    group,
    mesh,
    reveal: 1,
    width,
    set(values) {
      for (let d = 0; d < 365; d++) target[d] = values[d] ?? 0;
    },
    update(dt) {
      const k = Math.min(1, dt * 6);
      for (let d = 0; d < 365; d++) {
        const lit = d / 365 < tiles.reveal ? target[d]! : 0;
        shown[d] = shown[d]! + (lit - shown[d]!) * k;
        mesh.setColorAt(d, tmp.copy(off).lerp(on, shown[d]!));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
  return tiles;
}
