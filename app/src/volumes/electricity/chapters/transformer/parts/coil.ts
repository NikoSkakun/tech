/**
 * A coil on a vertical core limb: every turn is one copper ring (STYLE: «кожен виток — кільце, при великих числах —
 * щільна спіраль»), wound bottom → top, layer by layer, inner layer first. The real turn counts (10…2000) are
 * mapped to a drawable number of rings (`visibleTurns`, honest chip «не в масштабі»); the wire thickness follows
 * the rated current of the winding (∝ √I). Turns are added and removed with a winding animation: the geometry
 * holds all rings in winding order and `drawRange` reveals them one by one.
 */
import { BufferGeometry, Mesh, TorusGeometry, Vector3, type Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Drawable rings for a real turn count: all up to 16, then a gentle log growth (2000 turns → ≈ 90 rings). */
export function visibleTurns(n: number): number {
  return n <= 16 ? Math.round(n) : Math.round(16 + 28 * Math.log10(n / 16));
}

export interface CoilOptions {
  /** Inner radius of the first layer (clears the core). */
  inner: number;
  /** Height of the winding window. */
  height: number;
  material: Material;
}

export interface Coil {
  mesh: Mesh;
  /** Rebuild for a real turn count and wire radius; the shown count animates toward it in `update`. */
  set(turns: number, wire: number, instant?: boolean): void;
  /** Turns currently shown (fractional while winding). */
  readonly shown: number;
  /** Outer radius of the winding as built. */
  readonly outer: number;
  /** A helix through the winding (for the electron flow), bottom lead → top lead. */
  path(): Vector3[];
  update(dt: number): void;
}

export function createCoil(o: CoilOptions): Coil {
  const mesh = new Mesh(new BufferGeometry(), o.material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  let target = 0;
  let shown = 0;
  let wire = 0.02;
  let outer = o.inner;
  let perRing = 0;
  let layout: { r: number; y: number }[] = [];

  function build(count: number, w: number): void {
    const perLayer = Math.max(4, Math.floor(o.height / (2.15 * w)));
    const pitch = o.height / perLayer;
    layout = [];
    for (let i = 0; i < count; i++) {
      const layer = Math.floor(i / perLayer);
      const k = i % perLayer;
      // alternate the winding direction per layer like a real coil: up, down, up…
      const y = -o.height / 2 + pitch * (layer % 2 === 0 ? k + 0.5 : perLayer - k - 0.5);
      layout.push({ r: o.inner + w + layer * 2.1 * w, y });
    }
    outer = layout.length ? layout[layout.length - 1]!.r + w : o.inner;
    const rings = layout.map(({ r, y }) => {
      const g = new TorusGeometry(r, w, 6, 28);
      g.rotateX(Math.PI / 2);
      g.translate(0, y, 0);
      return g;
    });
    const merged = rings.length ? mergeGeometries(rings) : new BufferGeometry();
    rings.forEach((g) => g.dispose());
    mesh.geometry.dispose();
    mesh.geometry = merged;
    perRing = rings.length ? merged.index!.count / rings.length : 0;
  }

  const coil: Coil = {
    mesh,
    get shown() {
      return shown;
    },
    get outer() {
      return outer;
    },
    set(turns, w, instant = false) {
      const count = visibleTurns(turns);
      if (w !== wire || count > layout.length || instant) build(Math.max(count, instant ? count : layout.length), w);
      wire = w;
      target = count;
      if (instant) shown = count;
      coil.update(0);
    },
    path() {
      const pts: Vector3[] = [];
      const turnsDrawn = Math.max(3, Math.min(10, Math.round(target / 3)));
      const r = outer + 0.03; // just outside the last layer, where the eye can see them
      const steps = turnsDrawn * 16;
      for (let i = 0; i <= steps; i++) {
        const a = (i / 16) * Math.PI * 2;
        pts.push(new Vector3(Math.cos(a) * r, -o.height / 2 + (i / steps) * o.height, Math.sin(a) * r));
      }
      return pts;
    },
    update(dt) {
      // winding speed: ≈ 40 rings per second, never slower than 0,6 s for the whole change
      const rate = Math.max(40, Math.abs(target - shown) / 0.6);
      shown = target > shown ? Math.min(target, shown + rate * dt) : Math.max(target, shown - rate * dt);
      if (dt === 0) shown = Math.min(shown, layout.length);
      mesh.geometry.setDrawRange(0, Math.round(Math.ceil(shown) * perRing));
    },
  };
  return coil;
}
