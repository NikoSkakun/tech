import { describe, expect, it } from 'vitest';
import { Clock, FIXED_DT, MAX_FRAME_DT } from '../clock';
import { EASE, Tweens, damp } from '../tween';

describe('Clock', () => {
  it('advances by real time, clamps long frames and honours pause / timeScale', () => {
    const clock = new Clock();
    expect(clock.tickReal(1000)).toBe(0); // first tick only records the timestamp
    expect(clock.tickReal(1016)).toBeCloseTo(0.016, 5);
    expect(clock.tickReal(5000)).toBeCloseTo(MAX_FRAME_DT, 5); // a 4 s hitch must not teleport state
    clock.timeScale = 2;
    expect(clock.tickReal(5010)).toBeCloseTo(0.02, 5);
    clock.paused = true;
    const t = clock.time;
    expect(clock.tickReal(6000)).toBe(0);
    expect(clock.time).toBe(t);
  });

  it('fixed stepping is exact and independent of real time', () => {
    const a = new Clock();
    const b = new Clock();
    for (let i = 0; i < 180; i++) a.advance(FIXED_DT);
    b.tickReal(123456);
    for (let i = 0; i < 180; i++) b.advance(FIXED_DT);
    expect(a.time).toBeCloseTo(3, 9);
    expect(b.time).toBe(a.time);
    expect(a.frame).toBe(180);
  });
});

describe('Tweens', () => {
  it('tweens numeric properties from their current value with easing', () => {
    const tweens = new Tweens();
    const o = { x: 10, y: 0 };
    tweens.root.to(o, { x: 20 }, { duration: 1, ease: 'linear' });
    tweens.update(0.25);
    expect(o.x).toBeCloseTo(12.5, 6);
    tweens.update(0.75);
    expect(o.x).toBe(20);
    expect(tweens.liveCount).toBe(0);
  });

  it('is deterministic: the same dt sequence gives bit-identical results', () => {
    const run = (): number[] => {
      const tweens = new Tweens();
      const o = { v: 0 };
      const out: number[] = [];
      tweens.root.to(o, { v: 1 }, { duration: 0.7, ease: 'back.out' });
      tweens.root.to(o, { v: -3 }, { duration: 0.5, delay: 0.4, ease: 'power2.inOut' });
      for (let i = 0; i < 90; i++) {
        tweens.update(FIXED_DT);
        out.push(o.v);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('a newer tween takes the property over without a jump (overwrite auto)', () => {
    const tweens = new Tweens();
    const o = { x: 0, y: 0 };
    const first = tweens.root.to(o, { x: 100, y: 100 }, { duration: 1, ease: 'linear' });
    tweens.update(0.5);
    expect(o.x).toBeCloseTo(50, 6);
    tweens.root.to(o, { x: 0 }, { duration: 1, ease: 'linear' });
    tweens.update(0.1); // the new tween starts from the current value (≈ 50), the old keeps driving y only
    expect(o.x).toBeCloseTo(50 - 5, 4);
    expect(o.y).toBeCloseTo(60, 4);
    tweens.update(2);
    expect(o.x).toBe(0);
    expect(o.y).toBe(100);
    expect(first.completed).toBe(true);
  });

  it('delays capture start values late, callbacks fire once, kill skips onComplete', async () => {
    const tweens = new Tweens();
    const o = { x: 0 };
    let started = 0;
    let completed = 0;
    const t = tweens.root.to(
      o,
      { x: 10 },
      { duration: 0.5, delay: 0.5, ease: 'linear', onStart: () => started++, onComplete: () => completed++ },
    );
    o.x = 4; // changed during the delay: the tween must start from 4
    tweens.update(0.5);
    tweens.update(0.25);
    expect(started).toBe(1);
    expect(o.x).toBeCloseTo(7, 6);
    t.kill();
    tweens.update(1);
    expect(o.x).toBeCloseTo(7, 6);
    expect(completed).toBe(0);
    expect(await t.finished).toBe(false);
  });

  it('scopes kill their tweens (and child scopes) and reject new ones after dispose', () => {
    const tweens = new Tweens();
    const chapter = tweens.root.scope();
    const step = chapter.scope();
    const o = { a: 0, b: 0, c: 0 };
    chapter.to(o, { a: 1 }, { duration: 1 });
    step.to(o, { b: 1 }, { duration: 1 });
    tweens.root.to(o, { c: 1 }, { duration: 1, ease: 'linear' });
    step.killAll();
    tweens.update(0.5);
    expect(o.b).toBe(0);
    expect(o.a).toBeGreaterThan(0);
    chapter.dispose();
    const dead = chapter.to(o, { a: 5 }, { duration: 0.1 });
    tweens.update(1);
    expect(dead.done).toBe(true);
    expect(o.a).toBeLessThan(1);
    expect(o.c).toBe(1);
  });

  it('timelines place entries relative to each other on the shared clock', () => {
    const tweens = new Tweens();
    const o = { x: 0, y: 0 };
    const calls: string[] = [];
    const tl = tweens.root
      .timeline()
      .to(o, { x: 1 }, { duration: 0.5, ease: 'linear' }) // 0 … 0.5
      .to(o, { y: 1 }, { duration: 0.5, ease: 'linear' }, '<+0.25') // 0.25 … 0.75 (relative to the start of x)
      .call(() => calls.push('mid')) // 0.75
      .wait(0.5)
      .call(() => calls.push('end')); // 1.25
    expect(tl.duration).toBeCloseTo(1.25, 6);
    tweens.update(0.5);
    expect(o.x).toBe(1);
    expect(o.y).toBeCloseTo(0.5, 6);
    expect(calls).toEqual([]);
    tweens.update(0.26);
    expect(o.y).toBe(1);
    expect(calls).toEqual(['mid']);
    tweens.update(1);
    expect(calls).toEqual(['mid', 'end']);
  });

  it('easings hit their end points; damp converges frame-rate independently', () => {
    for (const fn of Object.values(EASE)) {
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    }
    expect(EASE['back.out'](0.6)).toBeGreaterThan(1); // overshoot
    let a = 0;
    let b = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 1, 5, 1 / 60);
    for (let i = 0; i < 30; i++) b = damp(b, 1, 5, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });
});
