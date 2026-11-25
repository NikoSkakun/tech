/**
 * The magnifier's focus ring (the owner, 2026-11-25: the zoom is an in-game ring on the lens's rim, shown only once
 * the reader has taken the lens; at deep zoom it stays on screen as the bottom arc of the rim — «дуга ободка внизу»).
 *
 * A knurled band along the bottom of the lens's rim (`focus-ring-shader.ts`), laid out in CSS px each frame from the
 * lens's projected circle (`focus-ring-layout.ts`: it rides the rim, then stays pinned above the navigator as the lens
 * grows past the frame). Turning it — a drag along the arc — scrubs the value; a click on the band glides there; the
 * wheel over it nudges. The floor marks are printed on the band, their names stand as small chips above it (a click
 * glides there), the yellow ◆ is the value. Keyboard and screen readers get a `role="slider"` element on a
 * `hudLayer` that follows the marker (arrows / PageUp / PageDown / Home / End when focused).
 *
 * The band is drawn on the overlay layer (crisp, never blurred); the pointer hits an unrendered proxy band (layer
 * 31: the engine's raycaster sees every layer, no camera draws this one) at least 44 px wide.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector3,
  type Camera,
} from 'three';
import { toOverlay, type ChapterContext } from '@/engine/api';
import { domKit, hudLayer } from '@/hud';
import { col } from '@/style';
import { LENS } from '../layout';
import { FOCUS_RING_FRAG, FOCUS_RING_VERT, MAX_MARKS } from './focus-ring-shader';
import {
  ringLayout,
  ringPoint,
  ringS,
  valuePerPx,
  valueS,
  type RingCircle,
  type RingFrame,
  type RingLayout,
} from './focus-ring-layout';
import type { LensModel } from './lens';

export interface RingMark {
  value: number;
  label: string;
}

export interface FocusRingOptions {
  /** `data-ui` of the slider element (QA: `__ui.locate(name)`), and of its marks (`<name>:<i>`). */
  name: string;
  /** Accessible name of the ring (the old slider's label, «Глибина»). */
  label: string;
  min: number;
  max: number;
  marks: () => readonly RingMark[];
  /** The value shown now (where the dive is) and the one it is going to. */
  value: () => number;
  target: () => number;
  /** Lens mode: the ring is on the lens. */
  shown: () => boolean;
  lens: LensModel;
  /** The hand on the ring: the frame follows at once. */
  scrub(v: number): void;
  /** Glide there (click, keys, wheel, a mark). */
  travelTo(v: number): void;
  /** Words for the value (screen readers). */
  valueText(v: number): string;
  /** Any use of the ring. */
  touched?(): void;
}

export interface FocusRingState {
  shown: boolean;
  amount: number;
  dragging: boolean;
  focused: boolean;
  /** Layout in CSS px (centre, inner radius, thickness, half arc, pinned share). */
  layout: RingLayout | null;
  /** The marker's point, the band's ends and each mark's point (px, the band's middle line). */
  marker: { x: number; y: number } | null;
  ends: [{ x: number; y: number }, { x: number; y: number }] | null;
  marks: { x: number; y: number; label: string }[];
}

export interface FocusRing {
  update(dt: number): void;
  /** A wheel step (or pinch) anywhere in lens mode: + = deeper. */
  nudge(amount: number): void;
  /** Screen point (px) of a value on the band's middle line (QA: where to press). */
  pointOf(value: number): { x: number; y: number } | null;
  state(): FocusRingState;
  readonly dragging: boolean;
}

/** Segments along the arc of the drawn band and of the pointer's proxy. */
const SEG = 72;
const PROXY_SEG = 24;
/** Rows across the drawn band: v from the marker's room inside the lens to past the focus outline. */
const V_ROWS = [-0.9, 0, 1, 1.3] as const;
/** The pointer's band is at least this wide (px, STYLE_GUIDE §6). */
const TARGET_PX = 44;
/** Value per wheel pixel (a notch of 100 px ≈ a fifth of a floor). */
const WHEEL = 0.002;
/** Value per key press (arrows) and per PageUp / PageDown. */
const KEY_STEP = 0.1;
const PAGE_STEP = 0.5;
/** Rates (1/s) of the reveal / hide and of the hover light. */
const SHOW_RATE = 5;
const HIDE_RATE = 9;
const HOT_RATE = 14;
/** Proxy layer: pickable, drawn by no camera. */
const PICK_ONLY_LAYER = 31;

