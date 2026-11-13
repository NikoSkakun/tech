/**
 * QuizCard — one question at a time: options as big buttons, instant feedback (the right answer turns green,
 * a wrong pick shakes and turns red), the explanation, then «Далі»; ends with the score.
 */
import type { QuizItem } from '@/content/types';
import { conceal, reveal, shake } from '../core/anim';
import { sfx } from '../core/focus';
import { UiNode } from '../core/node';
import { mixRgba, rgba, type Painter } from '../core/painter';
import { accentOf, STATUS, TEXT_COLOR, UI } from '../theme';
import { Button } from './button';
import { Control } from './control';
import { Label } from './label';
import { Icon, Panel, type PanelProps } from './panel';
import { Stepper } from './stepper';

const LETTERS = ['а', 'б', 'в', 'г', 'д', 'е'];

class Option extends Control {
  /** 0 idle · 1 correct · −1 wrong (animated). */
  verdict = 0;
  locked = false;
  private readonly mark: Icon;
  constructor(
    index: number,
    text: string,
    private readonly pick: () => void,
  ) {
    super({ dir: 'row', align: 'center', gap: 12, width: 'fill', minH: 52, pad: [9, 14, 9, 12] });
    this.lift = 3;
    this.squash = 0.98;
    this.mark = new Icon('check', 22, 'white', 1, { visible: false });
    this.add(
      new Label(
        LETTERS[index] ?? String(index + 1),
        { font: 'display', size: UI.text.small, color: TEXT_COLOR.dim, align: 'center', nowrap: true },
        { width: 26, height: 26 },
      ),
      new Label(text, { size: UI.text.small, lineHeight: 1.34 }, { width: 'fill' }),
      this.mark,
    );
  }
  protected override activate(): void {
    if (!this.locked) this.pick();
  }
  resolve(correct: boolean): void {
    this.mark.set(correct ? 'check' : 'close', correct ? STATUS.ok : STATUS.alarm);
    this.mark.visible = true;
    this.tween({ verdict: correct ? 1 : -1 }, { duration: 0.25 });
    if (!correct) shake(this);
  }
  override paint(p: Painter): void {
    const accent = rgba(accentOf(this));
    const v = this.verdict;
    const tone = v > 0 ? rgba(STATUS.ok) : v < 0 ? rgba(STATUS.alarm) : accent;
    const hov = this.locked ? 0 : this.hoverT;
    const r = UI.radius.control;
    this.paintFocus(p, this.bw, this.bh, r);
    p.rect(0, 0, this.bw, this.bh, {
      r,
      fill: mixRgba(
        rgba('bg.indigo', 0.92),
        [tone[0] * 0.32, tone[1] * 0.32, tone[2] * 0.32, 0.96],
        Math.abs(v),
      ),
      fill2: rgba('bg.deep', 0.96),
      border: [tone[0], tone[1], tone[2], 0.35 + 0.5 * Math.max(hov, Math.abs(v))],
      bw: 1.5,
      glow: 9,
      glowAlpha: 0.22 * Math.max(hov, Math.abs(v)),
    });
    p.circle(-this.bw / 2 + 12 + 13, 0, 28, {
      fill: rgba('bg.void', 0.7),
      border: [tone[0], tone[1], tone[2], 0.6],
      bw: 1.2,
    });
  }
}

export interface QuizProps extends PanelProps {
  items: readonly QuizItem[];
  title?: string;
  /** Called after each answer. */
  onAnswer?: (index: number, correct: boolean) => void;
  /** Called with the number of correct answers when the last question was answered and «Готово» pressed. */
  onDone?: (score: number, total: number) => void;
}

export class QuizCard extends Panel {
  private readonly items: readonly QuizItem[];
  private readonly body: UiNode;
  private readonly dots: Stepper;
  private readonly onAnswer: QuizProps['onAnswer'];
  private readonly onDone: QuizProps['onDone'];
  private at = 0;
  private score = 0;

