/**
 * The HUD shell: one `UiSurface` in the engine's HUD layer, the persistent regions (header, step panel,
 * navigator, spine, system buttons, dock), responsive placement, inset reporting to the camera director,
 * choreography around chapter transitions, overlays (map, home, settings, glossary, help).
 */
import {
  fullChapterId,
  type ChapterManifest,
  type Engine,
  type HudMetrics,
  type Position,
  type VolumeManifest,
} from '@/engine/api';
import { linkTarget, loadContent, type ChapterContent } from '@/content';
import {
  ToastStack,
  UI,
  UiNode,
  UiSurface,
  conceal,
  reveal,
  setAccent,
  type ToastOptions,
  type UiHost,
} from '@/ui3d';
import type { HudContext, HudModule, OverlayName } from './context';
import { Landing } from './landing';

/** Screen edge a region counts toward (`auto`: right on wide screens, bottom otherwise). */
export type InsetSide = 'left' | 'right' | 'top' | 'bottom' | 'auto';

export interface Overlay {
  /** Show the overlay; `arg` is view-specific (e.g. a glossary term to focus). */
  open(arg?: unknown): void;
  close(): void;
  /** True for full-screen views that replace the HUD (map, home); false for modal panels over it. */
  readonly fullscreen: boolean;
  /** Keys while the overlay is open; return true when consumed. */
  key?(e: KeyboardEvent): boolean;
}

export class Hud implements HudContext {
  readonly surface: UiSurface;
  readonly host: UiHost;
  volume: VolumeManifest | null = null;
  chapter: ChapterManifest | null = null;
  content: ChapterContent | null = null;
  overlay: OverlayName | null = null;
  /** Regions that hide while a full-screen view is open or a chapter transition runs. */
  readonly chrome = new UiNode({
    name: 'chrome',
    dir: 'stack',
    width: 'fill',
    height: 'fill',
    layer: UI.layer.base,
  });
  /** Projected annotations (callouts, hotspots) — below the chrome. */
  readonly world = new UiNode({
    name: 'annotations',
    dir: 'stack',
    width: 'fill',
    height: 'fill',
    layer: UI.layer.world,
  });
  /** Cards and bubbles above the chrome. */
  readonly popups = new UiNode({
    name: 'popups',
    dir: 'stack',
    width: 'fill',
    height: 'fill',
    layer: UI.layer.popup,
  });
  /** Full-screen views and modal overlays. */
  readonly modal = new UiNode({
    name: 'modal',
    dir: 'stack',
    width: 'fill',
    height: 'fill',
    layer: UI.layer.modal,
  });
  readonly toasts = new ToastStack({ float: { ax: 0.5, ay: 0, dy: 96 }, layer: UI.layer.tip });
  private readonly modules: HudModule[] = [];
  private readonly volumeListeners: ((volume: VolumeManifest) => void)[] = [];
  private readonly overlays = new Map<OverlayName, Overlay>();
  private readonly insetSources: {
    side: InsetSide | ((m: HudMetrics) => InsetSide);
    node: UiNode;
    extra: number;
  }[] = [];
  private layoutPending = true;
  private chromeShown = true;
  private contentToken = 0;

  /** The first step of a first visit, loaded behind the landing screen and not seen yet (`landing.ts`). */
  readonly landing: Landing;

