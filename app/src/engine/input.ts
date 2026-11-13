/**
 * Unified input (ARCHITECTURE §4): Pointer Events (mouse, touch, pen) raycast against registered objects —
 * HUD layer first, then the world — with hover / press / click / drag / wheel / pinch, pointer capture, cursor
 * management, a keyboard action map and a first-user-gesture signal (audio unlock).
 *
 * Anything not claimed by a registered object drives the camera director's constrained orbit / zoom.
 */
import {
  Plane,
  Ray,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Intersection,
  type Object3D,
} from 'three';
import { Emitter, type Unsubscribe } from './events';
import type { CameraDirector } from './camera/director';

export type InputLayer = 'world' | 'hud';

export interface PointerInfo {
  readonly pointerId: number;
  /** `mouse`, `touch` or `pen`. */
  readonly pointerType: string;
  /** Position in CSS px relative to the canvas (origin top-left). */
  readonly x: number;
  readonly y: number;
  /** Normalised device coordinates −1…1 (y up). */
  readonly ndc: Vector2;
  /** Pick ray in the coordinate space of the object's layer (world space / HUD scene space). */
  readonly ray: Ray;
  /** Hit point on the object, if the pointer is over it. */
  readonly point: Vector3 | null;
  /** The registered object this event is for. */
  readonly object: Object3D;
  readonly layer: InputLayer;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
}

export interface DragInfo extends PointerInfo {
  /** Movement since the previous drag event, CSS px. */
  readonly dx: number;
  readonly dy: number;
  /** Movement since the press, CSS px. */
  readonly totalX: number;
  readonly totalY: number;
  /** Hit point where the drag started. */
  readonly startPoint: Vector3 | null;
  /**
   * Intersect the current pick ray with a plane (given by normal and a point on it) — the usual way to drag
   * an object across a surface. Returns null if the ray is parallel to the plane.
   */
  planePoint(normal: Vector3, through: Vector3, out?: Vector3): Vector3 | null;
}

export interface InteractionHandlers {
  /** CSS cursor while hovering. Default `pointer` (`grab` when drag handlers are present). */
  cursor?: string;
  /** Name shown in the hover tooltip (STYLE_GUIDE §6); the HUD renders it from the `hover` event. */
  tooltip?: string | (() => string);
  /** Called with `true` when the pointer enters, `false` when it leaves — drive hover lift/glow here. */
  hover?(over: boolean, e: PointerInfo): void;
  press?(e: PointerInfo): void;
  release?(e: PointerInfo): void;
  /** Press + release on the object without dragging away. */
  click?(e: PointerInfo): void;
  dragStart?(e: DragInfo): void;
  drag?(e: DragInfo): void;
  dragEnd?(e: DragInfo): void;
  /** Return true to consume the wheel event (otherwise it zooms the camera). */
  wheel?(deltaY: number, e: PointerInfo): boolean | void;
  /** Return false to make the object temporarily non-interactive. */
  enabled?(): boolean;
}

export interface HoverEvent {
  /** Hovered registered object, or null when the pointer left all interactive objects. */
  object: Object3D | null;
  tooltip: string | null;
  layer: InputLayer | null;
  /** Pointer position in CSS px. */
  x: number;
  y: number;
}

export type KeyAction = 'next' | 'prev' | 'first' | 'last' | 'map' | 'library' | 'back' | 'fullscreen';

export interface InputEvents {
  hover: HoverEvent;
  /** A mapped key was pressed (←/→ steps, M map, Esc back, F fullscreen, Home/End). */
  action: KeyAction;
  /** First pointer or key gesture of the session. */
  gesture: void;
  /** Pointer pressed on empty space (nothing interactive under it). */
  background: { x: number; y: number };
}

