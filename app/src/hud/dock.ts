/**
 * The step column: the step info panel and, under it, the control dock built from the chapter's `stepUi`
 * declaration (plus the optional board, `board.ts`). Wide screens: right column, flat (DECISIONS §59 p). Narrow /
 * portrait: a bottom sheet where «Опис» and «Керування» share the space through a tab switch (STYLE_GUIDE §6).
 *
 * Height budget (UI_API §3.1): the column never leaves the screen. The dock keeps its buttons in a sticky action
 * row at its bottom; when text and controls do not both fit, the text yields first (down to `TEXT_MIN`, it
 * scrolls), then the dock's controls scroll inside the dock, then the title switches to the compact size.
 */
import { Panel, ScrollView, Tabs, UiNode, conceal, reveal } from '@/ui3d';
import { fullChapterId, type HudMetrics } from '@/engine/api';
import { createBoard } from './board';
import type { HudContext, HudModule } from './context';
import { bindVisible, buildControls, honestyChips, type BuiltControls } from './dock-build';
import { PANEL_WIDTH, createStepPanel } from './step-panel';
import { bindingOf, watchBindings, type StepUiBinding } from './step-ui';
import type { StepUiSpec } from './step-ui-types';

/** Least height of the step text when the dock needs room (≈ 4 lines of body text), units. */
export const TEXT_MIN = 130;
/** Least height of the dock's scrolling controls before the title gets compact, units. */
export const DOCK_MIN = 150;
/** Gap between the panel and the dock. */
const GAP = 12;

export interface StepColumn extends HudModule {
  /** Called with the step's spec whenever the visible step UI changes (annotations listen). */
  onSpec: ((spec: StepUiSpec | null) => void) | null;
  /** The board module (mounted separately by the plugin for its own inset). */
  readonly board: HudModule;
}

