/**
 * DOM step panel: «КРОК n / N», step title, honesty chips, paged text with its page bar, the sections.
 * Same data as `hud/step-panel.ts`. Spike: it is placed into the box of the (transparent) WebGL step panel,
 * so the WebGL control dock under it keeps its place; D2 gives the column a CSS layout of its own.
 */
import type { ChapterManifest } from '@/engine/api';
import type { ChapterContent } from '@/content';
import type { Hud } from '@/hud/shell';
import { Button, Chip, Icon, type UiNode } from '@/ui3d';
import { onReadingLevel, quizCopy, stepCopy } from '@/hud/level';
import { buildLinks } from '@/hud/step-links';
import { h, scrollArea, setText } from '../core/dom';
import { findNode } from '../core/webgl';
import { icon } from '../core/icons';
import { richEl } from '../core/rich';
import { btn, buildDomSections } from './sections';

export interface DomStepPanel {
  readonly el: HTMLElement;
  onChapter(m: ChapterManifest): void;
  onContent(c: ChapterContent | null): void;
  onStep(id: string, instant: boolean): void;
  /** Mirror the honesty chips the WebGL column built for this step (texts, icons, `visible`). */
  syncBadges(webglBadges: UiNode | undefined): void;
}

/**
 * «Див. також» from the chips `hud/step-links.ts` builds (spike shortcut: D2 splits that file into a data
 * function shared by both renderers).
 */
// D2: mirrors the WebGL chips until a view model of the links exists (hud/model/links.ts)
function domLinks(webgl: UiNode | null): HTMLElement | null {
  if (!webgl) return null;
  const chips: Chip[] = [];
  webgl.walk((n) => {
    if (n instanceof Chip) chips.push(n);
  });
  const items = chips.map((c) => {
    const glyph = c.children.find((n): n is Icon => n instanceof Icon);
    const live = c.onClick !== null;
    const el = h(
      live ? 'button.chip.link.multi' : 'span.chip.link.multi.dim',
      { 'data-ui': c.name, type: live ? 'button' : null, title: live ? null : 'Цей розділ ще будується' },
      glyph ? icon(glyph.icon) : null,
      h('span', null, c.label),
    );
    if (live) el.addEventListener('click', () => c.onClick?.());
    return h('li', null, el);
  });
  return h('div.links', null, h('div.kicker', null, 'Див. також'), h('ul.chips', null, ...items));
}

export function createDomStepPanel(hud: Hud, webglColumn: UiNode): DomStepPanel {
  const counter = h('div.kicker', { 'aria-hidden': 'true' });
  const title = h('h2.sp-title', { id: 'kd-step-title' });
  const badges = h('ul.badges', { 'aria-label': 'Чесність моделі' });
  const pages = h('div.pages', { 'aria-live': 'polite' });
  const extra = h('div.sp-extra');
  const scroll = scrollArea(h('div.sp-scroll', { 'data-ui': 'step-text', tabindex: '0' }, pages, extra));
  const pageLabel = h('span.page-count');
  const prev = h('button.btn.icon.sm', { type: 'button', 'aria-label': 'Попередня сторінка' }, icon('prev'));
  const next = h('button.btn.icon.sm', { type: 'button', 'aria-label': 'Наступна сторінка' }, icon('next'));
  const bar = h('nav.pager', { 'aria-label': 'Сторінки тексту' }, prev, pageLabel, next);
  const el = h(
    'section.kd.glass.sp',
    { 'data-ui': 'step-panel', 'aria-labelledby': 'kd-step-title' },
    counter,
    title,
    badges,
    scroll,
    bar,
  );
  let manifest: ChapterManifest | null = null;
  let content: ChapterContent | null = null;
  let stepId: string | null = null;
  let page = 0;
  let badgeKey = '';
  const fade = { o: 1 };

  const showPage = (i: number): void => {
    const list = [...pages.children] as HTMLElement[];
    page = Math.min(Math.max(i, 0), Math.max(list.length - 1, 0));
    list.forEach((p, k) => (p.hidden = k !== page));
    bar.hidden = list.length < 2;
    setText(pageLabel, `${page + 1} / ${list.length}`);
    prev.disabled = page === 0;
    scroll.scrollTop = 0;
  };
  prev.addEventListener('click', () => showPage(page - 1));
  // like the WebGL pager: «next» on the last page goes on to the next step
  next.addEventListener('click', () => {
    if (page < pages.children.length - 1) showPage(page + 1);
    else void hud.engine.nav.next();
  });

  const fill = (): void => {
    if (!manifest || !stepId) return;
    const index = manifest.steps.findIndex((s) => s.id === stepId);
    const step = manifest.steps[index];
    if (!step) return;
    // the copy at the reading level in effect (L1 selector; D2 adds the «Просто | Докладно» switch)
    const data = stepCopy(hud.engine, content, stepId);
    setText(counter, `Крок ${index + 1} / ${manifest.steps.length}`);
    setText(title, data?.title ?? step.title);
    const texts = data?.panel.length ? data.panel : [step.blurb];
    pages.replaceChildren(...texts.map((t) => richEl('p', 'page', t)));
    const sections = data ? buildDomSections(data, (name) => hud.open('glossary', name)) : null;
    extra.replaceChildren(...(sections ? [sections] : []));
    const links = domLinks(buildLinks(hud, content, manifest, index));
    if (links) extra.append(links);
    if (index === manifest.steps.length - 1 && quizCopy(hud.engine, content).length)
      extra.append(
        btn('Міні-квіз розділу', 'quiz', 'primary', () => {
          // D2: the quiz is still the WebGL card (popups layer): press the hidden WebGL entry
          const entry = findNode(webglColumn, 'chapter-quiz');
          if (entry instanceof Button) entry.onClick?.();
        }),
      );
      extra.lastElementChild?.setAttribute('data-ui', 'chapter-quiz');
    showPage(0);
  };
  // a new reading level re-renders the step in place (setting, or the end of a `?level=` pin)
  onReadingLevel(hud.engine, fill);

  return {
    el,
    onChapter(m) {
      manifest = m;
      stepId = hud.engine.store.get().stepId ?? m.steps[0]!.id;
    },
    onContent(c) {
      content = c;
      fill();
    },
    onStep(id, instant) {
      if (id === stepId && pages.children.length > 0) return;
      stepId = id;
      if (instant) return fill();
      // the page-turn dip of the WebGL panel, on the engine clock (deterministic under ?freeze)
      const tweens = hud.host.tweens;
      const apply = (): void => void scroll.style.setProperty('opacity', fade.o.toFixed(3));
      tweens.to(fade, { o: 0 }, { duration: 0.12, ease: 'power2.in', onUpdate: apply, onComplete: () => {
        fill();
        tweens.to(fade, { o: 1 }, { duration: 0.3, ease: 'power2.out', onUpdate: apply });
      } }); // prettier-ignore
    },
    // D2: mirrors the WebGL honesty chips until a view model of the step exists (hud/model/step.ts)
    syncBadges(webgl) {
      const chips = (webgl?.children ?? []).filter((c): c is Chip => c instanceof Chip && c.visible);
      const key = webgl?.visible ? chips.map((c) => c.label).join('|') : '';
      if (key === badgeKey) return;
      badgeKey = key;
      badges.replaceChildren(
        ...chips.map((c) => {
          const glyph = c.children.find((n): n is Icon => n instanceof Icon);
          return h('li.chip.honesty', null, glyph ? icon(glyph.icon) : null, c.label);
        }),
      );
      badges.hidden = chips.length === 0;
    },
  };
}
