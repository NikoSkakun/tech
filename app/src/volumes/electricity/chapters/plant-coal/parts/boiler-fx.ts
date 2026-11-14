/**
 * Life inside the boiler (step 4): tangential flames from the corner burners, a rising fire vortex (orbs on a
 * helix), and the three media as particle streams coloured by temperature along their path — water / steam
 * `blue` → `sky` → hot steam `white`+`pink`; flue gas `orange` (≈ 1500 °C) → `amber` (≈ 1100 °C) → `steel`
 * (≈ 350 °C) → `slate` (≈ 120–140 °C, after the air heater); air `sky` → `amber` after the air heater.
 * `show(medium)` highlights one stream and thins the others to 15 % (document: «інші притлумлюються»).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlame, createFlow, createHalo, type Flame, type Flow } from '@/fx';
import type { ColorToken } from '@/style';
import { FURNACE, type BoilerCore } from './boiler-core';

export type Medium = 'water' | 'gas' | 'air';

export interface BoilerFx {
  group: Group;
  flames: Flame[];
  /** 0…1 fire strength (load). */
  power: number;
  show(medium: Medium | null): void;
  update(dt: number): void;
}

/** One stream = consecutive segments of a polyline, each with its own colour. */
function stream(ctx: ChapterContext, pts: readonly Vector3[], cuts: readonly [number, number, ColorToken][], radius: number, speed: number): Flow[] {
  return cuts.map(([a, b, color]) =>
    createFlow(ctx, { kind: 'blob', color, paths: pts.slice(a, b + 1).map((p) => p.clone()), count: ctx.quality.count(8 * (b - a) + 10, 6), radius, speed, spread: radius * 1.6, halo: false }),
  );
}

/** `outside`: the gas and air legs outside the shell (air heater, catalyst), already in the shell frame. */
export function buildBoilerFx(ctx: ChapterContext, core: BoilerCore, outside: { gas: Vector3[] }): BoilerFx {
  const group = new Group();
  group.name = 'boiler-fx';
  const F = FURNACE;
  // corner flames (middle tier), tilted toward the tangential circle, plus the fireball core
  const flames: Flame[] = [];
  for (const p of core.burners.slice(4, 8)) {
    const f = createFlame({ height: 9, width: 4, intensity: 1.3, seed: flames.length * 1.3 });
    f.position.copy(p);
    const toward = new Vector3(F.x, p.y, F.z).sub(p).normalize();
    f.rotation.set(toward.z * 1.2, 0, -toward.x * 1.2);
    group.add(f);
    flames.push(f);
  }
  for (const [y, hgt, w] of [[18, 20, 9], [28, 18, 6]] as const) {
    const f = createFlame({ height: hgt, width: w, intensity: 1.15, colors: ['red', 'orange', 'yellow'], seed: y });
    f.position.set(F.x, y, F.z);
    group.add(f);
    flames.push(f);
  }
  const glow = createHalo({ color: 'orange', size: 30, intensity: 0.7 });
  glow.position.set(F.x, 30, F.z);
  group.add(glow);
  // fire vortex: orange pulses spiralling up the furnace
  const helix: Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = i * 0.42;
    helix.push(new Vector3(F.x + Math.cos(a) * 4.2, 18 + i * 0.6, F.z + Math.sin(a) * 4.2));
  }
  const vortex = createFlow(ctx, { kind: 'pulse', color: 'orange', paths: helix, count: ctx.quality.count(70, 30), radius: 0.7, speed: 14, spread: 1.2 });
  group.add(vortex);
  const W = core.paths.water;
  const R = core.paths.reheat;
  const G = [...core.paths.gas, ...outside.gas];
  const A = core.paths.air;
  const streams: Record<Medium, Flow[]> = {
    water: [...stream(ctx, W, [[0, 2, 'blue'], [2, 6, 'blue'], [6, 8, 'sky'], [8, 10, 'pink.light']], 0.7, 7), ...stream(ctx, R, [[0, 1, 'white'], [1, 4, 'pink.light']], 0.7, 7)],
    gas: stream(ctx, G, [[0, 2, 'orange'], [2, 4, 'amber'], [4, 7, 'steel'], [7, G.length - 1, 'slate']], 1.1, 10),
    air: stream(ctx, A, [[0, 1, 'sky'], [1, A.length - 1, 'amber']], 0.9, 8),
  };
  for (const list of Object.values(streams)) for (const f of list) group.add(f);
  const api: BoilerFx = {
    group,
    flames,
    power: 1,
    show(medium) {
      for (const [k, list] of Object.entries(streams) as [Medium, Flow[]][]) {
        for (const f of list) f.density = medium === null ? 0 : k === medium ? 1 : 0.15;
      }
    },
    update() {
      for (const f of flames) f.power = 0.35 + 0.65 * api.power;
      glow.intensity = 0.3 + 0.4 * api.power;
      vortex.speed = 6 + 10 * api.power;
    },
  };
  api.show('water');
  return api;
}
