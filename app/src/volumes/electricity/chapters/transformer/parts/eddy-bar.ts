/**
 * Step 6 props (world units). `createEddyBar`: a steel bar seen end-on — either one solid block or a pack of
 * insulated sheets (count from the sheet thickness, drawn thicker than real: «не в масштабі») — with the eddy-current
 * loops in its end face (`cyan` ribbons whose dashes circulate; one big loop per sheet, nested loops in a solid
 * block) and `magenta` flux running along the bar, back and forth. `createWindingSlice`: a cut through a disc
 * winding (rectangular copper conductors in discs on pressboard spacers) whose copper glows with I²R heat.
 */
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ChapterContext } from '@/engine/api';
import { RibbonLines, createFlow, type Flow } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { K, col, type KToonMaterial } from '@/style';
import { COPPER } from '../world';

export const BAR = { w: 1.4, h: 1.15, len: 1.8 } as const;

/** Drawn sheet thickness (units) for a real thickness d (mm): 0,25 mm → 36 sheets, 1 mm → 12, 3 mm → 4. */
export const drawnSheet = (dMm: number): number => 0.03 + (dMm - 0.2) * 0.11;

export interface EddyBar {
  group: Group;
  steel: KToonMaterial;
  loops: RibbonLines;
  flux: Flow;
  /** Rebuild for a sheet thickness (mm) or a solid block. */
  set(dMm: number, solid: boolean): void;
  /** Number of sheets drawn (1 = solid). */
  readonly sheets: number;
}

export function createEddyBar(ctx: ChapterContext): EddyBar {
  const group = new Group();
  const steel = K.metal({ color: 'steel', specular: 0.6, vertexColors: true });
  const block = new Mesh<BufferGeometry, typeof steel>(new BufferGeometry(), steel);
  block.castShadow = block.receiveShadow = true;
  block.position.y = BAR.h / 2;
  const loops = new RibbonLines({ capacity: 6000, color: 'cyan', width: 0.035, dashStrength: 0.8 });
  loops.position.set(0, BAR.h / 2, BAR.len / 2 + 0.015);
  const lanes = [-0.35, -0.12, 0.12, 0.35].map((x) => [new Vector3(x * BAR.w, BAR.h + 0.05, -BAR.len / 2), new Vector3(x * BAR.w, BAR.h + 0.05, BAR.len / 2)]);
  const flux = createFlow(ctx, { kind: 'pulse', color: 'magenta', paths: lanes.map((path) => ({ path, closed: false })), count: 36, radius: 0.04, speed: 0, name: 'bar-flux' });
  group.add(block, loops, flux);
  let sheets = 0;
  const A = col('steel');
  const B = col('slate').lerp(col('steel'), 0.35);
  const bar: EddyBar = {
    group,
    steel,
    loops,
    flux,
    get sheets() {
      return sheets;
    },
    set(dMm, solid) {
      const t = solid ? BAR.w : drawnSheet(dMm);
      const n = solid ? 1 : Math.max(2, Math.round(BAR.w / t));
      if (n === sheets) return;
      sheets = n;
      const pitch = BAR.w / n;
      const gap = solid ? 0 : Math.min(0.012, pitch * 0.18);
      const parts = Array.from({ length: n }, (_, i) => {
        const g = new BoxGeometry(pitch - gap, BAR.h, BAR.len).toNonIndexed();
        g.translate(-BAR.w / 2 + pitch * (i + 0.5), 0, 0);
        const c = i % 2 ? B : A;
        const colors: number[] = [];
        for (let k = 0; k < g.attributes.position!.count; k++) colors.push(c.r, c.g, c.b);
        g.setAttribute('color', new Float32BufferAttribute(colors, 3));
        return g;
      });
      block.geometry.dispose();
      block.geometry = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      // eddy loops: one per sheet (a laminated core), nested rings in a solid block
      const lines: { points: Vector3[]; closed: boolean }[] = [];
      const ring = (hw: number, hh: number, cx: number): Vector3[] => {
        const pts: Vector3[] = [];
        const r = Math.min(hw, hh) * 0.5;
        for (let k = 0; k < 40; k++) {
          const a = (k / 40) * Math.PI * 2;
          const sx = Math.sign(Math.cos(a)) * Math.max(0, hw - r) + Math.cos(a) * r;
          const sy = Math.sign(Math.sin(a)) * Math.max(0, hh - r) + Math.sin(a) * r;
          pts.push(new Vector3(cx + sx, sy, 0));
        }
        return pts;
      };
      if (solid) for (const k of [0.85, 0.6, 0.35]) lines.push({ points: ring((BAR.w / 2) * k, (BAR.h / 2) * k, 0), closed: true });
      else for (let i = 0; i < n; i++) lines.push({ points: ring(Math.max(0.006, pitch / 2 - gap - 0.012), BAR.h / 2 - 0.07, -BAR.w / 2 + pitch * (i + 0.5)), closed: true });
      loops.width = solid ? 0.04 : Math.min(0.03, pitch * 0.22);
      loops.setLines(lines);
    },
  };
  return bar;
}

/** A slice through a disc winding: 6 discs × 5 conductors on pressboard spacers; `copper` takes the heat glow. */
export function createWindingSlice(): { model: KitModel; copper: KToonMaterial } {
  const b = new Builder('winding-slice');
  b.box(1.5, 0.12, 1.1, { r: 0.04, slot: 'toon', c: 'mist', at: [0, 0, 0] });
  for (let d = 0; d < 6; d++) {
    const y = 0.16 + d * 0.36;
    for (let k = 0; k < 5; k++) b.box(0.22, 0.26, 1.0, { r: 0.04, slot: 'metal', c: COPPER, at: [-0.5 + k * 0.25, y, 0] });
    b.box(1.45, 0.06, 0.25, { r: 0.02, slot: 'toon', c: 'mist', at: [0, y + 0.28, 0.35] });
    b.box(1.45, 0.06, 0.25, { r: 0.02, slot: 'toon', c: 'mist', at: [0, y + 0.28, -0.35] });
  }
  b.anchor('top', 0, 2.45, 0);
  const model = b.build();
  return { model, copper: model.mats.get('metal') as KToonMaterial };
}

