/**
 * `labUi(ctx)` — the HUD's `stepUi` plus two things this chapter needs:
 *
 * - `drive(id, value)`: set a control *and* notify the chapter's `onChange` listeners (`ui.set` is silent by
 *   design; presets and scripted sequences want the same effect as a user gesture);
 * - `press(id)`: run a button's `onClick`.
 *
 * Both are also exposed as `window.__lab` for the interaction test (`qa/interaction.mjs`): segmented controls
 * have no `ctl-<id>` node name, so a test cannot find them with `__ui.locate` (see docs/requests).
 */
import type { ChapterContext } from '@/engine/api';
import { stepUi, type StepUi, type StepUiSpec } from '@/hud';

type Value = number | boolean | string;

export interface LabUi extends StepUi {
  drive(id: string, value: Value): void;
  press(id: string): void;
  /**
   * Register a control that lives outside the dock (a widget on the holo board): `value(id)` / `drive(id, v)`
   * work for it like for dock controls; `apply` moves the widget when the value is driven from code.
   */
  external(id: string, initial: Value, apply?: (value: Value) => void): { set(value: Value): void };
  /** Register a button that lives outside the dock so that `press(id)` reaches it; returns `run` unchanged. */
  action(id: string, run: () => void): () => void;
}

declare global {
  interface Window {
    __lab?: {
      drive(id: string, value: Value): void;
      press(id: string): void;
      value(id: string): Value;
      /** Observable state of the current step (set by `scene.ts`). */
      probe?(): Record<string, unknown>;
    };
  }
}

export function labUi(ctx: ChapterContext): LabUi {
  const ui = stepUi(ctx);
  const listeners = new Map<string, ((value: Value) => void)[]>();
  const buttons = new Map<string, () => void>();
  const externals = new Map<string, { value: Value; apply?: (value: Value) => void }>();
  const notify = (id: string, value: Value): void => {
    for (const fn of listeners.get(id) ?? []) fn(value);
  };
  const lab: LabUi = {
    define(steps) {
      for (const spec of Object.values(steps) as (StepUiSpec | undefined)[])
        for (const c of spec?.controls ?? []) if (c.type === 'button') buttons.set(c.id, c.onClick);
      ui.define(steps);
    },
    value: <T extends Value = number>(id: string): T =>
      externals.has(id) ? (externals.get(id)!.value as T) : ui.value<T>(id),
    set(id, value) {
      const ext = externals.get(id);
      if (!ext) return ui.set(id, value);
      ext.value = value;
      ext.apply?.(value);
    },
    onChange(id, fn) {
      listeners.set(id, [...(listeners.get(id) ?? []), fn]);
      if (!externals.has(id)) ui.onChange(id, fn);
    },
    drive(id, value) {
      lab.set(id, value);
      notify(id, value);
    },
    external(id, initial, apply) {
      const ext = { value: initial, apply };
      externals.set(id, ext);
      // the widget calls `set` on user input: store and notify, without echoing back into the widget
      return { set: (value) => ((ext.value = value), notify(id, value)) };
    },
    action(id, run) {
      buttons.set(id, run);
      return run;
    },
    press: (id) => buttons.get(id)?.(),
  };
  window.__lab = { drive: lab.drive, press: lab.press, value: (id) => lab.value<Value>(id) };
  ctx.onDispose(() => delete window.__lab);
  return lab;
}
