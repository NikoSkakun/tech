/**
 * Chapter header (top-left): volume (when the library level is shown) and part, chapter title, the chapter's
 * place on the volume's journey axis (electricity: scale chip `10ⁿ m`), chapter progress ring.
 */
import { groupLabel, type ChapterManifest } from '@/engine/api';
import { chapterProgress } from '@/content';
import { Chip, Label, Panel, ProgressRing, TEXT_COLOR, UI, UiNode } from '@/ui3d';
import type { HudContext, HudModule } from './context';

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
  let manifest: ChapterManifest | null = null;
  const progress = (): void => {
    if (!manifest) return;
    const p = chapterProgress(hud.engine.store.get().progress.visited, manifest);
    ring.value = p.fraction;
    ring.label = `${p.done}/${p.total}`;
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
      node.float = { ax: 0, ay: 0, dx: m.safeMargin, dy: m.safeMargin };
      title.setStyle({ maxWidth: m.layout === 'wide' ? 430 : Math.min(360, m.width * 0.42) });
    },
  };
}