/** Registration interface handed to chapters; everything registered is removed with the chapter. */
export interface ScopedInput {
  /**
   * Make an object interactive. Its whole subtree is pickable. Returns a function that unregisters it.
   * @param layer `world` (default) or `hud` for objects in the HUD scene.
   */
  register(object: Object3D, handlers: InteractionHandlers, layer?: InputLayer): Unsubscribe;
  /** Subscribe to input events (hover, key actions, …). */
  on<K extends keyof InputEvents>(type: K, fn: (payload: InputEvents[K]) => void): Unsubscribe;
  /**
   * Take keys before the engine maps them to step actions. The handler sees every `keydown` (also with
   * modifiers, never while a DOM text field has focus); return true when it consumed the key — the engine then
   * calls `preventDefault()` and emits no `action`. Higher `priority` runs first (default 0; the HUD uses 100 so
   * open overlays and focused controls win over chapter handlers); equal priority: the newest first.
   * Returns an unsubscribe.
   */
  captureKeys(handler: KeyCapture, options?: { priority?: number }): Unsubscribe;
}

/** See `ScopedInput.captureKeys`. */
export type KeyCapture = (e: KeyboardEvent) => boolean;

interface Entry {
  object: Object3D;
  handlers: InteractionHandlers;
  layer: InputLayer;
}

interface Pick {
  entry: Entry;
  hit: Intersection;
}

interface ActivePointer {
  id: number;
  type: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  entry: Entry | null;
  startPoint: Vector3 | null;
  dragging: boolean;
  moved: boolean;
}

const KEY_MAP: Record<string, KeyAction> = {
  ArrowRight: 'next',
  PageDown: 'next',
  Space: 'next',
  ArrowLeft: 'prev',
  PageUp: 'prev',
  Home: 'first',
  End: 'last',
  KeyM: 'map',
  KeyL: 'library',
  Escape: 'back',
  KeyF: 'fullscreen',
};

const DRAG_THRESHOLD_PX = 4;

