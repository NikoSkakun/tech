/**
 * Step navigator (bottom centre of the free area): previous / next and one segment per step with the step
 * title in the tooltip; visited steps are filled. ←/→ are handled by the engine and reflected here.
 */
import { fullChapterId, type ChapterManifest } from '@/engine/api';
import { isVisited } from '@/content';
import { Button, Label, Panel, Stepper, TEXT_COLOR, UI, UiNode, rgba, type Painter } from '@/ui3d';
import type { HudContext, HudModule } from './context';
import { TOUCH, sheetGeometry } from './touch/geometry';

/** Opaque strip behind the navigation row of the bottom sheet (touch portrait): content scrolls under it. */
class NavPlate extends UiNode {
  override paint(p: Painter): void {
    p.rect(0, 0, this.bw, this.bh, { fill: rgba('bg.void', 1) });
    p.rect(0, this.bh / 2 - 0.6, this.bw, 1.2, { fill: rgba('slate', 0.35) });
  }
}

export function createNavigator(hud: HudContext): HudModule {
  const { nav, store } = hud.engine;
  let manifest: ChapterManifest | null = null;
  const prev = new Button({
    name: 'nav-prev',
    icon: 'prev',
    variant: 'icon',
    tooltip: 'Попередній крок (←)',
    onClick: () => void nav.prev(),
  });
  const next = new Button({
    name: 'nav-next',
    icon: 'next',
    variant: 'primary',
    size: 'md',
    label: 'Далі',
    iconRight: true,
    tooltip: 'Наступний крок (→)',
    onClick: () => void nav.next(),
  });
  const dots = new Stepper({
    count: 0,
    onSelect: (i) => manifest && void nav.goto(fullChapterId(manifest), manifest.steps[i]!.id),
  });
  const counter = new Label(
    '',
    {
      font: 'mono',
      size: UI.text.caption,
      color: TEXT_COLOR.mute,
      nowrap: true,
      align: 'center',
      reserve: 8,
      stable: true,
    },
    { width: 64, height: 22 },
  );
  const middle = new UiNode({ dir: 'col', align: 'center', gap: 0, children: [dots, counter] });
  const plate = new NavPlate({ float: { ax: 0.5, ay: 0.5 }, visible: false });
  /** `desk`: the floating pill (as always); `sheet`: the bottom row of the sheet; `side`: a compact pill. */
  let mode: 'desk' | 'sheet' | 'side' = 'desk';
  const node = new Panel({
    variant: 'card',
    dir: 'row',
    align: 'center',
    gap: 10,
    pad: [8, 12],
    radius: 34,
    float: { ax: 0.5, ay: 1 },
    children: [plate, prev, middle, next],
  });

  const sync = (): void => {
    const pos = nav.position;
    if (!manifest || !pos || pos.volumeId !== manifest.volume || pos.chapterId !== manifest.id) return;
    const i = manifest.steps.findIndex((s) => s.id === pos.stepId);
    dots.index = i;
    counter.text = `${i + 1} / ${manifest.steps.length}`;
    prev.disabled = !nav.canPrev;
    next.disabled = !nav.canNext;
    const last = i === manifest.steps.length - 1;
    // the touch shells have no room for the long caption
    const onward = mode === 'desk' ? 'Далі: наступний розділ' : 'Наступний розділ';
    next.label = last && nav.canNext ? onward : 'Далі';
    const visited = store.get().progress.visited;
    const key = fullChapterId(manifest);
    manifest.steps.forEach((s, k) => dots.setVisited(k, isVisited(visited, key, s.id)));
  };
  store.subscribe((s) => s.target, sync);
  store.subscribe((s) => s.progress, sync);

  return {
    node,
    onChapter(m) {
      manifest = m;
      const fit = Math.min(44, Math.max(22, (hud.metrics.width * 0.5) / Math.max(m.steps.length, 1)));
      dots.build(
        m.steps.length,
        m.steps.map((s, i) => `${i + 1}. ${s.title}`),
        undefined,
        fit,
      );
      sync();
    },
    onStep: sync,
    onLayout(m) {
      if (m.shell !== mode) {
        mode = m.shell;
        const touch = mode !== 'desk';
        // touch: no dots (the counter says where we are; the map jumps to any step)
        dots.visible = !touch;
        counter.setStyle({ size: touch ? UI.text.small : UI.text.caption, color: touch ? TEXT_COLOR.dim : TEXT_COLOR.mute });
        counter.height = touch ? 28 : 22;
        node.variant = mode === 'sheet' ? 'plain' : 'card';
        node.layerUp = mode === 'sheet' ? 1 : 0;
        node.justify = mode === 'sheet' ? 'between' : 'start';
        plate.visible = mode === 'sheet';
        if (mode !== 'sheet') {
          node.width = 'hug';
          node.height = 'hug';
          node.pad = mode === 'desk' ? [8, 12] : [4, 6];
        }
        node.repaint();
        sync();
      }
      if (mode === 'sheet') {
        // the bottom row of the sheet: pinned to the screen, over the sheet's content
        const g = sheetGeometry(m, 0, false);
        node.width = g.width;
        node.height = TOUCH.navH + g.safeBottom;
        node.pad = [3, 10, 3 + g.safeBottom, 10];
        node.float = { ax: 0, ay: 1, dx: g.left, dy: 0 };
        plate.width = g.width;
        plate.height = TOUCH.navH + g.safeBottom;
        return;
      }
      // centred in the area the step panel leaves free on wide screens (and beside the side sheet)
      const beside = m.layout === 'wide' || mode === 'side';
      const shift = beside ? -(hud.engine.hud.insetFractions().right * m.width) / 2 : 0;
      const lift = mode === 'side' ? m.safeArea.bottom + TOUCH.edge : m.safeMargin;
      node.float = { ax: 0.5, ay: 1, dx: shift, dy: -lift };
    },
  };
}