const clamp = (x: number, a: number, b: number): number => Math.min(Math.max(x, a), b);
const approach = (x: number, to: number, rate: number, dt: number): number =>
  to + (x - to) * Math.exp(-rate * dt);

const ringLocal = new Vector3();
const probe = new Vector3();

/**
 * The lens's rim on screen: its horizontal extent gives the radius, its lowest point the centre's height (a lens
 * seen at a slant is an ellipse; the band hugs its bottom). Null when part of the rim is behind the camera.
 */
function lensCircle(lens: LensModel, camera: Camera, width: number, height: number): RingCircle | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ringLocal.set(Math.cos(a) * LENS.radius, Math.sin(a) * LENS.radius, 0);
    lens.group.localToWorld(probe.copy(ringLocal));
    probe.applyMatrix4(camera.matrixWorldInverse);
    if (probe.z > -1e-4) return null;
    probe.applyMatrix4(camera.projectionMatrix);
    const x = ((probe.x + 1) / 2) * width;
    const y = ((1 - probe.y) / 2) * height;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const r = (maxX - minX) / 2;
  return { cx: (minX + maxX) / 2, cy: maxY - r, r };
}

/** A band of `rows` × (`seg` + 1) vertices, two triangles per cell. */
function bandIndex(rows: number, seg: number): number[] {
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++)
    for (let k = 0; k < seg; k++) {
      const a = r * (seg + 1) + k;
      const b = a + seg + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  return index;
}

/** The drawn band: static shares along / v across; the shader lays it out (`FOCUS_RING_VERT`). */
function drawnGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const n = V_ROWS.length * (SEG + 1);
  const kv = new Float32Array(n * 2);
  let i = 0;
  for (const v of V_ROWS)
    for (let k = 0; k <= SEG; k++) {
      kv[i++] = k / SEG;
      kv[i++] = v;
    }
  g.setAttribute('aKV', new BufferAttribute(kv, 2));
  // three.js wants a position attribute to count the vertices; the shader does not read it
  g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
  g.setIndex(bandIndex(V_ROWS.length, SEG));
  return g;
}

/** The navigator's band at the bottom of the frame (share of the height) when the HUD reports no bottom inset. */
const NAV_SHARE = 0.115;

