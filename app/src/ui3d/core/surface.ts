/**
 * UiSurface — a plane of UI in 3D. It owns a `UiNode` tree and renders it with two draw calls per paint layer
 * (see `batch.ts`). The same class serves the camera-anchored HUD (added to `hud.root`, 1 unit = 1 px-eq) and
 * world-anchored consoles (added to a chapter's `root`, scaled to world units).
 *
 * Nothing has to be ticked: the surface flushes pending layout / paint / transforms from its
 * `updateMatrixWorld`, which three.js calls right before every render of the scene it lives in.
 * Pointer input goes through the engine's input system: every interactive node gets an invisible pick proxy.
 */
import {
  Group,
  Matrix4,
  Object3D,
  Vector3,
  Vector4,
  type Intersection,
  type Mesh,
  type Ray,
  type Raycaster,
} from 'three';
import type { InputLayer, PointerInfo, ScopedInput, TweenScope, Unsubscribe } from '@/engine/api';
import { GlyphBatch, ShapeBatch, XformTexture } from './batch';
import { uiFocus, type Focusable } from './focus';
import { layoutTree, UiNode, type NodeProps } from './node';
import { Painter } from './painter';

/** Engine services a surface needs. Build one with `uiHost(ctx)` (chapters) — the HUD has its own. */
export interface UiHost {
  readonly tweens: TweenScope;
  readonly input: ScopedInput;
  /** Input layer the surface's scene belongs to. */
  readonly layer: InputLayer;
  reducedMotion(): boolean;
}

/** A node that carries a regular three.js object (chart mesh, 3D knob…) positioned by the UI layout. */
export class MeshNode extends UiNode {
  /** Called on every flush with the node's effective opacity. */
  onPlace: ((opacity: number) => void) | null = null;

  constructor(
    readonly object: Object3D,
    props: NodeProps = {},
  ) {
    super(props);
    object.matrixAutoUpdate = false;
  }
}

class HitProxy extends Object3D {
  constructor(
    readonly surface: UiSurface,
    readonly node: UiNode,
  ) {
    super();
    this.matrixAutoUpdate = false;
  }

  override raycast(raycaster: Raycaster, intersects: Intersection[]): void {
    const hit = this.surface.hitTest(this.node, raycaster.ray);
    if (hit) intersects.push({ distance: hit.distance, point: hit.point, object: this });
  }
}

const _clip = new Vector4();

/** Free the GPU side of an embedded object (geometries; materials too when the surface dies). */
function releaseGpu(object: Object3D, materials: boolean): void {
  object.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.geometry && mesh.geometry.userData.shared !== true) mesh.geometry.dispose();
    if (materials && mesh.material)
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  });
}

interface LayerBatch {
  shapes: ShapeBatch;
  glyphs: GlyphBatch;
}

export interface SurfaceOptions {
  width: number;
  height: number;
  /** Base `renderOrder` of the surface's meshes (each layer adds 10). Default 1000. */
  renderOrder?: number;
  name?: string;
}

const _o = new Vector3();
const _d = new Vector3();
const _inv = new Matrix4();
const _m = new Matrix4();
const L = new Float64Array(12);

export class UiSurface extends Group {
  /** Root of the element tree; its box is the whole surface, centred on the surface origin. */
  readonly root: UiNode;
  /** Set false to make the whole surface ignore the pointer. */
  interactive = true;
  private surfaceWidth: number;
  private surfaceHeight: number;
  private readonly baseOrder: number;
  private readonly batches: LayerBatch[] = [];
  private readonly xform = new XformTexture();
  private readonly painter = new Painter();
  private readonly ordered: UiNode[] = [];
  private readonly clipOf = new Map<UiNode, UiNode>();
  private readonly proxies = new Map<UiNode, { proxy: HitProxy; handlers: object; off: Unsubscribe }>();
  private readonly extras = new Set<MeshNode>();
  private readonly dirty: UiNode[] = [];
  private layoutDirty = true;
  private structDirty = true;
  private flushing = false;
  private layerMask: number | null = null;
  private depthTest = false;
  private dead = false;
  private readonly offFocus: Unsubscribe;

