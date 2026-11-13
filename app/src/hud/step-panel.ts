/**
 * Step info panel: step counter, title, pages of rich text, the sections accordion and the quiz entry.
 * Wide screens: right column. Narrow / portrait: bottom sheet (STYLE_GUIDE §6).
 * Without chapter content it falls back to the manifest's step title and blurb.
 */
import type { ChapterManifest } from '@/engine/api';
import type { ChapterContent } from '@/content';
import {
  Button,
  Label,
  Pager,
  Panel,
  QuizCard,
  ScrollView,
  TEXT_COLOR,
  UI,
  UiNode,
  conceal,
  reveal,
} from '@/ui3d';
import type { HudContext, HudModule } from './context';
import { onReadingLevel, quizCopy, stepCopy } from './level';
import { buildLinks } from './step-links';
import { buildSections, caption } from './step-sections';

export const PANEL_WIDTH = 468;

export interface StepPanel extends HudModule {
  /** Extra nodes shown under the title (honesty chips of the current step). */
  setBadges(nodes: readonly UiNode[]): void;
  /** Panel width and the height its scrolling body may take (the column decides both). */
  fit(width: number, maxScroll: number): void;
  /** Height of everything in the panel except the scrolling body (valid after a layout). */
  chrome(): number;
  /** Height the scrolling body would take unclipped (valid after a layout). */
  want(): number;
  /** Compact title (smaller type) when the column is short of height. */
  setCompact(on: boolean): void;
  /**
   * Touch shells (F5): the panel becomes a plain view inside the sheet — no plate of its own, no counter and
   * title (the sheet's head shows the title), the text flows as one scroll instead of pages.
   */
  setTouch(on: boolean): void;
  /** Title of the step on screen (the sheet's head shows it). */
  readonly stepTitle: string;
}

