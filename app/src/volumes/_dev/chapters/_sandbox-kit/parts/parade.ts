/**
 * One themed island of the kit parade: a scaled world group (kit models are in metres, the engine's diorama
 * defaults assume ~10 units), the models on it, and their combined update / night switch.
 */
import { Group, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { KitModel } from '@/kit';

/** World units per metre: a 60 m island becomes a 9-unit diorama. */
export const WORLD_SCALE = 0.15;

export class Parade {
  readonly group = new Group();
  private readonly models: KitModel[] = [];

  constructor(name: string) {
    this.group.name = name;
    this.group.scale.setScalar(WORLD_SCALE);
  }

  /** Register a model (for update / night) and add its group to the island (or to `parent`). */
  add<T extends KitModel>(model: T, parent: Object3D = this.group): T {
    this.models.push(model);
    if (!model.group.parent) parent.add(model.group);
    return model;
  }

  update(dt: number, t: number): void {
    for (const m of this.models) m.update(dt, t);
  }

  set night(v: number) {
    for (const m of this.models) m.night = v;
  }
}

export type ParadeBuilder = (ctx: ChapterContext) => Parade;
