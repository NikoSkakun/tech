/**
 * `CrystalBlock` for copper: a cube of n×n×n face-centred cubic unit cells — ion cores Cu⁺ (`coral.dark` impostor
 * orbs with a «+») at the corners and face centres of every cell, inside a bevelled glass box. The atoms can fly
 * in layer by layer (`assemble`), tremble (`jitter`, ∝ √T in step 5) and push apart without the electron "glue"
 * (`swell`). Sites are in the block's local space, centred on its middle.
 */
import { Group, Mesh, Vector3 } from 'three';
import { createOrbs, type Orbs } from '@/fx';
import { G } from '@/kit';
import { K, type ColorLike } from '@/style';

export interface FccOptions {
  cells: number;
  /** Edge of the unit cell, world units. */
  a: number;
  radius: number;
  color?: ColorLike;
  /** Glass box around the block. */
  glass?: boolean;
  /** Sign sticker of the ions (default «+»: ion cores). */
  glyph?: 'plus' | 'none';
  /** Per-ion colours (impurities, heat ripples) through `ions.setInstanceColor`. */
  instanceColors?: boolean;
}

export interface FccBlock {
  group: Group;
  ions: Orbs;
  /** Rest positions of the ions (local), sorted bottom → top. */
  sites: Vector3[];
  /** Edge of the whole block. */
  size: number;
  a: number;
  /** 0 = atoms scattered far out, 1 = assembled (layer by layer, stagger ≈ 30 ms per atom row). */
  assemble: number;
  /** Trembling amplitude, world units. */
  jitter: number;
  /** 0…1: ions push each other apart (no electron glue). */
  swell: number;
  /** 0…1: amorphous disorder (glass): every site shifted by up to ≈ 0,35 a. */
  disorder: number;
  /** Per-ion scale multiplier (0 hides a site: vacancy). */
  scales: Float32Array;
  update(t: number): void;
}

/** All FCC sites of an n-cell cube with edge a, centred on the origin. */
export function fccSites(n: number, a: number): Vector3[] {
  const out: Vector3[] = [];
  const h = (n * a) / 2;
  const push = (x: number, y: number, z: number): void => {
    out.push(new Vector3(x * a - h, y * a - h, z * a - h));
  };
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++)
      for (let k = 0; k <= n; k++) {
        push(i, j, k);
        if (i < n && j < n) push(i + 0.5, j + 0.5, k);
        if (i < n && k < n) push(i + 0.5, j, k + 0.5);
        if (j < n && k < n) push(i, j + 0.5, k + 0.5);
      }
  return out.sort((p, q) => p.y - q.y || p.x - q.x || p.z - q.z);
}

const hash = (i: number, k: number): number => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function createFccBlock(opts: FccOptions): FccBlock {
  const group = new Group();
  group.name = 'fcc-block';
  const sites = fccSites(opts.cells, opts.a);
  const size = opts.cells * opts.a;
  const ions = createOrbs({
    kind: 'ion',
    color: opts.color ?? 'coral.dark',
    glyph: opts.glyph ?? 'plus',
    count: sites.length,
    radius: opts.radius,
    instanceColors: opts.instanceColors ?? false,
  });
  group.add(ions);
  if (opts.glass !== false) {
    const pad = opts.a * 0.42;
    const box = new Mesh(
      G.rbox(size + 2 * pad, size + 2 * pad, size + 2 * pad, pad * 0.9, 3),
      K.glass({ color: 'sky', opacity: 0.035, edgeOpacity: 0.28 }),
    );
    box.renderOrder = 2;
    group.add(box);
  }
  // fly-in start points: outward from the centre and up, a little random
  const from = sites.map((p, i) =>
    p
      .clone()
      .normalize()
      .multiplyScalar(size * (1.2 + hash(i, 1)))
      .add(new Vector3(0, size * (0.8 + hash(i, 2)), 0)),
  );
  const phase = sites.map((_, i) => [hash(i, 3), hash(i, 4), hash(i, 5)].map((x) => x * 6.283));
  const rows = sites.length;
  const block: FccBlock = {
    group,
    ions,
    sites,
    size,
    a: opts.a,
    assemble: 1,
    jitter: 0,
    swell: 0,
    disorder: 0,
    scales: new Float32Array(sites.length).fill(1),
    update(t) {
      const j = block.jitter * (1 + 1.6 * block.swell);
      const grow = 1 + 0.08 * block.swell;
      for (let i = 0; i < rows; i++) {
        // atoms arrive bottom layer first; each atom takes 0,35 of the timeline
        const local = Math.min(Math.max((block.assemble * 1.35 - (i / rows) * 1.0) / 0.35, 0), 1);
        const e = 1 - (1 - local) ** 3;
        const p = sites[i]!;
        const f = from[i]!;
        const ph = phase[i]!;
        const q = block.disorder * opts.a * 0.35;
        const x = (p.x * grow + q * Math.cos(ph[0]!)) * e + f.x * (1 - e) + j * Math.sin(t * 11.3 + ph[0]!);
        const y = (p.y * grow + q * Math.cos(ph[1]!)) * e + f.y * (1 - e) + j * Math.sin(t * 12.7 + ph[1]!);
        const z = (p.z * grow + q * Math.cos(ph[2]!)) * e + f.z * (1 - e) + j * Math.sin(t * 10.1 + ph[2]!);
        ions.setPosition(i, x, y, z, block.scales[i]! * (0.25 + 0.75 * e));
      }
      ions.commit();
    },
  };
  block.update(0);
  return block;
}
