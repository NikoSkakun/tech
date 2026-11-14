/**
 * The year carpet of step 8: 365 day tiles laid out as a wall calendar — twelve month blocks (columns of 7 days)
 * in 3 × 4 (it fits the tall free area between the board and the panel), so the year reads as a picture instead of a thin 53-week strip — on a floating slab; each tile glows `yellow`
 * in proportion to the plant's output that day (`dayTiles`, plants sim M5). One instanced draw call; `set(values)`
 * eases the tiles to new values, `reveal` (0…1) lights them day by day (the «year» run).
 */
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4 } from 'three';
import { Builder } from '@/kit';
import { K, col } from '@/style';

export const TILE = 1.5;
const MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Month block: 5 columns of 7 days, a 2 m gap between blocks; 3 × 4 blocks. */
const BLOCK_W = 5 * TILE + 2;
const BLOCK_D = 7 * TILE + 2;

export interface DayTiles {
  group: Group;
  mesh: InstancedMesh;
  /** Target values 0…1 per day. */
  set(values: readonly number[]): void;
  /** Share of the year already lit (0…1). */
  reveal: number;
  update(dt: number): void;
  width: number;
  depth: number;
}

export function createDayTiles(): DayTiles {
  const group = new Group();
  group.name = 'day-tiles';
  const width = 3 * BLOCK_W;
  const b = new Builder('tile-slab');
  b.box(width + 2, 0.8, 4 * BLOCK_D + 2, { r: 0.5, at: [0, -0.8, 0], c: ['ink', 'slate'], slot: 'gloss' });
  group.add(b.build().group);
  const mat = K.glow({ color: 'white', intensity: 1.25, whiten: 0, keepHue: true });
  const mesh = new InstancedMesh(new BoxGeometry(TILE * 0.82, 0.3, TILE * 0.82), mat, 365);
  const m = new Matrix4();
  let d = 0;
  MONTHS.forEach((len, mo) => {
    const bx = ((mo % 3) - 1) * BLOCK_W;
    const bz = (Math.floor(mo / 3) - 1.5) * BLOCK_D;
    for (let i = 0; i < len; i++, d++) {
      m.makeTranslation(bx + (Math.floor(i / 7) - 2) * TILE, 0.1, bz + ((i % 7) - 3) * TILE);
      mesh.setMatrixAt(d, m);
    }
  });
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
    depth: 4 * BLOCK_D,
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
