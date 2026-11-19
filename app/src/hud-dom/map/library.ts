/**
 * Library screen in the DOM (twin of `hud/library.ts`, model `hud/model/library.ts`): one card per listed volume
 * (`volume-card-<id>`: emblem, «ТОМ n», title, subtitle, lead, size chips, progress ring `volume-progress-<id>`, the
 * way in `volume-open-<id>`), over the journey map of the volume on screen in "attract" mode. The volumes kept aside
 * are not on the shelf (`library.listed`). Opened by `L` / `__ui.open('library')` (debug) or a home screen's
 * «Бібліотека» while the library level is shown.
 */
import type { VolumeManifest } from '@/engine/api';
import { volumeCardModel } from '@/hud/model/library';
import type { HomeStage } from '@/hud/home';
import type { Overlay } from '@/hud/shell';
import { ICON_NAMES, type IconName } from '@/ui3d';
import type { DomHud } from '../core/context';
import { h } from '../core/dom';
import { icon } from '../core/icons';
import { presence } from '../core/motion';
import { applyAccent } from '../core/tokens';
import { blurInside } from '../overlays/modal';
import { ring } from './ring';

export function domLibrary(dom: DomHud, stage: () => HomeStage | null): Overlay {
  const { hud } = dom;
  const { library, store, nav } = hud.engine;
  const shelf = h('ul.lb-shelf', { 'aria-label': 'Томи' });
  const root = h(
    'div.lb-root',
    { 'data-ui': 'library', hidden: true, tabindex: -1 },
    h('div.lb-scrim', { 'aria-hidden': 'true' }),
    h(
      'div.lb-col.kd-scroll',
      null,
      h('p.kicker.lb-kicker', null, 'Бібліотека'),
      h('h1.lb-title', null, library.title),
      shelf,
    ),
  );
  dom.layers.modal.append(root);
  const shown = presence(root);

  const enter = (volume: VolumeManifest): void => {
    hud.close();
    // inside the volume the reader lands where they left it; a first visit starts on the volume's home screen
    const first = !store.freshStart && store.get().lastIn[volume.id] === undefined; // FRESH_START: no home screen
    if (first) hud.landing.arm();
    void nav.gotoVolume(volume.id).then((ok) => {
      if (ok && first) hud.open('home');
    });
  };

  const card = (volume: VolumeManifest, index: number): HTMLElement => {
    const s = store.get();
    const m = volumeCardModel(volume, index, library.registry(volume.id)?.chapters ?? [], {
      visited: s.progress.visited,
      volumeId: s.volumeId,
      lastIn: s.lastIn,
      unseen: hud.unseenStep !== null,
    });
    const r = ring(54, `volume-progress-${volume.id}`);
    r.set(m.progress.fraction, m.progress.label, m.progress.tooltip);
    r.el.dataset.tip = m.progress.tooltip;
    const emblem: IconName = (ICON_NAMES as readonly string[]).includes(volume.emblem)
      ? (volume.emblem as IconName)
      : 'book';
    const open = h(
      'button.btn.primary.lb-open',
      { type: 'button', 'data-ui': `volume-open-${volume.id}`, disabled: m.disabled },
      icon(m.openIcon),
      h('span', null, m.openLabel),
    );
    open.addEventListener('click', () => (m.current ? hud.close() : enter(volume)));
    const titleId = `lb-title-${volume.id}`;
    const el = h(
      'li.kd.card.lb-card',
      { 'data-ui': `volume-card-${volume.id}`, 'aria-labelledby': titleId },
      h(
        'div.lb-head',
        null,
        h('span.lb-emblem', { 'aria-hidden': 'true' }, icon(emblem)),
        h(
          'div.lb-names',
          null,
          h('p.kicker', null, m.status),
          h('h2.lb-name', { id: titleId }, volume.title),
          h('p.lb-sub', null, volume.subtitle),
        ),
        r.el,
      ),
      volume.lead ? h('p.lb-lead', null, volume.lead) : null,
      h(
        'div.lb-chips',
        null,
        ...m.chips.map((c) =>
          h(
            c.kind === 'scale' ? 'span.chip.scale' : 'span.chip',
            { 'data-tip': c.tooltip },
            icon(c.icon ?? 'ruler'),
            c.text,
          ),
        ),
      ),
      h('div.lb-foot', null, open),
    );
    applyAccent(el, volume.accent);
    return el;
  };

  const build = (): void => {
    shelf.replaceChildren(...library.listed.map(card));
    [...shelf.children].forEach((c, i) => {
      const p = presence(c as HTMLElement);
      p.conceal({ instant: true });
      p.reveal({ dy: -18, scale: 1, delay: i * 0.06 });
    });
  };

  return {
    fullscreen: true,
    open() {
      build();
      stage()?.setAttract(true);
      shown.reveal({ dx: 0, dy: 0, scale: 1, duration: 0.35 });
      root.focus({ preventScroll: true });
      // the cards need every listed volume's chapter list (sizes, progress): load the missing ones, rebuild
      const missing = library.listed.filter((v) => !library.registry(v.id));
      if (missing.length > 0)
        void Promise.all(missing.map((v) => library.load(v.id).catch(() => null))).then(() => {
          if (hud.overlay === 'library') build();
        });
    },
    close() {
      stage()?.setAttract(false);
      blurInside(root);
      shown.conceal({ dx: 0, dy: 20, scale: 1 });
    },
  };
}
