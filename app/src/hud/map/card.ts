/**
 * Chapter card of the Journey Map: the selected node "unfolds" into its steps — numbered rows with titles and
 * visited marks; clicking a row travels there. Shown next to the focused platform.
 */
import { contentKey, isVisited, plural, type Visited } from '@/content';
import {
  Button,
  Chip,
  Control,
  Icon,
  Label,
  Panel,
  ProgressRing,
  ScrollView,
  TEXT_COLOR,
  UI,
  UiNode,
  lit,
  mixRgba,
  rgba,
  setAccent,
  type Painter,
} from '@/ui3d';
import type { JourneyChapter } from '../journey';

class StepRow extends Control {
  constructor(
    index: number,
    title: string,
    private readonly seen: boolean,
    private readonly current: boolean,
    pick: () => void,
  ) {
    super({ dir: 'row', align: 'center', gap: 12, width: 'fill', minH: UI.hit, pad: [6, 12, 6, 8] });
    this.lift = 2;
    this.squash = 0.985;
    this.activate = pick;
    this.add(
      new Label(
        String(index + 1),
        {
          font: 'mono',
          size: UI.text.caption,
          color: current ? 'bg.void' : 'white',
          align: 'center',
          nowrap: true,
        },
        { width: 30, height: 30 },
      ),
      new Label(
        title,
        { size: UI.text.small, lineHeight: 1.28, color: seen || current ? 'white' : TEXT_COLOR.dim },
        { width: 'fill' },
      ),
      new Icon(current ? 'target' : 'check', 18, current ? 'yellow' : 'green', 1, {
        opacity: seen || current ? 1 : 0,
      }),
    );
  }
  override paint(p: Painter): void {
    const accent = rgba(this.current ? 'yellow' : 'cyan');
    const hov = this.hoverT;
    this.paintFocus(p, this.bw, this.bh, 12);
    p.rect(0, 0, this.bw, this.bh - 2, {
      r: 12,
      fill: rgba('bg.violet', 0.25 + 0.5 * hov),
      border: [accent[0], accent[1], accent[2], (this.current ? 0.7 : 0) + 0.5 * hov],
      bw: 1.3,
    });
    const badge = this.current
      ? lit(accent, 1.2)
      : this.seen
        ? mixRgba(rgba('bg.indigo'), rgba('green'), 0.45)
        : rgba('bg.void', 0.8);
    p.circle(-this.bw / 2 + 8 + 15, 0, 30, { fill: badge, border: rgba('mist', 0.5), bw: 1 });
  }
}

export interface ChapterCardOptions {
  chapter: JourneyChapter;
  /** Short name of the chapter's group (part of the volume). */
  group: string;
  visited: Visited;
  /** Step the user is on, if this is the current chapter. */
  currentStep: string | null;
  maxHeight: number;
  onStep(stepId: string): void;
  onClose(): void;
}

export function chapterCard(o: ChapterCardOptions): Panel {
  const c = o.chapter;
  const key = contentKey(c);
  const done = c.steps.filter((s) => isVisited(o.visited, key, s.id)).length;
  const next = c.steps.find((s) => !isVisited(o.visited, key, s.id)) ?? c.steps[0]!;
  const start = o.currentStep ?? next.id;
  const list = new ScrollView({ height: 'hug', maxH: Math.max(o.maxHeight - 250, 180), gap: 2 });
  c.steps.forEach((s, i) => {
    const row = new StepRow(i, s.title, isVisited(o.visited, key, s.id), s.id === o.currentStep, () =>
      o.onStep(s.id),
    );
    row.name = `map-step-${s.id}`;
    list.content.add(row);
  });
  const label = o.currentStep
    ? 'Повернутися до кроку'
    : done === 0
      ? 'Почати розділ'
      : done >= c.steps.length
        ? 'Переглянути знову'
        : 'Продовжити';
  const card = new Panel({
    width: 470,
    gap: 12,
    children: [
      new UiNode({
        dir: 'row',
        align: 'start',
        gap: 12,
        width: 'fill',
        children: [
          new ProgressRing({
            size: 52,
            value: done / Math.max(c.steps.length, 1),
            label: `${done}/${c.steps.length}`,
          }),
          new UiNode({
            dir: 'col',
            gap: 2,
            width: 'fill',
            children: [
              new Label(o.group.toUpperCase(), {
                font: 'bodyBold',
                size: UI.text.caption,
                color: TEXT_COLOR.mute,
                letterSpacing: 0.08,
                nowrap: true,
              }),
              new Label(c.title, { font: 'display', size: UI.text.h2, lineHeight: 1.16 }, { width: 'fill' }),
            ],
          }),
          new Button({
            icon: 'close',
            variant: 'icon',
            size: 'sm',
            tooltip: 'Закрити (Esc)',
            onClick: o.onClose,
          }),
        ],
      }),
      new UiNode({
        dir: 'row',
        wrap: true,
        gap: 8,
        width: 'fill',
        children: [
          new Chip({ kind: 'scale', text: c.axisLabel }),
          new Chip({
            kind: 'plain',
            icon: 'layers',
            text: `${c.steps.length} ${plural(c.steps.length, ['крок', 'кроки', 'кроків'])}`,
          }),
        ],
      }),
      list,
      c.real
        ? new Button({
            label,
            icon: 'play',
            variant: 'primary',
            size: 'lg',
            width: 'fill',
            onClick: () => o.onStep(start),
          })
        : new Label(
            'Цей розділ ще будується — кроки показано для огляду.',
            { size: UI.text.small, color: TEXT_COLOR.dim },
            { width: 'fill' },
          ),
    ],
  });
  setAccent(card, c.accent);
  return card;
}
