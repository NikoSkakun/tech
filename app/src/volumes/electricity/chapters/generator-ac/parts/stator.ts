/**
 * Teaching stator lying flat (axis = +Y): a laminated steel ring with `3·p` teeth pointing inward, a coil on
 * every tooth in its phase colour (L1 `yellow`, L2 `green`, L3 `red`, repeating), on four feet. The coil k sits
 * at angle φ_k = k·360°/(3p) measured in the XZ plane from +X toward −Z (counter-clockwise seen from above), so a
 * rotor turning counter-clockwise passes L1 → L2 → L3. Coil materials are per coil (emissive ∝ current).
 * Origin = centre of the stator on the floor; the bore centre is at `BORE_Y`.
 */
import { Group, Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { G } from '@/kit';
import { K, SEMANTIC } from '@/style';
import { PHASE } from '../world';

export const BORE_Y = 0.85;
export const STATOR_R = 1.62;
export const TOOTH_TIP = 0.86;

export interface Stator {
  group: Group;
  /** One material per coil (phase colour; tween `emissiveIntensity`). */
  coilMats: ReturnType<typeof K.toon>[];
  /** Phase index 0…2 of each coil. */
  phaseOf: number[];
  /** Angle of each coil, rad (XZ plane, CCW from +X seen from above). */
  angles: number[];
  /** Local point on the outer rim at angle a (for wires / labels). */
  rim(a: number, out?: Vector3): Vector3;
}

/** Position on the XZ circle of radius r at angle a (CCW from +X seen from above → z = −sin). */
export function polar(r: number, a: number, y: number, out = new Vector3()): Vector3 {
  return out.set(Math.cos(a) * r, y, -Math.sin(a) * r);
}

export function createStator(polePairs = 1): Stator {
  const group = new Group();
  group.name = `stator-p${polePairs}`;
  const n = 3 * polePairs;
  const steel = K.metal({ color: 'steel', specular: 0.6 });
  // yoke: thick ring (closed lathe profile, bottom → top, outer wall first)
  const h = 0.7;
  const r0 = 1.3;
  const r1 = STATOR_R;
  const yoke = new Mesh(
    G.lathe([[r0, BORE_Y - h / 2], [r1 - 0.06, BORE_Y - h / 2], [r1, BORE_Y - h / 2 + 0.06], [r1, BORE_Y + h / 2 - 0.06], [r1 - 0.06, BORE_Y + h / 2], [r0, BORE_Y + h / 2], [r0, BORE_Y - h / 2]], { seg: 96, crease: 50 }),
    steel,
  );
  yoke.castShadow = yoke.receiveShadow = true;
  group.add(yoke);
  // lamination grooves (thin dark rings)
  for (const dy of [-0.2, 0, 0.2]) {
    const ring = new Mesh(G.ring(r1 + 0.005, 0.012, 96, 4), K.toon({ color: 'slate' }));
    ring.position.y = BORE_Y + dy;
    group.add(ring);
  }
  const coilMats: ReturnType<typeof K.toon>[] = [];
  const phaseOf: number[] = [];
  const angles: number[] = [];
  const tooth = new RoundedBoxGeometry(r0 - TOOTH_TIP + 0.1, 0.5, 0.3, 2, 0.05);
  const coilGeo = new RoundedBoxGeometry(0.3, 0.62, 0.5, 3, 0.1);
  const shoe = new RoundedBoxGeometry(0.1, 0.52, 0.5, 2, 0.04);
  for (let k = 0; k < n; k++) {
    const a = (k * 2 * Math.PI) / n;
    const phase = k % 3;
    angles.push(a);
    phaseOf.push(phase);
    const holder = new Group();
    holder.rotation.y = a;
    holder.position.y = BORE_Y;
    const t = new Mesh(tooth, steel);
    t.position.x = (r0 + TOOTH_TIP) / 2 - 0.05;
    const s = new Mesh(shoe, steel);
    s.position.x = TOOTH_TIP + 0.05;
    const mat = K.toon({ color: PHASE[phase]!, gloss: 0.5, emissive: PHASE[phase]!, emissiveIntensity: 0.1, keepHue: true });
    coilMats.push(mat);
    const c = new Mesh(coilGeo, mat);
    c.position.x = (r0 + TOOTH_TIP) / 2 + 0.02;
    for (const m of [t, s, c]) m.castShadow = true;
    holder.add(t, s, c);
    group.add(holder);
  }
  // feet and base plate
  for (const a of [0.6, 2.5, 3.8, 5.6]) {
    const foot = new Mesh(new RoundedBoxGeometry(0.34, BORE_Y - h / 2 + 0.05, 0.34, 2, 0.06), K.toon({ color: 'slate' }));
    polar(r1 - 0.12, a, (BORE_Y - h / 2) / 2, foot.position);
    foot.castShadow = true;
    group.add(foot);
  }
  return {
    group,
    coilMats,
    phaseOf,
    angles,
    rim: (a, out = new Vector3()) => polar(r1 + 0.05, a, BORE_Y, out),
  };
}

/** Two-pole bar magnet rotor on a vertical shaft (N `coral` toward local +X). Rotate `group.rotation.y`. */
export function createMagnetRotor(length = 1.5): Group {
  const g = new Group();
  g.name = 'magnet-rotor';
  const half = new RoundedBoxGeometry(length / 2, 0.42, 0.42, 3, 0.1);
  const n = new Mesh(half, K.toon({ color: SEMANTIC.poleN, gloss: 0.5 }));
  n.position.x = length / 4;
  const s = new Mesh(half, K.toon({ color: SEMANTIC.poleS, gloss: 0.5 }));
  s.position.x = -length / 4;
  const shaft = new Mesh(G.cyl(0.07, 1.2, { seg: 16 }), K.metal({ color: 'steel' }));
  shaft.position.y = -0.6;
  for (const m of [n, s, shaft]) m.castShadow = true;
  g.add(n, s, shaft);
  g.position.y = BORE_Y;
  return g;
}
