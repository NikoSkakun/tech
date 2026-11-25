/**
 * Small builders for the steps of this volume: a dock slider that IS a scrubbed number (UI_API §3.3), a hold timer
 * for goals «stayed there for 1 s», and a set of things the reader has touched.
 */
import type { SliderSpec } from '@/hud';
import type { Scrub } from './scrub';

/** A slider bound to a scrub: a drag follows the thumb, a click on the track glides there. */
export function scrubSlider(
  s: Scrub,
  id: string,
  label: string,
  opts: {
    min?: number;
    max?: number;
    /** Slider units → the scrub's value (default identity). */
    map?: (v: number) => number;
    format?: (v: number) => string;
    marks?: readonly { value: number; label: string }[];
    value?: number;
    onChange?: (v: number) => void;
  } = {},
): SliderSpec {
  const map = opts.map ?? ((v: number) => v);
  return {
    type: 'slider',
    id,
    label,
    min: opts.min ?? 0,
    max: opts.max ?? 1,
    value: opts.value ?? opts.min ?? 0,
    format: opts.format ?? (() => ''),
    ...(opts.marks ? { marks: opts.marks } : {}),
    onChange: (v: number) => {
      s.target = map(v);
      opts.onChange?.(v);
    },
    onInput: (_v: number, how: 'drag' | 'jump' | 'step') => (s.drag = how === 'drag'),
  };
}

/** «Stayed true for `seconds`»: call `tick(dt, condition)` every frame; `done` latches. */
export function holdFor(seconds: number): {
  tick(dt: number, on: boolean): boolean;
  reset(): void;
  readonly done: boolean;
} {
  let t = 0;
  let done = false;
  return {
    tick(dt, on) {
      t = on ? t + dt : 0;
      if (t >= seconds) done = true;
      return done;
    },
    reset() {
      t = 0;
      done = false;
    },
    get done() {
      return done;
    },
  };
}
