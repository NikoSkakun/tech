/**
 * Home / intro screen of a volume: its headline over its Journey Map drifting in "attract" mode (the hero
 * vignette — for electricity the whole path from the atom to the socket), with the primary actions. All text
 * comes from the volume manifest. When the library level is shown, a button leads up to the library. The first pointer or key gesture
 * here is also what unlocks audio (the engine resolves `input.gesture`).
 */
import { contentKey, journeyProgress, plural } from '@/content';
import {
  Button,
  Chip,
  Label,
  TEXT_COLOR,
  UI,
  UiNode,
  conceal,
  reveal,
  revealAll,
  rgba,
  type Painter,
} from '@/ui3d';
import type { JourneyMap } from './map/map';
import type { Hud, Overlay } from './shell';

/** Soft dark veil behind the title so it reads over the glowing map. */
class Veil extends UiNode {
  override paint(p: Painter): void {
    p.rect(0, 0, this.bw * 0.5, this.bh * 0.5, {
      r: this.bh * 0.25,
      fill: rgba('bg.void', 0.5),
      border: rgba('bg.void', 0),
      glow: this.bh * 0.6,
      glowAlpha: 0.5,
    });
  }
}

export function createHome(hud: Hud, map: JourneyMap): Overlay {
  const { store, library } = hud.engine;
  const journey = map.journey;
  const volume = journey.volume;
  const kicker = new Label(volume.kicker.toLocaleUpperCase('uk'), {
    font: 'bodyBold',
    size: UI.text.small,
    color: 'cyan',
    letterSpacing: 0.22,
    nowrap: true,
  });
  const title = new Label(volume.headline, {
    font: 'display',
    size: UI.text.hero,
    align: 'center',
    lineHeight: 1.08,
    emissive: 1.12,
  });
  const subtitle = new Label(volume.lead, {
    size: UI.text.h3,
    color: TEXT_COLOR.dim,
    align: 'center',
    maxWidth: 760,
    lineHeight: 1.4,
  });
  const start = new Button({
    label: 'Почати подорож',
    icon: 'play',
    variant: 'primary',
    size: 'lg',
    onClick: () => hud.open('map'),
  });
  const resume = new Button({
    label: 'Продовжити',
    icon: 'next',
    iconRight: true,
    variant: 'primary',
    size: 'lg',
    onClick: () => hud.close(),
  });
  const mapButton = new Button({ label: 'Мапа', icon: 'map', size: 'lg', onClick: () => hud.open('map') });
  const facts = new UiNode({
    dir: 'row',
    gap: 10,
    wrap: true,
    justify: 'center',
    children: [
      new Chip({
        kind: 'plain',
        icon: 'layers',
        text: `${journey.chapters.length} ${plural(journey.chapters.length, ['розділ', 'розділи', 'розділів'])}`,
      }),
      new Chip({
        kind: 'plain',
        icon: 'target',
        text: `${journey.stepCount} ${plural(journey.stepCount, ['крок', 'кроки', 'кроків'])}`,
      }),
      new Chip({ kind: 'scale', text: volume.journey.axis.range }),
    ],
  });
  const actions = new UiNode({
    dir: 'row',
    gap: 16,
    wrap: true,
    justify: 'center',
    align: 'center',
    // the way up to the library exists only while the library level is shown (more than one volume)
    children: library.showsLibrary(volume.id)
      ? [
          resume,
          start,
          mapButton,
          new Button({
            name: 'home-library',
            label: 'Бібліотека',
            icon: 'book',
            size: 'lg',
            onClick: () => hud.open('library'),
          }),
        ]
      : [resume, start, mapButton],
  });
  const column = new UiNode({
    dir: 'col',
    align: 'center',
    gap: 18,
    float: { ax: 0.5, ay: 0 },
    children: [kicker, title, subtitle, new UiNode({ height: 6 }), actions, facts],
  });
  const veil = new Veil({ float: { ax: 0.5, ay: 0 }, width: 1100, height: 520 });
  const root = new UiNode({
    dir: 'stack',
    width: 'fill',
    height: 'fill',
    visible: false,
    opacity: 0,
    children: [veil, column],
  });
  hud.modal.add(root);

  const place = (): void => {
    const m = hud.metrics;
    const narrow = m.layout !== 'wide';
    title.setStyle({
      size: narrow ? Math.min(UI.text.hero, m.width / 15) : UI.text.hero,
      maxWidth: m.width - m.safeMargin * 4,
    });
    subtitle.setStyle({ maxWidth: Math.min(760, m.width - m.safeMargin * 4) });
    column.float = { ax: 0.5, ay: 0, dy: m.height * (m.layout === 'portrait' ? 0.12 : 0.09) };
    if (m.shell !== 'desk') {
      // phones and tablets: clear of the notch; a landscape phone has no height to spare for a tall margin
      const top = m.safeArea.top + (m.shell === 'side' && m.formFactor === 'phone' ? 14 : m.height * 0.08);
      column.float = { ax: 0.5, ay: 0, dy: top };
      column.gap = m.formFactor === 'phone' ? 12 : 18;
      const room = m.width - Math.max(m.safeArea.left, m.safeArea.right) * 2 - 32;
      title.setStyle({ size: Math.min(UI.text.hero, Math.max(room / 13, 28)), maxWidth: room });
      subtitle.setStyle({ size: m.formFactor === 'phone' ? UI.text.small : UI.text.h3, maxWidth: Math.min(760, room) });
      // a phone held upright stacks the buttons (a wrapped row would hug the left edge)
      const stack = room < 520;
      actions.dir = stack ? 'col' : 'row';
      actions.gap = stack ? 10 : 16;
      actions.maxW = room;
      facts.maxW = room;
    } else if (actions.dir === 'col') {
      actions.dir = 'row';
      actions.gap = 16;
      column.gap = 18;
      actions.maxW = facts.maxW = Infinity;
      subtitle.setStyle({ size: UI.text.h3 });
    }
    veil.float = { ax: 0.5, ay: 0, dy: m.height * 0.02 };
    veil.width = Math.min(1200, m.width);
  };
  hud.engine.hud.onResize(place);
  place();

  return {
    fullscreen: true,
    open() {
      const s = store.get();
      const chapters = library.registry(volume.id)?.chapters ?? [];
      const seen =
        journeyProgress(s.progress.visited, chapters).done > 0 && s.lastIn[volume.id] !== undefined;
      // returning users continue where they stopped; first-time users start the journey on the map
      resume.visible = seen;
      start.label = seen ? 'Почати спочатку' : 'Почати подорож';
      start.onClick = seen ? () => hud.goto(contentKey(chapters[0]!)) : () => hud.open('map');
      map.setAttract(true);
      reveal(root, { dy: 0, scale: 1, duration: 0.5 });
      revealAll(column.children, { dy: -22 }, 0.07);
    },
    close() {
      map.setAttract(false);
      conceal(root, { dy: 30, scale: 1 });
    },
  };
}
