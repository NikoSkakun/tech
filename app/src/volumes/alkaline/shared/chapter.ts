/**
 * The frame every chapter of `battery` uses: a step is a stage state (`spec`), a step UI (`ui`) and optional
 * `enter` / `leave` / `update`; `runChapter` registers them with the stage and the HUD, routes the frame to the step
 * on screen and ticks the world after it. What the reader reached lives in the chapter's session set (`goals`).
 */
import type { ChapterContext, SceneHooks, StepInfo, StepSpec } from '@/engine/api';
import { stepUi, type StepUiApi, type StepUiSpec } from '@/hud';
import type { BatteryWorld } from './world';

export interface StepDef {
  spec: StepSpec;
  ui: StepUiSpec;
  /** After the stage applied the step (also on deep links: honour `info.instant`). */
  enter?(info: StepInfo): void;
  leave?(): void;
  /** Every frame while the step is on screen, before the world's update. */
  update?(dt: number, t: number): void;
}

/** Goals reached in this session, per chapter (module state survives a rebuild of the scene). */
const SESSION = new Map<string, Set<string>>();
export function goals(chapter: string): { has(step: string): boolean; add(step: string): void } {
  let set = SESSION.get(chapter);
  if (!set) SESSION.set(chapter, (set = new Set()));
  const s = set;
  return { has: (step) => s.has(step), add: (step) => void s.add(step) };
}

/** A caption of a step («Підписи» of the script, by position) from a chapter's generated content. */
export function captions(
  chapter: string,
  content: { steps: readonly { id: string; labels?: readonly string[] }[] },
): (step: string, i: number) => string {
  return (step, i) => {
    const text = content.steps.find((x) => x.id === step)?.labels?.[i];
    if (text === undefined) throw new Error(`${chapter}: no caption ${i} in step '${step}'`);
    return text;
  };
}

export function runChapter(
  ctx: ChapterContext,
  world: BatteryWorld,
  steps: Record<string, StepDef>,
  extra: { update?(dt: number, t: number): void; enter?(id: string, info: StepInfo): void } = {},
): SceneHooks {
  const ui = stepUi(ctx) as StepUiApi<string>;
  ctx.stage.define(
    Object.fromEntries(
      Object.entries(steps).map(([id, s]) => [
        id,
        { ...s.spec, enter: s.enter?.bind(s), leave: s.leave?.bind(s) },
      ]),
    ),
  );
  ui.define(Object.fromEntries(Object.entries(steps).map(([id, s]) => [id, s.ui])));
  return {
    enterStep(id, info) {
      world.flips = 0;
      if (info.instant) world.stage.snap();
      extra.enter?.(id, info);
    },
    update(dt, t) {
      const id = ctx.stage.current;
      if (id !== null) steps[id]?.update?.(dt, t);
      extra.update?.(dt, t);
      world.update(dt, t);
    },
  };
}

export type { StepUiApi };