  constructor(
    readonly host: UiHost,
    opts: SurfaceOptions,
  ) {
    super();
    this.name = opts.name ?? 'ui-surface';
    this.surfaceWidth = opts.width;
    this.surfaceHeight = opts.height;
    this.baseOrder = opts.renderOrder ?? 1000;
    this.root = new UiNode({ name: 'root', dir: 'stack' });
    this.root.attach(this);
    // tab order = paint order
    this.offFocus = uiFocus.provide(() =>
      this.visible && this.interactive
        ? (this.ordered.filter(
            (n) => typeof (n as Focusable).onKey === 'function' && n.interactive,
          ) as Focusable[])
        : [],
    );
  }

  get width(): number {
    return this.surfaceWidth;
  }
  get height(): number {
    return this.surfaceHeight;
  }

  setSize(width: number, height: number): void {
    if (width === this.surfaceWidth && height === this.surfaceHeight) return;
    this.surfaceWidth = width;
    this.surfaceHeight = height;
    this.layoutDirty = true;
  }

  /** Render on the engine's overlay layer (world surfaces that must stay crisp and unoccluded). */
  setLayerMask(mask: number): void {
    this.layerMask = mask;
    this.traverse((o) => (o.layers.mask = mask));
  }

  /**
   * Called right before each render-time flush — the place for work that must use this frame's camera
   * (projected annotations), which an update callback would see one frame late.
   */
  beforeFlush: (() => void) | null = null;

  /** CSS pixels per surface unit (1 unless the owner sets it; the HUD keeps it at `hud.metrics.pxPerUnit`). */
  cssPxPerUnit = 1;

  /** Depth-test against the scene (world consoles in `scene` mode). HUD and overlay surfaces leave it off. */
  setDepthTest(on: boolean): void {
    this.depthTest = on;
    for (const b of this.batches) b.shapes.mesh.material.depthTest = b.glyphs.mesh.material.depthTest = on;
  }

  invalidateLayout(): void {
    this.layoutDirty = true;
  }

  invalidateStructure(): void {
    this.structDirty = true;
  }

  /** @internal */
  invalidatePaint(node: UiNode): void {
    this.dirty.push(node);
  }

