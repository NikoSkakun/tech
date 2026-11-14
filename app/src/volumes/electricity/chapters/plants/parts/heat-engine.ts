/**
 * `HeatEngineRig` of step 4: a glowing hot reservoir (left), a cold reservoir (right, `blue`) and between them a
 * toy engine — a glass cylinder whose piston drives a flywheel through a crank. Heat flows as orange blobs from
 * the hot sphere into the engine; part of it leaves as `yellow` work pulses to the flywheel, the rest cools to
 * `blue` and falls into the cold sphere. Thermometers are kit level tubes. Metres, origin = floor centre.
 */
import { CatmullRomCurve3, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { applyHeat, createFlow, type Flow } from '@/fx';
import { Builder, levelTube, type KitModel } from '@/kit';
import { K, type KToonMaterial } from '@/style';

export interface HeatEngine {
  group: Group;
  hot: Mesh<SphereGeometry, KToonMaterial>;
  cold: Mesh<SphereGeometry, KToonMaterial>;
  model: KitModel;
  thermoHot: ReturnType<typeof levelTube>;
  thermoCold: ReturnType<typeof levelTube>;
  heatIn: Flow;
  work: Flow;
  reject: Flow;
  /** Crank angle → piston and flywheel pose. */
  setCrank(angle: number): void;
  at: Record<'hot' | 'cold' | 'engine' | 'flywheel', Vector3>;
}

export const HE = { hotX: -11.5, coldX: 11.5, y: 5.6, r: 3.8 } as const;

export function createHeatEngine(ctx: ChapterContext): HeatEngine {
  const group = new Group();
  group.name = 'heat-engine';
  const hotMat = K.toon({ color: 'orange', gloss: 0.4, emissive: 'red', emissiveIntensity: 0.4 });
  const hot = new Mesh(new SphereGeometry(HE.r, 48, 32), hotMat);
  hot.position.set(HE.hotX, HE.y, 0);
  applyHeat(hotMat, 0.8);
  const cold = new Mesh(new SphereGeometry(HE.r, 48, 32), K.toon({ color: 'blue', gloss: 0.6, rim: 0.8 }));
  cold.position.set(HE.coldX, HE.y, 0);
  group.add(hot, cold);
  const b = new Builder('engine');
  for (const x of [HE.hotX, HE.coldX]) b.cyl(3, 1.6, { at: [x, 0, 0], seg: 40, c: ['slate', 'steel'], slot: 'matte' });
  b.box(9, 1.2, 5, { r: 0.3, at: [0, 0, 0], c: ['slate', 'steel'], slot: 'matte' });
  b.cyl(1.7, 6.4, { at: [-1.5, 1.2, 0], seg: 36, c: 'sky', slot: 'glass' });
  b.cyl(1.9, 0.4, { at: [-1.5, 7.6, 0], seg: 36, c: 'steel', slot: 'metal' });
  b.box(0.6, 7, 0.6, { r: 0.1, at: [2.6, 1.2, -1.4], c: 'steel', slot: 'metal' });
  const piston = b.part('piston', { at: [-1.5, 4, 0] });
  piston.cyl(1.6, 1.2, { seg: 32, c: ['steel', 'mist'], slot: 'metal' });
  const wheel = b.part('flywheel', { at: [2.6, 8.4, -1.4] });
  wheel.ring(2.6, 0.4, { axis: 'z', seg: 48, tubeSeg: 14, c: 'steel', slot: 'metal' });
  for (let i = 0; i < 4; i++) wheel.box(0.25, 5, 0.25, { at: [0, -2.5, 0], rot: [0, 0, (i * Math.PI) / 4], c: 'mist', slot: 'metal' });
  wheel.cyl(0.4, 0.8, { axis: 'z', seg: 20, at: [0, 0, -0.4], c: 'yellow', slot: 'gloss' });
  const rod = b.part('rod', { at: [-1.5, 5, 0.9] });
  rod.box(0.3, 4.6, 0.3, { r: 0.1, at: [0, 0, 0], c: 'amber', slot: 'gloss' });
  const model = b.build();
  group.add(model.group);
  const thermoHot = levelTube({ height: 11, radius: 0.55, color: 'orange', level: 0.5 });
  thermoHot.group.position.set(HE.hotX - 3.2, 0, -4.4);
  const thermoCold = levelTube({ height: 11, radius: 0.55, color: 'sky', level: 0.5 });
  thermoCold.group.position.set(HE.coldX + 3.2, 0, -4.4);
  group.add(thermoHot.group, thermoCold.group);
  const eng = new Vector3(-1.5, 4.5, 0);
  const curve = (pts: [number, number, number][]): { path: CatmullRomCurve3 }[] => [{ path: new CatmullRomCurve3(pts.map((p) => new Vector3(...p))) }];
  const heatIn = createFlow(ctx, { kind: 'blob', color: 'orange', paths: curve([[HE.hotX + 3.2, HE.y + 1.2, 0.4], [-5.5, 7.2, 0.6], [-1.5, 6, 0.6]]), count: 90, radius: 0.5, speed: 4, spread: 1.1 });
  const work = createFlow(ctx, { kind: 'pulse', color: 'yellow', paths: curve([[-1.5, 7.6, 0.6], [0.4, 10.2, 0.4], [2.6, 8.4, -0.6]]), count: 28, radius: 0.42, speed: 3, spread: 0.1 });
  const reject = createFlow(ctx, { kind: 'blob', color: 'sky', paths: curve([[-1.2, 2.6, 0.6], [4.5, 2.6, 1.2], [HE.coldX - 3.2, HE.y - 1, 0.4]]), count: 90, radius: 0.5, speed: 4, spread: 1.1 });
  group.add(heatIn, work, reject);
  const p = model.part('piston');
  const w = model.part('flywheel');
  const r = model.part('rod');
  return {
    group,
    hot,
    cold,
    model,
    thermoHot,
    thermoCold,
    heatIn,
    work,
    reject,
    setCrank(a) {
      w.rotation.z = a;
      p.position.y = 4 + 1.2 * Math.sin(a);
      r.position.y = p.position.y + 2.4;
      r.rotation.z = 0.35 * Math.cos(a);
    },
    at: { hot: hot.position.clone().setY(HE.y + HE.r + 1), cold: cold.position.clone().setY(HE.y + HE.r + 1), engine: eng, flywheel: new Vector3(2.6, 11.4, -1.4) },
  };
}
