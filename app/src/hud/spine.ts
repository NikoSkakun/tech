/**
 * Scale spine (left edge, wide screens): a compact ladder of all main-path chapters for one-click jumps.
 * Groups are separated, the current chapter is highlighted, plant types / labs fan out next to their parent
 * while you are inside that family. Names appear in the tooltip. Narrow screens: hidden (the map replaces it).
 */
import { chapterProgress, contentKey } from '@/content';
import { Control, Panel, UiNode, lit, mixRgba, rgba, type Painter } from '@/ui3d';
import type { HudContext, HudModule } from './context';
import type { Journey, JourneyChapter } from './journey';

class SpineDot extends Control {
  /** 0…1: current-chapter emphasis (animated). */
  active = 0;
  fraction = 0;
  constructor(
    readonly chapter: JourneyChapter,
    private readonly small: boolean,
    onPick: (c: JourneyChapter) => void,
  ) {
    super({ name: `spine-${chapter.id}`, width: small ? 30 : 44, height: small ? 34 : 44 });
    this.lift = 3;
    this.activate = () => onPick(chapter);
    this.on({ tooltip: `${chapter.title} · ${chapter.axisLabel}` });
  }
  setActive(on: boolean): void {
    this.tween({ active: on ? 1 : 0 }, { duration: 0.3, ease: 'back.out' });
  }
  override paint(p: Painter): void {
    const tone = rgba(this.chapter.accent);
    const a = Math.min(Math.max(this.active, 0), 1.1);
    const base = this.small ? 9 : 13;
    const d = base + 7 * a + 3 * this.hoverT;
    this.paintFocus(p, d + 8, d + 8, (d + 8) / 2);
    if (this.fraction > 0.01)
      p.arc(0, 0, d + 9, 0, Math.PI * 2 * Math.min(this.fraction, 1), 2.4, {
        fill: [tone[0], tone[1], tone[2], 0.85],
      });
    p.circle(0, 0, d, {
      fill: mixRgba(
        mixRgba(rgba('bg.indigo'), tone, 0.45 + 0.35 * this.hoverT),
        lit(tone, 1.4),
        Math.min(a, 1),
      ),
      border: mixRgba(rgba('mist', 0.55), rgba('white'), Math.max(a, this.hoverT)),
      bw: 1.5,
      glow: 10,
      glowAlpha: 0.5 * Math.min(a, 1) + 0.25 * this.hoverT,
    });
  }
}

export function createSpine(hud: HudContext, journey: Journey): HudModule {
  const dots = new Map<string, SpineDot>();
  const families = new Map<string, UiNode>();
  const pick = (c: JourneyChapter): void => {
    if (c.real) hud.goto(contentKey(c));
    else hud.toast(`«${c.title}» ще будується.`, { tone: 'warning', duration: 2.5 });
  };
  const column = new UiNode({ dir: 'col', align: 'start', gap: 0 });
  let group = '';
  for (const root of journey.roots) {
    if (group && root.group !== group) column.add(new UiNode({ height: 12, width: 44 }));
    group = root.group;
    const dot = new SpineDot(root, false, pick);
    dots.set(root.id, dot);
    const kids = journey.childrenOf(root.id);
    if (kids.length === 0) {
      column.add(dot);
      continue;
    }
    const fan = new Panel({
      variant: 'inset',
      dir: 'row',
      pad: [0, 6],
      gap: 0,
      radius: 18,
      visible: false,
      opacity: 0,
      blocks: false,
    });
    for (const k of kids) {
      const kd = new SpineDot(k, true, pick);
      dots.set(k.id, kd);
      fan.add(kd);
    }
    families.set(root.id, fan);
    column.add(new UiNode({ dir: 'row', align: 'center', gap: 2, children: [dot, fan] }));
  }
  const node = new UiNode({ dir: 'col', float: { ax: 0, ay: 0.5 }, children: [column] });
  // the rail behind the dots
  const rail = new (class extends UiNode {
    override paint(p: Painter): void {
      p.rect(0, 0, 3, this.bh - 40, { r: 1.5, fill: rgba('slate', 0.55), fill2: rgba('bg.violet', 0.5) });
    }
  })({ float: { ax: 0, ay: 0.5, px: 0.5, dx: 22 }, width: 4, height: 'fill' });
  node.insert(rail, 0);

  let current = '';
  const refresh = (): void => {
    const visited = hud.engine.store.get().progress.visited;
    for (const [id, dot] of dots) {
      const c = journey.get(id)!;
      const f = chapterProgress(visited, c).fraction;
      if (f !== dot.fraction) {
        dot.fraction = f;
        dot.repaint();
      }
    }
  };
  hud.engine.store.subscribe((s) => s.progress, refresh);
  refresh();

  return {
    node,
    onChapter(m) {
      dots.get(current)?.setActive(false);
      current = m.id;
      dots.get(current)?.setActive(true);
      const family = journey.get(m.id)?.parent ?? m.id;
      const tweens = hud.surface.host.tweens;
      for (const [id, fan] of families) {
        const open = id === family;
        if (open === fan.visible) continue;
        fan.visible = open;
        tweens.to(fan, { opacity: open ? 1 : 0 }, { duration: 0.25 });
      }
      hud.relayout();
    },
    onLayout(m) {
      node.visible = m.layout === 'wide';
      node.float = { ax: 0, ay: 0.5, dx: m.safeMargin - 6, dy: 30 };
    },
  };
}
