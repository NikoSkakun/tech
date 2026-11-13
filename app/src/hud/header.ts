/**
 * Chapter header (top-left): volume (when the library level is shown) and part, chapter title, the chapter's
 * place on the volume's journey axis (electricity: scale chip `10ⁿ m`), chapter progress ring.
 */
import { groupLabel, type ChapterManifest } from '@/engine/api';
import { chapterProgress } from '@/content';
import { Chip, Label, Panel, ProgressRing, TEXT_COLOR, UI, UiNode } from '@/ui3d';
import type { HudContext, HudModule } from './context';
import { TOUCH } from './touch/geometry';

export function createHeader(hud: HudContext): HudModule {
  const group = new Label('', {
    font: 'bodyBold',
    size: UI.text.caption,
    color: TEXT_COLOR.mute,
    letterSpacing: 0.08,
    nowrap: true,
  });
  const title = new Label('', { font: 'display', size: UI.text.h2, lineHeight: 1.16, maxWidth: 430 });
  const scale = new Chip({ kind: 'scale', text: '', tooltip: '' });
  const ring = new ProgressRing({ size: 46, label: '' });
  ring.on({ tooltip: 'Переглянуто кроків у розділі' });
  const node = new Panel({
    variant: 'card',
    dir: 'row',
    align: 'center',
    gap: 14,
    pad: [12, 18, 12, 14],
    float: { ax: 0, ay: 0 },
    children: [ring, new UiNode({ dir: 'col', gap: 2, children: [group, title] }), scale],
  });
  const deskParts = [...node.children];
  let manifest: ChapterManifest | null = null;
  // touch shells (phones, tablets): one compact row — a small ring and the chapter title on one line
  const miniRing = new ProgressRing({ size: 30, thickness: 4, visible: false });
  const miniTitle = new Label(
    '',
    { font: 'display', size: UI.text.small, nowrap: true },
    { name: 'header-title', visible: false },
  );
  node.add(miniRing, miniTitle);
  let touch = false;
  const progress = (): void => {
    if (!manifest) return;
    const p = chapterProgress(hud.engine.store.get().progress.visited, manifest);
    ring.value = p.fraction;
    ring.label = `${p.done}/${p.total}`;
    miniRing.value = p.fraction;
  };
  /** The chapter title cut to `width` units with an ellipsis (the label never wraps). */
  const fitTitle = (width: number): void => {
    const full = manifest?.title ?? '';
    miniTitle.text = full;
    if (miniTitle.measure(4000)[0] <= width) return;
    let lo = 1;
    let hi = full.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      miniTitle.text = `${full.slice(0, mid).trimEnd()}…`;
      if (miniTitle.measure(4000)[0] <= width) lo = mid;
      else hi = mid - 1;
    }
    miniTitle.text = `${full.slice(0, lo).trimEnd()}…`;
  };
  hud.engine.store.subscribe((s) => s.progress, progress);
  return {
    node,
    onChapter(m) {
      manifest = m;
      const volume = hud.engine.library.get(m.volume);
      const parent = hud.engine.library.registry(m.volume)?.parentOf(m.id);
      // «ТОМ · ЧАСТИНА · БАТЬКІВСЬКИЙ РОЗДІЛ»; the volume is named only when the library level is shown
      const path = [
        volume && hud.libraryLevel ? volume.title : '',
        volume ? groupLabel(volume, m.group) : '',
        parent ? parent.title : '',
      ];
      group.text = path
        .filter((p) => p !== '')
        .join(' · ')
        .toUpperCase();
      title.text = m.title;
      scale.label = m.axisLabel;
      scale.on({ tooltip: volume?.journey.axis.hint ?? '' });
      progress();
    },
    onLayout(m) {
      const now = m.shell !== 'desk';
      if (now !== touch) {
        touch = now;
        for (const n of deskParts) n.visible = !touch;
        miniRing.visible = miniTitle.visible = touch;
        node.pad = touch ? [0, 16, 0, 9] : [12, 18, 12, 14];
        node.gap = touch ? 9 : 14;
        node.radius = touch ? TOUCH.headerH / 2 : UI.radius.card;
        node.height = touch ? TOUCH.headerH : 'hug';
        node.repaint();
      }
      if (touch) {
        const left = m.safeArea.left + TOUCH.edge;
        node.float = { ax: 0, ay: 0, dx: left, dy: m.safeArea.top + TOUCH.edge };
        // room: up to the two system buttons (portrait) or up to the side sheet (landscape)
        const right = m.shell === 'side' ? (hud.touch.insets?.(m).right ?? 0) : m.safeArea.right;
        const buttons = 46 * 2 + 8 + TOUCH.edge * 2;
        fitTitle(Math.max(m.width - left - right - buttons - (30 + 9 + 9 + 16), 60));
        return;
      }
      node.float = { ax: 0, ay: 0, dx: m.safeMargin, dy: m.safeMargin };
      title.setStyle({ maxWidth: m.layout === 'wide' ? 430 : Math.min(360, m.width * 0.42) });
    },
  };
}
