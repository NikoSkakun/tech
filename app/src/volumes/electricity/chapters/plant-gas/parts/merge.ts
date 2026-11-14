/**
 * Merge several small `Builder`s (town quarters) into one mesh per material slot, keeping, per builder, the
 * range of its vertices in the `window` mesh — so a single quarter's lit windows can be switched off by
 * zeroing its slice of the per-vertex night emissive (`kEmissive`). 20 quarters → 6 draw calls instead of 60.
 */
import { Group, Mesh, type BufferAttribute, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder } from '@/kit';
import { K_EMISSIVE_ATTRIBUTE } from '@/style';

type Slot = 'toon' | 'matte' | 'gloss' | 'metal' | 'window' | 'glow';
const SLOTS: readonly Slot[] = ['toon', 'matte', 'gloss', 'metal', 'window', 'glow'];
const CASTS: Record<Slot, boolean> = { toon: true, matte: true, gloss: true, metal: true, window: false, glow: false };

export interface Merged {
  group: Group;
  /** Template builder whose `MatSet` the merged meshes use (`mats.night`). */
  template: Builder;
  /** Set the lit level 0…1 of the windows of entry i (multiplies its night emissive). */
  setLit(i: number, level: number): void;
}

export function mergeBuilders(name: string, entries: readonly { b: Builder; at: [number, number, number] }[]): Merged {
  const template = new Builder(name);
  const group = new Group();
  group.name = name;
  const ranges: [number, number][] = [];
  let windowGeo: BufferGeometry | null = null;
  for (const slot of SLOTS) {
    const parts: BufferGeometry[] = [];
    let start = 0;
    for (const e of entries) {
      let g: BufferGeometry;
      try {
        g = e.b.geometry(slot);
      } catch {
        if (slot === 'window') ranges.push([start, 0]);
        continue;
      }
      g.translate(e.at[0], e.at[1], e.at[2]);
      if (slot === 'window') {
        const n = g.getAttribute('position').count;
        ranges.push([start, n]);
        start += n;
      }
      parts.push(g);
    }
    if (!parts.length) continue;
    // three's merge keeps every attribute (vertex colours, the night emissive), the kit's keeps only position / normal / uv
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    const mesh = new Mesh(merged, template.mats.get(slot));
    mesh.name = `${name}:${slot}`;
    mesh.castShadow = CASTS[slot];
    mesh.receiveShadow = true;
    group.add(mesh);
    if (slot === 'window') windowGeo = merged;
  }
  const original = windowGeo ? Float32Array.from((windowGeo.getAttribute(K_EMISSIVE_ATTRIBUTE) as BufferAttribute).array as Float32Array) : null;
  const levels = entries.map(() => 1);
  return {
    group,
    template,
    setLit(i, level) {
      const r = ranges[i];
      if (!windowGeo || !original || !r || Math.abs((levels[i] ?? 1) - level) < 0.01) return;
      levels[i] = level;
      const attr = windowGeo.getAttribute(K_EMISSIVE_ATTRIBUTE) as BufferAttribute;
      const a = attr.array as Float32Array;
      for (let k = r[0] * 3; k < (r[0] + r[1]) * 3; k++) a[k] = (original[k] ?? 0) * level;
      attr.needsUpdate = true;
    },
  };
}
