/**
 * The «powers of ten» exhibit of step 5. The fuel is modelled at real size (`fuel-models.ts`); one number, the
 * level L, stages it: 0 = one pellet beside a coin, 1 = the fuel rod, 2 = the assembly, 3 = the core, 3,6 = the
 * core beside a year of fuel and a coal wagon. The exhibit group is scaled so the subject of the level always
 * fills the same frame (log interpolation of the frame size) and centred on it — the camera never moves —
 * while the parts gather on cue: pellets stack up around the hero pellet, the other rods drop into the
 * assembly, the other assemblies drop into the core. `tilt` turns the core to a top view (the core map).
 */
import { Color, ConeGeometry, CylinderGeometry, Group, Matrix4, Mesh, Vector3, type InstancedMesh } from 'three';
import { K, col } from '@/style';
import { Builder } from '@/kit';
import { CORE, FA, PELLET, ROD, buildFuelModels, type FuelModels } from './fuel-models';

/** Display size (set units) of the level's subject. */
const DISPLAY = 15;
const smooth = (a: number, b: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/** Real size (m) framed at level L. */
export function frameSize(L: number): number {
  if (L <= 1) return 0.024 * Math.pow(0.06 / 0.024, L);
  if (L <= 2) return 0.06 * Math.pow(1.0 / 0.06, L - 1);
  if (L <= 3) return 1.0 * Math.pow(4.9 / 1.0, L - 2);
  return 4.9 * Math.pow(20 / 4.9, Math.min(1, (L - 3) / 0.6));
}

export type Age = 0 | 1 | 2;
export const AGE_COLORS = ['violet.light', 'violet', 'violet.dark'] as const;

export interface FuelZoom {
  group: Group;
  models: FuelModels;
  /** Current (eased) level and tilt; write the targets. */
  level: number;
  tilt: number;
  /** Ages of the 163 assemblies (index = core lattice position; 0 = the hero/central one). */
  ages: Age[];
  /** 0…1 progress of the reload animation (< 0 = idle). */
  reload: number;
  /** Set-local positions of things (live). */
  at: { pellet: Vector3; plenum: Vector3; grid: Vector3; guides: Vector3; core: Vector3; heap: Vector3; wagon: Vector3 };
  /** Coal comparison (heap at rod level, wagon + year of uranium at core level), 0…1. */
  compare: number;
  update(dt: number): void;
}

export function buildFuelZoom(seed: () => number): FuelZoom {
  const models = buildFuelModels();
  const real = new Group(); // real metres
  const exhibit = new Group(); // scaled + centred
  exhibit.add(real);
  const group = new Group();
  group.add(exhibit);
  real.add(models.pellets, models.heroRod, models.rods, models.guides, models.frame, models.assemblies);
  const hs = models.rodSpots[models.hero]!;
  const n = models.pellets.count;
  const heroIdx = n - 12; // near the top of the column, under the plenum
  const pelletPos = new Vector3(hs.x, 0.04 + heroIdx * PELLET.h + PELLET.h / 2, hs.z);
  // pellets drawn nearest-first, so `count` reveals the column from the hero pellet outward
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - heroIdx) - Math.abs(b - heroIdx));
  const m = new Matrix4();
  order.forEach((src, i) => models.pellets.setMatrixAt(i, m.makeTranslation(hs.x, 0.04 + src * PELLET.h, hs.z)));
  models.pellets.instanceMatrix.needsUpdate = true;
  // coin for scale (26 mm, like a 1-hryvnia coin) beside the pellet
  const coin = new Mesh(new CylinderGeometry(0.013, 0.013, 0.0018, 48), K.metal({ color: 'amber' }));
  coin.position.copy(pelletPos).add(new Vector3(-0.019, -PELLET.h / 2 - 0.0009, -0.004));
  real.add(coin);
  // comparison props: a 0,7 m³ coal heap (r = 1 m, h = 0,67 m) and, at core level, a year of uranium + a wagon
  const heap = new Mesh(new ConeGeometry(1, 0.67, 40, 4), K.toon({ color: 'ink', highlight: 0.3 }));
  const heapAt = new Vector3(1.6, 0.335, 1.2);
  heap.position.copy(heapAt);
  const uranium = new Mesh(new CylinderGeometry(0.85, 0.85, 1.2, 6), K.toon({ color: 'slate.light' }));
  uranium.position.set(-3.4, 0.6, 1.5);
  const wb = new Builder('coal-wagon');
  wb.box(13.9, 2.6, 3.1, { r: 0.12, slot: 'matte', c: ['slate', 'steel'], at: [0, 1.1, 0] });
  wb.box(13.2, 0.5, 2.7, { r: 0.3, slot: 'matte', c: 'ink', at: [0, 3.6, 0] });
  for (const x of [-5, -3.6, 3.6, 5]) for (const z of [-1.2, 1.2]) wb.cyl(0.48, 0.25, { axis: 'z', seg: 16, slot: 'metal', c: 'slate', at: [x, 0.48, z] });
  const wagon = wb.build();
  const wagonAt = new Vector3(5.2, 0, -6);
  wagon.group.position.copy(wagonAt);
  wagon.group.rotation.y = -0.5;
  real.add(heap, uranium, wagon.group);
  // map cap of the hero assembly (its detailed model has no age colour of its own)
  const cap = new Mesh(new CylinderGeometry(FA.flat / Math.sqrt(3), FA.flat / Math.sqrt(3), 0.02, 6).rotateY(Math.PI / 6), K.toon({ color: 'white' }));
  cap.position.set(0, FA.length - 0.07, 0);
  real.add(cap);

  const ages: Age[] = models.faSpots.map(() => Math.min(2, Math.floor(seed() * 3)) as Age);
  const fuelSpots = models.rodSpots.filter((sp, i) => sp.ring !== 3 && sp.ring !== 0 && i !== models.hero);
  const faOthers = models.faSpots.slice(1);
  const heroMats = models.heroRod.children.map((c) => (c as InstancedMesh).material as unknown as { fade: number });
  let advanced = false;
  const rodDrop = (k: number) => 1.2 + 0.5 * k;
  const faDrop = (k: number) => 2.08 + 0.55 * k;
  const centre = new Vector3();
  const c0 = pelletPos.clone();
  const c1 = new Vector3(hs.x, ROD.column + 0.02, hs.z);
  const c2 = new Vector3(0, FA.length - 0.55, 0);
  const c3 = new Vector3(0, FA.length / 2 - 0.2, 0);
  const c4 = new Vector3(1.5, 1.6, -1.5);
  const color = new Color();
  const z: FuelZoom = {
    group,
    models,
    level: 1,
    tilt: 0,
    ages,
    reload: -1,
    compare: 0,
    at: { pellet: pelletPos, plenum: new Vector3(hs.x, ROD.column + 0.15, hs.z), grid: new Vector3(FA.flat / 2, 0.25 + 6 * 0.27, 0), guides: new Vector3(0, FA.length, 0), core: new Vector3(0, CORE.height, 0), heap: heapAt, wagon: wagonAt },
    update: () => undefined,
  };
  z.update = (dt) => {
    const L = z.level;
    // where the frame is centred, and how big the exhibit is drawn
    if (L <= 1) centre.copy(c0).lerp(c1, smooth(0, 1, L));
    else if (L <= 2) centre.copy(c1).lerp(c2, smooth(1, 2, L));
    else if (L <= 3) centre.copy(c2).lerp(c3, smooth(2, 3, L));
    else centre.copy(c3).lerp(c4, smooth(3, 3.6, L));
    const s = DISPLAY / frameSize(L);
    exhibit.scale.setScalar(s);
    // a three-quarter view from above once the assembly is whole (the hex top reads), a top view for the map
    exhibit.rotation.x = -0.32 * smooth(1.4, 2.2, L) * (1 - z.tilt) + (-Math.PI / 2) * z.tilt;
    exhibit.position.copy(centre).applyEuler(exhibit.rotation).multiplyScalar(-s);
    // pellets: the column grows outward from the hero pellet
    models.pellets.count = Math.max(1, Math.round(n * Math.pow(smooth(0.12, 1.6, L), 2)));
    coin.visible = L < 0.55;
    models.heroRod.visible = L > 0.3;
    for (const mat of heroMats) mat.fade = smooth(0.3, 0.8, L);
    dropIn(models.rods, L, rodDrop, fuelSpots, 0, 1.8);
    models.guides.visible = models.frame.visible = L > 1.3;
    models.frame.scale.set(1, Math.max(0.001, smooth(1.3, 1.8, L)), 1);
    dropIn(models.assemblies, L, faDrop, faOthers, 0, 3);
    if (z.reload >= 0) {
      // illustrative reload: the oldest third lifts out toward the pool, fresh ones drop into the free places,
      // the rest hop to new places (ages advance half-way through)
      z.reload = Math.min(1, z.reload + dt / 5);
      const u = z.reload;
      if (u >= 0.5 && !advanced) {
        advanced = true;
        for (let i = 0; i < ages.length; i++) ages[i] = (ages[i] === 2 ? 0 : ages[i]! + 1) as Age;
      }
      faOthers.forEach((sp, i) => {
        const a = ages[i + 1]!;
        let dy: number;
        let dx = 0;
        if (!advanced && a === 2) {
          dy = smooth(0, 0.4, u) * 5;
          dx = smooth(0.2, 0.5, u) * 6;
        } else if (advanced && a === 0) dy = (1 - smooth(0.5, 0.85, u)) * 5;
        else dy = Math.sin(Math.PI * smooth(0.3, 0.7, u)) * 0.6;
        models.assemblies.setMatrixAt(i, m.makeTranslation(sp.x + dx, dy, sp.z));
      });
      models.assemblies.instanceMatrix.needsUpdate = true;
      if (u >= 1) {
        z.reload = -1;
        advanced = false;
      }
    }
    heap.visible = z.compare > 0.01 && L < 2;
    heap.scale.setScalar(Math.max(0.001, z.compare));
    uranium.visible = wagon.group.visible = L > 3.1;
    // ages on the assembly tops (map mode) or plain steel
    const mapK = z.tilt;
    for (let i = 1; i < models.faSpots.length; i++) {
      color.copy(col('steel.light')).lerp(col(AGE_COLORS[ages[i]!]), mapK);
      models.assemblies.setColorAt(i - 1, color);
    }
    if (models.assemblies.instanceColor) models.assemblies.instanceColor.needsUpdate = true;
    (cap.material as unknown as { color: Color }).color.copy(col(AGE_COLORS[ages[0]!]));
    cap.visible = mapK > 0.05;
  };
  return z;
}

/** Instances drop in from above, one after another, as the level passes through their window. */
function dropIn(mesh: InstancedMesh, L: number, from: (k: number) => number, spots: readonly { x: number; z: number }[], y: number, height: number): void {
  const m = new Matrix4();
  const N = spots.length;
  mesh.visible = L > from(0);
  if (!mesh.visible) return;
  spots.forEach((s, i) => {
    const a = smooth(from((i / N) * 0.75), from((i / N) * 0.75) + 0.25, L);
    m.makeTranslation(s.x, y + (1 - a) * height, s.z);
    if (a <= 0.001) m.makeScale(0, 0, 0);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
}
