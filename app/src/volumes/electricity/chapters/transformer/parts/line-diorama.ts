/**
 * The «100 km» strip of step 3 (metres; the step scales it): a long slab with the power station on the left (turbine
 * hall, stack, step-up transformer), the city on the right (block of towers, step-down transformer) and, between
 * them, one three-phase line per voltage class — 10 and 35 kV on distribution poles, 110…750 kV on lattice towers
 * of their class (taller towers, longer insulator strings). Only the chosen class is visible. All phase conductors
 * share one `K.energy` material: its colour carries the wire temperature, its pulses the power.
 */
import { Color, Group, Matrix4, Vector3 } from 'three';
import { TRANSMISSION } from '@electricity/sim/transformer';
import { Builder, cityBlock, distributionPole, factoryHall, instanced, latticeTower, powerLine, powerTransformer, stack, type KitModel, type LineSupport } from '@/kit';
import { K, col } from '@/style';
import { greyPorcelain } from './porcelain';

export type ClassKV = (typeof TRANSMISSION.voltagesKV)[number];
/**
 * Support positions along X (metres): three supports, two spans — few and large enough to compare the classes
 * (pole vs. tower height, string length) at 720p. Not to scale: a real 100 km line has hundreds of spans.
 */
const TOWERS_X = [-50, 0, 50];
export const STRIP = { length: 214, width: 60 } as const;
/** Conductor radius, metres (≈ 20× real, so the temperature colour reads at 720p). */
const WIRE_R = 0.55;

export interface LineDiorama {
  group: Group;
  wire: ReturnType<typeof K.energy>;
  city: KitModel;
  /** Line per class (its towers and conductors). */
  lines: Map<ClassKV, Group>;
  /** Centre line of phase 1 of a class, plant → city (for flows). */
  phasePath(kv: ClassKV): Vector3[];
  /** Height of the insulator attachment of the class (for the hotspot). */
  topOf(kv: ClassKV): number;
  plantAt: Vector3;
  cityAt: Vector3;
  /** 0 = city lit as usual … 1 = blackout (windows off, facades dimmed toward the night sky). */
  setDark(k: number): void;
}

function support(kv: ClassKV): LineSupport {
  // poles drawn ≈ 1,3× their real 10 / 15 m («не в масштабі»), so they are not specks beside the towers
  if (kv === 10 || kv === 35) return distributionPole({ voltage: kv, kind: 'concrete', height: kv === 35 ? 19 : 13 });
  return latticeTower({ voltage: kv as 110 | 220 | 330 | 500 | 750, circuits: 1 });
}

export function createLineDiorama(): LineDiorama {
  const group = new Group();
  const ground = new Builder('strip');
  ground.box(STRIP.length, 3, STRIP.width, { r: 1.5, slot: 'matte', c: [col('bg.indigo'), col('teal').lerp(col('slate'), 0.55)], at: [0, -3, 0] });
  ground.box(STRIP.length - 6, 0.3, 6, { r: 0.3, slot: 'matte', c: col('slate').lerp(col('steel'), 0.3), at: [0, 0, 0] });
  group.add(ground.build().group);
  // station: hall, stack, step-up transformer
  const plantAt = new Vector3(-86, 0, 0);
  const hall = factoryHall({ length: 34, width: 18, height: 14, roof: 'gable' });
  hall.group.position.set(plantAt.x, 0, -14);
  hall.group.rotation.y = Math.PI / 2;
  const chimney = stack({ height: 36 });
  chimney.group.position.set(plantAt.x - 6, 0, 12);
  const stepUp = powerTransformer({ hv: 330, lv: 20, scale: 0.9 });
  stepUp.group.position.set(plantAt.x + 10, 0, 4);
  stepUp.group.rotation.y = Math.PI / 2;
  // city: blocks and the step-down transformer
  const cityAt = new Vector3(80, 0, 0);
  const city = cityBlock({ size: [34, 50], lot: 11, gaps: 0.05, floors: [5, 16], downtown: true, lit: 0.9, seed: 7, ground: false });
  city.group.position.set(cityAt.x + 10, 0, -2);
  const stepDown = powerTransformer({ hv: 330, lv: 110, scale: 0.8 });
  stepDown.group.position.set(cityAt.x - 14, 0, 12);
  stepDown.group.rotation.y = -Math.PI / 2;
  group.add(hall.group, chimney.group, stepUp.group, city.group, stepDown.group);
  // one line per voltage class on instanced supports
  const wire = K.energy({ color: 'mist', pulseColor: 'yellow', repeat: 0.04, speed: 14, power: 0.6, keepHue: true });
  const lines = new Map<ClassKV, Group>();
  const paths = new Map<ClassKV, Vector3[]>();
  const tops = new Map<ClassKV, number>();
  for (const kv of TRANSMISSION.voltagesKV) {
    const tower = support(kv);
    const placements = TOWERS_X.map((x) => ({ at: [x, 0, 0] as [number, number, number], ry: Math.PI / 2 }));
    const g = new Group();
    g.add(instanced(tower, placements));
    const sites = placements.map((p) => ({ tower, matrix: new Matrix4().makeRotationY(p.ry).setPosition(p.at[0], 0, 0) }));
    const line = powerLine(sites, { material: wire, radius: WIRE_R, sag: 0.03 });
    g.add(line.group);
    const pts: Vector3[] = [];
    for (let s = 0; s < TOWERS_X.length - 1; s++) pts.push(...(line.paths[`span${s}.${tower.phases[0]}`] ?? []));
    paths.set(kv, pts);
    tops.set(kv, tower.anchorLocal(`${tower.phases[0]}.in`).y);
    g.visible = false;
    lines.set(kv, g);
    group.add(g);
  }
  greyPorcelain(group);
  // facade colours of the city, to dim them in a blackout (the vertex colours stay; the material tint scales)
  // (both ends of the toon gradient: `color` alone is only its bottom)
  const facades = city.mats.list().flatMap((m) => {
    const u = (m as { uniforms?: Record<string, { value: unknown }> }).uniforms;
    return [u?.uColorA?.value, u?.uColorB?.value].flatMap((c) => (c instanceof Color ? [{ c, base: c.clone() }] : []));
  });
  const NIGHT = col('bg.indigo');
  return {
    group,
    wire,
    city,
    lines,
    phasePath: (kv) => paths.get(kv)!.map((p) => p.clone()),
    topOf: (kv) => tops.get(kv)!,
    plantAt,
    cityAt,
    setDark(k) {
      city.night = 0.95 * (1 - k) + 0.02 * k;
      for (const f of facades) f.c.copy(f.base).lerp(NIGHT, 0.82 * k);
    },
  };
}
