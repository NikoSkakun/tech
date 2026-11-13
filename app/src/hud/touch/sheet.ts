/**
 * The sheet of the touch shells (F5, `docs/MOBILE.md`) — where a phone or tablet shows what the desktop shows
 * in the step column and on the board, driven by the same `stepUi` declarations:
 *
 *   portrait (`sheet` shell)  — a bottom sheet: grip, step title, tabs «Текст» / «Керування» / «Графіки»,
 *                               the active view; three snap heights (peek / half / full); the navigation row
 *                               (`navigator.ts`) stays pinned to the screen bottom over it;
 *   landscape (`side` shell)  — a side sheet on the right with the same head and views; collapses to its grip.
 *
 * Moving the sheet never re-lays the HUD out: the sheet is laid out at its largest size and slides with a
 * presentation offset; the views are re-fitted once, when a snap is reached. The camera director gets the
 * sheet's size as an inset (never more than `half`: the full sheet is for reading, the framing stays).
 */
import type { DragInfo, HudMetrics, Tween } from '@/engine/api';
import { Button, Label, ScrollView, Tabs, UiNode, type Panel, type TabItem } from '@/ui3d';
import type { StepBoard } from '../board';
import type { HudContext } from '../context';
import type { StepPanel } from '../step-panel';
import { TOUCH, settleSnap, sheetGeometry, sideWidth, touchTop, type SheetGeometry, type SheetSnap } from './geometry';
import { Grip, SheetPlate } from './plates';

export type SheetTab = 'text' | 'controls' | 'board';

/** The step column's nodes the sheet shows as its views. */
export interface SheetParts {
  readonly panel: StepPanel;
  readonly dock: Panel;
  readonly dockBody: ScrollView;
  readonly board: StepBoard;
}

export interface SheetInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TouchSheet {
  readonly node: UiNode;
  readonly tab: SheetTab;
  readonly snap: SheetSnap;
  /** Take the column's views into the sheet (`true`) or release them for the desktop layouts (`false`). */
  adopt(on: boolean): void;
  /** Lay the sheet out; `has` — which tabs the step on screen offers besides the text. */
  layout(m: HudMetrics, has: { controls: boolean; board: boolean }): void;
  /** A new step is on screen: back to the text, at the height remembered for this kind of step. */
  enterStep(instant: boolean): void;
  setTab(tab: SheetTab): void;
  setSnap(snap: SheetSnap, opts?: { instant?: boolean }): void;
  /**
   * Show a card (an opened hotspot, the chapter quiz) in place of the views; the returned function removes it.
   * `back`: put a «Назад» button above a card that has no close button of its own.
   */
  showCard(card: UiNode, onDismiss: () => void, opts?: { back?: boolean }): () => void;
  /** Area the sheet and the compact header take from the scene, HUD units from each edge. */
  insets(m: HudMetrics): SheetInsets;
}

const TAB_LABEL: Record<SheetTab, string> = { text: 'Текст', controls: 'Керування', board: 'Графіки' };

