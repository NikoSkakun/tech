/**
 * Library screen — the level above the journey maps: one card per listed volume (emblem, title, subtitle,
 * progress, size) and the way into each. Data-driven from the volume manifests (`engine.library.listed`).
 *
 * While the library is a single published volume this screen is never shown on its own: the app opens that
 * volume's home, exactly like a stand-alone course (`Library.showsLibrary`). It can still be opened in a debug
 * session (`L`, or `__ui.open('library')`), where the dev volumes are listed as well.
 */
import { journeyProgress, plural } from '@/content';
import type { VolumeManifest } from '@/engine/api';
import {
  Button,
  Chip,
  ICON_NAMES,
  Icon,
  Label,
  Panel,
  ProgressRing,
  TEXT_COLOR,
  UI,
  UiNode,
  conceal,
  reveal,
  revealAll,
  rgba,
  setAccent,
  type IconName,
  type Painter,
} from '@/ui3d';
import type { JourneyMap } from './map/map';
import type { Hud, Overlay } from './shell';

/** Dark veil over the drifting journey map behind the cards, so they read without hiding it completely. */
class Backdrop extends UiNode {
  override paint(p: Painter): void {
    p.rect(0, 0, this.bw + 40, this.bh + 40, { fill: rgba('bg.void', 0.62) });
  }
}

/** Round medallion with the volume's icon in its accent colour. */
class Emblem extends UiNode {
  constructor(private readonly volume: VolumeManifest) {
    super({ dir: 'stack', align: 'center', justify: 'center', width: 76, height: 76 });
    const name = (ICON_NAMES as readonly string[]).includes(volume.emblem)
      ? (volume.emblem as IconName)
      : 'book';
    this.add(new Icon(name, 36, 'white', 1.1));
  }

  override paint(p: Painter): void {
    p.circle(0, 0, 76, {
      fill: rgba(this.volume.accent, 0.28),
      border: rgba(this.volume.accent, 0.95),
      bw: 2,
      glow: 14,
      glowAlpha: 0.45,
    });
  }
}

const CARD_WIDTH = 430;

/**
 * @param map the journey map of the volume on screen: like the home screen, the library is shown over it
 *   drifting in "attract" mode (which also stops rendering the chapter underneath).
 */
