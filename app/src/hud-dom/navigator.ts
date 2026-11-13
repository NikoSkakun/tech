/**
 * DOM step navigator (bottom centre of the free area): previous / one segment per step / next.
 * Same behaviour as `hud/navigator.ts`; segments are real buttons with the step title as their name.
 */
import { fullChapterId, type ChapterManifest } from '@/engine/api';
import { isVisited } from '@/content';
import type { Hud } from '@/hud/shell';
import { h, setClass, setText } from './dom';
import { icon } from './icons';

export function createDomNavigator(hud: Hud): { el: HTMLElement; onChapter(m: ChapterManifest): void; sync(): void } {
  const { nav, store } = hud.engine;
  let manifest: ChapterManifest | null = null;
  const prev = h(
    'button.btn.icon',
    { type: 'button', 'data-ui': 'nav-prev', title: 'Попередній крок (←)', 'aria-label': 'Попередній крок' },
    icon('prev'),
  );
  const nextLabel = h('span', null, 'Далі');
  const next = h(
    'button.btn.primary.md',
    { type: 'button', 'data-ui': 'nav-next', title: 'Наступний крок (→)' },
    nextLabel,
    icon('next'),
  );
  const dots = h('ol.dots');
  const counter = h('div.nav-count', { 'aria-hidden': 'true' });
  const el = h(
    'nav.kd.card.nav',
    { 'data-ui': 'navigator', 'aria-label': 'Кроки розділу' },
    prev,
    h('div.nav-mid', null, dots, counter),
    next,
  );
  prev.addEventListener('click', () => void nav.prev());
  next.addEventListener('click', () => void nav.next());

  const sync = (): void => {
    const pos = nav.position;
    if (!manifest || !pos || pos.volumeId !== manifest.volume || pos.chapterId !== manifest.id) return;
    const i = manifest.steps.findIndex((s) => s.id === pos.stepId);
    setText(counter, `${i + 1} / ${manifest.steps.length}`);
    prev.disabled = !nav.canPrev;
    next.disabled = !nav.canNext;
    setText(nextLabel, i === manifest.steps.length - 1 && nav.canNext ? 'Далі: наступний розділ' : 'Далі');
    const visited = store.get().progress.visited;
    const key = fullChapterId(manifest);
    [...dots.children].forEach((li, k) => {
      const b = li.firstElementChild as HTMLElement;
      setClass(b, 'seen', isVisited(visited, key, manifest!.steps[k]!.id));
      setClass(b, 'on', k === i);
      if (k === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  };
  store.subscribe((s) => s.target, sync);
  store.subscribe((s) => s.progress, sync);

  return {
    el,
    sync,
    onChapter(m) {
      manifest = m;
      dots.replaceChildren(
        ...m.steps.map((s, i) => {
          const b = h('button.dot', { type: 'button', title: `${i + 1}. ${s.title}`, 'aria-label': `Крок ${i + 1}: ${s.title}` });
          b.addEventListener('click', () => void nav.goto(fullChapterId(m), s.id));
          return h('li', null, b);
        }),
      );
      sync();
    },
  };
}
