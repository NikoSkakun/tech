/**
 * The contract between `scene.ts` and the step modules of this chapter.
 *
 * Every step is one module `steps/<nn>-<id>.ts` exporting a `StepFactory`. The factory builds the step's *set*
 * (its 3D objects, added under `lab.stand` — the space above the podium) and returns what the scene needs to
 * wire it: camera shots, the declarative stage state, the step UI and an `update` that runs while the set is on
 * screen. Steps never talk to each other; the podium, shared materials and the step UI live in `Lab`.
 */
import { Group, type Object3D } from 'three';
import type { Actor, ChapterContext, Shot, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { StepId } from './content';

export type { StepId };

/** Loop gains 0…1 requested by the step on screen (reset to 0 after every frame). */
export interface LiveState {
  /** Electronic buzz: current through a circuit, field across a gap. */
  buzz: number;
  /** Mains-like hum of a strong field (near breakdown) or a running device. */
  hum: number;
  /** Rustle of scattering / thermal noise (geiger voice, pitch = rate). */
  crackle: number;
  /** Rate of crackle clicks, 0…1. */
  crackleRate: number;
}

export interface Lab {
  ctx: ChapterContext;
  ui: StepUiApi;
  /** Parent of all sets: origin = centre of the podium top, y up. */
  stand: Group;
  /** "Wanted this frame" audio state: the step on screen writes it in `update`, `sound.ts` reads and resets it. */
  live: LiveState;
  /** True while step `id` is the current one. */
  isCurrent(id: StepId): boolean;
}

export interface StepModule {
  id: StepId;
  /** Camera shots owned by the step; the one named like the step id is its default. */
  shots: Record<string, Shot>;
  /** Stage state; `camera` defaults to the shot named like the step. */
  stage: Omit<StepSpec, 'show'> & { show: readonly (Actor | Object3D)[] };
  ui?: StepUiSpec;
  /** Runs every frame while the step is current or its set is still fading out. */
  update?(dt: number, t: number): void;
}

export type StepFactory = (lab: Lab) => StepModule;

/** Smoothstep 0…1 of `x` between `a` and `b`. */
export function smooth(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

export const clamp = (x: number, a: number, b: number): number => Math.min(Math.max(x, a), b);

/** A named group at a position (sets, sub-assemblies). */
export function group(name: string, x = 0, y = 0, z = 0): Group {
  const g = new Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}