  /** Apply everything that is pending now (normally automatic before each render). */
  flush(): void {
    if (this.flushing || this.dead) return;
    this.flushing = true;
    try {
      if (this.layoutDirty) {
        this.layoutDirty = false;
        layoutTree(this.root, this.surfaceWidth, this.surfaceHeight);
        this.structDirty = true;
      }
      if (!this.structDirty && this.dirty.length > 0) this.repaint();
      if (this.structDirty) this.rebuild();
      this.dirty.length = 0;
      this.place();
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Embedded meshes are not drawn by the batches, so the batches' clip does not reach them: hand the clip box of
   * the nearest clipping ancestor (a scroll view) to every material of the mesh that declares a `uClip` uniform,
   * in the mesh node's local units (centre xy, half size zw; zw = −1: no clip). Assumes no rotation in between.
   */
  private clipExtra(n: MeshNode): void {
    const clip = this.clipOf.get(n);
    if (clip) {
      const w = n.world;
      const c = clip.world;
      const sx = w[0] || 1;
      const sy = w[5] || 1;
      _clip.set(
        (c[3]! - w[3]!) / sx,
        (c[7]! - w[7]!) / sy,
        (clip.bw / 2) * Math.abs(c[0]! / sx),
        (clip.bh / 2) * Math.abs(c[5]! / sy),
      );
    } else _clip.set(0, 0, -1, -1);
    n.object.traverse((o) => {
      const m = (o as { material?: { uniforms?: Record<string, { value: unknown }> } }).material;
      const u = m?.uniforms?.uClip;
      if (u && u.value instanceof Vector4) u.value.copy(_clip);
    });
  }

  override updateMatrixWorld(force?: boolean): void {
    if (this.visible) {
      this.beforeFlush?.();
      this.flush();
    }
    super.updateMatrixWorld(force);
  }

  /**
   * Pick ray (in the space this surface is registered in) → `node`-local coordinates (origin at the box
   * centre, y up). Null when the ray is parallel to the node's plane or points away from it.
   */
  rayToLocal(node: UiNode, ray: Ray): { x: number; y: number } | null {
    const hit = this.intersect(node, ray);
    return hit ? { x: hit.x, y: hit.y } : null;
  }

  /** @internal Pick test used by the proxies. */
  hitTest(node: UiNode, ray: Ray): { distance: number; point: Vector3 } | null {
    if (!this.interactive || node.slot < 0 || !node.interactive) return null;
    const hit = this.intersect(node, ray);
    if (!hit) return null;
    const hw = Math.max(node.bw, node.minHit) / 2;
    const hh = Math.max(node.bh, node.minHit) / 2;
    if (Math.abs(hit.x) > hw || Math.abs(hit.y) > hh) return null;
    const clip = this.clipOf.get(node);
    if (clip) {
      const c = this.intersect(clip, ray);
      if (!c || Math.abs(c.x) > clip.bw / 2 || Math.abs(c.y) > clip.bh / 2) return null;
    }
    const point = new Vector3(hit.sx, hit.sy, hit.sz).applyMatrix4(this.matrixWorld);
    // later-painted nodes and higher layers win ties: bias the reported distance toward the viewer
    const k = this.matrixWorld.getMaxScaleOnAxis();
    const distance = ray.origin.distanceTo(point) - (node.paintLayer * 6 + node.paintOrder * 0.002) * k;
    return { distance: Math.max(distance, 1e-4), point };
  }

  override dispose(): void {
    if (this.dead) return;
    this.dead = true;
    this.offFocus();
    uiFocus.release(this.root);
    for (const p of this.proxies.values()) p.off();
    this.proxies.clear();
    for (const l of this.batches) {
      l.shapes.dispose();
      l.glyphs.dispose();
    }
    for (const n of this.extras) releaseGpu(n.object, true);
    this.extras.clear();
    this.xform.dispose();
    this.root.attach(null);
    this.removeFromParent();
  }

  /* ---------------------------------------------------------------------------------------------- */

  private intersect(
    node: UiNode,
    ray: Ray,
  ): { x: number; y: number; sx: number; sy: number; sz: number } | null {
    _inv.copy(this.matrixWorld).invert();
    _o.copy(ray.origin).applyMatrix4(_inv);
    _d.copy(ray.direction).transformDirection(_inv);
    const w = node.world;
    // inverse of the node's 3×3 (cofactors)
    const a = w[0]!, b = w[1]!, c = w[2]!; // prettier-ignore
    const d = w[4]!, e = w[5]!, f = w[6]!; // prettier-ignore
    const g = w[8]!, h = w[9]!, i = w[10]!; // prettier-ignore
    const A = e * i - f * h;
    const B = f * g - d * i;
    const C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-12) return null;
    const ox = _o.x - w[3]!;
    const oy = _o.y - w[7]!;
    const oz = _o.z - w[11]!;
    const lx = (A * ox + (c * h - b * i) * oy + (b * f - c * e) * oz) / det;
    const ly = (B * ox + (a * i - c * g) * oy + (c * d - a * f) * oz) / det;
    const lz = (C * ox + (b * g - a * h) * oy + (a * e - b * d) * oz) / det;
    const dx = (A * _d.x + (c * h - b * i) * _d.y + (b * f - c * e) * _d.z) / det;
    const dy = (B * _d.x + (a * i - c * g) * _d.y + (c * d - a * f) * _d.z) / det;
    const dz = (C * _d.x + (b * g - a * h) * _d.y + (a * e - b * d) * _d.z) / det;
    if (Math.abs(dz) < 1e-9) return null;
    const t = -lz / dz;
    if (t < 0) return null;
    return {
      x: lx + dx * t,
      y: ly + dy * t,
      sx: _o.x + _d.x * t,
      sy: _o.y + _d.y * t,
      sz: _o.z + _d.z * t,
    };
  }

  private layerBatch(index: number): LayerBatch {
    while (this.batches.length <= index) {
      const k = this.batches.length;
      const batch: LayerBatch = { shapes: new ShapeBatch(this.xform), glyphs: new GlyphBatch(this.xform) };
      batch.shapes.mesh.renderOrder = this.baseOrder + k * 10;
      batch.glyphs.mesh.renderOrder = this.baseOrder + k * 10 + 8;
      batch.shapes.mesh.material.depthTest = batch.glyphs.mesh.material.depthTest = this.depthTest;
      if (this.layerMask !== null) {
        batch.shapes.mesh.layers.mask = this.layerMask;
        batch.glyphs.mesh.layers.mask = this.layerMask;
      }
      this.add(batch.shapes.mesh, batch.glyphs.mesh);
      this.batches.push(batch);
    }
    return this.batches[index]!;
  }

  private rebuild(): void {
    this.structDirty = false;
    for (const l of this.batches) {
      l.shapes.count = 0;
      l.glyphs.count = 0;
    }
    this.ordered.length = 0;
    this.clipOf.clear();
    const live = new Set<UiNode>();
    const extras = new Set<MeshNode>();
    const painter = this.painter;
    const visit = (n: UiNode, layer: number, clip: UiNode | null): void => {
      if (!n.visible) {
        n.slot = -1;
        return;
      }
      n.slot = this.ordered.length;
      n.paintOrder = n.slot;
      this.ordered.push(n);
      n.paintLayer = (n.layer ?? layer) + n.layerUp;
      n.clipIndex = clip ? clip.slot : -1;
      if (clip) this.clipOf.set(n, clip);
      const batch = this.layerBatch(n.paintLayer);
      n.shapeStart = batch.shapes.count;
      n.glyphStart = batch.glyphs.count;
      painter.begin(n, batch.shapes, batch.glyphs);
      n.paint(painter);
      n.shapeCount = painter.shapesEmitted;
      n.glyphCount = painter.glyphsEmitted;
      batch.shapes.count += n.shapeCount;
      batch.glyphs.count += n.glyphCount;
      n.paintDirty = false;
      if (n.handlers) live.add(n);
      if (n instanceof MeshNode) extras.add(n);
      const childClip = n.clip ? n : clip;
      for (const c of n.children) visit(c, n.paintLayer, childClip);
    };
    visit(this.root, 0, null);
    this.xform.ensure(this.ordered.length);
    for (const l of this.batches) {
      l.shapes.commit();
      l.glyphs.commit();
    }
    // pick proxies: one per interactive node
    for (const [node, entry] of this.proxies) {
      if (live.has(node) && entry.handlers === node.handlers) continue;
      entry.off();
      this.remove(entry.proxy);
      this.proxies.delete(node);
    }
    for (const node of live) {
      if (this.proxies.has(node)) continue;
      const proxy = new HitProxy(this, node);
      proxy.name = `ui-hit:${node.name}`;
      const handlers = node.handlers!;
      const off = this.host.input.register(
        proxy,
        {
          // nodes without a wheel handler of their own (chart hover, tooltips) pass the wheel to their
          // ancestors, so a scroll view scrolls under everything it holds
          wheel: (dy: number, e: PointerInfo) => node.parent?.bubbleWheel(dy, e) ?? false,
          ...handlers,
          enabled: () => node.interactive,
        },
        this.host.layer,
      );
      this.add(proxy);
      this.proxies.set(node, { proxy, handlers, off });
    }
    // embedded three.js objects
    for (const n of this.extras) {
      if (!extras.has(n)) {
        this.remove(n.object);
        this.extras.delete(n);
        releaseGpu(n.object, false); // GL buffers are re-created on demand if the node comes back
      }
    }
    for (const n of extras) {
      if (this.extras.has(n)) continue;
      this.extras.add(n);
      n.object.traverse((o) => {
        o.renderOrder = this.baseOrder + n.paintLayer * 10 + 5;
        if (this.layerMask !== null) o.layers.mask = this.layerMask;
      });
      this.add(n.object);
    }
  }

  private repaint(): void {
    const painter = this.painter;
    for (const n of this.dirty) {
      if (!n.paintDirty || n.surface !== this) continue;
      n.paintDirty = false;
      if (n.slot < 0) continue;
      const batch = this.batches[n.paintLayer];
      if (!batch) {
        this.structDirty = true;
        return;
      }
      painter.begin(n, batch.shapes, batch.glyphs, n.shapeStart + n.shapeCount, n.glyphStart + n.glyphCount);
      n.paint(painter);
      if (
        painter.overflow ||
        painter.shapesEmitted !== n.shapeCount ||
        painter.glyphsEmitted !== n.glyphCount
      ) {
        this.structDirty = true;
        return;
      }
      batch.shapes.commit(n.shapeStart, n.shapeCount);
      batch.glyphs.commit(n.glyphStart, n.glyphCount);
    }
  }

  /** Compute surface-space matrices and opacities of all painted nodes and upload the changed ones. */
  private place(): void {
    const data = this.xform.data;
    let changed = false;
    const put = (o: number, v: number): void => {
      if (data[o] !== v) {
        // Float32 storage: compare against the rounded value to avoid perpetual "changes"
        const r = Math.fround(v);
        if (data[o] !== r) {
          data[o] = r;
          changed = true;
        }
      }
    };
    const list = this.ordered;
    for (let k = 0; k < list.length; k++) {
      const n = list[k]!;
      const p = n.parent;
      const sx = n.scale * n.scaleX;
      const sy = n.scale * n.scaleY;
      const ox = n.originX * n.bw;
      const oy = n.originY * n.bh;
      let cx = n.x;
      let cy = n.y;
      if (p) {
        cx += -p.bw / 2 + n.bx + n.bw / 2;
        cy += p.bh / 2 - n.by - n.bh / 2;
      }
      if (n.rotX === 0 && n.rotY === 0 && n.rotZ === 0) {
        L[0] = sx;
        L[1] = 0;
        L[2] = 0;
        L[3] = cx + ox - sx * ox; // prettier-ignore
        L[4] = 0;
        L[5] = sy;
        L[6] = 0;
        L[7] = cy + oy - sy * oy; // prettier-ignore
        L[8] = 0;
        L[9] = 0;
        L[10] = 1;
        L[11] = n.z; // prettier-ignore
      } else {
        // R = Rz · Ry · Rx, columns scaled by (sx, sy, 1); pivot at the origin point
        const cxr = Math.cos(n.rotX), sxr = Math.sin(n.rotX); // prettier-ignore
        const cyr = Math.cos(n.rotY), syr = Math.sin(n.rotY); // prettier-ignore
        const czr = Math.cos(n.rotZ), szr = Math.sin(n.rotZ); // prettier-ignore
        const r00 = czr * cyr, r01 = czr * syr * sxr - szr * cxr, r02 = czr * syr * cxr + szr * sxr; // prettier-ignore
        const r10 = szr * cyr, r11 = szr * syr * sxr + czr * cxr, r12 = szr * syr * cxr - czr * sxr; // prettier-ignore
        const r20 = -syr, r21 = cyr * sxr, r22 = cyr * cxr; // prettier-ignore
        L[0] = r00 * sx;
        L[1] = r01 * sy;
        L[2] = r02; // prettier-ignore
        L[4] = r10 * sx;
        L[5] = r11 * sy;
        L[6] = r12; // prettier-ignore
        L[8] = r20 * sx;
        L[9] = r21 * sy;
        L[10] = r22; // prettier-ignore
        L[3] = cx + ox - (L[0] * ox + L[1] * oy);
        L[7] = cy + oy - (L[4] * ox + L[5] * oy);
        L[11] = n.z - (L[8] * ox + L[9] * oy);
      }
      const w = n.world;
      if (p) {
        const q = p.world;
        for (let r = 0; r < 3; r++) {
          const a = q[r * 4]!, b = q[r * 4 + 1]!, c = q[r * 4 + 2]!; // prettier-ignore
          w[r * 4] = a * L[0]! + b * L[4]! + c * L[8]!;
          w[r * 4 + 1] = a * L[1]! + b * L[5]! + c * L[9]!;
          w[r * 4 + 2] = a * L[2]! + b * L[6]! + c * L[10]!;
          w[r * 4 + 3] = a * L[3]! + b * L[7]! + c * L[11]! + q[r * 4 + 3]!;
        }
        n.worldOpacity = p.worldOpacity * n.opacity;
      } else {
        w.set(L);
        n.worldOpacity = n.opacity;
      }
      const o = n.slot * 16;
      for (let j = 0; j < 12; j++) put(o + j, w[j]!);
      put(o + 12, n.worldOpacity);
      put(o + 13, n.bw / 2);
      put(o + 14, n.bh / 2);
      put(o + 15, n.clipFeather);
    }
    if (changed) this.xform.texture.needsUpdate = true;
    for (const n of this.extras) {
      const w = n.world;
      _m.set(
        w[0]!,
        w[1]!,
        w[2]!,
        w[3]!,
        w[4]!,
        w[5]!,
        w[6]!,
        w[7]!,
        w[8]!,
        w[9]!,
        w[10]!,
        w[11]!,
        0,
        0,
        0,
        1,
      );
      n.object.matrix.copy(_m);
      n.object.matrixWorldNeedsUpdate = true;
      n.object.visible = n.slot >= 0 && n.worldOpacity > 0.004;
      this.clipExtra(n);
      n.onPlace?.(n.worldOpacity);
    }
  }
}
