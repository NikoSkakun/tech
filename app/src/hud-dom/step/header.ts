/**
 * DOM chapter header (top-left): progress ring, «ЧАСТИНА · БАТЬКІВСЬКИЙ РОЗДІЛ», chapter title, axis chip.
 * Same data as `hud/header.ts`.
 */
import { groupLabel, type ChapterManifest } from '@/engine/api';
import { chapterProgress } from '@/content';
import type { Hud } from '@/hud/shell';
import { h, setStyle, setText } from '../core/dom';
import { icon } from '../core/icons';
import { setRich } from '../core/rich';

const SVG = 'http://www.w3.org/2000/svg';

function ring(): { el: HTMLElement; set(fraction: number, label: string): void } {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 46 46');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(SVG, 'circle');
  const arc = document.createElementNS(SVG, 'circle');
  for (const c of [track, arc]) {
    c.setAttribute('cx', '23');
    c.setAttribute('cy', '23');
    c.setAttribute('r', '20');
    c.setAttribute('pathLength', '100');
  }
  track.setAttribute('class', 'track');
  arc.setAttribute('class', 'arc');
  svg.append(track, arc);
  const text = h('span.ring-label');
  const el = h('div.ring', { role: 'img', 'data-ui': 'header-ring', title: 'Переглянуто кроків у розділі' }, text);
  el.prepend(svg);
  return {
    el,
    set(fraction, label) {
      setStyle(arc as unknown as HTMLElement, 'stroke-dasharray', `${(fraction * 100).toFixed(2)} 100`);
      setText(text, label);
      el.setAttribute('aria-label', `Переглянуто кроків: ${label}`);
    },
  };
}

export function createDomHeader(hud: Hud): {
  el: HTMLElement;
  onChapter(m: ChapterManifest): void;
} {
  const r = ring();
  const kicker = h('div.kicker');
  const title = h('h1.hd-title');
  const axis = h('span.axis-text');
  const chip = h('span.chip.scale', null, icon('ruler'), axis);
  const el = h('header.kd.card.hd', { 'data-ui': 'header' }, r.el, h('div.hd-text', null, kicker, title), chip);
  let manifest: ChapterManifest | null = null;
  const progress = (): void => {
    if (!manifest) return;
    const p = chapterProgress(hud.engine.store.get().progress.visited, manifest);
    r.set(p.fraction, `${p.done}/${p.total}`);
  };
  hud.engine.store.subscribe((s) => s.progress, progress);
  return {
    el,
    onChapter(m) {
      manifest = m;
      const volume = hud.engine.library.get(m.volume);
      const parent = hud.engine.library.registry(m.volume)?.parentOf(m.id);
      const path = [
        volume && hud.libraryLevel ? volume.title : '',
        volume ? groupLabel(volume, m.group) : '',
        parent ? parent.title : '',
      ];
      // uppercase by CSS: copying the kicker gives the words as written
      setText(kicker, path.filter((p) => p !== '').join(' · '));
      setText(title, m.title);
      setRich(axis, m.axisLabel);
      chip.title = volume?.journey.axis.hint ?? '';
      progress();
    },
  };
}
