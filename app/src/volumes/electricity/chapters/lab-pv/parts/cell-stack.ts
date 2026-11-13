/**
 * The cut half-cell of step 3: six layer slots (metal grid › coating › textured front layer › silicon base ›
 * rear layer › rear contact) as separate slabs that slide apart, re-coloured and re-shaped per technology.
 * `setTech` and `setExplode` are pure functions of their arguments; colours and thicknesses ease in `update`.
 * Units: stage units — a 182 × 91 mm half-cell drawn 3.6 × 1.8 with strongly exaggerated thickness.
 */
import { BoxGeometry, type Color, ConeGeometry, Group, InstancedMesh, Matrix4, Mesh, type Object3D } from 'three';
import { damp } from '@/engine/api';
import { G } from '@/kit';
import { K, col, type KToonMaterial } from '@/style';
import type { CellTech, LayerSlot } from '../data/cell-tech';

export const CELL = { w: 3.6, d: 1.8 } as const;
const SLOTS: readonly LayerSlot[] = ['grid', 'arc', 'front', 'base', 'back', 'rear'];
const THICK: Record<LayerSlot, number> = { grid: 0.05, arc: 0.035, front: 0.1, base: 0.42, back: 0.07, rear: 0.06 };
const GAP = 0.44;

export interface CellStack {
  group: Group;
  /** One anchor per slot at the right-hand edge of its slab (callouts). */
  anchors: Record<LayerSlot, Object3D>;
  /** Is the slot present in the current technology? */
  has(slot: LayerSlot): boolean;
  setTech(tech: CellTech): void;
  /** 0 = laminated … 1 = fully apart. */
  setExplode(amount: number): void;
  update(dt: number): void;
}

export function createCellStack(): CellStack {
  const group = new Group();
  group.name = 'cell-stack';
  const slab = (): Mesh<BoxGeometry, KToonMaterial> => {
    const m = new Mesh(new BoxGeometry(CELL.w, 1, CELL.d), K.toon({ color: 'mist', gloss: 0.25, rim: 0.6 }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const slabs = Object.fromEntries(SLOTS.map((s) => [s, slab()])) as Record<LayerSlot, Mesh<BoxGeometry, KToonMaterial>>;
  slabs.grid.visible = slabs.rear.visible = false; // drawn as fingers / sheet meshes below
  // front fingers (along Z) and busbars (along X); rear fingers; rear full sheet = the slab itself
  const fingers = (n: number, bars: number, y: number): Mesh => {
    const q: [number, number, number, number][] = [];
    for (let i = 0; i < n; i++) q.push([(i / (n - 1) - 0.5) * (CELL.w - 0.1), 0, 0.022, CELL.d - 0.06]);
    for (let j = 0; j < bars; j++) q.push([0, ((j + 0.5) / bars - 0.5) * CELL.d, CELL.w - 0.04, 0.06]);
    const m = new Mesh(G.quads(q, y), K.metal({ color: 'mist', specular: 0.9 }));
    m.material.side = 2;
    return m;
  };
  const gridMesh = fingers(40, 4, 0);
  const rearMesh = fingers(40, 4, 0);
  // interdigitated stripes of back-contact cells: alternating bars, the pink ones are the slab's own colour
  const stripes = new Mesh(G.quads(Array.from({ length: 9 }, (_, i) => [((i + 0.5) / 9 - 0.5) * CELL.w, 0, CELL.w / 18, CELL.d] as [number, number, number, number]), 0), K.toon({ color: 'teal' }));
  stripes.material.side = 2;
  // texture: pyramids on the front layer (same material → they re-colour with it)
  const pyramids = new InstancedMesh(new ConeGeometry(0.115, 0.13, 4, 1).rotateY(Math.PI / 4), slabs.front.material, 24 * 12);
  const m4 = new Matrix4();
  for (let i = 0; i < 24; i++) for (let j = 0; j < 12; j++) pyramids.setMatrixAt(i * 12 + j, m4.makeTranslation((i - 11.5) * 0.15, 0.065, (j - 5.5) * 0.15));
  slabs.front.add(pyramids);
  const anchors = Object.fromEntries(
    SLOTS.map((s) => {
      const a = new Group();
      a.position.set(CELL.w / 2, 0, 0.3);
      group.add(a);
      return [s, a];
    }),
  ) as unknown as Record<LayerSlot, Object3D>;
  group.add(...SLOTS.map((s) => slabs[s]), gridMesh, rearMesh, stripes);

  let tech: CellTech | null = null;
  let explode = 0;
  const target = Object.fromEntries(SLOTS.map((s) => [s, { h: THICK[s], color: col('mist') as Color }])) as Record<LayerSlot, { h: number; color: Color }>;
  const height = Object.fromEntries(SLOTS.map((s) => [s, THICK[s]])) as Record<LayerSlot, number>;

  const layout = (): void => {
    // stack from the bottom up; absent slots collapse to nothing
    let y = 0;
    for (const s of [...SLOTS].reverse()) {
      const h = Math.max(0.0001, height[s]);
      const present = height[s] > 0.004;
      const mid = y + h / 2;
      slabs[s].scale.y = h;
      slabs[s].position.y = mid;
      anchors[s].position.y = mid;
      if (s === 'grid') gridMesh.position.y = mid;
      if (s === 'rear') rearMesh.position.y = mid;
      if (s === 'back') stripes.position.y = y - 0.002;
      y += h + (present ? GAP * explode : 0);
    }
    // the pyramids are children of the (y-scaled) front slab: undo its scale and sit on its top face
    pyramids.scale.y = 1 / Math.max(0.0001, height.front);
    pyramids.position.y = 0.5;
    pyramids.visible = height.front > 0.02;
  };

  return {
    group,
    anchors,
    has: (slot) => Boolean(tech?.layers[slot]),
    setTech(next) {
      tech = next;
      for (const s of SLOTS) {
        const layer = next.layers[s];
        target[s].h = layer ? THICK[s] : 0;
        if (layer) target[s].color = col(layer.color);
      }
      slabs.rear.visible = next.fullRear;
      rearMesh.visible = !next.fullRear;
      gridMesh.visible = Boolean(next.layers.grid);
      stripes.visible = Boolean(next.stripes);
    },
    setExplode(amount) {
      explode = amount;
    },
    update(dt) {
      for (const s of SLOTS) {
        height[s] = damp(height[s], target[s].h, 7, dt);
        slabs[s].material.color.lerp(target[s].color, Math.min(1, dt * 7));
      }
      layout();
    },
  };
}