  constructor(readonly engine: Engine) {
    this.landing = new Landing(engine);
    this.host = {
      tweens: engine.tweens.root.scope(),
      input: engine.input,
      layer: 'hud',
      reducedMotion: () => engine.reducedMotion,
    };
    const m = engine.hud.metrics;
    this.surface = new UiSurface(this.host, {
      width: m.width,
      height: m.height,
      name: 'hud',
      renderOrder: 1000,
    });
    this.surface.root.add(this.world, this.chrome, this.popups, this.modal, this.toasts);
    engine.hud.root.add(this.surface);
    engine.hud.onResize(() => this.relayout());
    engine.onUpdate((dt) => this.update(dt));
    engine.runtime.on('chapter', ({ volumeId, chapterId }) => this.setChapter(volumeId, chapterId));
    engine.runtime.on('step', ({ volumeId, chapterId, stepId, instant }) => {
      this.landing.moved({ volumeId, chapterId, stepId });
      this.modules.forEach((mod) => mod.onStep?.(stepId, instant));
      // accessibility plumbing: announce the step in the page's invisible live region
      const live = document.getElementById('live');
      const step = this.chapter?.steps.find((s) => s.id === stepId);
      if (live && step && this.chapter)
        live.textContent = `${this.chapter.title}. ${step.title}. ${step.blurb}`;
    });
    engine.runtime.on('transitionStart', ({ duration }) => this.transition(duration));
    engine.input.on('action', (action) => {
      if (action === 'map') {
        if (this.overlay === 'map') this.close();
        else this.open('map');
      } else if (action === 'library') {
        // a single-volume library has no library level: the key does nothing there
        if (this.overlay === 'library') this.close();
        else if (engine.library.listed.length > 1) this.open('library');
      } else if (action === 'back') this.close();
    });
  }

  get metrics(): HudMetrics {
    return this.engine.hud.metrics;
  }

  /** Add a persistent region. `inset` makes it count toward the camera's free area. */
  mount(
    mod: HudModule,
    inset?: { side: InsetSide | ((m: HudMetrics) => InsetSide); extra?: number },
    parent: UiNode = this.chrome,
  ): void {
    this.modules.push(mod);
    parent.add(mod.node);
    if (inset) this.insetSources.push({ side: inset.side, node: mod.node, extra: inset.extra ?? 0 });
    if (this.volume) mod.onVolume?.(this.volume);
    if (this.chapter) {
      mod.onChapter?.(this.chapter);
      mod.onContent?.(this.content);
    }
    this.relayout();
  }

  /** Call `fn` whenever the chapter on screen belongs to another volume than before (and now, if one is up). */
  onVolume(fn: (volume: VolumeManifest) => void): void {
    this.volumeListeners.push(fn);
    if (this.volume) fn(this.volume);
  }

  /** Register (or replace) the view behind an overlay name; volume-bound views are swapped per volume. */
  register(name: OverlayName, overlay: Overlay): void {
    this.overlays.set(name, overlay);
  }

  relayout(): void {
    this.layoutPending = true;
  }

  toast(text: string, opts?: ToastOptions): () => void {
    return this.toasts.push(text, opts);
  }

  open(name: OverlayName, arg?: unknown): void {
    const next = this.overlays.get(name);
    if (!next) return;
    if (this.overlay && this.overlay !== name) this.overlays.get(this.overlay)?.close();
    this.overlay = name;
    next.open(arg);
    if (next.fullscreen) this.showChrome(false);
  }

  close(): boolean {
    const name = this.overlay;
    if (!name) return false;
    this.overlay = null;
    this.overlays.get(name)?.close();
    this.showChrome(true);
    this.landing.revealed();
    return true;
  }

  /** @internal Key routing for the open overlay. */
  overlayKey(e: KeyboardEvent): boolean {
    return (this.overlay && this.overlays.get(this.overlay)?.key?.(e)) || false;
  }

  get unseenStep(): Position | null {
    return this.landing.step;
  }

  goto(chapter: string, stepId?: string): void {
    this.landing.leaving(chapter, stepId);
    this.close();
    void this.engine.nav.goto(chapter, stepId);
  }

  /** Is the library level shown while this chapter's volume is on screen (see `Library.showsLibrary`)? */
  get libraryLevel(): boolean {
    return this.volume !== null && this.engine.library.showsLibrary(this.volume.id);
  }

  /** Show / hide the persistent regions (full-screen views and transitions hide them). */
  showChrome(on: boolean, instant = false): void {
    if (on === this.chromeShown && !instant) return;
    this.chromeShown = on;
    // chapter-owned HUD objects (a chapter's own `hudSurface`, legacy sandbox panels) step aside as well
    for (const child of this.engine.hud.root.children) {
      if (child === this.surface || child.userData.hudView === true) continue;
      if (!on && child.visible) {
        child.userData.hiddenByHud = true;
        child.visible = false;
      } else if (on && child.userData.hiddenByHud === true) {
        child.userData.hiddenByHud = false;
        child.visible = true;
      }
    }
    for (const node of [this.chrome, this.world]) {
      if (on) reveal(node, { dy: 0, scale: 1.015, instant });
      else conceal(node, { dy: 0, scale: 1.015, instant });
    }
    this.relayout();
  }

