/**
 * 3D views of the constructor's parts (step 7). A part lies between two grid nodes: two lead halves (tinted by
 * the potential of their node, pulses ∝ current) and a small body in the middle — candy resistor, lamp, knife
 * switch, ammeter puck or battery block. Bodies are built along local +X = the part's a → b direction.
 * Views are created and disposed as the circuit is edited (unique geometry / materials per view).
 */
import { Group, Mesh, SphereGeometry, type Vector3, type Material, type Object3D } from 'three';
import { Builder } from '@/kit';
import { K, SEMANTIC, type KGlowMaterial } from '@/style';
import type { Text3D } from '@/text';
import type { Part, PartKind } from '@electricity/sim/current';
import { tag } from '../world';
import { createLead, type Lead } from './leads';

export interface PartView {
  id: string;
  kind: PartKind;
  /** `kind:a:b` — what this view was built for. */
  key: string;
  group: Group;
  /** Lead halves on the `a` and on the `b` side (a plain wire has only the first). */
  halves: Lead[];
  mid: Vector3;
  /** Unit vector a → b. */
  dir: Vector3;
  label: Text3D | null;
  /** Lamp filament. */
  glow: KGlowMaterial | null;
  /** Switch blade. */
  blade: Object3D | null;
  shown: string;
}

const BODY_SCALE = 1.2; // bodies on the board are drawn larger than the tray models: they are the hero
const BODY_HALF = 0.4 * BODY_SCALE; // half length of a body along the part

export function partBody(kind: PartKind): { group: Group; blade: Object3D | null } {
  const b = new Builder(`part-${kind}`);
  let blade: Object3D | null = null;
  if (kind === 'resistor') {
    b.cyl(0.17, 0.72, { at: [-0.36, 0.2, 0], axis: 'x', seg: 20, slot: 'gloss', c: 'teal', bevel: 0.08 });
    (['coral', 'yellow', 'violet'] as const).forEach((c, k) =>
      b.cyl(0.176, 0.07, { at: [-0.2 + k * 0.16, 0.2, 0], axis: 'x', seg: 20, c, bevel: 0 }),
    );
  } else if (kind === 'lamp') {
    b.cyl(0.24, 0.14, { seg: 24, c: ['ink', 'slate'] });
    b.cyl(0.13, 0.14, { at: [0, 0.14, 0], seg: 18, slot: 'metal', c: 'mist' });
    b.sphere(0.27, { at: [0, 0.5, 0], seg: 24, slot: 'glass' });
  } else if (kind === 'switch') {
    b.box(0.86, 0.1, 0.4, { r: 0.03, c: ['ink', 'slate'] });
    b.box(0.1, 0.22, 0.14, { at: [-0.3, 0.1, 0], r: 0.02, slot: 'metal', c: 'amber' });
    b.box(0.1, 0.22, 0.14, { at: [0.3, 0.1, 0], r: 0.02, slot: 'metal', c: 'amber' });
    const p = b.part('blade', { at: [0.3, 0.3, 0] });
    p.box(0.66, 0.07, 0.05, { at: [-0.3, -0.035, 0], r: 0.015, slot: 'metal', c: 'orange' });
    p.cyl(0.055, 0.26, { at: [-0.62, 0, 0], seg: 12, slot: 'gloss', c: 'coral' });
  } else if (kind === 'ammeter') {
    b.cyl(0.36, 0.16, { seg: 32, slot: 'gloss', c: ['ink', 'slate'] });
    b.cyl(0.3, 0.02, { at: [0, 0.16, 0], seg: 32, c: 'white' });
    b.ring(0.31, 0.03, { at: [0, 0.17, 0], seg: 32, slot: 'metal', c: 'amber' });
    b.box(0.03, 0.012, 0.26, { at: [0.05, 0.185, 0], rot: [0, 0.6, 0], r: 0, c: 'coral' });
  } else if (kind === 'source') {
    // battery block: «+» (coral cap) toward `a`, «−» (blue) toward `b`
    b.box(0.86, 0.36, 0.5, { at: [0, 0.02, 0], r: 0.07, slot: 'gloss', c: ['ink', 'slate'] });
    b.box(0.2, 0.37, 0.51, { at: [-0.34, 0.02, 0], r: 0.07, slot: 'gloss', c: SEMANTIC.dcPlus });
    b.box(0.2, 0.37, 0.51, { at: [0.34, 0.02, 0], r: 0.07, slot: 'gloss', c: SEMANTIC.dcMinus });
    b.box(0.16, 0.012, 0.04, { at: [-0.34, 0.39, 0], r: 0, c: 'white' });
    b.box(0.04, 0.012, 0.16, { at: [-0.34, 0.39, 0], r: 0, c: 'white' });
    b.box(0.16, 0.012, 0.04, { at: [0.34, 0.39, 0], r: 0, c: 'white' });
  }
  const model = b.build();
  if (kind === 'switch') blade = model.part('blade');
  return { group: model.group, blade };
}

export function createPartView(part: Part, pa: Vector3, pb: Vector3): PartView {
  const group = new Group();
  group.name = `part:${part.id}`;
  const mid = pa.clone().lerp(pb, 0.5);
  const dir = pb.clone().sub(pa).normalize();
  const halves: Lead[] = [];
  let label: Text3D | null = null;
  let glow: KGlowMaterial | null = null;
  let blade: Object3D | null = null;
  if (part.kind === 'wire') halves.push(createLead([pa, pb], { bend: 0, radius: 0.05 }));
  else {
    const gap = dir.clone().multiplyScalar(BODY_HALF);
    halves.push(
      createLead([pa, mid.clone().sub(gap)], { bend: 0, radius: 0.05 }),
      createLead([mid.clone().add(gap), pb], { bend: 0, radius: 0.05 }),
    );
    const made = partBody(part.kind);
    blade = made.blade;
    made.group.position.copy(mid).setY(0);
    made.group.scale.setScalar(BODY_SCALE);
    made.group.rotation.y = Math.atan2(-dir.z, dir.x);
    group.add(made.group);
    if (part.kind === 'lamp') {
      glow = K.glow({ color: 'orange', intensity: 0.2, falloff: 0, whiten: 0.3 });
      const filament = new Mesh(new SphereGeometry(0.1 * BODY_SCALE, 14, 10), glow);
      filament.position.set(mid.x, 0.5 * BODY_SCALE, mid.z);
      group.add(filament);
    }
    label = tag('', 19, 'white', 'mono');
    // two short lines right beside the body: to the right of a part that runs toward the camera, behind one
    // that runs across — never over its own leads, and narrow enough not to touch a neighbour's reading
    label.position.set(mid.x + Math.abs(dir.z) * 0.62, 0.6, mid.z - Math.abs(dir.x) * 0.5);
    group.add(label);
  }
  group.add(...halves.map((h) => h.mesh));
  return {
    id: part.id,
    kind: part.kind,
    key: `${part.kind}:${part.a}:${part.b}`,
    group,
    halves,
    mid,
    dir,
    label,
    glow,
    blade,
    shown: '',
  };
}

/** Free everything a view owns (its geometries and materials are unique to it). */
export function disposePartView(view: PartView): void {
  view.group.removeFromParent();
  view.group.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    // engine-lifetime resources (kit caches) are marked `shared` and must survive
    if (m.geometry.userData.shared !== true) m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material as Material])
      if (mat.userData.shared !== true) mat.dispose();
  });
}