export function createFocusRing(ctx: ChapterContext, o: FocusRingOptions): FocusRing {
  const { min, max } = o;
  const metal = col('steel').lerp(col('slate'), 0.3);
  const uniforms = {
    uView: { value: [1, 1] },
    uCircle: { value: new Vector3(0, 0, 100) },
    uT: { value: 20 },
    uHalf: { value: 100 },
    uExt: { value: 12 },
    uAmount: { value: 0 },
    uHot: { value: 0 },
    uFocus: { value: 0 },
    uRim: { value: 0 },
    uTurn: { value: 0 },
    uMarker: { value: 0 },
    uMarks: { value: new Array<number>(MAX_MARKS).fill(0) },
    uMarkCount: { value: 0 },
    uMetal: { value: metal },
    uLight: { value: col('white') },
    uDark: { value: col('ink') },
    uCyan: { value: col('cyan') },
    uYellow: { value: col('yellow') },
    uPrint: { value: col('white') },
  };
  const material = new ShaderMaterial({
    vertexShader: FOCUS_RING_VERT,
    fragmentShader: FOCUS_RING_FRAG,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(drawnGeometry(), material);
  mesh.name = 'lens:focus-ring';
  mesh.frustumCulled = false;
  mesh.renderOrder = 60;
  mesh.visible = false;
  toOverlay(mesh);
  ctx.root.add(mesh);

  // the pointer's band: world-space triangles in front of the camera, drawn by nobody
  const proxyRows = 2;
  const proxyGeometry = new BufferGeometry();
  proxyGeometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(proxyRows * (PROXY_SEG + 1) * 3), 3),
  );
  proxyGeometry.setIndex(bandIndex(proxyRows, PROXY_SEG));
  const proxy = new Mesh(proxyGeometry, new MeshBasicMaterial({ side: DoubleSide }));
  proxy.name = 'lens:focus-ring-hit';
  proxy.frustumCulled = false;
  proxy.layers.set(PICK_ONLY_LAYER);
  proxy.visible = false;
  ctx.root.add(proxy);

  let amount = 0;
  let hot = 0;
  let over = false;
  let dragging = false;
  let focused = false;
  let held = 0;
  let layout: RingLayout | null = null;

  const frame = (): RingFrame => {
    const width = ctx.viewport.width;
    const height = ctx.viewport.height;
    const cam = ctx.camera.camera;
    const i = cam.insets;
    const free = cam.freeCenter({ x: 0.5, y: 0.5 });
    return {
      width,
      height,
      floor: height * (1 - Math.max(i.bottom, NAV_SHARE)) - 8,
      left: width * i.left,
      right: width * (1 - i.right),
      freeX: width * free.x,
    };
  };
  const layoutFor = (camera: Camera): RingLayout => {
    const f = frame();
    return ringLayout(lensCircle(o.lens, camera, f.width, f.height), f);
  };
  const valueAt = (l: RingLayout, s: number): number => {
    const pad = 0.75 * l.t;
    const k = clamp((s + l.half - pad) / Math.max(2 * (l.half - pad), 1), 0, 1);
    return min + k * (max - min);
  };
  const go = (v: number): void => {
    o.touched?.();
    o.travelTo(clamp(v, min, max));
  };
  const nudge = (a: number): void => go(o.target() + a);

  // the band is laid out from the camera of the very frame it is drawn in
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    const l = layoutFor(camera);
    uniforms.uView.value = [ctx.viewport.width, ctx.viewport.height];
    uniforms.uCircle.value.set(l.cx, l.cy, l.r);
    uniforms.uT.value = l.t;
    uniforms.uHalf.value = l.half;
    uniforms.uExt.value = 0.7 * l.t;
    uniforms.uRim.value = l.pinned;
    const marker = valueS(l, o.value(), min, max);
    uniforms.uMarker.value = marker;
    uniforms.uTurn.value = -marker;
    const marks = o.marks();
    uniforms.uMarkCount.value = Math.min(marks.length, MAX_MARKS);
    marks.slice(0, MAX_MARKS).forEach((m, i) => (uniforms.uMarks.value[i] = valueS(l, m.value, min, max)));
  };

  ctx.input.register(proxy, {
    tooltip: () => o.label,
    cursor: 'grab',
    enabled: () => o.shown() && amount > 0.5,
    hover: (on) => (over = on),
    dragStart: () => {
      dragging = true;
      held = o.value();
      o.touched?.();
    },
    drag: (e) => {
      if (!layout) return;
      // the hand's own motion along the arc's tangent where it is: the ring itself moves while it turns (it rides
      // the growing lens, then pins), and that must never turn it by itself
      const a = Math.atan2(e.x - layout.cx, e.y - layout.cy);
      const ds = e.dx * Math.cos(a) - e.dy * Math.sin(a);
      held = clamp(held + ds * valuePerPx(layout, min, max), min, max);
      o.scrub(held);
    },
    dragEnd: () => (dragging = false),
    click: (e) => {
      if (layout) go(valueAt(layout, ringS(layout, e.x, e.y)));
    },
    wheel: (dy) => {
      nudge(-dy * WHEEL);
      return true;
    },
  });

  // keyboard and screen readers: a slider element that follows the marker; the names of the marks as chips
  const { h, setStyle } = domKit;
  const layer = hudLayer(ctx, `${o.name}-layer`);
  const slider = layer
    ? h('div', {
        role: 'slider',
        tabindex: '0',
        'aria-label': o.label,
        'aria-valuemin': String(min),
        'aria-valuemax': String(max),
        'data-ui': o.name,
        'data-keys': '',
        hidden: true,
      })
    : null;
  if (layer && slider) {
    Object.assign(slider.style, {
      width: `${TARGET_PX}px`,
      height: `${TARGET_PX}px`,
      borderRadius: '50%',
      outline: 'none',
      pointerEvents: 'none',
    });
    slider.addEventListener('focus', () => (focused = true));
    slider.addEventListener('blur', () => (focused = false));
    slider.addEventListener('keydown', (e) => {
      const t = o.target();
      const to: Record<string, number> = {
        ArrowRight: t + KEY_STEP,
        ArrowUp: t + KEY_STEP,
        ArrowLeft: t - KEY_STEP,
        ArrowDown: t - KEY_STEP,
        PageUp: t + PAGE_STEP,
        PageDown: t - PAGE_STEP,
        Home: min,
        End: max,
      };
      const v = to[e.code];
      if (v === undefined) return;
      e.preventDefault();
      go(v);
    });
    layer.append(slider);
  }
  let chips: HTMLButtonElement[] = [];
  let chipKey = '';
  const syncChips = (marks: readonly RingMark[]): void => {
    const key = marks.map((m) => `${m.value}:${m.label}`).join('|');
    if (!layer || key === chipKey) return;
    chipKey = key;
    for (const c of chips) c.remove();
    chips = marks.map((m, i) => {
      const c = h('button.chip', { type: 'button', tabindex: '-1', 'data-ui': `${o.name}:${i}` }, m.label);
      c.addEventListener('click', () => go(m.value));
      // `.chip` is `position: relative` in the platform's sheet: the layer's absolute placing is restated here
      Object.assign(c.style, { position: 'absolute', transform: 'translate(-50%, -100%)', transition: 'none' });
      layer.append(c);
      return c;
    });
  };

  const pt = { x: 0, y: 0 };
  const world = new Vector3();
  const placeProxy = (l: RingLayout): void => {
    const cam = ctx.camera.camera;
    const extra = Math.max(0, (TARGET_PX / l.t - 1.9) / 2);
    const rows = [-0.9 - extra, 1 + extra];
    const pos = proxyGeometry.getAttribute('position') as BufferAttribute;
    let i = 0;
    for (const v of rows)
      for (let k = 0; k <= PROXY_SEG; k++) {
        const s = (-1 + (2 * k) / PROXY_SEG) * (l.half + 0.4 * l.t);
        ringPoint(l, s, v, pt);
        world.set((pt.x / ctx.viewport.width) * 2 - 1, 1 - (pt.y / ctx.viewport.height) * 2, 0.5);
        world.unproject(cam);
        ctx.root.worldToLocal(world);
        pos.setXYZ(i++, world.x, world.y, world.z);
      }
    pos.needsUpdate = true;
    proxyGeometry.computeBoundingSphere();
  };

  let state: FocusRingState = {
    shown: false,
    amount: 0,
    dragging: false,
    focused: false,
    layout: null,
    marker: null,
    ends: null,
    marks: [],
  };
  let lastValue = Number.NaN;
  return {
    get dragging() {
      return dragging;
    },
    nudge,
    pointOf(value) {
      return layout ? { ...ringPoint(layout, valueS(layout, value, min, max), 0.5) } : null;
    },
    state: () => state,
    update(dt) {
      const shown = o.shown();
      if (!shown) dragging = false;
      amount = approach(amount, shown ? 1 : 0, shown ? SHOW_RATE : HIDE_RATE, dt);
      if (shown && amount > 0.995) amount = 1;
      if (!shown && amount < 0.004) amount = 0;
      hot = approach(hot, over || dragging ? 1 : 0, HOT_RATE, dt);
      uniforms.uAmount.value = amount;
      uniforms.uHot.value = hot;
      uniforms.uFocus.value = focused && shown ? 1 : 0;
      mesh.visible = amount > 0;
      proxy.visible = shown && amount > 0.5;
      const cam = ctx.camera.camera;
      cam.updateMatrixWorld();
      layout = amount > 0 ? layoutFor(cam) : null;
      if (layout && proxy.visible) placeProxy(layout);
      const marks = o.marks();
      syncChips(marks);
      const value = o.value();
      if (slider) {
        slider.hidden = !shown;
        if (value !== lastValue) {
          lastValue = value;
          slider.setAttribute('aria-valuenow', value.toFixed(2));
          slider.setAttribute('aria-valuetext', o.valueText(value));
        }
      }
      const l = layout;
      if (l) {
        const m = ringPoint(l, valueS(l, value, min, max), -0.36);
        if (slider) setStyle(slider, 'transform', `translate(${m.x - TARGET_PX / 2}px, ${m.y - TARGET_PX / 2}px)`);
        chips.forEach((c, i) => {
          const mark = marks[i];
          if (!mark) return;
          const p = ringPoint(l, valueS(l, mark.value, min, max), -1.05);
          setStyle(c, 'left', `${p.x.toFixed(1)}px`);
          setStyle(c, 'top', `${p.y.toFixed(1)}px`);
          setStyle(c, 'opacity', String(Math.max(0, (amount - 0.3) / 0.7)));
        });
      }
      for (const c of chips) c.hidden = !(l && amount > 0.3);
      state = {
        shown,
        amount,
        dragging,
        focused,
        layout: l,
        marker: l ? { ...ringPoint(l, valueS(l, value, min, max), 0.5) } : null,
        ends: l ? [{ ...ringPoint(l, -l.half, 0.5) }, { ...ringPoint(l, l.half, 0.5) }] : null,
        marks: l
          ? marks.map((m) => ({ ...ringPoint(l, valueS(l, m.value, min, max), 0.5), label: m.label }))
          : [],
      };
    },
  };
}
