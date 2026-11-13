/**
 * Step navigator (bottom centre of the free area): previous / next and one segment per step with the step
 * title in the tooltip; visited steps are filled. ←/→ are handled by the engine and reflected here.
 */
import { fullChapterId, type ChapterManifest } from '@/engine/api';
import { isVisited } from '@/content';
import { Button, Label, Panel, Stepper, TEXT_COLOR, UI, UiNode } from '@/ui3d';
import type { HudContext, HudModule } from './context';

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
  const node = new Panel({
    variant: 'card',
    dir: 'row',
    align: 'center',
    gap: 10,
    pad: [8, 12],
    radius: 34,
    float: { ax: 0.5, ay: 1 },
    children: [prev, middle, next],
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
    next.label = last && nav.canNext ? 'Далі: наступний розділ' : 'Далі';
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
      // centred in the area the step panel leaves free on wide screens
      const shift = m.layout === 'wide' ? -(hud.engine.hud.insetFractions().right * m.width) / 2 : 0;
      node.float = { ax: 0.5, ay: 1, dx: shift, dy: -m.safeMargin };
    },
  };
}
