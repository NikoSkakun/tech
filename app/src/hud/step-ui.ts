/**
 * `stepUi(ctx)` — the chapter-side entry of the step controls API.
 *
 *   const ui = stepUi(ctx);
 *   ui.define({
 *     'iv-curve': {
 *       controls: [
 *         { type: 'slider', id: 'R', label: 'Опір R', min: 0.05, max: 1000, scale: 'log', step: 3, unit: 'Ω', value: 10 },
 *         { type: 'readout', id: 'P', label: 'Потужність P', unit: 'W', get: () => model.power },
 *       ],
 *       honesty: ['simplified'],
 *       callouts: [{ anchor: module, text: 'Фотомодуль' }],
 *     },
 *   });
 *   // in update(): const r = ui.value('R');
 *
 * Values live as long as the chapter instance, so `ui.value(id)` is valid in every step (it returns the
 * declared default until the user touches the control).
 */
import { fullChapterId, type ChapterContext, type StepIdOf, type ChapterManifest } from '@/engine/api';
import type { IconName, ToastOptions } from '@/ui3d';
import type { ControlSpec, SliderSpec, StepUiSpec } from './step-ui-types';

type Value = number | boolean | string;

/** Live changes of a control without re-declaring the step (`ui.patch`). */
export interface ControlPatch {
  label?: string;
  min?: number;
  max?: number;
  /** New value (clamped to the new range for sliders); does not call `onChange`. */
  value?: Value;
  disabled?: boolean;
}

/** The original four members (chapters that wrap the API implement this shape). */
export interface StepUi<S extends string = string> {
  /** Declare the UI of steps (merges with earlier calls; a step may be omitted). */
  define(steps: Partial<Record<S, StepUiSpec>>): void;
  /** Current value of a slider (number), toggle (boolean) or segmented control (item id). */
  value<T extends Value = number>(id: string): T;
  /**
   * Set a control's value programmatically; the widget follows. By default `onChange` / `ui.onChange` handlers
   * are not called; `{ notify: true }` calls them exactly as a user gesture would (presets, scripted demos).
   */
  set(id: string, value: Value, opts?: { notify?: boolean }): void;
  /** Subscribe to changes of a control (user gestures and `set(…, { notify: true })`). */
  onChange(id: string, fn: (value: Value) => void): void;
}

/** What `stepUi(ctx)` returns: `StepUi` plus scripted presses, live patches and event messages (M3). */
export interface StepUiApi<S extends string = string> extends StepUi<S> {
  /** Press a button as the user would: its `onClick` runs, and the button flashes when it is on screen. */
  press(id: string): void;
  /** Change a control's label, slider range, value or disabled state live (no re-`define`). */
  patch(id: string, patch: ControlPatch): void;
  /** Event message (toast) under the header: «Не поглинуто — енергія не та». Returns a function that hides it. */
  toast(text: string, opts?: { icon?: IconName; duration?: number; tone?: ToastOptions['tone'] }): () => void;
}

/** What the HUD reads from a chapter's binding. */
export interface StepUiBinding {
  readonly chapterId: string;
  readonly specs: Map<string, StepUiSpec>;
  readonly values: Map<string, Value>;
  readonly listeners: Map<string, ((value: Value) => void)[]>;
  /** Every declared control by id (last declaration wins). */
  readonly controls: Map<string, ControlSpec>;
  /** Specs of the controls on screen now (one id may be declared differently in several steps). */
  readonly onScreen: Map<string, ControlSpec>;
  /** Live patches by control id (applied when a widget is built and pushed while it is on screen). */
  readonly patches: Map<string, ControlPatch>;
  /** Set by the HUD while the binding's controls are on screen: pushes a programmatic value into the widget. */
  push: ((id: string, value: Value) => void) | null;
  /** Set by the HUD while the binding's controls are on screen: re-applies `patches` of control `id`. */
  repatch: ((id: string) => void) | null;
  /** Set by the HUD while on screen: flash the button `id`. */
  flash: ((id: string) => void) | null;
}

const bindings = new Map<string, StepUiBinding>();
const watchers = new Set<(chapterId: string) => void>();
let toastSink: ((text: string, opts?: ToastOptions) => () => void) | null = null;

/** @internal The HUD looks up the binding of the chapter on screen. */
export function bindingOf(chapterId: string): StepUiBinding | undefined {
  return bindings.get(chapterId);
}

/** @internal The HUD is told when a binding changes (a chapter called `define` after it became active). */
export function watchBindings(fn: (chapterId: string) => void): void {
  watchers.add(fn);
}

/** @internal The HUD routes `ui.toast` to its toast stack. */
export function setToastSink(fn: (text: string, opts?: ToastOptions) => () => void): void {
  toastSink = fn;
}

