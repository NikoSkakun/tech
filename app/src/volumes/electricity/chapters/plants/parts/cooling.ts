/**
 * The three ways of step 7 to take the condenser's heat away: a natural-draft cooling tower with its white vapour
 * plume, once-through cooling from a river (a warm `orange` streak downstream of the outfall) and an air-cooled
 * condenser (A-frames with turning fans). Groups in metres, origin = the spot on the hub where they stand.
 */
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createPlume, createWaterStrip } from '@/fx';
import { Builder, coolingTower, type KitModel } from '@/kit';

export interface Cooling {
  tower: Group;
  river: Group;
  acc: Group;
  fans: Group[];
  towerModel: KitModel;
  at: Record<'tower' | 'river' | 'acc', Vector3>;
}

export function createCooling(ctx: ChapterContext): Cooling {
  const tower = new Group();
  const towerModel = coolingTower({ height: 28, cut: 0.9 });
  tower.add(towerModel.group);
  const plume = createPlume(ctx, { radius: 6, height: 26, wind: [2, 0, 1], count: 30 });
  plume.position.copy(towerModel.anchorLocal('top'));
  tower.add(plume);

  const river = new Group();
  const bank = new CatmullRomCurve3([new Vector3(-30, 0.25, 6), new Vector3(-8, 0.25, 4), new Vector3(12, 0.25, 7), new Vector3(30, 0.25, 4)]);
  river.add(createWaterStrip(bank, { width: 8, speed: 2, whiteWater: 0.05 }));
  const warm = new CatmullRomCurve3([new Vector3(0, 0.32, 4.5), new Vector3(12, 0.32, 6.6), new Vector3(28, 0.32, 4.2)]);
  river.add(createWaterStrip(warm, { width: [1.5, 4], speed: 2, shallow: 'orange', deep: 'coral', whiteWater: 0, opacity: 0.7 }));
  const b0 = new Builder('outfall');
  b0.box(2, 1.2, 4, { r: 0.2, at: [0, 0, 1], c: 'steel', slot: 'matte' });
  river.add(b0.build().group);

  const acc = new Group();
  const b = new Builder('acc');
  const fans: Group[] = [];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 7;
    for (const s of [-1, 1]) b.box(0.6, 9, 6, { at: [x, 4, s * 2.2], rot: [s * 0.45, 0, 0], r: 0.1, c: ['steel', 'mist'], slot: 'metal' });
    for (const z of [-3, 3]) b.box(0.5, 6, 0.5, { at: [x, 0, z], c: 'slate', slot: 'matte' });
    b.cyl(2.6, 0.6, { at: [x, 6, 0], seg: 32, c: 'slate', slot: 'matte' });
    const fan = b.part(`fan${i}`, { at: [x, 6.4, 0] });
    for (let k = 0; k < 4; k++) fan.box(4.4, 0.12, 0.6, { rot: [0, (k * Math.PI) / 4, 0.2], c: 'mist', slot: 'metal' });
  }
  const accModel = b.build();
  for (let i = 0; i < 3; i++) fans.push(accModel.part(`fan${i}`));
  acc.add(accModel.group);
  return { tower, river, acc, fans, towerModel, at: { tower: new Vector3(0, 30, 0), river: new Vector3(12, 1.5, 7), acc: new Vector3(0, 10, 0) } };
}
