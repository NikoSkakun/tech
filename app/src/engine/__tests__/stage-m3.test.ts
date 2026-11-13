// M3 stage additions: step scope for handlers, in-step sub-states, pose + actor scale, envTune.
import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../clock';
import { Stage, type StageDeps } from '../stage';
import { Tweens } from '../tween';

function setup() {
  const tweens = new Tweens();
  const envCalls: { preset: string; duration?: number; overrides?: object }[] = [];
  const env = {
    preset: 'day',
    set(preset: string, opts: { duration?: number; overrides?: object } = {}) {
      env.preset = preset;
      envCalls.push({ preset, ...opts });
    },
  };
  const deps: StageDeps = {
    tweens: tweens.root.scope(),
    env: env as unknown as StageDeps['env'],
    defaultEnv: 'day',
  };
  const stage = new Stage(deps);
  const run = (seconds: number): void => {
    for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) tweens.update(FIXED_DT);
  };
  const info = (instant: boolean) => ({ from: stage.current, instant, direction: 0 as const, index: 0 });
  return { stage, run, info, envCalls };
}

describe('Stage — M3 additions', () => {
  it('stage.scope belongs to the current step: a handler delay does not fire in the next step', () => {
    const s = setup();
    s.stage.define({ one: {}, two: {} });
    s.stage.apply('one', s.info(true));
    let fired = 0;
    // a button handler running inside step one
    s.stage.scope.delay(1, () => fired++);
    s.stage.scope.value(0, 1, { duration: 2 }, () => undefined);
    s.run(0.5);
    s.stage.apply('two', s.info(false));
    s.run(2);
    expect(fired).toBe(0);
    // the same handler in step two works there
    s.stage.scope.delay(0.2, () => fired++);
    s.run(0.5);
    expect(fired).toBe(1);
  });

  it('toggle(): in-step sub-state, reverted by the next step entry', () => {
    const s = setup();
    const lamp = new Object3D();
    const lampActor = s.stage.actor(lamp);
    s.stage.define({ one: { show: [lamp] }, two: { show: [lamp] }, three: {} });
    s.stage.apply('one', s.info(true));
    expect(s.stage.toggle(lamp)).toBe(false); // toggle → hide
    s.run(1);
    expect(lamp.visible).toBe(false);
    expect(s.stage.shown(lampActor)).toBe(false);
    s.stage.apply('two', s.info(false)); // the declared state wins again
    s.run(1);
    expect(lamp.visible).toBe(true);
    expect(lamp.scale.x).toBeCloseTo(1, 4);
    s.stage.toggle(lamp, false, { instant: true });
    expect(lamp.visible).toBe(false);
    s.stage.apply('three', s.info(false));
    s.run(1);
    expect(lamp.visible).toBe(false);
  });

  it('setParam()/setColor(): tween inside the step, step entry restores the declared values', () => {
    const s = setup();
    const p = s.stage.param('flow', 0);
    const c = s.stage.color('tint', 'cyan');
    s.stage.define({ one: { params: { flow: 1 } }, two: { params: { flow: 1 } } });
    s.stage.apply('one', s.info(true));
    s.stage.setParam('flow', 3, { duration: 0.5 });
    s.stage.setColor('tint', 'red', { instant: true });
    s.run(1);
    expect(p.value).toBeCloseTo(3, 6);
    s.stage.apply('two', s.info(true));
    expect(p.value).toBe(1);
    expect(c.value.equals(c.initial)).toBe(true);
    expect(() => s.stage.setParam('nope', 1)).toThrow();
  });

  it('a pose on a pop actor scales the actor base instead of fighting it', () => {
    for (const order of ['actor-first', 'pose-first'] as const) {
      const s = setup();
      const o = new Object3D();
      if (order === 'actor-first') s.stage.actor(o);
      s.stage.pose('o', o);
      s.stage.define({ big: { show: [o], poses: { o: { scale: 2 } } }, plain: { show: [o] }, gone: {} });
      s.stage.apply('big', s.info(false));
      s.run(2);
      expect(o.scale.x).toBeCloseTo(2, 4);
      s.stage.apply('plain', s.info(false));
      s.run(2);
      expect(o.scale.x).toBeCloseTo(1, 4);
      s.stage.apply('big', s.info(true));
      expect(o.scale.x).toBeCloseTo(2, 4);
      s.stage.apply('gone', s.info(false));
      s.run(2);
      expect(o.visible).toBe(false);
    }
  });

  it('envTune is applied on deep links and sequential entries alike', () => {
    const s = setup();
    s.stage.define({ a: {}, b: { envTune: { harmony: 0.3 } }, c: { envTune: { harmony: 0.3 } } });
    s.stage.apply('a', s.info(true));
    s.stage.apply('b', s.info(false));
    expect(s.envCalls.at(-1)).toMatchObject({ preset: 'day', overrides: { harmony: 0.3 } });
    const n = s.envCalls.length;
    s.stage.apply('c', s.info(false)); // same preset, same tune: nothing to do
    expect(s.envCalls.length).toBe(n);
    s.stage.apply('a', s.info(false)); // back to no tune: reset
    expect(s.envCalls.at(-1)).toEqual({ preset: 'day' });
    s.stage.apply('b', s.info(true)); // deep link
    expect(s.envCalls.at(-1)).toEqual({ preset: 'day', duration: 0, overrides: { harmony: 0.3 } });
  });
});
