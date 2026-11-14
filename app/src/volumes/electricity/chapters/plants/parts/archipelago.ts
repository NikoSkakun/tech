/**
 * The shared world of the chapter: the hub island with the open machine hall and its turbine-generator set,
 * the world ring (a glowing hoop: the common grid every plant feeds), the nine plant islands around it and a
 * line from each island to the ring. Steps drive it through "wanted this frame" fields (`begin()` resets them,
 * the step on screen overrides them in its `update`, `apply()` writes them to materials).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createWire, curveThrough, type Wire } from '@/fx';
import { GROUND, birds, clouds, island, machineHall, turboSet, type Island, type KitModel, type MachineHall, type TurboSet } from '@/kit';
import { HALL, HUB, RING, satPosition } from '../layout';
import { PLANT_IDS, type PlantId } from '../plants-data';
import { dressHub, type HubDressing } from './hub-dressing';
import { createIslandPicker, type IslandPicker } from './island-picker';
import { plainRotor } from './plain-rotor';
import { createPlantIsland, type Alive, type PlantIsland } from './plant-islands';

export interface Archipelago {
  hub: Island;
  hall: MachineHall;
  turbo: TurboSet;
  /** Group of the turbine-generator set (the actor). */
  turboGroup: Group;
  sats: Record<PlantId, PlantIsland>;
  ring: Wire;
  /** One line per island, island port → ring (a group, so steps can hide them all). */
  lines: Group;
  lineWires: Record<PlantId, Wire>;
  picker: IslandPicker;
  dress: HubDressing;
  /** Wanted this frame: ring pulse power 0…1, per-island line power 0…1, turbo shaft speed (rad/s). */
  want: { ring: number; line: Record<PlantId, number>; shaft: number };
  /** World position of an island's label point (follows its pose). */
  satTop(id: PlantId, out?: Vector3): Vector3;
  begin(): void;
  apply(): void;
  update(dt: number, t: number): void;
}

export function createArchipelago(ctx: ChapterContext, root: Group): Archipelago {
  const rng = ctx.random.fork('arch');
  const hub = island({
    radius: HUB.radius,
    seed: HUB.seed,
    biome: 'meadow',
    underside: 'floating',
    depth: HUB.depth,
    relief: 1.1,
    detail: 0.5,
    features: [{ type: 'pad', x: HALL.x, z: HALL.z, w: HALL.length + 14, d: HALL.width + 18, corner: 5, y: 0, blend: 7, color: GROUND.concrete() }],
  });
  hub.group.traverse((o) => void (o.castShadow = false));
  root.add(hub.group);
  const hall = machineHall({ length: HALL.length, width: HALL.width, height: HALL.height, units: 1 });
  hall.setOpen(true, true);
  hall.group.position.set(HALL.x, 0, HALL.z);
  root.add(hall.group);
  const turbo = turboSet({ cut: 2.1 });
  plainRotor(turbo.part('gen.rotor'));
  const turboGroup = new Group();
  turboGroup.name = 'turbo-set';
  turbo.group.position.set(-turbo.length / 2, 0, 0);
  turboGroup.add(turbo.group);
  turboGroup.position.set(HALL.x, 1.0, HALL.z);
  root.add(turboGroup);

  const dress = dressHub(ctx, root, hub, turbo, turboGroup);
  const alive: Alive[] = [hub, turbo, ...dress.alive];
  const sats = {} as Record<PlantId, PlantIsland>;
  for (const id of PLANT_IDS) {
    const s = createPlantIsland(ctx, id);
    s.group.position.set(...satPosition(id));
    // every island turns its yard (the line port) roughly toward the hub
    s.group.rotation.y = Math.atan2(-s.group.position.x, -s.group.position.z) - Math.PI / 2;
    root.add(s.group);
    sats[id] = s;
    alive.push(...s.alive);
  }
  root.updateMatrixWorld(true);

  const ringPts = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return new Vector3(Math.cos(a) * RING.radius, RING.y, Math.sin(a) * RING.radius);
  });
  const ring = createWire(curveThrough(ringPts, true), { radius: RING.tube, color: 'slate', repeat: 0.05, speed: 14, length: 0.35, intensity: 2.2, detail: 0.4, radialSegments: 14, castShadow: false });
  root.add(ring);

  const lines = new Group();
  lines.name = 'island-lines';
  const lineWires = {} as Record<PlantId, Wire>;
  for (const id of PLANT_IDS) {
    const s = sats[id];
    const from = s.group.localToWorld(s.port.clone());
    const dir = new Vector3(from.x, 0, from.z).normalize();
    const to = dir.clone().multiplyScalar(RING.radius).setY(RING.y);
    const mid = from.clone().lerp(to, 0.5).add(new Vector3(0, 10, 0));
    const w = createWire(curveThrough([from, mid, to]), { radius: 0.32, color: 'ink', repeat: 0.08, speed: 16, detail: 0.35, castShadow: false });
    lines.add(w);
    lineWires[id] = w;
  }
  root.add(lines);

  const sky: KitModel[] = [
    clouds({ rng, count: ctx.quality.count(10, 6), radius: [480, 660], heights: [[30, 90], [-110, -60]], size: [2.4, 4.4], speed: 2 }),
    birds({ rng, count: 7, centre: [0, 0, 0], radius: [40, 90], height: [26, 46], size: 1.4, color: 'white' }),
  ];
  for (const m of sky) {
    root.add(m.group);
    alive.push(m);
  }

  const picker = createIslandPicker(ctx, sats, root);
  const want = { ring: 1, line: {} as Record<PlantId, number>, shaft: 0 };
  const top = new Vector3();
  const arch: Archipelago = {
    hub,
    hall,
    turbo,
    turboGroup,
    sats,
    ring,
    lines,
    lineWires,
    picker,
    dress,
    want,
    satTop: (id, out = top) => sats[id].group.localToWorld(out.copy(sats[id].top)),
    begin() {
      picker.begin();
      want.ring = 0.8;
      want.shaft = 1.2;
      for (const id of PLANT_IDS) want.line[id] = 0.7;
    },
    apply() {
      ring.material.power = want.ring;
      for (const id of PLANT_IDS) lineWires[id].material.power = want.line[id];
      turbo.speed = want.shaft;
    },
    update(dt, t) {
      for (const a of alive) a.update?.(dt, t);
      picker.update(dt);
    },
  };
  arch.begin();
  return arch;
}
