/**
 * Step 11: a magnified sub-module of a modular multilevel converter, floating beside the valve hall with a
 * leader line to one valve tower. The kit's hall is a line-commutated (thyristor) hall; the step's text speaks of
 * IGBT sub-modules, so the inset shows what one block of a modern tower holds: a half-bridge of two
 * transistors and its own capacitor on a busbar. Pure builder. Local space: origin = centre of the inset.
 */
import { Group, Mesh, TorusGeometry, type Vector3 } from 'three';
import { createWire } from '@/fx';
import { Builder } from '@/kit';
import { K } from '@/style';
import { COPPER } from '../world';
import { addCan, addTransistor } from './components';

export interface SubModuleInset {
  group: Group;
  /** Lens ring glow 0…1 (the steps pulse it gently). */
  setGlow(v: number): void;
}

/** `from` = centre of the inset, `to` = the valve the leader line points at (both in the parent's space). */
export function createSubModuleInset(from: Vector3, to: Vector3): SubModuleInset {
  const b = new Builder('mmc-submodule');
  b.box(0.95, 0.05, 0.55, { r: 0.03, slot: 'gloss', c: 'green', at: [0, -0.32, 0] });
  addTransistor(b, [-0.3, -0.27, 0.12], 0.42);
  addTransistor(b, [0.0, -0.27, 0.12], 0.42);
  addCan(b, [0.3, -0.27, -0.02], 0.15, 0.48, 'blue');
  b.box(0.8, 0.03, 0.06, { r: 0.01, slot: 'metal', c: COPPER, at: [0, -0.27, -0.2] });
  const inset = b.build().group;
  const ringMat = K.glow({ color: 'cyan', intensity: 1.2, whiten: 0.1, keepHue: true, falloff: 0 });
  const ring = new Mesh(new TorusGeometry(0.66, 0.018, 8, 64), ringMat);
  const group = new Group();
  group.name = 'mmc-submodule-inset';
  group.position.copy(from);
  group.add(inset, ring);
  // leader line from the lens rim to the valve tower (built in the parent's space, then offset into ours)
  const dir = to.clone().sub(from).normalize();
  const leader = createWire([dir.clone().multiplyScalar(0.68), to.clone().sub(from)], {
    radius: 0.012,
    color: 'cyan',
    power: 0,
    detail: 6,
    castShadow: false,
  });
  group.add(leader);
  return {
    group,
    setGlow(v) {
      ringMat.intensity = 0.6 + 0.8 * v;
    },
  };
}