export function createLibrary(hud: Hud, map: () => JourneyMap | null): Overlay {
  const { library, store, nav } = hud.engine;
  const title = new Label(library.title, {
    font: 'display',
    size: UI.text.h1,
    align: 'center',
    lineHeight: 1.1,
    emissive: 1.1,
  });
  const kicker = new Label('БІБЛІОТЕКА', {
    font: 'bodyBold',
    size: UI.text.small,
    color: 'cyan',
    letterSpacing: 0.22,
    nowrap: true,
  });
  const shelf = new UiNode({ dir: 'row', wrap: true, gap: 22, justify: 'center', align: 'start' });
  const column = new UiNode({
    dir: 'col',
    align: 'center',
    gap: 16,
    float: { ax: 0.5, ay: 0 },
    children: [kicker, title, new UiNode({ height: 8 }), shelf],
  });
  const root = new UiNode({
    dir: 'stack',
    width: 'fill',
    height: 'fill',
    visible: false,
    opacity: 0,
    children: [new Backdrop({ width: 'fill', height: 'fill' }), column],
  });
  hud.modal.add(root);

  const enter = (volume: VolumeManifest): void => {
    hud.close();
    // inside the volume the user lands where they left it; a first visit starts on the volume's home screen
    const first = store.get().lastIn[volume.id] === undefined;
    void nav.gotoVolume(volume.id).then((ok) => {
      if (ok && first) hud.open('home');
    });
  };

  const card = (volume: VolumeManifest, index: number): UiNode => {
    const chapters = library.registry(volume.id)?.chapters ?? [];
    const steps = chapters.reduce((n, c) => n + c.steps.length, 0);
    const progress = journeyProgress(store.get().progress.visited, chapters);
    const current = store.get().volumeId === volume.id;
    const started = store.get().lastIn[volume.id] !== undefined;
    const ring = new ProgressRing({
      name: `volume-progress-${volume.id}`,
      size: 54,
      value: progress.fraction,
      label: `${Math.round(progress.fraction * 100)}%`,
    });
    ring.on({ tooltip: `Переглянуто ${progress.done} з ${progress.total} кроків` });
    const open = new Button({
      name: `volume-open-${volume.id}`,
      label: current ? 'Повернутися' : started ? 'Продовжити' : 'Відкрити том',
      icon: current ? 'prev' : 'play',
      variant: 'primary',
      alignSelf: 'start',
      onClick: () => (current ? hud.close() : enter(volume)),
    });
    open.disabled = chapters.length === 0; // a volume without built chapters cannot be entered yet
    const panel = new Panel({
      name: `volume-card-${volume.id}`,
      variant: 'card',
      dir: 'col',
      gap: 14,
      width: CARD_WIDTH,
      pad: [20, 22, 20, 22],
      children: [
        new UiNode({
          dir: 'row',
          align: 'center',
          gap: 16,
          width: 'fill',
          children: [
            new Emblem(volume),
            new UiNode({
              dir: 'col',
              gap: 2,
              width: 'fill',
              children: [
                new Label(`ТОМ ${index + 1}${volume.status === 'published' ? '' : ' · У РОЗРОБЦІ'}`, {
                  font: 'bodyBold',
                  size: UI.text.caption,
                  color: TEXT_COLOR.mute,
                  letterSpacing: 0.08,
                  nowrap: true,
                }),
                new Label(
                  volume.title,
                  { font: 'display', size: UI.text.h2, lineHeight: 1.14 },
                  { width: 'fill' },
                ),
                new Label(volume.subtitle, { size: UI.text.small, color: TEXT_COLOR.dim }, { width: 'fill' }),
              ],
            }),
            ring,
          ],
        }),
        volume.lead
          ? new Label(
              volume.lead,
              { size: UI.text.small, color: TEXT_COLOR.dim, lineHeight: 1.38 },
              { width: 'fill' },
            )
          : null,
        new UiNode({
          dir: 'row',
          wrap: true,
          gap: 8,
          width: 'fill',
          children: [
            new Chip({
              kind: 'plain',
              icon: 'layers',
              text: `${chapters.length} ${plural(chapters.length, ['розділ', 'розділи', 'розділів'])}`,
            }),
            new Chip({
              kind: 'plain',
              icon: 'target',
              text: `${steps} ${plural(steps, ['крок', 'кроки', 'кроків'])}`,
            }),
            new Chip({ kind: 'scale', text: volume.journey.axis.range, tooltip: volume.journey.axis.label }),
          ],
        }),
        open,
      ],
    });
    setAccent(panel, volume.accent);
    return panel;
  };

  const build = (): void => {
    shelf.clear();
    library.listed.forEach((volume, i) => shelf.add(card(volume, i)));
    revealAll(shelf.children, { dy: -18 }, 0.06);
    hud.relayout();
  };

  const place = (): void => {
    const m = hud.metrics;
    column.float = { ax: 0.5, ay: 0, dy: m.height * (m.layout === 'portrait' ? 0.06 : 0.09) };
    shelf.width = Math.min(m.width - m.safeMargin * 2, CARD_WIDTH * 3 + 44 + 8);
    title.setStyle({ maxWidth: m.width - m.safeMargin * 4 });
  };
  hud.engine.hud.onResize(place);
  place();

  return {
    fullscreen: true,
    open() {
      build();
      map()?.setAttract(true);
      reveal(root, { dy: 0, scale: 1, duration: 0.35 });
      // the cards need every listed volume's chapter list (sizes, progress): load the missing ones, rebuild
      const missing = library.listed.filter((v) => !library.registry(v.id));
      if (missing.length > 0)
        void Promise.all(missing.map((v) => library.load(v.id).catch(() => null))).then(() => {
          if (hud.overlay === 'library') build();
        });
    },
    close() {
      map()?.setAttract(false);
      conceal(root, { dy: 20, scale: 1 });
    },
  };
}
