/**
 * Disposables tracker. Everything a chapter allocates must be released when the chapter is left; the tracker
 * makes that automatic: the chapter root is traversed (geometries, materials, their textures), and anything
 * else (render targets, listeners, audio nodes, …) is registered with `track()` / `onDispose()`.
 *
 * Shared, engine-lifetime resources (cached kit geometries, palette ramps, font atlas, …) opt out by setting
 * `userData.shared = true` on the geometry / material / texture.
 */
import type { BufferGeometry, Material, Object3D, Texture } from 'three';

export interface Disposable {
  dispose(): void;
}

export type DisposeFn = () => void;

interface WithUserData {
  userData?: Record<string, unknown>;
}

function isShared(resource: WithUserData): boolean {
  return resource.userData?.shared === true;
}

/** Mark a geometry/material/texture as engine-lifetime: chapter disposal will skip it. Returns the resource. */
export function markShared<T extends { userData: Record<string, unknown> }>(resource: T): T {
  resource.userData.shared = true;
  return resource;
}

function disposeMaterial(material: Material, seen: Set<object>): void {
  if (seen.has(material) || isShared(material)) return;
  seen.add(material);
  // Textures referenced directly on the material or through shader uniforms.
  const holder = material as unknown as Record<string, unknown> & {
    uniforms?: Record<string, { value: unknown }>;
  };
  for (const key of Object.keys(holder)) {
    const v = holder[key];
    if (v && (v as Texture).isTexture) disposeTexture(v as Texture, seen);
  }
  if (holder.uniforms) {
    for (const u of Object.values(holder.uniforms)) {
      const v = u?.value;
      if (v && (v as Texture).isTexture) disposeTexture(v as Texture, seen);
    }
  }
  material.dispose();
}

function disposeTexture(texture: Texture, seen: Set<object>): void {
  if (seen.has(texture) || isShared(texture)) return;
  seen.add(texture);
  texture.dispose();
}

/** Dispose every geometry/material/texture reachable from `root` (skipping shared resources). */
export function disposeObject3D(root: Object3D, seen: Set<object> = new Set()): void {
  root.traverse((obj) => {
    const o = obj as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
      customDepthMaterial?: Material;
      customDistanceMaterial?: Material;
      dispose?: () => void;
    };
    if (o.geometry && !seen.has(o.geometry) && !isShared(o.geometry)) {
      seen.add(o.geometry);
      o.geometry.dispose();
    }
    if (o.material) {
      if (Array.isArray(o.material)) for (const m of o.material) disposeMaterial(m, seen);
      else disposeMaterial(o.material, seen);
    }
    if (o.customDepthMaterial) disposeMaterial(o.customDepthMaterial, seen);
    if (o.customDistanceMaterial) disposeMaterial(o.customDistanceMaterial, seen);
    // Objects owning extra GPU resources (InstancedMesh, SkinnedMesh, Text3D…) expose dispose().
    if (typeof o.dispose === 'function' && !seen.has(o)) {
      seen.add(o);
      o.dispose();
    }
  });
}

export class Disposables {
  private readonly items: (Disposable | DisposeFn)[] = [];
  private disposed = false;

  /** Register a resource with a `dispose()` method; returns it for chaining. */
  track<T extends Disposable>(resource: T): T {
    if (this.disposed) resource.dispose();
    else this.items.push(resource);
    return resource;
  }

  /** Register an arbitrary cleanup callback (remove a listener, stop an oscillator, …). */
  onDispose(fn: DisposeFn): void {
    if (this.disposed) fn();
    else this.items.push(fn);
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Run all cleanups in reverse registration order. Errors are collected so one bad cleanup cannot leak the rest. */
  dispose(): unknown[] {
    if (this.disposed) return [];
    this.disposed = true;
    const errors: unknown[] = [];
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]!;
      try {
        if (typeof item === 'function') item();
        else item.dispose();
      } catch (e) {
        errors.push(e);
      }
    }
    this.items.length = 0;
    return errors;
  }
}