export function createStepColumn(hud: HudContext, popups: UiNode, header: UiNode): StepColumn {
  const panel = createStepPanel(hud, popups);
  const board = createBoard(hud);
  const body = new ScrollView({ name: 'dock-scroll', height: 'hug', gap: 14 });
  const actions = new UiNode({
    name: 'dock-actions',
    dir: 'row',
    wrap: true,
    gap: 10,
    width: 'fill',
    justify: 'end',
  });
  const dock = new Panel({
    name: 'dock',
    width: PANEL_WIDTH,
    gap: 12,
    pad: [18, 22],
    visible: false,
    opacity: 0,
    children: [body, actions],
  });
  const tabs = new Tabs<'text' | 'controls'>({
    name: 'sheet-tabs',
    items: [
      { id: 'text', label: 'Опис' },
      { id: 'controls', label: 'Керування' },
    ],
    visible: false,
    onChange: () => hud.relayout(),
  });
  const node = new UiNode({
    name: 'step-column',
    dir: 'col',
    gap: GAP,
    float: { ax: 1, ay: 0 },
    children: [tabs, panel.node, dock],
  });
  let built: BuiltControls | null = null;
  let boardBuilt: BuiltControls | null = null;
  let tick: ((t: number) => void)[] = [];
  let binding: StepUiBinding | null = null;
  let chapterId = '';
  let stepId = '';
  let time = 0;
  let hintOff: (() => void) | null = null;
  const relayout = (): void => hud.relayout();

  const self: StepColumn = {
    node,
    onSpec: null,
    board,
    onChapter(m) {
      chapterId = fullChapterId(m);
      stepId = hud.engine.store.get().stepId ?? m.steps[0]!.id;
      panel.onChapter?.(m);
      rebuild(true);
    },
    onContent: (c) => panel.onContent?.(c),
    onStep(id, instant) {
      stepId = id;
      panel.onStep?.(id, instant);
      rebuild(instant);
    },
    update(dt) {
      time += dt;
      for (const fn of tick) fn(time);
    },
    onLayout(m) {
      if (m.layout === 'wide') layoutWide(m);
      else layoutSheet(m);
    },
  };

  const hasDock = (): boolean => built !== null && built.body.length + built.actions.length > 0;
  /** Lay the surface out now with the constraints set so far (field changes do not invalidate by themselves). */
  const measure = (): void => {
    hud.surface.invalidateLayout();
    hud.surface.flush();
  };

  /** Share `available` units of height between the text panel and the dock (see the file header). */
  function fitColumn(available: number, width: number, withText: boolean, withDock: boolean): void {
    panel.setCompact(false);
    body.maxH = 4000;
    panel.fit(width, 4000);
    measure();
    if (!withDock) {
      panel.fit(width, available - panel.chrome());
      measure();
      return;
    }
    const dockChrome = dock.bh - body.bh;
    const bodyWant = body.bh;
    if (!withText) {
      body.maxH = Math.max(available - dockChrome, 60);
      measure();
      return;
    }
    let chrome = panel.chrome();
    const textWant = panel.want();
    let space = available - chrome - GAP - dockChrome;
    // short of height: the title takes the compact size first (it gives back 1–2 lines of text)
    if (textWant + bodyWant > space) {
      panel.setCompact(true);
      measure();
      chrome = panel.chrome();
      space = available - chrome - GAP - dockChrome;
    }
    const text = Math.min(textWant, Math.max(Math.min(TEXT_MIN, textWant), space - bodyWant));
    body.maxH = Math.max(space - text, 60);
    panel.fit(width, text);
    measure();
  }

  function layoutWide(m: HudMetrics): void {
    const margin = m.safeMargin;
    const top = margin + 58;
    const withDock = hasDock();
    tabs.visible = false;
    panel.node.visible = true;
    dock.visible = withDock;
    dock.width = PANEL_WIDTH;
    node.float = { ax: 1, ay: 0, dx: -margin, dy: top };
    fitColumn(m.height - top - margin, PANEL_WIDTH, true, withDock);
    board.place(m, Math.max(header.by + header.bh + 14, top), 0);
    measure();
  }

  function layoutSheet(m: HudMetrics): void {
    const margin = m.safeMargin;
    const width = Math.min(m.width - margin * 2, 760);
    const bottom = margin + 78; // above the step navigator
    const withDock = hasDock();
    tabs.visible = withDock;
    const showDock = withDock && tabs.value === 'controls';
    panel.node.visible = !showDock;
    dock.visible = showDock;
    dock.width = width;
    tabs.width = Math.min(width, 360);
    node.float = { ax: 0.5, ay: 1, dy: -bottom };
    // the sheet may take up to 42 % of the height (45 % in portrait), never more than the free area under the header
    const headerBottom = header.by + header.bh + 12;
    const share = m.height * (m.layout === 'portrait' ? 0.45 : 0.42);
    const sheet = Math.min(share, m.height - headerBottom - bottom) - (withDock ? 44 + GAP : 0);
    fitColumn(sheet, width, !showDock, showDock);
    board.place(m, headerBottom, bottom + node.bh + 12);
    measure();
  }

  function rebuild(instant: boolean): void {
    hintOff?.();
    hintOff = null;
    if (binding) binding.push = binding.repatch = binding.flash = null;
    binding = bindingOf(chapterId) ?? null;
    binding?.onScreen.clear();
    const spec = binding?.specs.get(stepId) ?? null;
    built =
      binding && spec
        ? buildControls(binding, spec.controls ?? [], { where: 'dock', reset: spec.reset, relayout })
        : null;
    boardBuilt =
      binding && spec?.board
        ? buildControls(binding, spec.board.children, { where: 'board', reset: spec.reset, relayout })
        : null;
    const parts = [built, boardBuilt].filter((b): b is BuiltControls => b !== null);
    if (binding) {
      binding.push = (id, v) => parts.forEach((b) => b.push(id, v));
      binding.repatch = (id) => parts.forEach((b) => b.repatch(id));
      binding.flash = (id) => parts.forEach((b) => b.flash(id));
    }
    body.content.clear();
    actions.clear();
    for (const n of built?.body ?? []) body.content.add(n);
    for (const n of built?.actions ?? []) actions.add(n);
    actions.visible = (built?.actions.length ?? 0) > 0;
    body.visible = (built?.body.length ?? 0) > 0;
    body.scrollTo(0, true);
    const has = hasDock();
    if (has) reveal(dock, { instant, dy: -10 });
    else conceal(dock, { instant });
    if (!has) tabs.value = 'text';
    const chips = honestyChips(spec?.honesty, relayout);
    panel.setBadges(chips.chips);
    tick = [...(built?.tick ?? []), ...(boardBuilt?.tick ?? []), ...chips.tick];
    board.show(spec?.board ?? null, boardBuilt?.body ?? [], boardBuilt?.actions ?? [], instant);
    const boardWhen = bindVisible(board.node, spec?.board?.visible, relayout, { dy: 0 });
    if (boardWhen) tick.push(boardWhen);
    if (spec?.hint && !instant) hintOff = hud.toast(spec.hint, { icon: 'hand', duration: 6 });
    self.onSpec?.(spec);
    hud.relayout();
  }

  // a chapter may call `define()` after it became active (async scene code)
  watchBindings((id) => {
    if (id === chapterId) rebuild(true);
  });
  return self;
}
