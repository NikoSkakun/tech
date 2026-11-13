/**
 * Living part of the storm diorama (fx only): separated charge in the cloud (`coral` «+» in the anvil, `cyan`
 * «−» at the base, a small «+» pocket below), graupel and ice crystals colliding in the core, the induced
 * `coral` charge of the ground, the field under the cloud, and the strike itself — stepped leader down,
 * streamer up, return stroke with re-strikes (sim: `lightningTimeline`), flash and a dust ring.
 * All positions are metres in the diorama group.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import {
  boxEmitter,
  createArc,
  createFlash,
  createHalo,
  createOrbs,
  createParticles,
  createPulseRings,
  RibbonLines,
} from '@/fx';
import { lightningTimeline, stormState } from '@electricity/sim/charge-field';
import { SEMANTIC } from '@/style';
import { smooth } from '../chapter';
import type { StormSet } from './storm-set';

const PLUS = 16;
const MINUS = 16;

export interface StormFx {
  group: Group;
  /** Slider «Розділення заряду в хмарі», 0…1. */
  separation: number;
  /** Strike target: the rod (true) or the tallest tree. */
  toRod: boolean;
  readonly striking: boolean;
  /** Start the strike animation; `onStroke(i)` fires at every return stroke, `onEnd` after the last one. */
  strike(seed: number, onStroke: (index: number) => void, onEnd: () => void): void;
  reset(): void;
  update(dt: number, t: number): void;
}

