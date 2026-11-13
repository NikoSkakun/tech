/**
 * «Мапа подорожі» — the Journey Map controller: opens over the current chapter, shows the whole course as a
 * 3D "mountain of scale", lets the user travel along the path (drag / wheel / arrow keys), unfolds a node
 * into its steps and jumps to any step through the engine. Also serves as the hero scene of the home screen
 * (`attract` mode: slow drift, no labels).
 */
import { chapterProgress, contentKey, isVisited, journeyProgress } from '@/content';
import { groupLabel } from '@/engine/api';
import { col } from '@/style';
import { Button, Label, Panel, ProgressRing, TEXT_COLOR, UI, UiNode, conceal, reveal } from '@/ui3d';
import type { Journey } from '../journey';
import type { Hud, Overlay } from '../shell';
import { Backdrop } from './backdrop';
import { MapCamera } from './camera';
import { chapterCard } from './card';
import { MapLabels } from './labels';
import { layoutJourney, pathPoint, type MapLayout, type MapNode } from './layout';
import { MapWorld } from './world';

export class JourneyMap implements Overlay {
  readonly fullscreen = true;
  readonly layout: MapLayout;
  readonly camera: MapCamera;
  /** 0…1 presence of the map (animated). */
  presence = 0;
  /** Hero mode for the home screen: no labels, no card, the camera drifts. */
  attract = false;
  private readonly world: MapWorld;
  private readonly backdrop = new Backdrop();
  private readonly labels: MapLabels;
  private readonly ui: UiNode;
  private readonly bar: UiNode;
  private readonly cardSlot: UiNode;
  private readonly total: ProgressRing;
  private readonly totalText: Label;
  private hint!: Label;
  private selected = -1;
  private hover = -1;
  private u = 0;
  private time = 0;
  private isOpen = false;
  /** Presence the map is heading to (the target of the running `presence` tween). */
  private shown = false;
  /** True while this view holds `runtime.suspendWorld(true)`. */
  private suspending = false;

