/**
 * Ways of looking inside a machine without cutting it: exploded view, x-ray shell, and the hum / vibration
 * that tells a running machine from a stopped one.
 */
import { Mesh, Vector3, type Material, type Object3D } from 'three';
import { K, type ColorLike, type KGlassMaterial } from '@/style';
import type { Updatable } from '../core/tick';

/* ----------------------------------------------------------------------------------- exploded view */

export interface ExplodePart {
  object: Object3D;
  /** Direction the part slides along (parent space; normalised here). */
  axis: readonly [number, number, number];
  /** Distance at full explosion, units. */
  distance: number;
  /** 0…1: when in the motion this part starts (parts with a later start leave after the others). */
  delay?: number;
}

/**
 * Exploded view: parts slide apart along authored axes. The pose is a pure function of `amount` (0 =
 * assembled, 1 = exploded), so it is random-access safe — drive it with a `stage.param`.
 */
export class ExplodedView {
  private readonly parts: { object: Object3D; home: Vector3; axis: Vector3; distance: number; delay: number }[];
  private value = 0;

  constructor(parts: readonly ExplodePart[]) {
    this.parts = parts.map((p) => ({
      object: p.object,
      home: p.object.position.clone(),
      axis: new Vector3(...p.axis).normalize(),
      distance: p.distance,
      delay: Math.min(Math.max(p.delay ?? 0, 0), 0.9),
    }));
  }

  get amount(): number {
    return this.value;
  }
  set amount(v: number) {
    this.value = v;
    for (const p of this.parts) {
      // each part uses its own window [delay, 1] of the motion, eased in and out (smoothstep)
      const k = Math.min(Math.max((v - p.delay) / (1 - p.delay), 0), 1);
      p.object.position.copy(p.home).addScaledVector(p.axis, p.distance * k * k * (3 - 2 * k));
    }
  }
}

export function createExplodedView(parts: readonly ExplodePart[]): ExplodedView {
  return new ExplodedView(parts);
}

/* ------------------------------------------------------------------------------------------- x-ray */

interface Fadable {
  fade: number;
}

/**
 * X-ray shell: the shell's own materials dissolve (dithered `fade`) while a ghost of the same geometry in
 * edge-lit glass fades in, so the silhouette stays readable and the internals show through.
 */
export class XRay {
  readonly ghostMaterial: KGlassMaterial;
  private readonly solids: Fadable[] = [];
  private readonly ghosts: Mesh[] = [];
  private value = 0;
  private readonly minFade: number;

  constructor(shell: Object3D, o: { color?: ColorLike; opacity?: number; edgeOpacity?: number; keep?: number } = {}) {
    this.ghostMaterial = K.glass({ color: o.color ?? 'sky', opacity: o.opacity ?? 0.05, edgeOpacity: o.edgeOpacity ?? 0.55, specular: 0.3 });
    this.minFade = o.keep ?? 0;
    const meshes: Mesh[] = [];
    shell.traverse((obj) => {
      if ((obj as Mesh).isMesh) meshes.push(obj as Mesh);
    });
    for (const mesh of meshes) {
      const list: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list) {
        const f = m as unknown as Partial<Fadable>;
        if (typeof f.fade === 'number' && !this.solids.includes(f as Fadable)) this.solids.push(f as Fadable);
      }
      const ghost = new Mesh(mesh.geometry, this.ghostMaterial);
      ghost.name = 'xray-ghost';
      ghost.renderOrder = 4;
      ghost.visible = false;
      mesh.add(ghost);
      this.ghosts.push(ghost);
    }
  }

  /** 0 = solid shell … 1 = see-through ghost (tweenable; drive it with a `stage.param`). */
  get amount(): number {
    return this.value;
  }
  set amount(v: number) {
    this.value = v;
    for (const s of this.solids) s.fade = Math.max(1 - v, this.minFade);
    this.ghostMaterial.fade = v;
    for (const g of this.ghosts) g.visible = v > 0.01;
  }
}

export function createXRay(shell: Object3D, o: ConstructorParameters<typeof XRay>[1] = {}): XRay {
  return new XRay(shell, o);
}

/* --------------------------------------------------------------------------------------- vibration */

/**
 * Hum / vibration: tiny deterministic jitter of position (and roll) around the rest pose. `amount` 0…1 is
 * tweenable (map it to load or speed). Call `update(dt, t)` from the chapter (or add it to an `FxSet`).
 */
export class Vibration implements Updatable {
  amount: number;
  private readonly home: Vector3;
  private readonly amplitude: number;
  private readonly frequency: number;

  constructor(
    private readonly object: Object3D,
    o: { amplitude?: number; frequency?: number; amount?: number; reducedMotion?: boolean } = {},
  ) {
    this.home = object.position.clone();
    // reduced motion: no shake at all (STYLE_GUIDE §5)
    this.amplitude = o.reducedMotion ? 0 : (o.amplitude ?? 0.01);
    this.frequency = o.frequency ?? 23;
    this.amount = o.amount ?? 1;
  }

  update(_dt: number, t: number): void {
    const a = this.amplitude * this.amount;
    const w = t * this.frequency;
    // three incommensurate sines per axis: reads as a hum, never as a loop
    this.object.position.set(
      this.home.x + a * Math.sin(w * 6.283) * 0.6,
      this.home.y + a * Math.sin(w * 6.283 * 1.31 + 1.7),
      this.home.z + a * Math.sin(w * 6.283 * 0.83 + 4.1) * 0.6,
    );
  }
}

export function createVibration(object: Object3D, o: ConstructorParameters<typeof Vibration>[1] = {}): Vibration {
  return new Vibration(object, o);
}
