/**
 * `@/hud` — the persistent interface shell (plugin) and the step UI API for chapters.
 * `main.ts` mounts `plugin` after the engine and fonts are ready, before the first chapter loads.
 */
import type { EnginePlugin, VolumeManifest } from '@/engine/api';
import { mountAnnotations } from './annotations';
import { installUiDebug } from './debug';
import { createStepColumn } from './dock';
import { createHeader } from './header';
import { createLoading, installOnboarding } from './hints';
import type { HudModule } from './context';
import { createHome } from './home';
import { journeyFromManifests, loadJourney, wantsFixture, type Journey } from './journey';
import { installKeys, installParallax } from './keys';
import { createLibrary } from './library';
import { JourneyMap } from './map/map';
import { createGlossary } from './overlays/glossary';
import { createHelp } from './overlays/help';
import { createSettings } from './overlays/settings';
import { createNavigator } from './navigator';
import { Hud, type Overlay } from './shell';
import { setToastSink } from './step-ui';
import { createSpine } from './spine';
import { createSystemButtons } from './system';
import { mountTooltips } from './tooltips';

let instance: Hud | null = null;

/** The HUD of the running app (null before the plugin is mounted, e.g. in unit tests). */
export function hud(): Hud | null {
  return instance;
}

export const plugin: EnginePlugin = {
  name: 'hud',
  mount(engine) {
    const h = new Hud(engine);
    instance = h;
    const header = createHeader(h);
    h.mount(header, { side: 'top', extra: 8 });
    h.mount(createSystemButtons(h));
    const navigator = createNavigator(h);
    h.mount(navigator, { side: 'bottom', extra: 8 });
    const column = createStepColumn(h, h.popups, header.node);
    h.mount(column, { side: 'auto', extra: 14 });
    h.mount(column.board, { side: (m) => (m.layout === 'wide' ? 'left' : 'top'), extra: 14 });
    setToastSink((text, opts) => h.toast(text, opts));
    column.onSpec = mountAnnotations(h);
    mountTooltips(h, h.surface.root);
    installKeys(h, (e) => h.overlayKey(e));
    installParallax(h);
    let journeyMap: JourneyMap | null = null;
    installUiDebug(h, () => journeyMap);
    h.mount(createLoading(h));
    installOnboarding(h);
    h.register('settings', createSettings(h));
    h.register('help', createHelp(h));
    h.register(
      'library',
      createLibrary(h, () => journeyMap),
    );

    // Spine, journey map, home and glossary belong to a volume: one set per volume, built when the volume is
    // first entered and swapped in whenever the chapter on screen belongs to another volume.
    interface VolumeViews {
      readonly spine: HudModule;
      readonly map: JourneyMap;
      readonly home: Overlay;
      readonly glossary: Overlay;
    }
    const views = new Map<string, VolumeViews>();
    const pending = new Set<string>();
    let current = '';
    const build = (volume: VolumeManifest, journey: Journey): VolumeViews => {
      const spine = createSpine(h, journey);
      const map = new JourneyMap(h, journey);
      // mounted once; while another volume is on screen the spine stays hidden and hears nothing
      h.mount(
        {
          node: spine.node,
          onChapter: (m) => (m.volume === volume.id ? spine.onChapter?.(m) : undefined),
          onLayout: (m) => {
            if (current === volume.id) spine.onLayout?.(m);
            else spine.node.visible = false;
          },
        },
        { side: 'left', extra: 6 },
      );
      const v = { spine, map, home: createHome(h, map), glossary: createGlossary(h, journey) };
      views.set(volume.id, v);
      return v;
    };
    // no deep link in the address bar → land on the home screen of the volume once its first chapter is up
    let landing = engine.router.route.chapterId === null;
    // the step that loads behind that home screen is not "visited" until the learner reaches it
    if (landing) h.landing.arm();
    let shownFor = '';
    const show = (volume: VolumeManifest, v: VolumeViews): void => {
      shownFor = volume.id;
      journeyMap = v.map;
      h.register('map', v.map);
      h.register('home', v.home);
      h.register('glossary', v.glossary);
      h.relayout();
      if (landing) {
        landing = false;
        h.open('home');
      }
    };
    /**
     * Build the views of a volume as soon as its first chapter starts loading — before the chapter scene is
     * created, as the views of a stand-alone course always were — so that they are laid out and settled by
     * the time the chapter appears (QA screenshots with a frozen clock depend on it).
     */
    const prepare = (volume: VolumeManifest): void => {
      if (views.has(volume.id) || pending.has(volume.id)) return;
      if (current === '') current = volume.id; // nothing is on screen yet: this is the volume we start in
      const registry = engine.library.registry(volume.id);
      if (registry && !(wantsFixture() && volume.fixtures?.journey)) {
        build(volume, journeyFromManifests(volume, registry.chapters));
        return;
      }
      pending.add(volume.id);
      void loadJourney(engine, volume).then((journey) => {
        const v = build(volume, journey);
        if (shownFor !== volume.id && current === volume.id) show(volume, v);
      });
    };
    /** The chapter on screen belongs to `volume` now: its views take over the overlay names. */
    const activate = (volume: VolumeManifest): void => {
      current = volume.id;
      prepare(volume);
      const v = views.get(volume.id);
      if (v) show(volume, v); // else: `prepare` shows them when the fixture has arrived
    };
    engine.runtime.on('loading', ({ volumeId, progress }) => {
      const volume = progress === 0 ? engine.library.get(volumeId) : undefined;
      if (volume) prepare(volume);
    });
    h.onVolume(activate);
    // D0 spike (docs/HUD_DOM.md): `?hud=dom` draws header, step panel and navigator as DOM over the canvas
    if (new URLSearchParams(window.location.search).get('hud') === 'dom')
      void import('@/hud-dom').then((m) => m.mountDomHud(h, { header: header.node, navigator: navigator.node }));
  },
};

export type { HudContext, HudModule, OverlayName } from './context';
export { stepUi, type StepUi, type StepUiApi, type ControlPatch } from './step-ui';
export type * from './step-ui-types';
