/**
 * The bridge morph of step `to-generator`: a holographic `violet` silhouette of a real generator — a hollow
 * stator drum with pole shoes and a rotor on its shaft, both along the axle (local z) — that grows around the
 * table model while the camera flies out to `generator-ac`. Pure scenery: no physics, no picking.
 * Origin: on the axle, mid-length; `set(k)` 0 = hidden, 1 = full size.
 */
import { Group, Mesh } from 'three';
import { Builder } from '@/kit';
import { K } from '@/style';

export interface GenSilhouette {
  group: Group;
  set(k: number): void;
}

export function createGenSilhouette(): GenSilhouette {
  const g = new Group();
  g.name = 'gen-silhouette';
  const L = 1.8;
  const stator = new Builder('stator-ghost');
  stator.cyl(1.75, L, { axis: 'z', at: [0, 0, -L / 2], seg: 64, open: true, bevel: 0 });
  stator.cyl(1.35, L, { axis: 'z', at: [0, 0, -L / 2], seg: 64, open: true, bevel: 0 });
  for (const z of [-L / 2, L / 2]) stator.ring(1.55, 0.2, { at: [0, 0, z], seg: 64, tubeSeg: 8, axis: 'z' });
  // pole shoes inside the drum, left and right (where the horseshoe's poles are)
  for (const x of [-1.2, 1.2]) stator.box(0.3, 1.0, L * 0.9, { at: [x, 0, 0], r: 0.06, mid: true });
  const rotor = new Builder('rotor-ghost');
  rotor.cyl(0.8, L * 1.05, { axis: 'z', at: [0, 0, (-L * 1.05) / 2], seg: 48, bevel: 0.05 });
  rotor.cyl(0.12, L * 2.0, { axis: 'z', at: [0, 0, -L], seg: 16, bevel: 0 });
  const mat = K.glass({ color: 'violet', opacity: 0.22, edgeOpacity: 0.85 });
  const parts = [new Mesh(stator.geometry('toon'), mat), new Mesh(rotor.geometry('toon'), mat)];
  for (const m of parts) m.renderOrder = 3;
  g.add(...parts);
  g.visible = false;
  return {
    group: g,
    set(k) {
      g.visible = k > 0.01;
      g.scale.setScalar(Math.max(0.35 + 0.65 * k, 0.001));
      // the rotor arrives a beat after the stator
      parts[1]!.scale.setScalar(Math.max(Math.min(k * 1.4 - 0.3, 1), 0.001));
    },
  };
}
