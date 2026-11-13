/**
 * Control widgets of the dock and the board: turns a step's `ControlSpec`s into widgets named `ctl-<id>`, wires
 * them to the binding's value store, applies live patches, and returns what must run every frame (readouts,
 * gauges, live charts, `visible` / `disabled` predicates).
 */
import {
  Button,
  Chart,
  Chip,
  Gauge,
  Label,
  Readout,
  Slider,
  StatGrid,
  TEXT_COLOR,
  Table,
  Tabs,
  Toggle,
  UI,
  UiNode,
  conceal,
  honesty,
  isRevealed,
  reveal,
} from '@/ui3d';
import { fmtUnit } from '@/content';
import type { ColorLike } from '@/style';
import type { StepUiBinding } from './step-ui';
import { controlDefault, notifyChange } from './step-ui';
import type { ControlSpec, HonestySpec, When } from './step-ui-types';

export interface BuiltControls {
  /** Content groups in display order (empty when nothing is declared). */
  body: UiNode[];
  /** Buttons: the dock pins them in a sticky action row; the board shows them last. */
  actions: UiNode[];
  /** Per-frame work (polling, predicates). */
  tick: ((t: number) => void)[];
  /** Push a programmatic value into the widget of control `id`. */
  push(id: string, value: number | boolean | string): void;
  /** Re-apply the binding's live patch of control `id`. */
  repatch(id: string): void;
  /** Flash the button `id` (scripted press). */
  flash(id: string): void;
}

/** Evaluate a `When`. */
export const holds = (w: When | undefined): boolean =>
  w === undefined ? true : typeof w === 'function' ? w() : w;

/** Animated show / hide of a node bound to a predicate; the layout is redone when it changes. */
export function bindVisible(
  node: UiNode,
  when: When | undefined,
  relayout: () => void,
  opts: { dy?: number } = {},
): ((t: number) => void) | null {
  if (when === undefined) return null;
  if (!holds(when)) {
    node.visible = false;
    node.opacity = 0;
  }
  return () => {
    const on = holds(when);
    if (on === isRevealed(node)) return;
    if (on) reveal(node, { dy: opts.dy ?? -6, scale: 0.98 });
    else conceal(node, { dy: opts.dy ?? -6, scale: 0.98, onDone: relayout });
    relayout();
  };
}

/** Chips under the step title; `visible` predicates are returned as per-frame work. */
export function honestyChips(
  list: readonly HonestySpec[] = [],
  relayout: () => void = () => undefined,
): { chips: Chip[]; tick: ((t: number) => void)[] } {
  const tick: ((t: number) => void)[] = [];
  const chips = list.map((h) => {
    if (h === 'notToScale' || h === 'simplified' || h === 'illustrative') return honesty[h]();
    const c =
      'slowed' in h
        ? honesty.slowed(h.slowed, h.text)
        : 'sped' in h
          ? honesty.sped(h.sped, h.text)
          : 'enlarged' in h
            ? honesty.enlarged(h.enlarged, h.text)
            : 'kind' in h
              ? honesty[h.kind](h.text)
              : honesty.note(h.text ?? '');
    const fn = bindVisible(c, h.visible, relayout);
    if (fn) tick.push(fn);
    return c;
  });
  return { chips, tick };
}

type Out = number | boolean | string;

/** A wrapping row of controls. */
function group(children: UiNode[], props: { gap: number; align?: 'start' | 'end' | 'center' }): UiNode {
  return new UiNode({ dir: 'row', wrap: true, width: 'fill', ...props, children });
}

/** Groups take no room (and no gap) while every member is hidden. */
function autoHide(groups: readonly UiNode[]): (t: number) => void {
  return () => {
    for (const g of groups) {
      const any = g.children.some((c) => c.visible);
      if (any !== g.visible) g.visible = any;
    }
  };
}

/**
 * Build the widgets of `controls`. `where` decides the default layout: in the dock sliders come first and
 * buttons go to the sticky action row; on a board the declared order is kept.
 */
