/**
 * Engine hall of the island: a light hall with a removable roof and south wall, 8 gas engines inside (engine 0
 * is the animated hero, 1…7 are instanced copies), a stack and a radiator with two fans per engine on the
 * roof. Running engines «breathe»: heat shimmer over their stacks. Origin: world (positions from `layout.ts`).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createHeatShimmer, type HeatShimmer } from '@/fx';
import { Builder, instanced, type KitModel } from '@/kit';
import { col } from '@/style';
import { ENGINES, ISLAND, enginePos } from '../layout';
import { buildEngineModel, type EngineModel } from './engine';
import { animateEngine, type EngineAnim } from './engine-anim';

export interface EngineHall {
  group: Group;
  hall: KitModel;
  /** The eight engines (visible with the roof off, step 8). */
  interior: Group;
  hero: EngineModel;
  anim: EngineAnim;
  /** World position of engine i's stack top. */
  stackTop: Vector3[];
  /** World origin of the hero engine. */
  heroAt: Vector3;
  /** Number of running engines 0…8 (fractional = the last one fading in). */
  running: number;
  update(dt: number): void;
}

export function buildEngineHall(ctx: ChapterContext): EngineHall {
  const { length: L, width: W, height: H } = ENGINES;
  const y0 = ISLAND.y;
  const group = new Group();
  const b = new Builder('engine-hall');
  const wall = col('mist').lerp(col('pink.light'), 0.12);
  b.box(L + 1, 0.5, W + 1, { r: 0.1, slot: 'matte', c: ['steel', 'mist'], at: [ENGINES.x, y0, ENGINES.z] });
  b.box(L, H, 0.5, { r: 0.1, c: [wall.clone().multiplyScalar(0.84), wall], at: [ENGINES.x, y0, ENGINES.z - W / 2] });
  for (const s of [-1, 1]) b.box(0.5, H, W, { r: 0.1, c: wall, at: [ENGINES.x + (s * L) / 2, y0, ENGINES.z] });
  const front = b.part('front');
  front.box(L, H, 0.5, { r: 0.1, c: [wall.clone().multiplyScalar(0.84), wall], at: [ENGINES.x, y0, ENGINES.z + W / 2] });
  for (let k = 0; k < 8; k++) front.box(5, 3.2, 0.2, { r: 0.05, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.3), at: [ENGINES.x - L / 2 + 5 + k * 8.6, y0 + 5, ENGINES.z + W / 2 + 0.25] });
  front.box(L + 0.2, 0.7, 0.6, { r: 0, c: 'pink', at: [ENGINES.x, y0 + H * 0.82, ENGINES.z + W / 2] });
  const roof = b.part('roof');
  roof.box(L + 1.2, 0.8, W + 1.2, { r: 0.2, slot: 'matte', c: [wall.clone().multiplyScalar(0.7), wall.clone().multiplyScalar(0.85)], at: [ENGINES.x, y0 + H, ENGINES.z] });
  const stackTop: Vector3[] = [];
  for (let i = 0; i < ENGINES.count; i++) {
    const [x, z] = enginePos(i);
    roof.cyl(0.75, 9, { seg: 18, slot: 'gloss', c: ['steel', 'mist'], at: [x - 4, y0 + H, z] });
    roof.cyl(0.78, 0.6, { seg: 18, slot: 'gloss', c: 'pink', at: [x - 4, y0 + H + 8.2, z] });
    stackTop.push(new Vector3(x - 4, y0 + H + 9, z));
    // radiator: a low box with two fan rings on top
    roof.box(6, 1.6, 3.4, { r: 0.2, slot: 'metal', c: ['slate', 'steel'], at: [x + 3, y0 + H + 0.4, z] });
    for (const dx of [-1.4, 1.4]) roof.ring(1.2, 0.12, { seg: 24, tubeSeg: 6, slot: 'metal', c: 'steel.light', at: [x + 3 + dx, y0 + H + 2.05, z] });
  }
  const hall = b.build();
  group.add(hall.group);
  const hero = buildEngineModel();
  const anim = animateEngine(hero);
  const [hx, hz] = enginePos(0);
  const heroAt = new Vector3(hx, y0 + 0.5, hz);
  const heroGroup = new Group();
  heroGroup.position.copy(heroAt);
  heroGroup.add(hero.model.group, anim.group);
  const interior = new Group();
  interior.name = 'engine-interior';
  interior.add(heroGroup);
  group.add(interior);
  const copies = instanced(
    hero.model,
    Array.from({ length: ENGINES.count - 1 }, (_, k) => {
      const [x, z] = enginePos(k + 1);
      return { at: [x, y0 + 0.5, z] as [number, number, number] };
    }),
  );
  interior.add(copies);
  const haze: HeatShimmer[] = stackTop.map((p) => {
    const h = createHeatShimmer({ width: 3.2, height: 9, lines: 5, intensity: 0.7 });
    h.position.copy(p);
    group.add(h);
    return h;
  });
  const fades = haze.map(() => 0);
  const eh: EngineHall = {
    group,
    hall,
    interior,
    hero,
    anim,
    stackTop,
    heroAt,
    running: 3,
    update(dt) {
      anim.update(dt);
      haze.forEach((h, i) => {
        const on = Math.min(1, Math.max(0, eh.running - i));
        fades[i] = (fades[i] ?? 0) + (on - (fades[i] ?? 0)) * Math.min(1, dt * 2.5);
        h.fade = fades[i] ?? 0;
        h.visible = h.fade > 0.01;
      });
    },
  };
  void ctx;
  return eh;
}