function visibleDeep(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export interface InputHost {
  /** HUD camera (the HUD layer is picked first). */
  hudCamera: Camera;
  /** Active world camera director, or null while nothing is loaded. */
  director(): CameraDirector | null;
}

export class InputSystem implements ScopedInput {
  /** Resolves on the first user gesture. */
  readonly gesture: Promise<void>;
  private resolveGesture!: () => void;
  private gestureSeen = false;
  private readonly events = new Emitter<InputEvents>();
  private readonly entries = new Map<Object3D, Entry>();
  private readonly raycaster = new Raycaster();
  private readonly pointers = new Map<number, ActivePointer>();
  private hovered: Entry | null = null;
  private lastPointer: { x: number; y: number; type: string; inside: boolean } = {
    x: 0,
    y: 0,
    type: 'mouse',
    inside: false,
  };
  private hoverDirty = false;
  private pinchDistance = 0;
  private readonly ndc = new Vector2();
  private readonly listeners: (() => void)[] = [];
  private readonly keyCaptures: { fn: KeyCapture; priority: number }[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: InputHost,
  ) {
    this.raycaster.layers.enableAll(); // overlay-layer objects (labels, markers) are pickable too
    this.gesture = new Promise((resolve) => {
      this.resolveGesture = resolve;
    });
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(type, fn as EventListener, opts);
      this.listeners.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    canvas.style.touchAction = 'none'; // we handle pan/pinch ourselves
    on(canvas, 'pointerdown', (e) => this.onDown(e));
    on(canvas, 'pointermove', (e) => this.onMove(e));
    on(canvas, 'pointerup', (e) => this.onUp(e, false));
    on(canvas, 'pointercancel', (e) => this.onUp(e, true));
    on(canvas, 'pointerleave', () => {
      this.lastPointer.inside = false;
      this.hoverDirty = true;
    });
    on(canvas, 'wheel', (e) => this.onWheel(e), { passive: false });
    on(canvas, 'contextmenu', (e) => e.preventDefault());
    on(window, 'keydown', (e) => this.onKey(e));
    on(window, 'blur', () => this.cancelAll());
  }

  register(object: Object3D, handlers: InteractionHandlers, layer: InputLayer = 'world'): Unsubscribe {
    const entry: Entry = { object, handlers, layer };
    this.entries.set(object, entry);
    this.hoverDirty = true;
    return () => {
      if (this.entries.get(object) !== entry) return;
      this.entries.delete(object);
      if (this.hovered === entry) this.setHover(null, null);
      for (const p of this.pointers.values()) if (p.entry === entry) p.entry = null;
    };
  }

  on<K extends keyof InputEvents>(type: K, fn: (payload: InputEvents[K]) => void): Unsubscribe {
    return this.events.on(type, fn);
  }

  captureKeys(handler: KeyCapture, options: { priority?: number } = {}): Unsubscribe {
    // a fresh entry per call: the same function may be installed twice and is removed once per unsubscribe
    const entry = { fn: handler, priority: options.priority ?? 0 };
    const at = this.keyCaptures.findIndex((c) => c.priority <= entry.priority);
    this.keyCaptures.splice(at < 0 ? this.keyCaptures.length : at, 0, entry);
    return () => {
      const i = this.keyCaptures.indexOf(entry);
      if (i >= 0) this.keyCaptures.splice(i, 1);
    };
  }

  /** A scope whose registrations and subscriptions are all removed by `dispose()`. */
  scoped(): ScopedInput & { dispose(): void } {
    const offs = new Set<Unsubscribe>();
    const track = (off: Unsubscribe): Unsubscribe => {
      offs.add(off);
      return () => {
        offs.delete(off);
        off();
      };
    };
    return {
      register: (object, handlers, layer) => track(this.register(object, handlers, layer)),
      on: (type, fn) => track(this.on(type, fn)),
      captureKeys: (handler, options) => track(this.captureKeys(handler, options)),
      dispose: () => {
        for (const off of [...offs]) off();
        offs.clear();
      },
    };
  }

  /** @internal Once per frame: refresh hover (objects may have moved under a resting pointer). */
  update(): void {
    if (this.pointers.size > 0) return; // hover is frozen while a pointer is down
    if (this.lastPointer.type === 'touch' && !this.lastPointer.inside) return;
    if (!this.hoverDirty && this.entries.size === 0) return;
    this.hoverDirty = false;
    if (!this.lastPointer.inside) {
      this.setHover(null, null);
      return;
    }
    const pick = this.pick(this.lastPointer.x, this.lastPointer.y);
    this.setHover(pick?.entry ?? null, pick);
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners.length = 0;
    this.entries.clear();
    this.events.clear();
  }

  /* ----------------------------------------------------------------------------------------- picking */

  private toNdc(x: number, y: number): Vector2 {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    return this.ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
  }

  private cameraFor(layer: InputLayer): Camera | null {
    return layer === 'hud' ? this.host.hudCamera : (this.host.director()?.camera ?? null);
  }

  private pick(x: number, y: number): Pick | null {
    const ndc = this.toNdc(x, y);
    for (const layer of ['hud', 'world'] as const) {
      const camera = this.cameraFor(layer);
      if (!camera) continue;
      const roots: Object3D[] = [];
      for (const e of this.entries.values()) {
        if (e.layer === layer && (e.handlers.enabled?.() ?? true) && visibleDeep(e.object))
          roots.push(e.object);
      }
      if (roots.length === 0) continue;
      this.raycaster.setFromCamera(ndc, camera);
      const hits = this.raycaster.intersectObjects(roots, true);
      for (const hit of hits) {
        if (!visibleDeep(hit.object)) continue;
        for (let o: Object3D | null = hit.object; o; o = o.parent) {
          const entry = this.entries.get(o);
          if (entry && entry.layer === layer) return { entry, hit };
        }
      }
    }
    return null;
  }

  private info(
    entry: Entry,
    x: number,
    y: number,
    e: { pointerId?: number; pointerType?: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean },
    point: Vector3 | null,
  ): PointerInfo {
    const ndc = this.toNdc(x, y).clone();
    const camera = this.cameraFor(entry.layer);
    const ray = new Ray();
    if (camera) {
      this.raycaster.setFromCamera(ndc, camera);
      ray.copy(this.raycaster.ray);
    }
    return {
      pointerId: e.pointerId ?? 0,
      pointerType: e.pointerType ?? 'mouse',
      x,
      y,
      ndc,
      ray,
      point,
      object: entry.object,
      layer: entry.layer,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
    };
  }

  private dragInfo(p: ActivePointer, entry: Entry, e: PointerEvent, dx: number, dy: number): DragInfo {
    const base = this.info(entry, p.x, p.y, e, null);
    const plane = new Plane();
    return {
      ...base,
      dx,
      dy,
      totalX: p.x - p.startX,
      totalY: p.y - p.startY,
      startPoint: p.startPoint,
      planePoint: (normal, through, out = new Vector3()) =>
        base.ray.intersectPlane(plane.setFromNormalAndCoplanarPoint(normal, through), out),
    };
  }

  private setHover(entry: Entry | null, pick: Pick | null): void {
    if (entry === this.hovered) return;
    const { x, y } = this.lastPointer;
    const neutral = { shiftKey: false, ctrlKey: false, altKey: false };
    const previous = this.hovered;
    this.hovered = entry;
    if (previous) previous.handlers.hover?.(false, this.info(previous, x, y, neutral, null));
    if (entry) entry.handlers.hover?.(true, this.info(entry, x, y, neutral, pick?.hit.point ?? null));
    this.updateCursor();
    const tooltip = entry?.handlers.tooltip;
    this.events.emit('hover', {
      object: entry?.object ?? null,
      tooltip: tooltip === undefined ? null : typeof tooltip === 'function' ? tooltip() : tooltip,
      layer: entry?.layer ?? null,
      x,
      y,
    });
  }

  private updateCursor(): void {
    let cursor = 'default';
    const dragging = [...this.pointers.values()].some((p) => p.dragging || (p.entry === null && p.moved));
    if (dragging) cursor = 'grabbing';
    else if (this.hovered) {
      const h = this.hovered.handlers;
      cursor = h.cursor ?? (h.drag || h.dragStart ? 'grab' : 'pointer');
    }
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
  }

  /* ------------------------------------------------------------------------------------------ events */

  private local(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private noteGesture(): void {
    if (this.gestureSeen) return;
    this.gestureSeen = true;
    this.resolveGesture();
    this.events.emit('gesture', undefined);
  }

  private onDown(e: PointerEvent): void {
    this.noteGesture();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { x, y } = this.local(e);
    this.lastPointer = { x, y, type: e.pointerType, inside: true };
    const pick = this.pointers.size === 0 ? this.pick(x, y) : null;
    const p: ActivePointer = {
      id: e.pointerId,
      type: e.pointerType,
      x,
      y,
      startX: x,
      startY: y,
      entry: pick?.entry ?? null,
      startPoint: pick?.hit.point.clone() ?? null,
      dragging: false,
      moved: false,
    };
    this.pointers.set(e.pointerId, p);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort (synthetic events have no active pointer)
    }
    if (pick) {
      this.setHover(pick.entry, pick);
      pick.entry.handlers.press?.(this.info(pick.entry, x, y, e, pick.hit.point));
    } else if (this.pointers.size === 1) {
      this.events.emit('background', { x, y });
    }
    if (this.pointers.size === 2) this.pinchDistance = this.currentPinchDistance();
  }

  private onMove(e: PointerEvent): void {
    const { x, y } = this.local(e);
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      this.lastPointer = { x, y, type: e.pointerType, inside: true };
      this.hoverDirty = true;
      return;
    }
    const dx = x - p.x;
    const dy = y - p.y;
    p.x = x;
    p.y = y;
    this.lastPointer = { x, y, type: e.pointerType, inside: true };
    if (!p.moved && Math.hypot(x - p.startX, y - p.startY) > DRAG_THRESHOLD_PX) p.moved = true;
    if (!p.moved) return;
    const director = this.host.director();
    if (this.pointers.size >= 2) {
      // two fingers: pinch zooms, the centroid pans the orbit
      const d = this.currentPinchDistance();
      if (this.pinchDistance > 0 && d > 0) director?.zoomBy(this.pinchDistance / d);
      this.pinchDistance = d;
      director?.orbitBy(dx * 0.5, dy * 0.5);
      return;
    }
    const entry = p.entry;
    if (entry && (entry.handlers.drag || entry.handlers.dragStart)) {
      if (!p.dragging) {
        p.dragging = true;
        entry.handlers.dragStart?.(this.dragInfo(p, entry, e, 0, 0));
        this.updateCursor();
      }
      entry.handlers.drag?.(this.dragInfo(p, entry, e, dx, dy));
    } else if (!entry || entry.layer === 'world') {
      // empty space (or a non-draggable world object): orbit the camera
      director?.orbitBy(dx, dy);
      this.updateCursor();
    }
  }

  private onUp(e: PointerEvent, cancelled: boolean): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    const entry = p.entry;
    if (entry && this.entries.get(entry.object) === entry) {
      if (p.dragging) entry.handlers.dragEnd?.(this.dragInfo(p, entry, e, 0, 0));
      const pick = cancelled ? null : this.pick(p.x, p.y);
      entry.handlers.release?.(this.info(entry, p.x, p.y, e, pick?.entry === entry ? pick.hit.point : null));
      if (!cancelled && !p.dragging && pick?.entry === entry) {
        entry.handlers.click?.(this.info(entry, p.x, p.y, e, pick.hit.point));
      }
    }
    if (this.pointers.size < 2) this.pinchDistance = 0;
    if (e.pointerType === 'touch') this.lastPointer.inside = false;
    this.hoverDirty = true;
    this.updateCursor();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const { x, y } = this.local(e);
    const pick = this.pick(x, y);
    const delta = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    if (pick?.entry.handlers.wheel) {
      const consumed = pick.entry.handlers.wheel(
        delta,
        this.info(
          pick.entry,
          x,
          y,
          {
            ...e,
            pointerId: 0,
            pointerType: 'mouse',
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey,
          },
          pick.hit.point,
        ),
      );
      if (consumed) return;
    }
    if (pick?.entry.layer === 'hud') return; // the HUD blocks world zoom under its panels
    this.host.director()?.zoomBy(Math.exp(MathClamp(delta, -240, 240) * 0.0014));
  }

  private onKey(e: KeyboardEvent): void {
    this.noteGesture();
    const t = e.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    )
      return;
    for (const capture of [...this.keyCaptures]) {
      if (capture.fn(e)) {
        e.preventDefault();
        return;
      }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    this.events.emit('action', action);
  }

  private currentPinchDistance(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
  }

  private cancelAll(): void {
    for (const p of this.pointers.values()) {
      if (p.entry && p.dragging) {
        const neutral = {
          pointerId: p.id,
          pointerType: p.type,
          shiftKey: false,
          ctrlKey: false,
          altKey: false,
        };
        const base = this.info(p.entry, p.x, p.y, neutral, null);
        p.entry.handlers.dragEnd?.({
          ...base,
          dx: 0,
          dy: 0,
          totalX: p.x - p.startX,
          totalY: p.y - p.startY,
          startPoint: p.startPoint,
          planePoint: () => null,
        });
      }
    }
    this.pointers.clear();
    this.pinchDistance = 0;
    this.lastPointer.inside = false;
    this.hoverDirty = true;
    this.setHover(null, null);
  }
}

function MathClamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
