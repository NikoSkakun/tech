/**
 * Declarative step UI — what a chapter scene hands to `stepUi(ctx).define({...})`. The HUD lays the controls
 * out in the control dock (and the optional board), shows / hides them with the step and cleans up; chapters
 * never place panels.
 */
import type { Object3D, Vector3 } from 'three';
import type { ColorLike } from '@/style';
import type { Chart, ChartProps, GaugeZone, IconName, SliderScale, UiNode } from '@/ui3d';

/**
 * A condition re-evaluated every frame while the step is on screen (keep it cheap: read `ui.value(…)` or a
 * flag of your model). Hidden things fade out and give their space back; `false` hides permanently.
 */
export type When = boolean | (() => boolean);

interface Base {
  /** Unique within the chapter; `ui.value(id)` / `ui.set(id, v)` address the control by it. Node name `ctl-<id>`. */
  id: string;
  /** Tooltip with a longer explanation. */
  hint?: string;
  /** Show the control only while this holds (animated). Default: always. */
  visible?: When;
  /** Grey the control out while this holds (inputs only). */
  disabled?: When;
}

export interface SliderSpec extends Base, SliderScale {
  type: 'slider';
  label: string;
  value: number;
  unit?: string;
  digits?: number;
  format?: (value: number) => string;
  marks?: readonly { value: number; label: string }[];
  onChange?: (value: number) => void;
}

export interface ToggleSpec extends Base {
  type: 'toggle';
  label: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
}

export interface SegmentedSpec extends Base {
  type: 'segmented';
  label?: string;
  /** Item nodes are named `ctl-<id>:<item id>`. Labels that do not fit shrink, then wrap to two rows. */
  items: readonly { id: string; label: string }[];
  value?: string;
  onChange?: (id: string) => void;
}

export interface ButtonSpec extends Base {
  type: 'button';
  label: string;
  icon?: IconName;
  primary?: boolean;
  onClick: () => void;
}

export interface ReadoutSpec extends Base {
  type: 'readout';
  label: string;
  unit?: string;
  digits?: number;
  format?: (value: number) => string;
  /** Polled every frame while the step is on screen. Give `get` (a number) or `text` (a string). */
  get?: () => number;
  /** Text value instead of a number («з втратами», «LFP»), polled every frame. */
  text?: () => string;
  /** Colour by value (e.g. a status colour); for text readouts the argument is NaN. */
  color?: (value: number) => ColorLike;
}

export interface GaugeSpec extends Base {
  type: 'gauge';
  kind?: 'radial' | 'linear';
  label: string;
  min: number;
  max: number;
  unit?: string;
  digits?: number;
  zones?: readonly GaugeZone[];
  get: () => number;
}

export interface ChartSpec extends Base {
  type: 'chart';
  chart: ChartProps;
  /** Called once when the chart is created (fill static curves). */
  init?: (chart: Chart) => void;
  /** Called every frame while visible (push live samples, move markers). `t` = engine time in seconds. */
  update?: (chart: Chart, t: number) => void;
}

export interface CustomSpec extends Base {
  type: 'custom';
  /** Any widget tree built with `@/ui3d` (it is detached, not disposed, when the step is left). */
  node: UiNode;
  update?: (t: number) => void;
}

/** A table of strings (key–value lists, comparison tables, run results). */
export interface TableSpec extends Base {
  type: 'table';
  /** Column headers; omit for a key–value list. */
  head?: readonly string[];
  /** Rows of cells; a function is polled every frame (the table repaints only when a cell changed). */
  rows: readonly (readonly string[])[] | (() => readonly (readonly string[])[]);
  /** Highlight one row (e.g. the chemistry selected in a segmented control); -1 / undefined = none. */
  highlight?: () => number;
  /** Column alignment, default: first column left, the rest right. */
  align?: readonly ('left' | 'right' | 'center')[];
}

/** A grid of big numbers with captions («86,4 Wh», «91,8 %»), 2–4 per row. */
export interface StatsSpec extends Base {
  type: 'stats';
  items: readonly {
    label: string;
    /** Number (formatted with `unit` / `digits`) or text. Polled every frame. */
    get: () => number | string;
    unit?: string;
    digits?: number;
    color?: () => ColorLike;
  }[];
  /** Cells per row. Default 3 (2 in the dock). */
  columns?: number;
}

