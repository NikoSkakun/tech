/**
 * The reader's hands on the stand (the owner, 2026-11-20): take the battery out of its clamps and unscrew the lamp,
 * carry them on a rubber band within the stand, drop them (they fall by physics and stay where they can be picked
 * up), put them back. The circuit follows: the lamp is lit only while both are in their places and the switch is
 * closed (`CircuitStage.contact`). A reusable module of the stage — a chapter switches it on where it wants it:
 *
 * ```ts
 * const hands = createStandHands(ctx, stage, { enabled: () => here() });
 * // update, after the stage's own update:  hands.update(dt, t)
 * // leaving the place:                     hands.home(info.instant)
 * ```
 *
 * A press on the battery or the lamp takes it; everywhere else the chapter's own interactions work as before.
 * The wires never move: the clamps and the socket's terminals are part of the stand.
 */
import { CylinderGeometry, Mesh, MeshBasicMaterial, type Object3D, SphereGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import type { ChapterContext } from '@/engine/api';
import type { CircuitStage } from '../index';
import { boardToWorld } from '../shots';
import { PLACE } from '../stand';
import { worldToBoard } from '../tools';
import { batteryHand } from './battery-hand';
import { Cursor } from './carry';
import { lampHand } from './lamp-hand';
import { type LoosePart, floor, obstacles } from './parts';
import { clearanceOf } from './limits';
import { createSolver } from './solver';

export interface StandHandsOptions {
  /** Whether the reader may take a part now (the step, no flight, nothing else holding the scene). */
  enabled(): boolean;
  /** The reader's first touch of a part (a step may dismiss its captions). */
  touched?(): void;
}

export interface StandHands {
  /** Both parts in their places: the circuit can carry current. */
  readonly inPlace: boolean;
  /** Both home and at rest: the stand's own poses (the unfolding) are in charge. */
  readonly idle: boolean;
  /** The part in the hand now. */
  readonly holding: 'battery' | 'lamp' | null;
  /** Put both back: gliding (and the lamp screwing itself in) or, `instant`, at once. */
  home(instant: boolean): void;
  update(dt: number, t: number): void;
  /** QA: the parts' states and board positions. */
  state(): Record<'battery' | 'lamp', { state: string; at: number[]; inPlace: boolean; asleep: boolean; clear: number }>;
}

const hitMaterial = new MeshBasicMaterial({ visible: false });

export function createStandHands(ctx: ChapterContext, stage: CircuitStage, opts: StandHandsOptions): StandHands {
  const { stand } = stage;
  const dims = stage.bulbDims;
  const globe = dims.globe;
  const battery = batteryHand(stand, (k) => audio.play(k === 'seat' ? 'click' : 'tick', { gain: 0.7 }));
  const lamp = lampHand(stand, dims, (k) => audio.play(k === 'seat' ? 'click' : 'tick', { gain: 0.6, pitch: 0.8 }));
  const parts = { battery, lamp } as const;
  const solver = createSolver([battery.body, lamp.body, obstacles()], floor());
  const cursor = new Cursor();
  const still = new Cursor();
  let holding: 'battery' | 'lamp' | null = null;
  const at = new Vector3();

  // generous invisible hit volumes (a finger must find the battery and the lamp on every screen)
  const batteryHit = new Mesh(new CylinderGeometry(0.36, 0.36, 2.1, 16), hitMaterial);
  batteryHit.rotation.z = Math.PI / 2;
  const lampHit = new Mesh(new SphereGeometry(globe + 0.06, 16, 12), hitMaterial);
  lampHit.position.y = dims.globeY;
  const baseHit = new Mesh(new CylinderGeometry(0.26, 0.26, 0.5, 12), hitMaterial);
  baseHit.position.y = 0.25;
  lampHit.add(baseHit);
  baseHit.position.y -= dims.globeY;
  stand.battery.group.add(batteryHit);
  stand.bulb.group.add(lampHit);
  for (const m of [batteryHit, lampHit, baseHit]) {
    m.name = 'stand-hands:hit';
    m.castShadow = false;
  }

  const register = (key: 'battery' | 'lamp', hit: Object3D): void => {
    const part: LoosePart = parts[key];
    ctx.input.register(hit, {
      cursor: 'grab',
      enabled: () => opts.enabled() && (holding === null || holding === key),
      dragStart: (e) => {
        if (!opts.enabled() || holding) return;
        const p = e.startPoint ?? e.point;
        if (!p) return;
        cursor.set(e.ray);
        holding = key;
        part.grab(worldToBoard(p, at), cursor);
        opts.touched?.();
      },
      drag: (e) => {
        if (holding !== key) return;
        cursor.set(e.ray);
        part.moved(cursor);
      },
      dragEnd: () => {
        if (holding !== key) return;
        holding = null;
        cursor.known = false;
        part.release();
      },
    });
  };
  register('battery', batteryHit);
  register('lamp', lampHit);
  ctx.qa.probe('hand-battery', () => stand.battery.group.getWorldPosition(new Vector3()));
  ctx.qa.probe('hand-lamp', () => lampHit.getWorldPosition(new Vector3()));
  // QA: the battery's centre and the lamp's globe in their places
  ctx.qa.probe('hand-battery-seat', () => boardToWorld(PLACE.battery.x, PLACE.battery.y, PLACE.battery.z));
  ctx.qa.probe('hand-lamp-seat', () => boardToWorld(PLACE.bulb.x, PLACE.bulb.y + dims.globeY, PLACE.bulb.z));

  const hands: StandHands = {
    get inPlace() {
      return battery.inPlace && lamp.inPlace;
    },
    get idle() {
      return battery.idle && lamp.idle;
    },
    get holding() {
      return holding;
    },
    home(instant) {
      if (holding) parts[holding].release();
      holding = null;
      cursor.known = false;
      battery.home(instant);
      lamp.home(instant);
      if (instant) hands.update(0, 0);
    },
    update(dt, t) {
      if (holding && !opts.enabled()) hands.home(false);
      solver.step(dt);
      battery.update(dt, t, holding === 'battery' ? cursor : still, lamp.body);
      lamp.update(dt, t, holding === 'lamp' ? cursor : still, battery.body);
      stage.contact = hands.inPlace ? 1 : 0;
    },
    state() {
      const of = (part: LoosePart) => ({
        state: part.state,
        at: part.body.x.toArray().map((v) => Math.round(v * 1000) / 1000),
        inPlace: part.inPlace,
        asleep: part.body.asleep,
        clear: Math.round(clearanceOf(part.body) * 1000) / 1000,
      });
      return { battery: of(battery), lamp: of(lamp) };
    },
  };
  return hands;
}
