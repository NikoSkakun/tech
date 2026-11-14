/**
 * Choreography of the DOM interface on the engine clock (docs/HUD_DOM.md §7): `presence(el)` reveals and
 * conceals an element with the numbers of the WebGL kit (`ui3d/core/anim.ts`), writing only `opacity` and a 2D
 * `transform` — deterministic under `?freeze`, compositor-only. Plus the two switches on `<html>`:
 * `kd-reduced` (reduced motion: setting or system) and `kd-freeze` (frozen QA clock: CSS transitions off).
 * Nothing here follows the pointer; only state changes move the interface (DECISIONS §59 p).
 */
import type { Engine } from '@/engine/api';
import type { TweenScope } from '@/engine/tween';
import { MOTION } from '@/style/motion';
import { setClass, setStyle } from './dom';

export interface PresenceOptions {
  /** Where it comes from / goes to: offset in units (x right, y up, as the WebGL kit) and scale. */
  dx?: number;
  dy?: number;
  scale?: number;
  delay?: number;
  duration?: number;
  instant?: boolean;
}

export interface Presence {
  /** True when shown or animating in. */
  readonly shown: boolean;
  /** Animate in (defaults: rise from 14 units below, scale 0.96). Safe to call repeatedly and mid-flight. */
  reveal(opts?: PresenceOptions): void;
  /** Animate out (defaults: drop 10 units, scale 0.97), then take the element out of the layout (`hidden`). */
  conceal(opts?: PresenceOptions & { onDone?: () => void }): void;
}

let env: { tweens: TweenScope; reduced: () => boolean } | null = null;

/** Wire the DOM interface's motion to the engine (called once by the mount). */
export function initMotion(engine: Engine, tweens: TweenScope): void {
  env = { tweens, reduced: () => engine.reducedMotion };
  setClass(document.documentElement, 'kd-freeze', engine.flags.freeze !== null);
  syncMotion();
}

/** Per frame: the reduced-motion setting can change at any time (settings overlay, system preference). */
export function syncMotion(): void {
  if (env) setClass(document.documentElement, 'kd-reduced', env.reduced());
}

interface State {
  o: number;
  x: number;
  y: number;
  s: number;
  shown: boolean;
}

const states = new WeakMap<HTMLElement, State>();

function apply(el: HTMLElement, st: State): void {
  // identity → no inline transform, so the element's own CSS (hover / press feedback) keeps working
  const still = st.x === 0 && st.y === 0 && st.s === 1;
  setStyle(el, 'opacity', st.o >= 1 ? '' : st.o.toFixed(3));
  setStyle(
    el,
    'transform',
    still ? '' : `translate(calc(${st.x.toFixed(2)} * var(--u)), calc(${(-st.y).toFixed(2)} * var(--u))) scale(${st.s.toFixed(4)})`,
  );
}

/** Reveal / conceal handle of an element (one per element). */
export function presence(el: HTMLElement): Presence {
  let st = states.get(el);
  if (!st) states.set(el, (st = { o: 1, x: 0, y: 0, s: 1, shown: !el.hidden }));
  const s = st;
  const update = (): void => apply(el, s);
  return {
    get shown() {
      return s.shown;
    },
    reveal(opts = {}) {
      s.shown = true;
      const wasHidden = el.hidden || s.o <= 0.001;
      el.hidden = false;
      if (!env || opts.instant) {
        Object.assign(s, { o: 1, x: 0, y: 0, s: 1 });
        return update();
      }
      const reduced = env.reduced();
      if (wasHidden) {
        s.o = 0;
        if (!reduced) Object.assign(s, { x: opts.dx ?? 0, y: opts.dy ?? -14, s: opts.scale ?? 0.96 });
        update();
      }
      const duration = reduced ? 0.12 : (opts.duration ?? MOTION.panel.duration);
      env.tweens.to(s, { o: 1 }, { duration: duration * 0.7, delay: opts.delay, ease: 'power1.out', onUpdate: update });
      env.tweens.to(s, { x: 0, y: 0, s: 1 }, { duration, delay: opts.delay, ease: 'back.out', onUpdate: update });
    },
    conceal(opts = {}) {
      if (!s.shown && el.hidden) return opts.onDone?.();
      s.shown = false;
      const done = (): void => {
        if (s.shown) return; // revealed again meanwhile
        el.hidden = true;
        opts.onDone?.();
      };
      if (!env || opts.instant || el.hidden) {
        s.o = 0;
        update();
        return done();
      }
      const reduced = env.reduced();
      const duration = reduced ? 0.1 : (opts.duration ?? MOTION.disappear.duration);
      env.tweens.to(s, { o: 0 }, { duration, delay: opts.delay, ease: 'power2.in', onUpdate: update, onComplete: done });
      if (!reduced) {
        const to = { x: opts.dx ?? 0, y: opts.dy ?? -10, s: opts.scale ?? 0.97 };
        env.tweens.to(s, to, { duration, delay: opts.delay, ease: 'power2.in', onUpdate: update });
      }
    },
  };
}