export function createStormFx(ctx: ChapterContext, set: StormSet): StormFx {
  const group = new Group();
  const plus = createOrbs({
    kind: 'ion',
    color: SEMANTIC.proton,
    glyph: 'plus',
    count: PLUS + 3,
    radius: 1.05,
  });
  const minus = createOrbs({
    kind: 'ion',
    color: SEMANTIC.electron,
    glyph: 'minus',
    count: MINUS,
    radius: 1.05,
  });
  const core = set.core;
  // ice crystals rise, heavier graupel falls: where they collide the charge separates
  const ice = createParticles(ctx, {
    count: 70,
    emitter: boxEmitter([16, 7, 1]),
    sprite: 'disc',
    color: ['white', 'sky'],
    life: [1.6, 2.6],
    speed: [1.5, 3],
    gravity: [0, 2.2, 0],
    size: [0.18, 0.32, 0.1],
    depthTest: false,
  });
  const graupel = createParticles(ctx, {
    count: 40,
    emitter: boxEmitter([16, 7, 1]),
    sprite: 'disc',
    color: ['mist', 'steel'],
    life: [1.4, 2.2],
    speed: [0.5, 1.5],
    gravity: [0, -4, 0],
    size: [0.4, 0.55, 0.3],
    depthTest: false,
  });
  ice.position.copy(core);
  graupel.position.copy(core);
  const ground = createHalo({
    color: SEMANTIC.proton,
    size: 34,
    intensity: 0,
    billboard: false,
    amount: 0.15,
  });
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-1, 1.4, 2);
  const fieldLines = new RibbonLines({
    capacity: 64,
    color: SEMANTIC.fieldE,
    width: 0.3,
    intensity: 1.1,
    dashRepeat: 0.22,
    dashSpeed: 5,
    dashStrength: 0.8,
    base: 0.3,
    keepHue: true,
  });
  fieldLines.setLines(
    [-12, -7, -2, 3, 8, 13].map((x, i) => ({
      points: [new Vector3(x, 2.5, 4 + (i % 2)), new Vector3(x, set.cloudBase.y - 1, 4 + (i % 2))],
    })),
  );
  const arc = (width: number, intensity: number, branches: number, continuous: boolean) =>
    createArc({
      color: 'violet.light',
      width,
      intensity,
      branches,
      jaggedness: 0.14,
      flickerRate: 12,
      continuous,
    });
  const leader = arc(0.3, 1.8, 3, true);
  const streamer = arc(0.22, 1.5, 0, true);
  const bolt = arc(0.75, 4.2, 2, false);
  const flash = createFlash({ size: 26, color: 'white', speed: 0.35 });
  const dust = createPulseRings({
    color: 'mist',
    size: 20,
    amount: 1,
    intensity: 0,
    billboard: false,
    speed: 1.6,
  });
  dust.rotation.x = -Math.PI / 2;
  group.add(ground, fieldLines, ice, graupel, plus, minus, leader, streamer, bolt, flash, dust);

  // fixed seats of the charge marks on the front face of the cloud
  const seat = (i: number, n: number, y: number, spanX: number): [number, number, number] => [
    ((i + 0.5) / n - 0.5) * spanX + (i % 2) * 0.8,
    y + ((i * 7) % 3) * 1.5 - 1.5,
    5.4 + ((i * 5) % 3) * 0.4,
  ];
  let run: {
    t: number;
    plan: ReturnType<typeof lightningTimeline>;
    next: number;
    onStroke: (i: number) => void;
    onEnd: () => void;
  } | null = null;
  let dustAge = 9;
  const target = new Vector3();
  const tip = new Vector3();
  const fx: StormFx = {
    group,
    separation: 0.2,
    toRod: true,
    get striking() {
      return run !== null;
    },
    strike(seed, onStroke, onEnd) {
      if (run) return;
      run = { t: 0, plan: lightningTimeline(seed), next: 0, onStroke, onEnd };
    },
    reset() {
      run = null;
      dustAge = 9;
    },
    update(dt, t) {
      const s = stormState(fx.separation);
      for (let i = 0; i < PLUS + 3; i++) {
        const pocket = i >= PLUS;
        const [x, y, z] = pocket
          ? [-6 + (i - PLUS) * 2.2, set.cloudBase.y + 2.2, 6.4]
          : seat(i, PLUS, set.cloudTop.y, 34);
        plus.setPosition(
          i,
          x,
          y + 0.25 * Math.sin(t * 1.3 + i),
          z,
          smooth(i / (PLUS + 3), i / (PLUS + 3) + 0.25, s.chargeDensity * 1.25) * (pocket ? 0.7 : 1),
        );
      }
      for (let i = 0; i < MINUS; i++) {
        const [x, y, z] = seat(i, MINUS, set.cloudBase.y + 5, 30);
        minus.setPosition(
          i,
          x,
          y + 0.25 * Math.sin(t * 1.1 + i * 2),
          z,
          smooth(i / MINUS, i / MINUS + 0.25, s.chargeDensity * 1.25),
        );
      }
      plus.commit();
      minus.commit();
      ground.intensity = 0.9 * s.chargeDensity;
      fieldLines.intensity = 0.25 + 1.2 * s.fieldBrightness;
      fieldLines.fade = smooth(0.02, 0.3, s.fieldBrightness);
      ice.rate = graupel.rate = 0.35 + 0.65 * s.chargeDensity;

      target.copy(fx.toRod ? set.rodTip : set.treeTop);
      let lead = 0;
      let rise = 0;
      if (run) {
        run.t += dt;
        const { plan } = run;
        // the leader advances in jumps (≈ 9 steps), the streamer rises from the target during the last third
        lead = Math.min(Math.floor((run.t / plan.leaderS) * 9) / 9, 1);
        rise = smooth(0.65, 1, run.t / plan.leaderS);
        const stroke = plan.strokes[run.next];
        if (stroke && run.t >= stroke.startS) {
          bolt.from.copy(set.cloudBase);
          bolt.to.copy(target);
          bolt.strike(stroke.durationS);
          flash.position.copy(target);
          flash.fire();
          if (run.next === 0) dustAge = 0;
          run.onStroke(run.next++);
        }
        if (run.t > plan.leaderS) lead = rise = 0;
        const last = plan.strokes[plan.strokes.length - 1]!;
        if (run.t > last.startS + last.durationS + 0.5) {
          const done = run.onEnd;
          run = null;
          done();
        }
      }
      leader.from.copy(set.cloudBase);
      leader.to.copy(tip.copy(set.cloudBase).lerp(target, lead * 0.86));
      leader.power = lead > 0 ? 0.9 : 0;
      leader.visible = lead > 0;
      streamer.from.copy(target);
      streamer.to.copy(tip.copy(target).lerp(set.cloudBase, 0.14 * rise));
      streamer.power = rise > 0.02 ? 0.8 : 0;
      streamer.visible = rise > 0.02;
      dustAge += dt;
      dust.position.set(target.x, 1.2, target.z);
      dust.intensity = dustAge < 1.4 ? 1.2 * (1 - dustAge / 1.4) : 0;
      dust.visible = dust.intensity > 0.01;
    },
  };
  return fx;
}