  constructor(
    private readonly hud: Hud,
    readonly journey: Journey,
  ) {
    const engine = hud.engine;
    this.layout = layoutJourney(journey);
    this.camera = new MapCamera(engine.hud.camera);
    this.world = new MapWorld(this.layout);
    this.camera.content.add(this.world.group);
    this.backdrop.userData.hudView = this.camera.rig.userData.hudView = true; // not chapter-owned: never hidden by the shell
    engine.hud.root.add(this.backdrop, this.camera.rig);
    this.world.fade = 0;
    this.labels = new MapLabels(this.layout, this.world.rulerX);

    // full-screen catcher far behind the map: drag = travel, wheel = zoom, click = back to the overview
    const catcher = new UiNode({ width: 'fill', height: 'fill', z: -6000 });
    catcher.on({
      cursor: 'grab',
      dragStart: () => undefined,
      drag: (e) => this.pan(-e.dx / Math.max(this.camera.view.zoom * 150 * hud.metrics.pxPerUnit, 1)),
      wheel: (dy) => {
        this.zoomBy(Math.exp(-dy * 0.0012));
        return true;
      },
      click: () => this.select(-1),
    });
    this.total = new ProgressRing({ size: 50, label: '' });
    this.totalText = new Label('', { size: UI.text.small, color: TEXT_COLOR.dim, nowrap: true });
    this.bar = new Panel({
      variant: 'card',
      dir: 'row',
      align: 'center',
      gap: 14,
      pad: [10, 18, 10, 12],
      float: { ax: 0, ay: 0 },
      layerUp: 1,
      children: [
        this.total,
        new UiNode({
          dir: 'col',
          gap: 0,
          children: [
            new Label('Мапа подорожі', { font: 'display', size: UI.text.h2, nowrap: true }),
            this.totalText,
          ],
        }),
      ],
    });
    const close = new Button({
      name: 'map-close',
      icon: 'close',
      label: 'Закрити',
      tooltip: 'Повернутися до розділу (M або Esc)',
      float: { ax: 1, ay: 0 },
      layerUp: 1,
      onClick: () => hud.close(),
    });
    const overview = new Button({
      name: 'map-overview',
      icon: 'expand',
      label: 'Уся подорож',
      tooltip: 'Показати весь шлях',
      float: { ax: 1, ay: 0 },
      layerUp: 1,
      onClick: () => this.select(-1),
    });
    const hint = (this.hint = new Label(
      'Тягніть, щоб мандрувати шляхом · колесо — масштаб · ← → — сусідні розділи · Enter — увійти',
      { size: UI.text.caption, color: TEXT_COLOR.mute, nowrap: true },
      { float: { ax: 0.5, ay: 1 } },
    ));
    // above the labels' text (text of a layer always draws over that layer's plates)
    this.cardSlot = new UiNode({ dir: 'stack', float: { ax: 1, ay: 0.5 }, layerUp: 1 });
    this.ui = new UiNode({
      dir: 'stack',
      width: 'fill',
      height: 'fill',
      visible: false,
      opacity: 0,
      children: [catcher, this.labels, this.bar, overview, close, hint, this.cardSlot],
    });
    hud.modal.add(this.ui);
    const place = (): void => {
      const m = hud.metrics;
      const g = m.safeMargin;
      this.backdrop.resize(m.width, m.height);
      this.bar.float = { ax: 0, ay: 0, dx: g, dy: g };
      close.float = { ax: 1, ay: 0, dx: -g, dy: g };
      overview.float = { ax: 1, ay: 0, dx: -g - 170, dy: g };
      hint.float = { ax: 0.5, ay: 1, dy: -g };
      hint.visible = m.layout === 'wide' && this.selected < 0;
      this.cardSlot.float =
        m.layout === 'wide' ? { ax: 1, ay: 0.5, dx: -g, dy: 20 } : { ax: 0.5, ay: 1, dy: -g };
      if (this.isOpen || this.attract) this.frame(true);
    };
    engine.hud.onResize(place);
    place();

    this.layout.nodes.forEach((n, i) => {
      engine.input.register(
        this.world.proxies[i]!,
        {
          tooltip: `${n.chapter.title} · ${n.chapter.axisLabel}`,
          hover: (over) => {
            this.hover = over ? i : this.hover === i ? -1 : this.hover;
          },
          click: () => this.select(i),
          enabled: () => this.isOpen && !this.attract,
        },
        'hud',
      );
    });
    // chapters that ship an `emblem.ts` replace their group's generic emblem
    this.layout.nodes.forEach((n, i) => {
      const load = n.chapter.emblem;
      if (!load) return;
      void load().then(
        (m) => this.world.setEmblem(i, m.default()),
        (error: unknown) => console.error(`[map] emblem of '${n.chapter.id}' failed to load:`, error),
      );
    });
    engine.onUpdate((dt) => this.update(dt));
    engine.store.subscribe(
      (s) => s.progress,
      () => this.refresh(),
    );
    this.refresh();
  }

  /** Index of the node of the chapter on screen (−1 if it is not on the map, e.g. a dev sandbox). */
  get here(): number {
    const s = this.hud.engine.store.get();
    return s.chapterId && s.volumeId === this.journey.volume.id
      ? (this.layout.byId(s.chapterId)?.index ?? -1)
      : -1;
  }

  open(): void {
    this.isOpen = true;
    this.attract = false;
    this.show(true);
    reveal(this.ui, { dy: 0, scale: 1 });
    this.refresh();
    // land on the whole journey, then travel to where the user is
    const here = this.here;
    this.selected = -1;
    this.frame(this.presence < 0.05);
    if (here >= 0)
      this.hud.host.tweens.delay(
        this.hud.engine.reducedMotion ? 0 : 0.55,
        () => this.isOpen && this.selected < 0 && this.select(here),
      );
  }

  close(): void {
    this.isOpen = false;
    this.setCard(null);
    conceal(this.ui, { dy: 0, scale: 1 });
    if (!this.attract) this.show(false);
  }

  /** Home-screen hero mode on / off (the map stays visible but passive). */
  setAttract(on: boolean): void {
    this.attract = on;
    if (on) {
      this.selected = -1;
      this.show(true);
      this.frame(this.presence < 0.05);
    } else if (!this.isOpen) this.show(false);
  }