  constructor(props: QuizProps) {
    super({ variant: 'card', dir: 'col', gap: UI.gap.md, width: 520, ...props });
    this.items = props.items;
    this.onAnswer = props.onAnswer;
    this.onDone = props.onDone;
    this.dots = new Stepper({ count: props.items.length, pitch: 28 });
    this.dots.walk((n) => (n.enabled = n === this.dots)); // progress only, not clickable
    this.body = new UiNode({ dir: 'col', gap: UI.gap.sm, width: 'fill' });
    this.add(
      new UiNode({
        dir: 'row',
        align: 'center',
        justify: 'between',
        width: 'fill',
        children: [
          new UiNode({
            dir: 'row',
            align: 'center',
            gap: 8,
            children: [
              new Icon('quiz', 24, 'yellow'),
              new Label(props.title ?? 'Міні-квіз', { font: 'display', size: UI.text.h3, nowrap: true }),
            ],
          }),
          this.dots,
        ],
      }),
      this.body,
    );
    this.show(0);
  }

  private show(index: number): void {
    this.at = index;
    this.dots.index = index;
    this.body.clear();
    const item = this.items[index];
    if (!item) {
      const total = this.items.length;
      this.body.add(
        new Label(
          `Результат: **${this.score} з ${total}**`,
          { font: 'display', size: UI.text.h2 },
          { width: 'fill' },
        ),
        new Label(
          this.score === total
            ? 'Бездоганно! Усі відповіді правильні.'
            : 'Пояснення до кожного питання — у кроках розділу. Можна спробувати ще раз.',
          { size: UI.text.small, color: TEXT_COLOR.dim },
          { width: 'fill' },
        ),
        new UiNode({
          dir: 'row',
          gap: 10,
          children: [
            new Button({ label: 'Ще раз', icon: 'resetView', onClick: () => this.restart() }),
            new Button({
              label: 'Готово',
              variant: 'primary',
              icon: 'check',
              onClick: () => this.onDone?.(this.score, total),
            }),
          ],
        }),
      );
      return;
    }
    const options: Option[] = [];
    const explain = new Label(
      item.explanation ? `_Пояснення._ ${item.explanation}` : '',
      { size: UI.text.small, color: TEXT_COLOR.dim, lineHeight: 1.4 },
      { width: 'fill', visible: false, opacity: 0 },
    );
    const next = new Button({
      label: index + 1 < this.items.length ? 'Далі' : 'Результат',
      variant: 'primary',
      icon: 'next',
      iconRight: true,
      alignSelf: 'end',
      visible: false,
      opacity: 0,
      onClick: () => this.show(index + 1),
    });
    item.options.forEach((text, i) => {
      const option = new Option(i, text, () => {
        const right = i === item.correct;
        for (const o of options) o.locked = true;
        option.resolve(right);
        if (!right) options[item.correct]?.resolve(true);
        if (right) this.score++;
        sfx(right ? 'success' : 'error');
        this.dots.setVisited(index);
        if (item.explanation) reveal(explain, { dy: 8, scale: 1 });
        reveal(next, { dy: 8 });
        this.onAnswer?.(index, right);
      });
      options.push(option);
    });
    this.body.add(
      new Label(item.question, { font: 'bodyBold', size: UI.text.body, lineHeight: 1.36 }, { width: 'fill' }),
      ...options,
      explain,
      next,
    );
  }

  /** Start over. */
  restart(): void {
    this.score = 0;
    this.dots.build(this.items.length, undefined, undefined, 28);
    this.dots.walk((n) => (n.enabled = n === this.dots));
    this.show(0);
  }

  /** Question currently shown (= item count when the result is on screen). */
  get position(): number {
    return this.at;
  }
}

/** Fade a quiz (or any card) out and remove it. */
export function dismissCard(card: UiNode): void {
  conceal(card, { onDone: () => card.detach() });
}
