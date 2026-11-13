/**
 * Table — rows of text cells with aligned columns (comparison tables of the documents' «Цифри і факти», run
 * results, key–value lists). Columns share the width in proportion to their longest cell; cells wrap when the
 * table is narrow. `setRows()` with the same shape only repaints.
 *
 * StatGrid — big numbers with captions in a grid («86,4 Wh», «91,8 %»).
 */
import type { ColorLike } from '@/style';
import { UiNode, type NodeProps } from '../core/node';
import { rgba, type Painter } from '../core/painter';
import { accentOf, TEXT_COLOR, UI } from '../theme';
import { Label } from './label';

export type CellAlign = 'left' | 'right' | 'center';

export interface TableProps extends NodeProps {
  /** Column headers (omit for a key–value list). */
  head?: readonly string[];
  rows: readonly (readonly string[])[];
  /** Per-column alignment; default: first column left, others right. */
  cellAlign?: readonly CellAlign[];
  /** Index of a highlighted row (accent bar), -1 = none. */
  highlight?: number;
  /** Text size; default `UI.text.small` (`UI.text.caption` for 5+ columns). */
  size?: number;
}

class Row extends UiNode {
  constructor(
    readonly cells: Label[],
    public tone: 'head' | 'odd' | 'even',
    public lit = false,
  ) {
    super({ dir: 'row', width: 'fill', gap: 10, pad: [6, 10], align: 'center', children: cells });
  }
  override paint(p: Painter): void {
    if (this.lit) {
      const a = rgba(accentOf(this));
      p.rect(0, 0, this.bw, this.bh, {
        r: 6,
        fill: [a[0], a[1], a[2], 0.16],
        border: [a[0], a[1], a[2], 0.6],
        bw: 1,
      });
    } else if (this.tone === 'odd') p.rect(0, 0, this.bw, this.bh, { r: 6, fill: rgba('bg.void', 0.45) });
    else if (this.tone === 'head')
      p.rect(0, -this.bh / 2 + 0.75, this.bw - 8, 1.5, { fill: rgba('slate', 0.8) });
  }
}

export class Table extends UiNode {
  private head: readonly string[] | null;
  private rows: (readonly string[])[] = [];
  private readonly cellAlign: readonly CellAlign[] | undefined;
  private readonly size: number | undefined;
  private highlighted = -1;
  private bodyRows: Row[] = [];

  constructor(props: TableProps) {
    super({ dir: 'col', width: 'fill', gap: 2, ...props });
    this.head = props.head ?? null;
    this.cellAlign = props.cellAlign;
    this.size = props.size;
    this.highlighted = props.highlight ?? -1;
    this.setRows(props.rows);
  }

  /** Replace the rows (same shape: texts are swapped in place; otherwise the table is rebuilt). */
  setRows(rows: readonly (readonly string[])[]): void {
    const same = rows.length === this.rows.length && rows.every((r, i) => r.length === this.rows[i]!.length);
    if (same && this.bodyRows.length === rows.length) {
      rows.forEach((r, i) => r.forEach((text, j) => (this.bodyRows[i]!.cells[j]!.text = text)));
      this.rows = rows.map((r) => [...r]);
      return;
    }
    this.rows = rows.map((r) => [...r]);
    this.rebuild();
  }

  /** Highlight row `index` (-1 = none). */
  set highlight(index: number) {
    if (index === this.highlighted) return;
    this.highlighted = index;
    this.bodyRows.forEach((r, i) => {
      r.lit = i === index;
      r.repaint();
    });
  }
  get highlight(): number {
    return this.highlighted;
  }

  private rebuild(): void {
    this.clear();
    const all = this.head ? [this.head, ...this.rows] : this.rows;
    const cols = all.reduce((n, r) => Math.max(n, r.length), 0);
    const size = this.size ?? (cols >= 5 ? UI.text.caption : UI.text.small);
    // column weight = longest cell on one line, capped so a long note does not starve the numbers
    const weight = Array.from({ length: cols }, (_, j) =>
      Math.min(Math.max(...all.map((r) => new Label(r[j] ?? '', { size }).measure(Infinity)[0]), 24), 260),
    );
    // a column is never narrower than its longest word (cells wrap between words, never inside one)
    const word = Array.from({ length: cols }, (_, j) =>
      Math.max(
        ...all.flatMap((r) =>
          (r[j] ?? '').split(/\s+/).map((w) => new Label(w, { size, font: 'bodyBold' }).measure(Infinity)[0]),
        ),
        0,
      ),
    );
    const cell = (text: string, j: number, head: boolean): Label =>
      new Label(
        text,
        {
          size,
          font: head ? 'bodyBold' : j === 0 ? 'bodyBold' : 'body',
          color: head ? TEXT_COLOR.dim : j === 0 ? 'white' : 'mist',
          align: this.cellAlign?.[j] ?? (j === 0 ? 'left' : 'right'),
          lineHeight: 1.25,
        },
        { width: 'fill', grow: Math.max(weight[j]!, word[j]!), minW: Math.ceil(word[j]!) },
      );
    if (this.head)
      this.add(
        new Row(
          this.head.map((t, j) => cell(t, j, true)),
          'head',
        ),
      );
    this.bodyRows = this.rows.map(
      (r, i) =>
        new Row(
          Array.from({ length: cols }, (_, j) => cell(r[j] ?? '', j, false)),
          i % 2 ? 'even' : 'odd',
          i === this.highlighted,
        ),
    );
    this.add(...this.bodyRows);
  }
}

export interface StatItem {
  label: string;
  value: string;
  color?: ColorLike;
}

export interface StatGridProps extends NodeProps {
  items: readonly StatItem[];
  /** Cells per row. Default 3. */
  columns?: number;
}

class StatCell extends UiNode {
  readonly value: Label;
  constructor(item: StatItem) {
    super({ dir: 'col', gap: 2, width: 'fill', pad: [8, 12] });
    this.value = new Label(
      item.value,
      { font: 'mono', size: UI.text.h3, color: item.color ?? 'white', nowrap: true, reserve: 16 },
      { width: 'fill' },
    );
    this.add(
      new Label(
        item.label,
        { size: UI.text.caption, color: TEXT_COLOR.dim, lineHeight: 1.2 },
        { width: 'fill' },
      ),
      this.value,
    );
  }
  override paint(p: Painter): void {
    p.rect(0, 0, this.bw, this.bh, { r: 8, fill: rgba('bg.void', 0.55), border: rgba('slate', 0.55), bw: 1 });
  }
}

export class StatGrid extends UiNode {
  private readonly cells: StatCell[];

  constructor(props: StatGridProps) {
    super({ dir: 'col', width: 'fill', gap: 8, ...props });
    const columns = Math.max(props.columns ?? 3, 1);
    this.cells = props.items.map((it) => new StatCell(it));
    for (let i = 0; i < this.cells.length; i += columns) {
      const line = this.cells.slice(i, i + columns);
      // keep the cells of an incomplete last row as wide as the others
      const pad = Array.from({ length: columns - line.length }, () => new UiNode({ width: 'fill' }));
      this.add(
        new UiNode({ dir: 'row', width: 'fill', gap: 8, align: 'stretch', children: [...line, ...pad] }),
      );
    }
  }

  /** Update cell `index` (text only repaints when it changed). */
  set(index: number, value: string, color?: ColorLike): void {
    const cell = this.cells[index];
    if (!cell) return;
    cell.value.text = value;
    if (color !== undefined) cell.value.recolor(color);
  }
}