  /* ---------------------------------------------------------------------------------------------- */

  private setChapter(volumeId: string, chapterId: string): void {
    const library = this.engine.library;
    const manifest = library.registry(volumeId)?.get(chapterId) ?? null;
    this.chapter = manifest;
    this.content = null;
    if (!manifest) return;
    const volume = library.get(volumeId) ?? null;
    let changed = false;
    if (volume && volume !== this.volume) {
      this.volume = volume;
      changed = true;
      for (const mod of this.modules) mod.onVolume?.(volume);
    }
    setAccent(this.surface.root, manifest.theme.accent);
    this.toasts.flush();
    for (const mod of this.modules) {
      mod.onChapter?.(manifest);
      mod.onContent?.(null);
    }
    // volume listeners (the per-volume views of the HUD plugin) run once the modules know the new chapter
    if (changed && volume) for (const fn of this.volumeListeners) fn(volume);
    const token = ++this.contentToken;
    void loadContent(fullChapterId(manifest)).then(async (content) => {
      if (token !== this.contentToken || !content) return;
      // «Див. також» may point into other volumes: have their chapter lists ready before the links are built
      const linked = new Set<string>();
      for (const ref of content.crossReferences ?? [])
        for (const target of ref.targets) {
          const to = linkTarget(target)?.volumeId;
          if (to && to !== volumeId && library.has(to)) linked.add(to);
        }
      if (linked.size > 0) {
        await Promise.all([...linked].map((id) => library.load(id).catch(() => null)));
        if (token !== this.contentToken) return;
      }
      this.content = content;
      for (const mod of this.modules) mod.onContent?.(content);
      this.relayout();
    });
    this.relayout();
  }

  /** Chapter transition: the chrome steps aside while the engine zooms, then returns with the new content. */
  private transition(duration: number): void {
    if (duration <= 0 || this.overlay) return;
    const fullscreen = this.overlay ? this.overlays.get(this.overlay)?.fullscreen : false;
    if (fullscreen) return;
    this.showChrome(false);
    this.host.tweens.delay(duration * 0.6, () => {
      const open = this.overlay ? this.overlays.get(this.overlay)?.fullscreen : false;
      if (!open) this.showChrome(true);
    });
  }

  private update(dt: number): void {
    if (this.layoutPending) this.layout();
    for (const mod of this.modules) mod.update?.(dt);
  }

  private layout(): void {
    this.layoutPending = false;
    const m = this.metrics;
    this.surface.setSize(m.width, m.height);
    this.surface.cssPxPerUnit = m.pxPerUnit;
    for (const mod of this.modules) mod.onLayout?.(m);
    this.surface.flush();
    // free area for the camera director: what the regions leave uncovered
    const insets = { left: 0, right: 0, top: 0, bottom: 0 };
    if (this.chromeShown) {
      for (const src of this.insetSources) {
        const n = src.node;
        if (!n.visible || n.slot < 0) continue;
        // `auto`: a side column on wide screens, a bottom sheet otherwise
        const declared = typeof src.side === 'function' ? src.side(m) : src.side;
        const side = declared === 'auto' ? (m.layout === 'wide' ? 'right' : 'bottom') : declared;
        const size = side === 'left' || side === 'right' ? n.bw : n.bh;
        const offset =
          side === 'left'
            ? n.bx
            : side === 'right'
              ? m.width - n.bx - n.bw
              : side === 'top'
                ? n.by
                : m.height - n.by - n.bh;
        insets[side] = Math.max(insets[side], Math.max(offset, 0) + size + src.extra);
      }
    }
    this.engine.hud.setInsets(insets);
  }
}
