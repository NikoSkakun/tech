/**
 * QA probes (M3): a chapter names scene points that interaction tests need to find on screen —
 * `ctx.qa.probe('rotor', rotorMesh)` — and QA scripts ask `window.__app.locate('rotor')` for CSS-pixel
 * coordinates. Replaces the pilots' ad-hoc `window.__atomQa` / `__lab` globals and works in production builds
 * (the registry is a few closures; nothing renders).
 */
import { Box3, Vector3, type Camera, type Object3D } from 'three';

/** What a probe points at: an object (its world bounding-box centre), a world point, or a live getter. */
export type ProbeTarget = Object3D | Vector3 | (() => Object3D | Vector3 | null);

export interface ProbeOptions {
  /** For objects: use the world origin of the object instead of its bounding-box centre. Default false. */
  origin?: boolean;
}

export interface LocatedProbe {
  /** CSS pixels from the top-left of the viewport. */
  x: number;
  y: number;
  /** True when the point is in front of the camera and inside the viewport. */
  visible: boolean;
  /** False when the object (or an ancestor) is hidden (`visible = false`). */
  shown: boolean;
  /** World position that was projected. */
  world: [number, number, number];
}

/** Chapter-side API (`ctx.qa`). */
export interface QaApi {
  /** Register (or replace) a named probe. Returns an unregister function. Cheap: resolved only on demand. */
  probe(name: string, target: ProbeTarget, opts?: ProbeOptions): () => void;
  /**
   * Expose observable state for interaction tests: `__app.read(name)` calls `fn` and returns its result
   * (plain JSON-able values: numbers, strings, arrays, records). Returns an unregister function.
   */
  expose(name: string, fn: () => unknown): () => void;
}

const _box = new Box3();

function shownInTree(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

export class QaProbes implements QaApi {
  private readonly map = new Map<string, { target: ProbeTarget; opts: ProbeOptions }>();
  private readonly readers = new Map<string, () => unknown>();

  expose(name: string, fn: () => unknown): () => void {
    this.readers.set(name, fn);
    return () => {
      if (this.readers.get(name) === fn) this.readers.delete(name);
    };
  }

  /** Value of an exposed reader (`undefined` when unknown). */
  read(name: string): unknown {
    return this.readers.get(name)?.();
  }

  /** Names of the exposed readers. */
  readerNames(): string[] {
    return [...this.readers.keys()];
  }

  probe(name: string, target: ProbeTarget, opts: ProbeOptions = {}): () => void {
    const entry = { target, opts };
    this.map.set(name, entry);
    return () => {
      if (this.map.get(name) === entry) this.map.delete(name);
    };
  }

  names(): string[] {
    return [...this.map.keys()];
  }

  /** World position + visibility of a probe, or null when unknown / the getter returned null. */
  resolve(name: string): { world: Vector3; shown: boolean } | null {
    const entry = this.map.get(name);
    if (!entry) return null;
    const t = typeof entry.target === 'function' ? entry.target() : entry.target;
    if (!t) return null;
    if (t instanceof Vector3) return { world: t.clone(), shown: true };
    t.updateWorldMatrix(true, true);
    const world = new Vector3();
    if (entry.opts.origin) t.getWorldPosition(world);
    else {
      _box.setFromObject(t, true);
      if (_box.isEmpty()) t.getWorldPosition(world);
      else _box.getCenter(world);
    }
    return { world, shown: shownInTree(t) };
  }

  /** Project a probe to CSS pixels with the given camera and viewport size. */
  locate(name: string, camera: Camera, width: number, height: number): LocatedProbe | null {
    const r = this.resolve(name);
    if (!r) return null;
    camera.updateMatrixWorld();
    const ndc = r.world.clone().project(camera);
    const inFront = r.world.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
    return {
      x: (ndc.x / 2 + 0.5) * width,
      y: (0.5 - ndc.y / 2) * height,
      visible: inFront && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1,
      shown: r.shown,
      world: [r.world.x, r.world.y, r.world.z],
    };
  }

  clear(): void {
    this.map.clear();
    this.readers.clear();
  }
}