/** A short status / notice line with an icon (conditional messages such as «Захист від шторму»). */
export interface NoteSpec extends Base {
  type: 'note';
  text: string | (() => string);
  icon?: IconName;
  color?: ColorLike | (() => ColorLike);
}

export type ControlSpec =
  | SliderSpec
  | ToggleSpec
  | SegmentedSpec
  | ButtonSpec
  | ReadoutSpec
  | GaugeSpec
  | ChartSpec
  | CustomSpec
  | TableSpec
  | StatsSpec
  | NoteSpec;

/** Kinds of the standard honesty chips (DECISIONS §5). */
export type HonestyKind = 'notToScale' | 'simplified' | 'illustrative';

/**
 * Honesty note of a step (DECISIONS §5). Object forms accept `text` (custom wording, e.g. «сповільнено ≈ у
 * мільярд разів», «спрощена модель сліду») and `visible` (e.g. hide «збільшено ×1000» while true proportions
 * are shown).
 */
export type HonestySpec =
  | HonestyKind
  | ({ visible?: When; text?: string } & (
      { slowed: number } | { sped: number } | { enlarged: number } | { kind: HonestyKind } | { text: string }
    ));

/** Where a world-anchored annotation points: an object (its origin), a fixed point, or a function. */
export type Anchor = Object3D | readonly [number, number, number] | (() => Vector3);

export interface CalloutSpec {
  anchor: Anchor;
  /** Label text (mini-markup allowed), international term first. A function is re-read every frame. */
  text: string | (() => string);
  color?: ColorLike;
  /** Preferred side of the label relative to the anchor. Default: automatic. */
  side?: 'left' | 'right' | 'up' | 'down';
  /** Objects that can hide the anchor: the callout fades while one of them is in front of it. */
  occluders?: readonly Object3D[];
  /** Show only while this holds (fades in / out in place — no off-screen anchor tricks). */
  visible?: When;
  /**
   * Importance on small screens (F5): phones show only the few most important callouts of a step (see
   * `docs/MOBILE.md`); lower number = more important. Default: the order of declaration, so list the callouts
   * that carry the step's point first. Desktops show all of them, as always.
   */
  priority?: number;
}

export interface HotspotSpec {
  anchor: Anchor;
  /**
   * Bind to a hotspot of the step's content: its index, its `id` (slug of the international name, e.g.
   * `'wind-turbine'`), its `international` name or its full `name`. Title and text then come from the content.
   */
  content?: number | string;
  /** Card title (when not bound with `content`); a `name` of a content hotspot still binds (legacy). */
  title?: string;
  text?: string;
  occluders?: readonly Object3D[];
  /** Called when the card opens (e.g. to move the camera closer). */
  onOpen?: () => void;
  /** Show only while this holds (fades in / out in place). */
  visible?: When;
}

/**
 * A board: the sanctioned place for a big chart, a results table or a stat grid that does not fit the dock.
 * The HUD lays it out (top-left on wide screens, above the bottom sheet otherwise), animates it with the step
 * and reports its area to the camera director like its own panels.
 */
export interface BoardSpec {
  title?: string;
  /** Width hint: `sm` 380, `md` 520 (default), `lg` 680 px-eq; shrinks to the free width on small screens. */
  size?: 'sm' | 'md' | 'lg';
  /** Charts, tables, stats, readouts, gauges, notes, buttons, custom nodes — top to bottom, readouts in rows. */
  children: readonly ControlSpec[];
  /** Show only while this holds. */
  visible?: When;
}

export interface StepUiSpec {
  controls?: readonly ControlSpec[];
  honesty?: readonly HonestySpec[];
  callouts?: readonly CalloutSpec[];
  hotspots?: readonly HotspotSpec[];
  board?: BoardSpec;
  /** One-line hint shown as a toast when the step is entered (what to try). */
  hint?: string;
  /** Restore control values to their declared defaults every time the step is entered. */
  reset?: boolean;
}