  key(e: KeyboardEvent): boolean {
    const nodes = this.layout.nodes;
    const sel = nodes[this.selected];
    const step = (by: number): void => {
      if (!sel) return this.select(Math.max(this.here, 0));
      // satellites cycle among their siblings, main-path nodes along the path
      const ring = nodes.filter((n) => n.parent === sel.parent);
      const next = ring[ring.indexOf(sel) + by];
      if (next) this.select(next.index);
    };
    switch (e.code) {
      case 'ArrowRight': step(1); return true; // prettier-ignore
      case 'ArrowLeft': step(-1); return true; // prettier-ignore
      case 'ArrowDown': {
        const kid = sel ? nodes.find((n) => n.parent === sel.index) : undefined;
        if (kid) this.select(kid.index);
        return true;
      }
      case 'ArrowUp':
        if (sel && sel.parent >= 0) this.select(sel.parent);
        return true;
      case 'Enter':
      case 'NumpadEnter':
        if (sel) this.enter(sel, null);
        return true;
      case 'Escape':
        if (this.selected < 0) return false; // the HUD closes the map
        this.select(-1);
        return true;
      default:
        return false;
    }
  }

  /** Select a node (the camera travels to it and its steps unfold) or −1 for the overview. */
  select(index: number): void {
    this.selected = index;
    const node = this.layout.nodes[index] ?? null;
    if (node) this.u = node.u;
    this.hint.visible = !node && this.hud.metrics.layout === 'wide';
    this.frame(false);
    this.setCard(node);
  }

  private enter(node: MapNode, stepId: string | null): void {
    const c = node.chapter;
    if (!c.real) {
      this.hud.toast(`«${c.title}» ще будується.`, { tone: 'warning', duration: 2.5 });
      return;
    }
    const visited = this.hud.engine.store.get().progress.visited;
    const key = contentKey(c);
    const target = stepId ?? c.steps.find((s) => !isVisited(visited, key, s.id))?.id ?? c.steps[0]!.id;
    // dive toward the platform while the HUD hands over to the engine's own scale-zoom
    this.camera.go({ zoom: this.camera.goal.zoom * 2.2 });
    this.hud.goto(key, target);
  }

  private setCard(node: MapNode | null): void {
    for (const old of [...this.cardSlot.children])
      conceal(old, { dx: 30, dy: 0, onDone: () => old.detach() });
    if (!node || this.attract) {
      this.world.setBeads(null, [], col('white'));
      return;
    }
    const state = this.hud.engine.store.get();
    const m = this.hud.metrics;
    const visited = state.progress.visited;
    const card = chapterCard({
      chapter: node.chapter,
      group: groupLabel(this.journey.volume, node.chapter.group),
      visited,
      currentStep:
        state.volumeId === node.chapter.volume && state.chapterId === node.chapter.id ? state.stepId : null,
      maxHeight: m.layout === 'wide' ? m.height - 190 : m.height * 0.5,
      onStep: (stepId) => this.enter(node, stepId),
      onClose: () => this.select(-1),
    });
    if (m.layout !== 'wide') card.width = Math.min(m.width - m.safeMargin * 2, 620);
    card.visible = false;
    this.cardSlot.add(card);
    reveal(card, { dx: 40, dy: 0 });
    this.world.setBeads(
      node,
      node.chapter.steps.map((s) => isVisited(visited, contentKey(node.chapter), s.id)),
      col(node.chapter.accent),
    );
  }

  /** Point the camera at the selection (or frame the whole journey). */
  private frame(instant: boolean): void {
    const m = this.hud.metrics;
    const node = this.layout.nodes[this.selected];
    const wide = m.layout === 'wide';
    if (!node) {
      const top = Math.max(...this.layout.nodes.map((n) => n.y));
      const span = this.layout.width + 620;
      const fit = Math.min((m.width * 0.95) / span, (m.height * 0.66) / (top - this.layout.ground + 200));
      const at = pathPoint(this.layout, this.u);
      // in the overview the whole path is in frame; on narrow screens it scrolls with `u`
      const x = fit * span >= m.width * 0.9 && !wide ? at.x : -60;
      this.camera.go(
        {
          x,
          y: (top + this.layout.ground) / 2 + 70,
          z: 0,
          zoom: this.attract ? fit * 1.12 : fit,
          yaw: -0.06,
          pitch: 0.3,
          sx: 0,
          sy: this.attract ? -m.height * 0.1 : -10,
        },
        instant,
      );
      return;
    }
    // a hub is framed together with its satellites; a satellite keeps its family in view
    const hub = node.parent >= 0 ? this.layout.nodes[node.parent]! : node;
    const kids = this.layout.nodes.filter((n) => n.parent === hub.index);
    const family = kids.length > 0;
    const low = family ? Math.min(...kids.map((k) => k.y)) : hub.y;
    const spread = family ? Math.max(...kids.map((k) => Math.abs(k.x - hub.x))) * 2 + 260 : 0;
    const room = wide ? m.width * 0.62 : m.width * 0.92;
    this.camera.go(
      {
        x: family ? hub.x : node.x,
        y: family ? (hub.y + low) / 2 + 20 : node.y + 30,
        z: family ? hub.z + 60 : node.z,
        zoom: family ? Math.min(room / spread, (m.height * 0.6) / (hub.y - low + 240), 1.9) : 2.1,
        yaw: -0.14 + 0.05 * Math.sin(node.u),
        pitch: 0.28,
        sx: wide ? -m.width * 0.15 : 0,
        sy: wide ? -10 : m.height * 0.2,
      },
      instant,
    );
  }