export function createTouchSheet(hud: HudContext, parts: SheetParts): TouchSheet {
  const tweens = hud.surface.host.tweens;
  const plate = new SheetPlate('bottom', { float: { ax: 0.5, ay: 0.5 }, name: 'sheet-plate' });
  const grip = new Grip(false, { name: 'sheet-grip', width: 'fill', height: TOUCH.gripH });
  const sideGrip = new Grip(true, { name: 'sheet-side-grip', width: TOUCH.sideGrip, height: 'fill' });
  grip.minHit = sideGrip.minHit = 44;
  const title = new Label('', { font: 'display', size: 20, lineHeight: 1.16 }, { name: 'sheet-title', width: 'fill' });
  const titleRow = new UiNode({ dir: 'col', width: 'fill', children: [title] });
  const tabsHost = new UiNode({ dir: 'col', width: 'fill', visible: false });
  const cardHost = new ScrollView({ name: 'sheet-card', height: 'hug', gap: 8, visible: false });
  const views = new UiNode({ name: 'sheet-views', dir: 'stack', width: 'fill', children: [cardHost] });
  const inner = new UiNode({ dir: 'col', gap: 0, width: 'fill', children: [grip, titleRow, tabsHost, views] });
  const node = new UiNode({ name: 'sheet', dir: 'row', visible: false, children: [plate, sideGrip, inner] });

  // the sheet is laid out at its largest size and slides: its box may leave the screen, its targets never do
  (node as { clickable?: boolean }).clickable = false;

  let mode: 'sheet' | 'side' = 'sheet';
  let adopted = false;
  let tab: SheetTab = 'text';
  let snap: SheetSnap = 'half';
  let has = { controls: false, board: false };
  let tabs: Tabs<SheetTab> | null = null;
  let tabsKey = '';
  let geo: SheetGeometry | null = null;
  let metrics: HudMetrics | null = null;
  /** Portrait: visible height of the sheet; landscape: visible width. Animated between snaps. */
  const pos = { v: 0 };
  let moving = false;
  let anim: Tween | null = null;
  let dragFrom = 0;
  let velocity = 0;
  let lastDragAt = 0;
  /** Height the views are fitted to right now. */
  let fitted = -1;
  /** Height the text view's scroll area has been given. */
  let textMax = 4000;
  let card: { node: UiNode; dismiss: () => void } | null = null;
  /** Snap remembered per kind of step (which tabs it has), for this session. */
  const memory = new Map<string, SheetSnap>();
  const kind = (): string => `${has.controls ? 'c' : ''}${has.board ? 'g' : ''}`;

  const measure = (): void => {
    hud.surface.invalidateLayout();
    hud.surface.flush();
  };
  const open = (): boolean => snap !== 'peek';
  /** Size of the sheet at a snap: height (portrait) or width (landscape). */
  const extent = (s: SheetSnap): number => {
    if (!geo || !metrics) return 0;
    if (mode === 'sheet') return geo[s];
    return s === 'peek' ? TOUCH.sideGrip : sideWidth(metrics);
  };
  /** Slide the laid-out sheet to the current `pos` (presentation only — no layout). */
  const place = (): void => {
    if (!geo || !metrics) return;
    if (mode === 'sheet') {
      node.x = 0;
      node.y = -(geo.full - pos.v);
    } else {
      node.y = 0;
      node.x = sideWidth(metrics) - pos.v;
    }
  };

  /** Height the active view may take at a snap. */
  const viewHeight = (s: SheetSnap): number => {
    if (!geo || !metrics) return 0;
    if (mode === 'sheet') return geo.view[s];
    const m = metrics;
    const head = m.safeArea.top + TOUCH.edge + 8 + titleRow.bh + (tabs ? TOUCH.tabsH + 8 : 0) + 4;
    return Math.max(m.height - head - m.safeArea.bottom - TOUCH.edge, 80);
  };

  /** Fit the view on screen to `height` (two passes: the views report their fixed parts after a layout). */
  const fit = (height: number): void => {
    if (!metrics) return;
    fitted = height;
    const width = inner.bw - TOUCH.padX * 2;
    if (width <= 0 || height <= 0) return;
    if (card) {
      cardHost.maxH = height;
      card.node.width = width;
    } else if (tab === 'text') {
      // (never through an intermediate "unlimited" pass: a scroll view that briefly has nothing to scroll
      // forgets its position)
      parts.panel.fit(width, textMax);
      measure();
      textMax = Math.max(height - parts.panel.chrome(), 60);
      parts.panel.fit(width, textMax);
    } else if (tab === 'controls') {
      parts.dock.width = width;
      measure();
      parts.dockBody.maxH = Math.max(height - (parts.dock.bh - parts.dockBody.bh), 60);
    } else {
      parts.board.fitTouch(width, height);
      measure();
      parts.board.fitTouch(width, height);
    }
    measure();
  };

  /** Which view is on screen follows the tab (or the open card) and whether the sheet is open at all. */
  const showViews = (): void => {
    const on = open() || moving;
    cardHost.visible = on && card !== null;
    parts.panel.node.visible = on && !card && tab === 'text';
    parts.dock.visible = on && !card && tab === 'controls' && has.controls;
    parts.board.node.visible = on && !card && tab === 'board' && has.board;
  };

  const buildTabs = (): void => {
    const items: TabItem<SheetTab>[] = [{ id: 'text', label: TAB_LABEL.text }];
    if (has.controls) items.push({ id: 'controls', label: TAB_LABEL.controls });
    if (has.board) items.push({ id: 'board', label: TAB_LABEL.board });
    const key = items.map((i) => i.id).join();
    if (key === tabsKey) {
      if (tabs && tabs.value !== tab) tabs.value = tab;
      return;
    }
    tabsKey = key;
    tabsHost.clear();
    tabs = null;
    tabsHost.visible = items.length > 1;
    if (items.length < 2) return;
    tabs = new Tabs<SheetTab>({
      name: 'sheet-tabs',
      items,
      value: tab,
      width: 'fill',
      onChange: (id) => self.setTab(id),
    });
    tabsHost.add(tabs);
  };

  const reportInsets = (): void => {
    if (!metrics) return;
    hud.engine.hud.setInsets(self.insets(metrics));
  };

  const self: TouchSheet = {
    node,
    get tab() {
      return tab;
    },
    get snap() {
      return snap;
    },
    adopt(on) {
      if (on === adopted) return;
      adopted = on;
      node.visible = on;
      parts.panel.setTouch(on);
      parts.board.setTouch(on);
      const dock = parts.dock;
      dock.variant = on ? 'plain' : 'glass';
      dock.pad = on ? 0 : [18, 22];
      dock.repaint();
      if (on) {
        for (const v of [parts.panel.node, dock, parts.board.node]) {
          v.float = null;
          views.add(v);
        }
        fitted = -1;
      }
    },
    layout(m, next) {
      metrics = m;
      has = next;
      if (tab === 'controls' && !has.controls) tab = 'text';
      if (tab === 'board' && !has.board) tab = 'text';
      const side = m.shell === 'side';
      if ((side ? 'side' : 'sheet') !== mode) {
        mode = side ? 'side' : 'sheet';
        moving = false;
        fitted = -1;
      }
      plate.edge = side ? 'right' : 'bottom';
      grip.visible = !side;
      sideGrip.visible = side;
      title.text = parts.panel.stepTitle;
      buildTabs();
      const safe = m.safeArea;
      const padTop = side ? safe.top + TOUCH.edge + 8 : 0;
      inner.pad = [padTop, 0, 0, 0];
      titleRow.pad = [0, TOUCH.padX, 6, TOUCH.padX];
      tabsHost.pad = [0, TOUCH.padX - 4, 8, TOUCH.padX - 4];
      views.pad = [0, TOUCH.padX, 0, TOUCH.padX];
      // pass 1: widths, so the title's height (1–3 lines) is known
      const sideW = sideWidth(m);
      if (side) {
        node.width = sideW + safe.right;
        node.height = m.height;
        node.float = { ax: 1, ay: 0, dx: 0, dy: 0 };
        inner.width = sideW - TOUCH.sideGrip;
      } else {
        const g0 = sheetGeometry(m, 0, false);
        node.width = g0.width;
        node.float = { ax: 0, ay: 1, dx: g0.left, dy: 0 };
        inner.width = g0.width;
      }
      showViews();
      measure();
      geo = sheetGeometry(m, titleRow.bh, tabs !== null);
      if (!side) node.height = geo.full;
      plate.width = node.width;
      plate.height = side ? m.height : geo.full;
      if (!moving) pos.v = extent(snap);
      place();
      // the views are fitted for where the sheet is heading (never smaller than what is being revealed)
      fit(viewHeight(open() ? snap : 'half'));
      reportInsets();
    },
    enterStep(instant) {
      if (card) card.dismiss();
      tab = 'text';
      if (tabs && tabs.value !== 'text') tabs.value = 'text';
      // the scene change is part of the step: a sheet left at `full` comes back at `half`
      const kept = memory.get(kind()) ?? 'half';
      self.setSnap(kept === 'full' ? 'half' : kept, { instant });
      hud.relayout();
    },
    setTab(next) {
      if (card) card.dismiss();
      if (next === tab && open()) return;
      tab = next;
      if (tabs && tabs.value !== next) tabs.value = next;
      showViews();
      fitted = -1;
      if (!open()) self.setSnap('half');
      hud.relayout();
    },
    setSnap(next, opts = {}) {
      snap = next;
      memory.set(kind(), next);
      if (!geo || !metrics) return;
      const to = extent(next);
      const height = viewHeight(next === 'peek' ? 'half' : next);
      moving = true;
      showViews();
      // growing: the newly revealed part must be laid out before it shows
      if (next !== 'peek' && height > fitted) fit(height);
      reportInsets();
      hud.relayout(); // header and system buttons follow the side sheet
      const done = (): void => {
        moving = false;
        pos.v = to;
        place();
        showViews();
        if (next !== 'peek' && height !== fitted) fit(height);
        hud.relayout();
      };
      anim?.kill();
      anim = null;
      if (opts.instant || hud.engine.reducedMotion) {
        done();
        return;
      }
      anim = tweens.to(pos, { v: to }, { duration: 0.34, ease: 'power3.out', onUpdate: place, onComplete: done });
    },
    showCard(cardNode, onDismiss, opts = {}) {
      if (card) card.dismiss();
      const entry = {
        node: cardNode,
        dismiss: () => {
          if (card !== entry) return;
          card = null;
          cardHost.content.clear();
          onDismiss();
          showViews();
          fitted = -1;
          hud.relayout();
        },
      };
      card = entry;
      cardHost.content.clear();
      if (opts.back)
        cardHost.content.add(
          new Button({
            name: 'sheet-card-back',
            label: 'Назад до кроку',
            icon: 'arrowLeft',
            variant: 'ghost',
            size: 'sm',
            alignSelf: 'start',
            onClick: () => entry.dismiss(),
          }),
        );
      cardHost.content.add(cardNode);
      cardHost.scrollTo(0, true);
      showViews();
      fitted = -1;
      if (!open()) self.setSnap('half');
      hud.relayout();
      return entry.dismiss;
    },
    insets(m) {
      const top = touchTop(m) + 6;
      if (m.shell === 'side') {
        const right = (open() ? sideWidth(m) : TOUCH.sideGrip) + m.safeArea.right;
        return { left: m.safeArea.left, right, top, bottom: TOUCH.navH + m.safeArea.bottom + TOUCH.edge };
      }
      const g = geo ?? sheetGeometry(m, 26, true);
      // `full` is for reading: the scene keeps the framing of `half` behind it
      return { left: 0, right: 0, top, bottom: Math.min(g[snap], g.half) };
    },
  };

  /* ------------------------------------------------------------------------------------ dragging */

  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
  const dragStart = (): void => {
    if (!geo || !metrics) return;
    anim?.kill();
    anim = null;
    moving = true;
    dragFrom = pos.v;
    velocity = 0;
    lastDragAt = performance.now();
    grip.hot = sideGrip.hot = 1;
    grip.repaint();
    sideGrip.repaint();
    showViews();
    // whatever the drag can reveal is laid out up front; nothing is laid out while the finger moves
    const height = viewHeight(mode === 'sheet' ? 'full' : 'half');
    if (height > fitted) fit(height);
  };
  const drag = (e: DragInfo): void => {
    if (!geo || !metrics) return;
    const ppu = Math.max(metrics.pxPerUnit, 0.01);
    const now = performance.now();
    const dt = Math.max((now - lastDragAt) / 1000, 1 / 240);
    lastDragAt = now;
    const next =
      mode === 'sheet'
        ? clamp(dragFrom - e.totalY / ppu, geo.peek - 18, geo.full + 12)
        : clamp(dragFrom - e.totalX / ppu, TOUCH.sideGrip, sideWidth(metrics));
    velocity = velocity * 0.6 + ((next - pos.v) / dt) * 0.4;
    pos.v = next;
    place();
  };
  const dragEnd = (): void => {
    if (!geo || !metrics) return;
    grip.hot = sideGrip.hot = 0;
    grip.repaint();
    sideGrip.repaint();
    const v = performance.now() - lastDragAt > 90 ? 0 : velocity; // the finger rested before lifting
    if (mode === 'sheet') self.setSnap(settleSnap(pos.v, v, geo));
    else self.setSnap(pos.v + v * 0.18 > sideWidth(metrics) / 2 ? 'half' : 'peek');
  };
  const toggle = (): void => {
    if (mode === 'side') self.setSnap(open() ? 'peek' : 'half');
    else self.setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'peek' : 'half');
  };
  const handlers = { dragStart, drag, dragEnd };
  // the whole sheet takes drags along its axis that its content does not want (see `UiNode.wantsDrag`)
  node.on({ cursor: 'default', ...handlers, wheel: () => true, click: () => !open() && self.setSnap('half') });
  node.wantsDrag = (dx, dy) => (mode === 'sheet' ? Math.abs(dy) >= Math.abs(dx) : Math.abs(dx) > Math.abs(dy));
  grip.on({ cursor: 'grab', tooltip: 'Потягніть або торкніться: розгорнути чи згорнути панель', ...handlers, click: toggle });
  sideGrip.on({ cursor: 'grab', tooltip: 'Торкніться: сховати чи показати панель', ...handlers, click: toggle });
  return self;
}
