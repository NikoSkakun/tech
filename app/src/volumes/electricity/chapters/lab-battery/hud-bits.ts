/**
 * Small dock widgets shared by the steps of this chapter (built from `@/ui3d`, used as `custom` controls).
 */
import type { ControlSpec } from '@/hud';
import { Chip, Label, STATUS, TEXT_COLOR, UI, UiNode, type IconName } from '@/ui3d';
import type { ColorLike } from '@/style';

export type Tone = 'info' | 'ok' | 'warning' | 'alarm' | 'honesty';

const TONE: Record<Tone, { color: ColorLike; icon: IconName }> = {
  info: { color: 'mist', icon: 'info' },
  ok: { color: STATUS.ok, icon: 'check' },
  warning: { color: STATUS.warning, icon: 'warning' },
  alarm: { color: STATUS.alarm, icon: 'warning' },
  honesty: { color: STATUS.warning, icon: 'info' },
};

export interface Notices<K extends string> {
  /** Hand this to the step's `controls` (or put `spec.node` on the holo board). */
  spec: ControlSpec & { type: 'custom' };
  /** Show / hide one notice. */
  show(id: K, on: boolean): void;
  /** Show exactly these notices. */
  only(...ids: K[]): void;
  isShown(id: K): boolean;
  /** Replace the text of a notice (verdicts with a changing reason). */
  setText(id: K, text: string): void;
}

/**
 * A stack of status chips (warnings, verdicts, model notes) whose visibility the simulation drives:
 * `notices('n1', { water: { text: L.reactsWithWater, tone: 'alarm' } })`, then `n.show('water', pair.reactsWithWater)`.
 * `shown` lists the chips visible from the start (permanent notes).
 */
export function notices<K extends string>(
  id: string,
  items: Record<K, { text: string; tone: Tone }>,
  shown: readonly NoInfer<K>[] = [],
): Notices<K> {
  const chips = new Map<K, Chip>();
  const node = new UiNode({ dir: 'col', gap: 8, width: 'fill' });
  node.name = `ctl-${id}`;
  for (const key of Object.keys(items) as K[]) {
    const item = items[key];
    const chip = new Chip({
      text: item.text,
      kind: 'status',
      color: TONE[item.tone].color,
      icon: TONE[item.tone].icon,
      maxWidth: 356,
      visible: shown.includes(key),
    });
    chip.name = `note-${key}`;
    chips.set(key, chip);
    node.add(chip);
  }
  const api: Notices<K> = {
    spec: { type: 'custom', id, node },
    show(key, on) {
      chips.get(key)!.visible = on;
    },
    only(...ids) {
      for (const [key, chip] of chips) chip.visible = ids.includes(key);
    },
    isShown: (key) => chips.get(key)!.visible,
    setText(key, text) {
      const chip = chips.get(key)!;
      if (chip.label !== text) chip.label = text;
    },
  };
  return api;
}

/**
 * Two-column fact table for the dock (name on the left, value on the right): `rows` are fixed, values change
 * through `set(i, text)`.
 */
export function factTable(
  id: string,
  names: readonly string[],
): { spec: ControlSpec & { type: 'custom' }; set(i: number, text: string): void } {
  const values = names.map(
    () => new Label('', { font: 'bodyBold', size: UI.text.small, color: 'white', maxWidth: 196 }),
  );
  const node = new UiNode({
    dir: 'col',
    gap: 5,
    width: 'fill',
    children: names.map(
      (name, i) =>
        new UiNode({
          dir: 'row',
          gap: 12,
          width: 'fill',
          align: 'start',
          children: [
            new Label(name, { size: UI.text.small, color: TEXT_COLOR.dim, maxWidth: 132 }, { width: 132 }),
            values[i]!,
          ],
        }),
    ),
  });
  node.name = `ctl-${id}`;
  return {
    spec: { type: 'custom', id, node },
    set(i, text) {
      if (values[i]!.text !== text) values[i]!.text = text;
    },
  };
}

/**
 * Small grid of live numbers for the holo board: a header row (`cols`) and one row per `rows` entry.
 * `set(row, col, text)` repaints only when the text changes.
 */
export function statGrid(
  rows: readonly { name: string; color: ColorLike }[],
  cols: readonly string[],
  nameWidth = 92,
): {
  node: UiNode;
  set(row: number, col: number, text: string): void;
  showRow(row: number, on: boolean): void;
} {
  const cellW = 78;
  const head = { size: UI.text.caption, color: TEXT_COLOR.dim, nowrap: true } as const;
  const line = (first: UiNode, rest: UiNode[]): UiNode =>
    new UiNode({ dir: 'row', gap: 6, width: 'fill', align: 'center', children: [first, ...rest] });
  const values = rows.map(() =>
    cols.map(
      () =>
        new Label(
          '—',
          { font: 'mono', size: UI.text.small, color: 'white', nowrap: true, reserve: 9, stable: true },
          { width: cellW },
        ),
    ),
  );
  const lines = rows.map((r, i) =>
    line(
      new Label(
        r.name,
        { font: 'bodyBold', size: UI.text.caption, color: r.color, nowrap: true },
        { width: nameWidth },
      ),
      values[i]!,
    ),
  );
  const node = new UiNode({
    dir: 'col',
    gap: 3,
    width: 'fill',
    children: [
      line(
        new UiNode({ width: nameWidth, height: 1 }),
        cols.map((c) => new Label(c, head, { width: cellW })),
      ),
      ...lines,
    ],
  });
  return {
    node,
    set(row, col, text) {
      const l = values[row]![col]!;
      if (l.text !== text) l.text = text;
    },
    showRow(row, on) {
      lines[row]!.visible = on;
    },
  };
}
