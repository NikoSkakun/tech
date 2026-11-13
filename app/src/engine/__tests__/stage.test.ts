import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../clock';
import { Stage, type StageDeps } from '../stage';
import { Tweens } from '../tween';

function setup() {
  const tweens = new Tweens();
  const cameraCalls: { shot: unknown; instant: boolean }[] = [];
  const envCalls: { preset: string; duration: number | undefined }[] = [];
  const postCalls: { overrides: object; instant: boolean }[] = [];
  const env = {
    preset: 'day' as const,
    set(preset: string, opts?: { duration?: number }) {
      (env as { preset: string }).preset = preset;
      envCalls.push({ preset, duration: opts?.duration });
    },
  };
  const deps: StageDeps = {
    tweens: tweens.root.scope(),
    camera: { go: (shot, opts) => cameraCalls.push({ shot, instant: opts?.instant === true }) },
    env: env as unknown as StageDeps['env'],
    post: {
      apply: (overrides = {}, opts = {}) => postCalls.push({ overrides, instant: opts.instant === true }),
    },
    defaultEnv: 'day',
  };
  const stage = new Stage(deps);
  const a = new Object3D();
  const b = new Object3D();
  const mover = new Object3D();
  mover.position.set(1, 2, 3);
  const actorA = stage.actor(a);
  const actorB = stage.actor(b, { appear: 'grow' });
  const speed = stage.param('speed', 1);
  const tint = stage.color('tint', 'cyan');
  stage.pose('mover', mover);
  const hooks: string[] = [];
  stage.define({
    one: {
      show: [a],
      camera: 'wide',
      enter: () => hooks.push('enter:one'),
      leave: () => hooks.push('leave:one'),
    },
    two: {
      show: [a, b],
      params: { speed: 4 },
      colors: { tint: 'coral' },
      poses: { mover: { position: [5, 0, 0], scale: 2 } },
      camera: 'close',
      env: 'night',
      post: { bloomIntensity: 2 },
    },
    three: { show: [b], params: { speed: -2 } },
  });
  const run = (seconds: number): void => {
    for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) tweens.update(FIXED_DT);
  };
  const info = (instant: boolean) => ({ from: stage.current, instant, direction: 0 as const, index: 0 });
  return {
    stage,
    tweens,
    run,
    info,
    a,
    b,
    mover,
    actorA,
    actorB,
    speed,
    tint,
    hooks,
    cameraCalls,
    envCalls,
    postCalls,
  };
}

/** Everything a step controls, as plain numbers, for comparing end states. */
function snapshot(s: ReturnType<typeof setup>): number[] {
  return [
    s.actorA.value,
    s.actorB.value,
    Number(s.a.visible),
    Number(s.b.visible),
    s.a.scale.x,
    s.b.scale.y,
    s.speed.value,
    s.tint.value.r,
    s.tint.value.g,
    s.tint.value.b,
    ...s.mover.position.toArray(),
    s.mover.scale.x,
  ].map((v) => Math.round(v * 1e6) / 1e6);
}

describe('Stage (declarative step states)', () => {
  it('actors start hidden; instant apply produces the exact target state', () => {
    const s = setup();
    expect(s.a.visible).toBe(false);
    s.stage.apply('two', s.info(true));
    expect(s.a.visible && s.b.visible).toBe(true);
    expect(s.a.scale.x).toBe(1);
    expect(s.speed.value).toBe(4);
    expect(s.mover.position.toArray()).toEqual([5, 0, 0]);
    expect(s.mover.scale.x).toBe(2);
    expect(s.cameraCalls.at(-1)).toEqual({ shot: 'close', instant: true });
    expect(s.envCalls.at(-1)).toEqual({ preset: 'night', duration: 0 });
    expect(s.postCalls.at(-1)).toEqual({ overrides: { bloomIntensity: 2 }, instant: true });
  });

  it('everything a step does not mention returns to its default', () => {
    const s = setup();
    s.stage.apply('two', s.info(true));
    s.stage.apply('one', s.info(false));
    s.run(3);
    expect(s.b.visible).toBe(false);
    expect(s.speed.value).toBe(1);
    expect(s.mover.position.toArray()).toEqual([1, 2, 3]);
    expect(s.mover.scale.x).toBe(1);
    expect(s.tint.value.getHexString()).toBe(s.tint.initial.getHexString());
    expect(s.envCalls.at(-1)?.preset).toBe('day'); // back to the chapter's default environment
    expect(s.postCalls.at(-1)?.overrides).toEqual({});
  });

  it('random access: the end state depends only on the target step, not on the path', () => {
    const paths: string[][] = [['two'], ['one', 'two'], ['three', 'one', 'two'], ['two', 'three', 'two']];
    const results = paths.map((path) => {
      const s = setup();
      for (const step of path) {
        s.stage.apply(step, s.info(false));
        s.run(3);
      }
      return snapshot(s);
    });
    const direct = setup();
    direct.stage.apply('two', direct.info(true));
    for (const r of results) expect(r).toEqual(snapshot(direct));
  });

  it('survives rapid step spamming and interruption mid-tween', () => {
    const s = setup();
    s.stage.apply('one', s.info(true));
    const sequence = ['two', 'three', 'one', 'two', 'three', 'two', 'one', 'three', 'two'];
    sequence.forEach((step, i) => {
      s.stage.apply(step, s.info(false));
      s.run(i % 3 === 0 ? 0.05 : 0.2); // never long enough to finish
    });
    s.run(3);
    const direct = setup();
    direct.stage.apply('two', direct.info(true));
    expect(snapshot(s)).toEqual(snapshot(direct));
    expect(s.tweens.liveCount).toBe(0); // nothing left running or leaked
  });

  it('animates: values move continuously from where they are (no jump on retarget)', () => {
    const s = setup();
    s.stage.apply('one', s.info(true));
    s.stage.apply('two', s.info(false));
    s.run(0.2);
    const mid = s.speed.value;
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(4);
    s.stage.apply('three', s.info(false)); // retarget mid-flight
    s.run(FIXED_DT);
    expect(Math.abs(s.speed.value - mid)).toBeLessThan(0.3);
    s.run(3);
    expect(s.speed.value).toBe(-2);
  });

  it('calls enter/leave hooks and kills the step scope on leave', () => {
    const s = setup();
    let ticks = 0;
    s.stage.define({
      one: {
        show: [s.a],
        enter: (i) => {
          s.hooks.push('enter:one');
          i.scope.value(0, 1, { duration: 10 }, () => ticks++);
        },
        leave: () => s.hooks.push('leave:one'),
      },
    });
    s.stage.apply('one', s.info(true));
    s.run(0.1);
    const before = ticks;
    expect(before).toBeGreaterThan(0);
    s.stage.apply('two', s.info(false));
    s.run(0.5);
    expect(ticks).toBe(before); // the step-local tween died with the step
    expect(s.hooks).toEqual(['enter:one', 'leave:one']);
  });

  it('validates step definitions against the manifest and unknown names', () => {
    const s = setup();
    expect(() => s.stage.validate(['one', 'two', 'three'], 'x')).not.toThrow();
    expect(() => s.stage.validate(['one', 'two', 'three', 'four'], 'x')).toThrow(/missing: four/);
    expect(() => s.stage.validate(['one', 'two'], 'x')).toThrow(/not in manifest: three/);
    expect(() => s.stage.define({ bad: { params: { nope: 1 } } })).toThrow(/unknown param/);
    expect(() => s.stage.param('speed', 0)).toThrow(/already registered/);
  });
});
