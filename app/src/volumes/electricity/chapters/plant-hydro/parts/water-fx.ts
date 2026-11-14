/**
 * Moving water of the valley (`@/fx`): the spillway (one water strip per gate bay over the ogee crest, down
 * the stepped chute and across the stilling basin, foam boiling in the basin), the churn at the draft-tube
 * outlets, the current of the tailwater river, and rain (over the whole valley in the storm; over the western
 * mountains for the water cycle of step 2). Levels are set every frame from the live state.
 */
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFoam, createRain, createWaterStrip, type ParticleSystem, type WaterStrip } from '@/fx';
import { DAM, ISLAND, POWERHOUSE, RESERVOIR, SPILLWAY, riverZ } from '../layout';
import { OGEE_Y } from './dam';

export interface WaterFx {
  group: Group;
  /** Spillway discharge 0…1, turbine discharge 0…1, rain over the valley 0…1, rain over the west 0…1. */
  set(spill: number, turbine: number, storm: number, westRain: number, reservoirY: number): void;
  /** The mountain river feeding the reservoir: 0 a calm stream … 1 a flood. */
  setInflow(f: number): void;
}

export function buildWaterFx(ctx: ChapterContext): WaterFx {
  const group = new Group();
  group.name = 'water-fx';
  const sea = ISLAND.seaLevel + 0.15;
  const bay = (SPILLWAY.z1 - SPILLWAY.z0) / SPILLWAY.gates;
  const strips: WaterStrip[] = [];
  for (let i = 0; i < SPILLWAY.gates; i++) {
    const z = SPILLWAY.z0 + (i + 0.5) * bay;
    const pts = [
      new Vector3(DAM.faceX - 2, OGEE_Y + 1.4, z),
      new Vector3(DAM.crestX + 1, OGEE_Y + 0.6, z),
      new Vector3(DAM.crestX + 8, OGEE_Y - 6, z),
      new Vector3((DAM.crestX + DAM.toeX) / 2, (OGEE_Y + DAM.baseY) / 2 + 0.8, z),
      new Vector3(DAM.toeX - 2, DAM.baseY + 1.6, z),
      new Vector3(DAM.toeX + 10, sea + 0.4, z + (i - 1.5) * 1.5),
      new Vector3(SPILLWAY.basinX[1], sea, z + (i - 1.5) * 3),
    ];
    const s = createWaterStrip(new CatmullRomCurve3(pts, false, 'centripetal'), {
      width: bay - 2.8,
      speed: 16,
      whiteWater: 0.7,
      segments: 90,
    });
    strips.push(s);
    group.add(s);
  }
  const basin = createFoam(ctx, { radius: 16, count: 160, size: 3.2 });
  basin.position.set(DAM.toeX + 14, sea, (SPILLWAY.z0 + SPILLWAY.z1) / 2);
  group.add(basin);
  const churn: ParticleSystem[] = POWERHOUSE.units.map((z) => {
    const f = createFoam(ctx, { radius: 5, count: 40, size: 2 });
    f.position.set(POWERHOUSE.x1 + 14, sea, z);
    group.add(f);
    return f;
  });
  // the tailwater river: a current strip from the powerhouse to the bay
  const riverPts: Vector3[] = [];
  for (let x = POWERHOUSE.x1 + 12; x <= ISLAND.coastX + 30; x += 12)
    riverPts.push(new Vector3(x, sea, x < 90 ? 8 : riverZ(x)));
  const river = createWaterStrip(new CatmullRomCurve3(riverPts), {
    width: 26,
    speed: 5,
    whiteWater: 0.12,
    segments: 120,
    opacity: 0.55,
  });
  group.add(river);
  // rain: the valley in a storm, the western mountains in the water cycle
  const valleyRain = createRain(ctx, {
    size: [520, 240, 330],
    count: 1400,
    speed: 70,
    dropSize: 0.55,
    color: 'sky',
  });
  valleyRain.position.set(-60, 0, 0);
  group.add(valleyRain);
  const westRain = createRain(ctx, {
    size: [130, 190, 260],
    count: 600,
    speed: 60,
    dropSize: 0.6,
    color: 'sky',
  });
  westRain.position.set(-238, 40, -10);
  group.add(westRain);
  // the mountain river that feeds the reservoir: tumbles down the western slopes into the lake
  const inflowPts = [
    new Vector3(-236, 104, 34),
    new Vector3(-224, 86, 28),
    new Vector3(-212, 66, 22),
    new Vector3(-200, RESERVOIR.npr + 0.4, 16),
    new Vector3(-188, RESERVOIR.npr, 12),
  ];
  const inflow = createWaterStrip(new CatmullRomCurve3(inflowPts), {
    width: 8,
    speed: 8,
    whiteWater: 0.5,
    segments: 60,
  });
  group.add(inflow);
  return {
    group,
    setInflow(f) {
      inflow.whiteWater = 0.35 + 0.6 * f;
      inflow.speed = 7 + 14 * f;
    },
    set(spill, turbine, storm, west, reservoirY) {
      // water only pours over the ogee when it stands above it (a drawn-down reservoir with open gates is dry)
      const over = Math.min(1, Math.max(0, (reservoirY - OGEE_Y) / 3));
      const q = spill * over;
      for (const s of strips) {
        s.fade = Math.min(1, q * 6);
        s.whiteWater = 0.45 + 0.5 * q;
        s.speed = 10 + 14 * q;
      }
      basin.rate = Math.min(1, q * 1.4);
      for (const c of churn) c.rate = Math.min(1, 0.15 + turbine);
      river.speed = 3 + 5 * Math.min(1, turbine + q);
      valleyRain.rate = storm;
      valleyRain.visible = storm > 0.01;
      westRain.rate = west;
      westRain.visible = west > 0.01;
    },
  };
}
