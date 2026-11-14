/**
 * The nine plant islands: toy dioramas of the plant chapters (the archipelago around the hub). Each island is
 * authored at "kit metres" on a 60 m island and shown at `ISLAND_SCALE` (≈ 18 m), so kit models keep their
 * own proportions. One Builder per island merges all structures (≈ 4 draw calls); effects (steam, smoke, water,
 * rotors) are added on top. Every island has something that moves.
 */
import { Group, Vector3, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, island, type Island, type KitModel } from '@/kit';
import { SAT } from '../layout';
import type { PlantId } from '../plants-data';
import { DIORAMAS } from './plant-dioramas';

/** Authoring radius of an island (kit metres) and the scale it is shown at. */
export const ISLAND_R = 60;
export const ISLAND_SCALE = SAT.radius / ISLAND_R;

/** Something with per-frame animation (kit models, fx controllers). */
export interface Alive {
  update?(dt: number, t: number): void;
}

export interface PlantIsland {
  id: PlantId;
  /** Posed by the stage (archipelago ↔ gallery); scaled to `ISLAND_SCALE`. */
  group: Group;
  island: Island;
  /** Where the island's line leaves for the world ring (local, kit metres). */
  port: Vector3;
  /** A point just above the island's hero structure (local) — labels and hotspots. */
  top: Vector3;
  alive: Alive[];
}

/** What a diorama gets: the island, a builder for its merged structures, and a place for effects. */
export interface DioramaKit {
  ctx: ChapterContext;
  isl: Island;
  b: Builder;
  /** Ground height at (x, z). */
  y(x: number, z: number): number;
  /** Add an effect or extra model to the island (local space). */
  add<T extends Object3D>(obj: T, x?: number, y?: number, z?: number): T;
  alive: Alive[];
}

export interface DioramaSpec {
  /** Island shape and ground: biome, pads, lakes, sea. */
  island: Parameters<typeof island>[0];
  /** Build the structures and effects; returns the local port and top points. */
  build(k: DioramaKit): { port: [number, number, number]; top: [number, number, number] };
}

export function createPlantIsland(ctx: ChapterContext, id: PlantId): PlantIsland {
  const spec = DIORAMAS[id];
  // the mobile tier gets coarser terrain (MOBILE §4 e)
  const detail = ctx.quality.profile.lowDetail ? 0.16 : 0.24;
  const isl = island({ radius: ISLAND_R, underside: 'floating', depth: 44, crystals: false, detail, ...spec.island });
  const group = new Group();
  group.name = `island-${id}`;
  group.scale.setScalar(ISLAND_SCALE);
  // the terrain only receives shadows: nothing below a floating island would show its shadow (half the cost)
  isl.group.traverse((o) => void (o.castShadow = false));
  group.add(isl.group);
  const alive: Alive[] = [];
  const b = new Builder(`plant-${id}`);
  const kit: DioramaKit = {
    ctx,
    isl,
    b,
    y: (x, z) => isl.heightAt(x, z),
    add: (obj, x = 0, y = 0, z = 0) => {
      obj.position.set(x, y, z);
      group.add(obj);
      return obj;
    },
    alive,
  };
  const { port, top } = spec.build(kit);
  const model: KitModel = b.build();
  group.add(model.group);
  alive.push(model);
  return { id, group, island: isl, port: new Vector3(...port), top: new Vector3(...top), alive };
}
