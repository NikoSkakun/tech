/**
 * The «ланцюжок жовтого світла»: energy taken from the wind shown as yellow pulses (brightness ∝ power) —
 * down the cable inside the hero's tower, into the kiosk transformer at its foot, underground to the farm
 * substation; the farm's own 33 kV collector strings join there. Cables that are hidden in reality (inside the
 * tower, under the ground) are drawn X-ray style: on top of whatever covers them.
 */
import { Vector3 } from 'three';
import { createWire, RibbonLines, type Wire } from '@/fx';
import { kioskSubstation, type KitModel } from '@/kit';
import { FARM, HERO } from '../layout';
import type { Farm } from './farm';
import type { Grid } from './grid';
import type { Hero } from './hero';
import type { World } from './world';

export interface Chain {
  /** Cable inside the hero tower and on to the kiosk. */
  tower: Wire;
  /** Underground cable from the hero's kiosk to the substation. */
  feeder: Wire;
  kiosk: KitModel;
  /** Collector strings of the farm (rebuilt by `layoutCollector`). */
  collector: RibbonLines;
  /** 0…1 visibility of the buried cables (step 8 turns the X-ray up). */
  xray: number;
  /** Rebuild the collector strings after the farm layout changed. */
  layoutCollector(): void;
  /** Brightness and pulse speed from the powers (0…1 of rated). */
  update(heroPower: number, farmPower: number): void;
}

export function buildChain(world: World, hero: Hero, farm: Farm, grid: Grid): Chain {
  const isl = world.island.group;
  const base = hero.base;
  const kiosk = kioskSubstation();
  world.island.place(kiosk.group, HERO.x + 9, HERO.z + 9, -0.6);
  const kpos = kiosk.group.position;
  const under = (x: number, z: number): Vector3 => new Vector3(x, world.y(x, z) - 0.25, z);
  const wireLook = { radius: 0.22, color: 'mist', repeat: 0.11, speed: 10, length: 0.42, intensity: 3.4, detail: 0.35, radialSegments: 8 } as const;
  // from the nacelle's rear straight down the tower axis, out at the foot, into the kiosk
  const tower = createWire(
    [
      new Vector3(base.x, base.y + HERO.hubHeight - 2.6, base.z),
      new Vector3(base.x, base.y + HERO.hubHeight - 6, base.z),
      new Vector3(base.x, base.y + 2.2, base.z),
      new Vector3(base.x + 2.5, base.y + 0.4, base.z + 2.5),
      new Vector3(kpos.x, kpos.y + 0.6, kpos.z),
    ],
    wireLook,
  );
  const route: [number, number][] = [[kpos.x, kpos.z], [-112, 58], [-60, 46], [0, 52], [60, 56], [grid.feed.x, grid.feed.z]];
  const feeder = createWire([...route.map(([x, z]) => under(x, z)), grid.feed.clone()], { ...wireLook, radius: 0.24 });
  for (const w of [tower, feeder]) {
    // X-ray: drawn over the tower shell / the turf that hides the real cable
    w.material.depthTest = false;
    w.material.depthWrite = false;
    w.renderOrder = 6;
    w.castShadow = false;
    isl.add(w);
  }
  const collector = new RibbonLines({ capacity: 260, color: 'yellow', width: 0.7, minPixels: 2.2, intensity: 1.6, dashRepeat: 0.09, dashStrength: 0.9, dashSpeed: 12, base: 0.18, depthTest: false, endFade: [0.02, 0.02] });
  collector.renderOrder = 6;
  isl.add(collector);
  const chain: Chain = {
    tower,
    feeder,
    kiosk,
    collector,
    xray: 0.35,
    layoutCollector() {
      // one string per column of turbines (constant z), running east to a trunk that ends in the yard
      const lines = [];
      const trunkX = grid.feed.x - 6;
      for (let c = 0; c < FARM.perRow; c++) {
        const pts: Vector3[] = [];
        for (let r = 0; r < FARM.rows; r++) {
          const s = farm.spot(r * FARM.perRow + c);
          pts.push(under(s.x, s.z));
        }
        const last = pts[pts.length - 1]!;
        pts.push(under(Math.max(last.x + 6, trunkX), last.z), under(trunkX, grid.feed.z - 4), grid.feed.clone());
        lines.push({ points: pts });
      }
      collector.setLines(lines);
    },
    update(heroPower, farmPower) {
      const k = chain.xray;
      tower.material.power = heroPower;
      tower.material.speed = 4 + 8 * heroPower;
      feeder.material.power = heroPower * (0.35 + 0.65 * k);
      feeder.material.fade = 0.45 + 0.55 * k;
      collector.intensity = (0.25 + 1.6 * farmPower) * (0.3 + 0.7 * k);
      collector.dashSpeed = 5 + 12 * farmPower;
      grid.wire.power = 0.15 + 0.85 * farmPower;
    },
  };
  return chain;
}