  /** Travel along the main path by `du` nodes (drag). */
  private pan(du: number): void {
    this.u = Math.min(Math.max(this.u + du, 0), this.layout.spine.length - 1);
    if (this.selected >= 0) {
      this.selected = -1;
      this.setCard(null);
    }
    const at = pathPoint(this.layout, this.u);
    const zoom = Math.max(this.camera.goal.zoom, 1.15);
    this.camera.go({ x: at.x, y: at.y + 20, z: at.z, zoom, yaw: 0, pitch: 0.26, sx: 0, sy: 0 });
  }

  private zoomBy(factor: number): void {
    const zoom = Math.min(Math.max(this.camera.goal.zoom * factor, 0.3), 3.2);
    if (zoom < 0.95 && this.selected >= 0) {
      this.select(-1);
      return;
    }
    this.camera.go({ zoom });
  }

  private show(on: boolean): void {
    this.shown = on;
    // the scene must render again before the fade-out starts to reveal it
    if (!on) this.suspend(false);
    const tweens = this.hud.host.tweens;
    const duration = this.hud.engine.reducedMotion ? 0.12 : on ? 0.5 : 0.3;
    tweens.to(
      this as JourneyMap,
      { presence: on ? 1 : 0 },
      { duration, ease: on ? 'power2.out' : 'power2.in' },
    );
  }

  private refresh(): void {
    const visited = this.hud.engine.store.get().progress.visited;
    this.layout.nodes.forEach((n, i) => {
      const p = chapterProgress(visited, n.chapter);
      this.labels.setProgress(i, p.done, p.total);
    });
    const all = journeyProgress(visited, this.journey.chapters);
    this.total.value = all.fraction;
    this.total.label = `${Math.round(all.fraction * 100)}%`;
    this.totalText.text = `Переглянуто ${all.done} з ${all.total} кроків · ${this.journey.chapters.length} розділів`;
  }

  private update(dt: number): void {
    const p = this.presence;
    this.backdrop.opacity = p; // fully opaque: emissive parts of the chapter underneath would ghost through
    this.world.fade = p;
    // the backdrop is opaque: stop rendering the chapter's world underneath (the engine still renders it during
    // a chapter load / transition, so a jump from the map or a deep link while the map is open stays correct)
    if (this.shown && p >= 0.999) this.suspend(true);
    if (p <= 0.002) return;
    this.time += dt;
    if (this.attract) {
      // slow drift over the journey behind the home screen
      this.camera.go({
        yaw: Math.sin(this.time * 0.11) * 0.22,
        x: Math.sin(this.time * 0.07) * this.layout.width * 0.16,
      });
    }
    this.camera.update(dt);
    this.backdrop.setGround(
      this.camera.content,
      this.hud.engine.hud.camera,
      this.layout.ground,
      this.layout.width * 0.85 + 500,
      p,
    );
    this.world.mark(this.here, this.selected, this.hover);
    this.world.update(this.time, dt);
    this.labels.update(this.camera, this.selected, this.attract ? 0 : p, dt);
  }

  private suspend(on: boolean): void {
    if (on === this.suspending) return;
    this.suspending = on;
    this.hud.engine.runtime.suspendWorld(on);
  }
}
