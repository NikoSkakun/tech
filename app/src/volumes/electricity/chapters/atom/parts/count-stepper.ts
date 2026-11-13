/**
 * CountStepper — a «−  N  +» row for the dock (a `custom` step-UI control): the particle counters of the atom
 * builder. Holding a button repeats the step 8 times a second (chapter document, step 9: «Утримання „+“ —
 * автоповтор 8 частинок/s»). The buttons are named `ctl-<id>:minus` / `ctl-<id>:plus` like the items of a
 * segmented control, so tests find them with `__ui.locate`.
 */
import type { ColorLike } from '@/style';
import { Button, Label, UiNode } from '@/ui3d';

/** Auto-repeat: steps per second once a button has been held for `HOLD_DELAY` seconds. */
const REPEAT_HZ = 8;
const HOLD_DELAY = 0.4;

export interface CountStepperOptions {
  id: string;
  label: string;
  color: ColorLike;
  /** Captions of the two buttons (the document's «−» and «+»). */
  minus: string;
  plus: string;
  /** Current value and its limits, read every frame. */
  get(): number;
  min(): number;
  max(): number;
  /** One step in the given direction (already within the limits). */
  onStep(delta: 1 | -1): void;
}

export interface CountStepper {
  node: UiNode;
  /** Call every frame with the engine time: drives the auto-repeat and refreshes the number. */
  update(t: number): void;
  /** Forget a held button (the step was left while it was down). */
  release(): void;
}

export function createCountStepper(opts: CountStepperOptions): CountStepper {
  const value = new Label('', { font: 'mono', size: 22, color: opts.color, nowrap: true, reserve: 3 });
  const well = new UiNode({ dir: 'row', justify: 'center', align: 'center', width: 52, children: [value] });
  // held: direction of the button that is down; since: when it went down; fired: repeats sent so far
  const hold = { held: 0 as 0 | 1 | -1, since: 0, fired: 0, now: 0 };
  const step = (delta: 1 | -1): void => {
    const next = opts.get() + delta;
    if (next >= opts.min() && next <= opts.max()) opts.onStep(delta);
  };
  const button = (delta: 1 | -1, caption: string): Button => {
    const b = new Button({
      name: `ctl-${opts.id}:${delta > 0 ? 'plus' : 'minus'}`,
      label: caption,
      variant: 'secondary',
      size: 'md',
      width: 56,
      accent: opts.color,
      // a hold that has already repeated must not add one more step when the button is let go
      onClick: () => {
        if (hold.fired === 0) step(delta);
        hold.fired = 0;
      },
    });
    const base = b.handlers ?? {};
    b.on({
      press: (e) => {
        base.press?.(e);
        Object.assign(hold, { held: delta, since: hold.now, fired: 0 });
      },
      release: (e) => {
        base.release?.(e);
        hold.held = 0;
      },
    });
    return b;
  };
  const minus = button(-1, opts.minus);
  const plus = button(1, opts.plus);
  const node = new UiNode({
    dir: 'row',
    align: 'center',
    gap: 8,
    width: 'fill',
    children: [
      new Label(opts.label, { size: 17, color: 'mist', nowrap: true }, { width: 'fill' }),
      minus,
      well,
      plus,
    ],
  });
  let shown = Number.NaN;
  return {
    node,
    update(t) {
      hold.now = t;
      if (hold.held !== 0) {
        const due = Math.floor((t - hold.since - HOLD_DELAY) * REPEAT_HZ) + 1;
        while (hold.fired < due) {
          hold.fired += 1;
          step(hold.held);
        }
      }
      const v = opts.get();
      if (v !== shown) value.text = String((shown = v));
      minus.disabled = v <= opts.min();
      plus.disabled = v >= opts.max();
    },
    release() {
      hold.held = 0;
      hold.fired = 0;
    },
  };
}