function defaultOf(spec: ControlSpec): Value | undefined {
  if (spec.type === 'slider') return spec.value;
  if (spec.type === 'toggle') return spec.value ?? false;
  if (spec.type === 'segmented') return spec.value ?? spec.items[0]?.id;
  return undefined;
}

/** @internal Declared default of a control (used for `reset`). */
export function controlDefault(spec: ControlSpec): Value | undefined {
  return defaultOf(spec);
}

/** @internal The spec of control `id`: the one on screen, else the last declared. */
export function specOf(binding: StepUiBinding, id: string): ControlSpec | undefined {
  return binding.onScreen.get(id) ?? binding.controls.get(id);
}

/** @internal Call a control's own `onChange` and the `ui.onChange` listeners (user gesture semantics). */
export function notifyChange(binding: StepUiBinding, id: string, value: Value, own?: ControlSpec): void {
  binding.values.set(id, value);
  const spec = own ?? specOf(binding, id);
  if (spec && 'onChange' in spec && spec.onChange) (spec.onChange as (v: Value) => void)(value);
  for (const fn of binding.listeners.get(id) ?? []) fn(value);
}

function clampSlider(spec: SliderSpec, patch: ControlPatch | undefined, v: number): number {
  const min = patch?.min ?? spec.min;
  const max = patch?.max ?? spec.max;
  return Math.min(Math.max(v, min), max);
}

export function stepUi<M extends ChapterManifest>(
  ctx: ChapterContext & { manifest: M },
): StepUiApi<StepIdOf<M>>;
export function stepUi(ctx: ChapterContext): StepUiApi;
export function stepUi(ctx: ChapterContext): StepUiApi {
  // bindings are keyed by the full chapter id: two volumes may both have a chapter `intro`
  const chapterId = fullChapterId(ctx.manifest);
  const binding: StepUiBinding = {
    chapterId,
    specs: new Map(),
    values: new Map(),
    listeners: new Map(),
    controls: new Map(),
    onScreen: new Map(),
    patches: new Map(),
    push: null,
    repatch: null,
    flash: null,
  };
  bindings.set(chapterId, binding);
  ctx.onDispose(() => {
    if (bindings.get(chapterId) === binding) bindings.delete(chapterId);
  });
  const known = new Set(ctx.manifest.steps.map((s) => s.id));
  const api: StepUiApi = {
    define(steps) {
      for (const [stepId, spec] of Object.entries(steps) as [string, StepUiSpec | undefined][]) {
        if (!spec) continue;
        if (!known.has(stepId)) throw new Error(`stepUi(${chapterId}): unknown step '${stepId}'`);
        binding.specs.set(stepId, spec);
        for (const c of [...(spec.controls ?? []), ...(spec.board?.children ?? [])]) {
          binding.controls.set(c.id, c);
          const d = defaultOf(c);
          if (d !== undefined && !binding.values.has(c.id)) binding.values.set(c.id, d);
        }
      }
      for (const w of watchers) w(chapterId);
    },
    value<T extends Value>(id: string): T {
      const v = binding.values.get(id);
      if (v === undefined) throw new Error(`stepUi(${chapterId}): no control '${id}' with a value`);
      return v as T;
    },
    set(id, value, opts) {
      const spec = specOf(binding, id);
      const v =
        spec?.type === 'slider' && typeof value === 'number'
          ? clampSlider(spec, binding.patches.get(id), value)
          : value;
      binding.values.set(id, v);
      binding.push?.(id, v);
      if (opts?.notify) notifyChange(binding, id, v);
    },
    press(id) {
      const spec = specOf(binding, id);
      if (spec?.type !== 'button') throw new Error(`stepUi(${chapterId}): no button '${id}'`);
      binding.flash?.(id);
      spec.onClick();
    },
    patch(id, patch) {
      const spec = specOf(binding, id);
      if (!spec) throw new Error(`stepUi(${chapterId}): no control '${id}'`);
      const merged = { ...binding.patches.get(id), ...patch };
      delete merged.value;
      binding.patches.set(id, merged);
      binding.repatch?.(id);
      if (patch.value !== undefined) api.set(id, patch.value);
      else if (spec.type === 'slider') {
        const v = binding.values.get(id);
        if (typeof v === 'number' && clampSlider(spec, merged, v) !== v)
          api.set(id, clampSlider(spec, merged, v));
      }
    },
    onChange(id, fn) {
      binding.listeners.set(id, [...(binding.listeners.get(id) ?? []), fn]);
    },
    toast(text, opts) {
      return toastSink?.(text, opts) ?? (() => undefined);
    },
  };
  return api;
}
