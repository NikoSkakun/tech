/**
 * The offshore block: a floating slab of sea east of the island, built like an aquarium so that step 10 can
 * show what stands *under* the water — a sandy sea bed that steps down from the monopile shallows to the deep
 * water of the floating turbines, tinted glass walls (depth gradient `sky` → `blue`), a translucent surface.
 * Local frame: origin at the block centre on the sea surface, +X east (deeper), Y up.
 */
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh } from 'three';
import { K, col } from '@/style';
import { SEA } from '../layout';

export interface SeaBlock {
  group: Group;
  /** Sea-bed depth below the surface (positive metres) at local x. */
  depthAt(x: number): number;
  /** Half-width (along z) of the rounded footprint at local x. */
  halfZ(x: number): number;
  /** Surface material: tween `uniforms.opacity` to let the camera look into the water. */
  surface: Mesh;
  setClarity(v: number): void;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Three terraces: 13 m (monopiles) → 24 m (jackets) → 46 m (floating), toy metres. */
export function seaDepth(x: number): number {
  const mid = (SEA.depthShallow + SEA.depthDeep) * 0.41;
  return SEA.depthShallow + (mid - SEA.depthShallow) * smooth(-34, -12, x) + (SEA.depthDeep - mid) * smooth(44, 66, x);
}

export function buildSea(): SeaBlock {
  const hx = SEA.sizeX / 2;
  const hz = SEA.sizeZ / 2;
  const corner = 34;
  const halfZ = (x: number): number => {
    const e = Math.max(0, Math.abs(x) - (hx - corner));
    return hz - corner + Math.sqrt(Math.max(0, corner * corner - e * e));
  };
  const n = 72;
  const xs = Array.from({ length: n + 1 }, (_, i) => -hx + (2 * hx * i) / n);
  const rock = 15; // thickness of the sea-bed slab under the water
  /** Quad strip over the footprint at height y(x): two vertices per station. */
  const deck = (y: (x: number) => number, up: boolean): BufferGeometry => {
    const pos: number[] = [];
    const idx: number[] = [];
    xs.forEach((x, i) => {
      const w = halfZ(x);
      pos.push(x, y(x), -w, x, y(x), w);
      if (i < n) {
        const a = i * 2;
        if (up) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    return finish(pos, idx);
  };
  /** Wall around the perimeter between two height functions (outward-facing). */
  const wall = (top: (x: number) => number, bottom: (x: number) => number): BufferGeometry => {
    const pos: number[] = [];
    const idx: number[] = [];
    const ring: [number, number][] = [...xs.map((x) => [x, halfZ(x)] as [number, number]), ...[...xs].reverse().map((x) => [x, -halfZ(x)] as [number, number])];
    ring.forEach(([x, z], i) => {
      pos.push(x, top(x), z, x, bottom(x), z);
      const a = i * 2;
      const b = ((i + 1) % ring.length) * 2;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    });
    return finish(pos, idx);
  };
  const group = new Group();
  group.name = 'sea-block';
  group.position.set(SEA.x, SEA.level, SEA.z);
  const bed = (x: number): number => -seaDepth(x);
  // sand seen through water: pulled toward the water colour
  const sand = col('yellow.light').lerp(col('amber.light'), 0.25).lerp(col('blue'), 0.62);
  const seabed = new Mesh(deck(bed, true), K.toon({ color: sand, highlight: 0.1, rim: 0.2 }));
  seabed.receiveShadow = true;
  // strata of the slab under the sea bed, same family as the island's flank
  const strata = K.toon({
    layers: { stops: [[-999, 'bg.indigo'], [-SEA.depthDeep - 9, 'violet.dark'], [-SEA.depthShallow - 9, 'violet'], [-SEA.depthShallow - 3, 'coral.dark']], wobble: 1.6, wobbleScale: 0.05, space: 'world' },
    highlight: 0.1,
    rim: 0.5,
  });
  const flank = new Mesh(wall(bed, (x) => bed(x) - rock), strata);
  const bottom = new Mesh(deck((x) => bed(x) - rock, false), strata);
  flank.castShadow = bottom.castShadow = true;
  // the water body: glass walls (depth tint) and a translucent surface
  // depth gradient of the document: `sky` at the surface → `blue` → `bg.indigo` at the bottom
  const body = K.toon({
    gradient: { bottom: 'bg.indigo', top: col('blue').lerp(col('sky'), 0.3), range: [-SEA.depthDeep * 0.8, 0] },
    opacity: 0.74,
    highlight: 0,
    rim: 0.25,
    side: DoubleSide,
  });
  body.depthWrite = false;
  const glass = new Mesh(wall(() => 0, bed), body);
  glass.renderOrder = 2;
  const water = K.water({ shallow: 'sky', deep: 'blue', shape: 'open', scale: 22, glints: 0.7, opacity: 0.96 });
  // K.water animates meshes built in their local XY plane and laid flat (kit convention)
  const flatPos: number[] = [];
  const flatIdx: number[] = [];
  xs.forEach((x, i) => {
    const w = halfZ(x);
    flatPos.push(x, w, 0, x, -w, 0);
    if (i < n) flatIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  });
  const surface = new Mesh(finish(flatPos, flatIdx), water);
  surface.rotation.x = -Math.PI / 2;
  surface.renderOrder = 3;
  surface.receiveShadow = true;
  group.add(seabed, flank, bottom, glass, surface);
  return {
    group,
    depthAt: seaDepth,
    halfZ,
    surface,
    setClarity: (v) => {
      water.uniforms.opacity!.value = 0.96 - 0.52 * v;
      body.uniforms.opacity!.value = 0.74 - 0.4 * v;
    },
  };
}

function finish(pos: number[], idx: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
