/**
 * Objects that several steps share: the field table (frame always on screen, glass top a `fade` actor that
 * step 4 dissolves into the landscape), the charge sandbox and its field lines (steps 3 and 4). Steps add
 * their own objects under `ctx.root`.
 */
import type { Actor, ChapterContext } from '@/engine/api';
import { createSandbox, type Sandbox } from './parts/sandbox';
import { createSimLines, type SimLines } from './parts/sim-lines';
import { createTable, type FieldTable } from './parts/table';

export interface World {
  table: FieldTable;
  /** The glass top + grid; list it in `show` of every step that keeps the flat table. */
  top: Actor;
  /** Charges + tray of steps 3 and 4 (each step keeps its own arrangement and hands it over in `enter`). */
  sandbox: Sandbox;
  /** Field lines of the sandbox charges (a `fade` actor's object: `lines.lines`). */
  lines: SimLines;
  update(dt: number, t: number): void;
}

export function createWorld(ctx: ChapterContext): World {
  const table = createTable();
  ctx.root.add(table.group);
  const top = ctx.stage.actor(table.top, { appear: 'fade' });
  const sandbox = createSandbox(
    ctx,
    () => ctx.stage.current === 'field' || ctx.stage.current === 'potential',
  );
  const lines = createSimLines();
  ctx.root.add(sandbox.group, lines.lines);
  ctx.stage.actor(lines.lines, { appear: 'fade' });
  return {
    table,
    top,
    sandbox,
    lines,
    update(dt, t) {
      table.update(t);
      if (sandbox.group.visible) sandbox.update(dt, t);
    },
  };
}