export function createStepPanel(hud: HudContext, popups: UiNode): StepPanel {
  const counter = caption('');
  const title = new Label('', { font: 'display', size: UI.text.h1, lineHeight: 1.14 }, { width: 'fill' });
  const badges = new UiNode({ dir: 'row', wrap: true, gap: 8, width: 'fill', visible: false });
  const pager = new Pager({ onEnd: () => void hud.engine.nav.next() });
  const extra = new UiNode({ dir: 'col', gap: 12, width: 'fill' });
  const scroll = new ScrollView({ name: 'step-text', height: 'hug', gap: 14, children: [pager, extra] });
  // the page bar stays pinned under the scrolling text
  const node = new Panel({
    name: 'step-panel',
    width: PANEL_WIDTH,
    gap: 12,
    children: [counter, title, badges, scroll, pager.takeBar()],
  });
  let manifest: ChapterManifest | null = null;
  let content: ChapterContent | null = null;
  let stepId: string | null = null;
  let quiz: QuizCard | null = null;
  let touch = false;

  /** Touch shells: the quiz lives in the sheet as a card; this removes it from there. */
  let quizDismiss: (() => void) | null = null;
  const closeQuiz = (): void => {
    if (!quiz) return;
    const q = quiz;
    quiz = null;
    if (quizDismiss) {
      const dismiss = quizDismiss;
      quizDismiss = null;
      dismiss();
      return;
    }
    conceal(q, { onDone: () => q.detach() });
  };
  const openQuiz = (): void => {
    const items = quizCopy(hud.engine, content);
    if (!items.length || quiz) return;
    if (hud.metrics.shell !== 'desk' && hud.touch.card) {
      // phones and tablets: the quiz is a card of the sheet, opened to its full height
      const card = new QuizCard({
        name: 'quiz-card',
        variant: 'plain',
        items,
        title: 'Міні-квіз розділу',
        width: 'fill',
        onDone: closeQuiz,
      });
      card.pad = 0;
      quiz = card;
      quizDismiss = hud.touch.card(
        card,
        () => {
          if (quiz === card) {
            quiz = null;
            quizDismiss = null;
          }
        },
        { back: true },
      );
      hud.touch.sheet?.setSnap('full');
      return;
    }
    quiz = new QuizCard({
      items,
      title: 'Міні-квіз розділу',
      width: 560,
      visible: false,
      onDone: closeQuiz,
    });
    popups.add(quiz);
    reveal(quiz, { scale: 0.92 });
  };

  const fill = (): void => {
    if (!manifest || !stepId) return;
    const index = manifest.steps.findIndex((s) => s.id === stepId);
    const step = manifest.steps[index];
    if (!step) return;
    const data = stepCopy(hud.engine, content, stepId);
    counter.text = `КРОК ${index + 1} / ${manifest.steps.length}`;
    title.text = data?.title ?? step.title;
    const pages = data?.panel.length ? data.panel : [step.blurb];
    // phones and tablets: a unit is a real pixel there, 17 px is the comfortable reading size (desktop: 19 units)
    const size = touch ? UI.text.small : UI.text.body;
    pager.setPages(pages.map((text) => new Label(text, { size, lineHeight: 1.46 }, { width: 'fill' })));
    extra.clear();
    const sections = data ? buildSections(hud, data) : null;
    if (sections) extra.add(sections);
    const links = buildLinks(hud, content, manifest, index);
    if (links) extra.add(links);
    if (index === manifest.steps.length - 1 && quizCopy(hud.engine, content).length)
      extra.add(
        new Button({
          name: 'chapter-quiz',
          label: 'Міні-квіз розділу',
          icon: 'quiz',
          variant: 'primary',
          alignSelf: 'start',
          onClick: openQuiz,
        }),
      );
    if (!data && content === null && manifest.steps.length > 0 && !step.blurb)
      extra.add(new Label('Текст цього кроку ще готується.', { size: UI.text.small, color: TEXT_COLOR.dim }));
    scroll.scrollTo(0, true);
    hud.relayout();
  };
  // «Просто / Докладно» switched: the open step shows the other copy at once (an open quiz is of the old level)
  onReadingLevel(hud.engine, () => {
    closeQuiz();
    fill();
  });

  return {
    node,
    setBadges(nodes) {
      badges.clear();
      for (const n of nodes) badges.add(n);
      badges.visible = nodes.length > 0;
      hud.relayout();
    },
    onChapter(m) {
      manifest = m;
      stepId = hud.engine.store.get().stepId ?? m.steps[0]!.id;
      closeQuiz();
    },
    onContent(c) {
      content = c;
      fill();
    },
    onStep(id, instant) {
      if (id === stepId && pager.count > 0) return;
      stepId = id;
      closeQuiz();
      const tweens = hud.surface.host.tweens;
      if (instant) {
        fill();
        return;
      }
      // quick dip so the text swap reads as a page turn, not a pop
      tweens.to(scroll, { opacity: 0 }, { duration: 0.12, ease: 'power2.in', onComplete: () => {
        fill();
        tweens.to(scroll, { opacity: 1 }, { duration: 0.3, ease: 'power2.out' });
      } }); // prettier-ignore
      tweens.to(title, { opacity: 0 }, { duration: 0.12 });
      tweens.to(title, { opacity: 1 }, { duration: 0.3, delay: 0.14 });
    },
    chrome: () => node.bh - scroll.bh,
    want: () => scroll.content.bh + scroll.padT + scroll.padB,
    setCompact(on) {
      const size = on ? UI.text.h3 : UI.text.h1;
      if (title.style.size !== size) title.setStyle({ size });
    },
    setTouch(on) {
      if (touch === on) return;
      touch = on;
      node.variant = on ? 'plain' : 'glass';
      node.pad = on ? 0 : UI.pad.panel;
      counter.visible = !on;
      title.visible = !on;
      pager.continuous = on;
      node.repaint();
      fill();
    },
    get stepTitle() {
      return title.text;
    },
    fit(width, maxScroll) {
      node.width = width;
      scroll.maxH = Math.max(maxScroll, 60);
    },
  };
}
