/**
 * The 12-module array of step 9 on the south slope (2 rows × 6, portrait — the layout of the kit house):
 * instanced kit modules, one coloured frame per module (string A `teal`, string B `violet`, unassigned
 * `slate`), the series wiring of both strings as painted lines, and a pick proxy that reports the module under
 * the pointer. Lives in the slope frame of `roof-world.ts` (metres; +Y = outward normal, +Z = downhill).
 */
import { Color, Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry, Vector3 } from 'three';
import { RibbonLines } from '@/fx';
import { Builder, PV_MODULE, instanced, pvModule } from '@/kit';
import { K, col } from '@/style';

export const ARRAY = { cols: 6, rows: 2, count: 12 } as const;
const MW = PV_MODULE.width + 0.02;
const ML = PV_MODULE.length + 0.02;
const LIFT = 0.16;
/** String of a module: 0 = A, 1 = B, −1 = not connected. */
export type Assignment = -1 | 0 | 1;
const STRING_COLORS = ['teal', 'violet'] as const;

export interface RoofArray {
  group: Group;
  /** Pick proxy over the whole array. */
  proxy: Mesh;
  /** Centre of module `i` in the array's frame (i = row × 6 + column; row 0 is the upper one). */
  centre(i: number, out?: Vector3): Vector3;
  /** Module under a point of the array's frame, or −1. */
  moduleAt(local: Vector3): number;
  /** Re-colour the frames and re-draw the wiring. */
  setStrings(assign: readonly Assignment[]): void;
}

export function createRoofArray(): RoofArray {
  const group = new Group();
  group.name = 'roof-array';
  const centre = (i: number, out = new Vector3()): Vector3 =>
    out.set(((i % ARRAY.cols) + 0.5) * MW - (ARRAY.cols * MW) / 2, LIFT, (Math.floor(i / ARRAY.cols) + 0.5) * ML - (ARRAY.rows * ML) / 2);
  const places = Array.from({ length: ARRAY.count }, (_, i) => {
    const c = centre(i);
    return { at: [c.x, c.y, c.z] as [number, number, number] };
  });
  const modules = instanced(pvModule({ detail: 'mid' }), places);
  modules.traverse((o) => (o.castShadow = o.receiveShadow = true));
  // mounting rails under both rows
  const rails = new Builder('array-rails');
  for (let j = 0; j < ARRAY.rows; j++) for (const k of [-0.28, 0.28]) rails.box(ARRAY.cols * MW + 0.1, 0.05, 0.05, { r: 0, slot: 'metal', c: 'steel.light', at: [0, 0.05, (j + 0.5 + k) * ML - (ARRAY.rows * ML) / 2] });
  // one outline per module, coloured by its string
  const ring = new Builder('module-ring');
  for (const s of [-1, 1]) {
    ring.box(0.05, 0.03, ML - 0.03, { r: 0, c: 'white', at: [(s * (MW - 0.05)) / 2, 0, 0] });
    ring.box(MW - 0.03, 0.03, 0.05, { r: 0, c: 'white', at: [0, 0, (s * (ML - 0.05)) / 2] });
  }
  const frames = new InstancedMesh(ring.geometry('toon'), K.toon({ color: 'white', emissive: 'white', emissiveIntensity: 0.25 }), ARRAY.count);
  const m = new Matrix4();
  const c = new Color();
  const v = new Vector3();
  for (let i = 0; i < ARRAY.count; i++) {
    frames.setMatrixAt(i, m.makeTranslation(...centre(i, v).setY(LIFT + 0.012).toArray()));
    frames.setColorAt(i, col('slate'));
  }
  const wires = STRING_COLORS.map((color) => {
    const line = new RibbonLines({ capacity: 64, color, width: 0.07, intensity: 1.2, dashStrength: 0.5, dashRepeat: 1.2, dashSpeed: 0.8, blend: 'normal' });
    group.add(line);
    return line;
  });
  const proxy = new Mesh(new PlaneGeometry(ARRAY.cols * MW, ARRAY.rows * ML).rotateX(-Math.PI / 2), K.flat('cyan'));
  proxy.material.colorWrite = false;
  proxy.material.depthWrite = false;
  proxy.position.y = LIFT + 0.03;
  group.add(modules, rails.build().group, frames, proxy);

  return {
    group,
    proxy,
    centre,
    moduleAt(local) {
      const i = Math.floor((local.x + (ARRAY.cols * MW) / 2) / MW);
      const j = Math.floor((local.z + (ARRAY.rows * ML) / 2) / ML);
      return i < 0 || i >= ARRAY.cols || j < 0 || j >= ARRAY.rows ? -1 : j * ARRAY.cols + i;
    },
    setStrings(assign) {
      for (let i = 0; i < ARRAY.count; i++) {
        const a = assign[i] ?? -1;
        frames.setColorAt(i, c.copy(col(a === 0 ? STRING_COLORS[0] : a === 1 ? STRING_COLORS[1] : 'slate')));
      }
      if (frames.instanceColor) frames.instanceColor.needsUpdate = true;
      STRING_COLORS.forEach((_, s) => {
        // series wiring: through the module centres in reading order, then off the eastern edge to the DC box
        const pts = assign.flatMap((a, i) => (a === s ? [centre(i, new Vector3()).setY(LIFT + 0.06)] : []));
        if (pts.length) pts.push(new Vector3((ARRAY.cols * MW) / 2 + 0.5, LIFT + 0.06, pts[pts.length - 1]!.z + (s ? 0.25 : -0.25)));
        wires[s]!.setLines(pts.length > 1 ? [{ points: pts }] : []);
      });
    },
  };
}