export function buildControls(
  binding: StepUiBinding,
  controls: readonly ControlSpec[],
  opts: { where: 'dock' | 'board'; reset?: boolean; relayout: () => void },
): BuiltControls {
  const setters = new Map<string, (v: Out) => void>();
  const patchers = new Map<string, () => void>();
  const flashers = new Map<string, () => void>();
  const tick: ((t: number) => void)[] = [];
  // the widget calls the onChange of the spec that built it (an id may be declared in several steps)
  const change = (c: ControlSpec) => (value: Out) => notifyChange(binding, c.id, value, c);
  const board = opts.where === 'board';
  // dock order: sliders, toggles (one row), blocks, readouts (one row), buttons (action row)
  const sliders: UiNode[] = [];
  const toggles: UiNode[] = [];
  const blocks: UiNode[] = [];
  const readouts: UiNode[] = [];
  const actions: UiNode[] = [];
  const ordered: UiNode[] = []; // board: declared order, consecutive readouts share a row
  let readoutRow: UiNode | null = null;
  const place = (node: UiNode, kind: 'slider' | 'toggle' | 'block' | 'readout' | 'action'): void => {
    if (board) {
      if (kind === 'readout' || kind === 'toggle') {
        if (!readoutRow) {
          readoutRow = group([], { gap: 22, align: 'end' });
          ordered.push(readoutRow);
        }
        readoutRow.add(node);
        return;
      }
      readoutRow = null;
      if (kind === 'action') actions.push(node);
      else ordered.push(node);
      return;
    }
    ({ slider: sliders, toggle: toggles, block: blocks, readout: readouts, action: actions })[kind].push(
      node,
    );
  };
  const watch = (node: UiNode, c: ControlSpec, input: { disabled: boolean } | null): void => {
    node.name = `ctl-${c.id}`;
    const fn = bindVisible(node, c.visible, opts.relayout);
    if (fn) tick.push(fn);
    const off = c.disabled;
    if (input && off !== undefined) {
      input.disabled = holds(off);
      tick.push(() => {
        const patched = binding.patches.get(c.id)?.disabled;
        input.disabled = patched ?? holds(off);
      });
    }
    if (input)
      patchers.set(c.id, () => {
        const d = binding.patches.get(c.id)?.disabled;
        if (d !== undefined) input.disabled = d;
      });
  };
  const add = (c: ControlSpec): void => {
    binding.onScreen.set(c.id, c);
    if (opts.reset) {
      const d = controlDefault(c);
      if (d !== undefined) binding.values.set(c.id, d);
    }
    const stored = binding.values.get(c.id);
    const patch = binding.patches.get(c.id);
    switch (c.type) {
      case 'slider': {
        const w = new Slider({
          scale: c.scale,
          step: c.step,
          stops: c.stops,
          snaps: c.snaps,
          snapRange: c.snapRange,
          unit: c.unit,
          digits: c.digits,
          format: c.format,
          marks: c.marks,
          label: patch?.label ?? c.label,
          min: patch?.min ?? c.min,
          max: patch?.max ?? c.max,
          value: typeof stored === 'number' ? stored : c.value,
          tooltip: c.hint,
          onChange: change(c),
        });
        watch(w, c, w);
        setters.set(c.id, (v) => (w.value = Number(v)));
        const base = patchers.get(c.id);
        patchers.set(c.id, () => {
          base?.();
          const p = binding.patches.get(c.id);
          if (p?.label !== undefined) w.label = p.label;
          w.setRange(p?.min ?? c.min, p?.max ?? c.max);
        });
        place(w, 'slider');
        break;
      }
      case 'toggle': {
        const w = new Toggle({
          label: patch?.label ?? c.label,
          value: typeof stored === 'boolean' ? stored : c.value,
          tooltip: c.hint,
          onChange: change(c),
        });
        watch(w, c, w);
        setters.set(c.id, (v) => (w.value = Boolean(v)));
        place(w, 'toggle');
        break;
      }
      case 'segmented': {
        const tabs = new Tabs({
          name: `ctl-${c.id}`,
          items: c.items,
          value: typeof stored === 'string' ? stored : c.value,
          onChange: change(c),
        });
        setters.set(c.id, (v) => (tabs.value = String(v)));
        const label = patch?.label ?? c.label;
        const caption = label ? new Label(label, { size: UI.text.small, color: TEXT_COLOR.dim }) : null;
        const node = caption
          ? new UiNode({ dir: 'col', gap: 4, width: 'fill', children: [caption, tabs] })
          : tabs;
        watch(node, c, tabs);
        if (node !== tabs) tabs.name = `ctl-${c.id}:tabs`;
        place(node, 'block');
        break;
      }
      case 'button': {
        const w = new Button({
          label: patch?.label ?? c.label,
          icon: c.icon,
          variant: c.primary ? 'primary' : 'secondary',
          tooltip: c.hint,
          onClick: c.onClick,
        });
        watch(w, c, w);
        flashers.set(c.id, () => w.flash());
        place(w, 'action');
        break;
      }
      case 'readout': {
        const text = c.text;
        const w = new Readout({
          label: c.label,
          unit: c.unit,
          digits: c.digits,
          format: c.format,
          value: c.get?.() ?? 0,
          text: text ? text() : undefined,
          chars: text ? Math.max(text().length + 2, 10) : undefined,
          duration: 0,
        });
        watch(w, c, null);
        const get = c.get;
        tick.push(() => {
          const v = get ? get() : NaN;
          if (text) w.setText(text());
          else w.setNow(v);
          if (c.color) w.color = c.color(v);
        });
        place(w, 'readout');
        break;
      }
      case 'gauge': {
        const w = new Gauge({
          kind: c.kind,
          label: c.label,
          min: c.min,
          max: c.max,
          unit: c.unit,
          digits: c.digits,
          zones: c.zones,
          value: c.get(),
          size: 132,
        });
        watch(w, c, null);
        tick.push(() => w.setNow(c.get()));
        place(w, c.kind === 'linear' ? 'block' : 'readout');
        break;
      }
      case 'chart': {
        const w = new Chart(c.chart);
        watch(w, c, null);
        c.init?.(w);
        const update = c.update;
        if (update) tick.push((t) => update(w, t));
        place(w, 'block');
        break;
      }
      case 'custom': {
        const update = c.update;
        if (update) tick.push(update);
        watch(c.node, c, null);
        place(c.node, 'block');
        break;
      }
      case 'table': {
        const rows = c.rows;
        const w = new Table({
          head: c.head,
          rows: typeof rows === 'function' ? rows() : rows,
          cellAlign: c.align,
        });
        watch(w, c, null);
        let last = '';
        if (typeof rows === 'function' || c.highlight)
          tick.push(() => {
            if (typeof rows === 'function') {
              const next = rows();
              const key = next.map((r) => r.join('\u0001')).join('\u0002');
              if (key !== last) {
                last = key;
                w.setRows(next);
              }
            }
            if (c.highlight) w.highlight = c.highlight();
          });
        place(w, 'block');
        break;
      }
      case 'stats': {
        const fmt = (it: (typeof c.items)[number]): string => {
          const v = it.get();
          return typeof v === 'string'
            ? v
            : fmtUnit(v, it.unit ?? '', it.digits !== undefined ? { digits: it.digits } : { maxDigits: 2 });
        };
        const w = new StatGrid({
          items: c.items.map((it) => ({ label: it.label, value: fmt(it), color: it.color?.() })),
          columns: c.columns ?? (board ? 3 : 2),
        });
        watch(w, c, null);
        tick.push(() => c.items.forEach((it, i) => w.set(i, fmt(it), it.color?.())));
        place(w, 'block');
        break;
      }
      case 'note': {
        const read = (): string => (typeof c.text === 'function' ? c.text() : c.text);
        const tone = (): ColorLike | undefined => (typeof c.color === 'function' ? c.color() : c.color);
        const w = new Chip({
          kind: 'status',
          icon: c.icon ?? 'info',
          text: read(),
          color: tone(),
          maxWidth: 400,
          tooltip: c.hint,
        });
        watch(w, c, null);
        tick.push(() => {
          w.label = read();
          const t = tone();
          if (t !== undefined) w.color = t;
        });
        place(w, 'block');
        break;
      }
    }
  };
  for (const c of controls) add(c);
  let body: UiNode[];
  if (board) body = ordered;
  else {
    body = [...sliders];
    if (toggles.length) body.push(group(toggles, { gap: 18 }));
    body.push(...blocks);
    if (readouts.length) body.push(group(readouts, { gap: 22, align: 'end' }));
  }
  const groups = body.filter((n) => n.dir === 'row' && n.wrap && !n.name);
  if (groups.length) tick.push(autoHide(groups));
  return {
    body,
    actions,
    tick,
    push: (id, v) => setters.get(id)?.(v),
    repatch: (id) => patchers.get(id)?.(),
    flash: (id) => flashers.get(id)?.(),
  };
}
