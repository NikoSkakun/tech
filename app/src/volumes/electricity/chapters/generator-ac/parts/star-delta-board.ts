/**
 * Step 5 schematic: three windings (thick coils in phase colours) on a dark standing board that morph between
 * a star (Y: inner ends joined in the `blue` neutral node, terminals outward) and a delta (Δ: windings on the
 * sides of a triangle, terminals at its corners). `set(delta)` takes 0 = Y … 1 = Δ (tweened by the step).
 * Board-local plane XY, faces +Z. Terminal k direction: 90° − k·120° (L1 up, L2 lower right, L3 lower left).
 */
import { CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RibbonLines } from '@/fx';
import { K } from '@/style';
import { COPPER, PHASE, tag } from '../world';
import type { Text3D } from '@/text';

const COIL_L = 0.8;
const R_TRI = 1.25;

export interface StarDeltaBoard {
  group: Group;
  set(delta: number): void;
  /** Board-local terminal points (L1…L3) and the star node. */
  terminals: Vector3[];
  node: Vector3;
  coils: Group[];
  nTag: Text3D;
}

const dir = (k: number, out = new Vector3()): Vector3 => {
  const a = Math.PI / 2 - (k * 2 * Math.PI) / 3;
  return out.set(Math.cos(a), Math.sin(a), 0);
};

export function createStarDeltaBoard(): StarDeltaBoard {
  const group = new Group();
  group.name = 'star-delta-board';
  const plate = new Mesh(new RoundedBoxGeometry(3.6, 3.4, 0.1, 3, 0.12), K.toon({ color: 'bg.deep', rim: 0.6, emissive: 'teal', emissiveIntensity: 0.06 }));
  plate.position.set(0, -0.15, -0.12);
  group.add(plate);
  const coils = PHASE.map((c) => {
    const g = new Group();
    const body = new Mesh(new CylinderGeometry(0.2, 0.2, COIL_L, 32), K.toon({ color: c, gloss: 0.5, emissive: c, emissiveIntensity: 0.15, keepHue: true }));
    for (let i = -3; i <= 3; i++) {
      const turn = new Mesh(new CylinderGeometry(0.215, 0.215, 0.04, 32), K.metal({ color: COPPER }));
      turn.position.y = i * 0.1;
      g.add(turn);
    }
    g.add(body);
    group.add(g);
    return g;
  });
  const wires = new RibbonLines({ capacity: 64, color: COPPER, width: 0.06, intensity: 1.0, dashStrength: 0, minPixels: 2 });
  group.add(wires);
  const nodeMesh = new Mesh(new CylinderGeometry(0.12, 0.12, 0.08, 24).rotateX(Math.PI / 2), K.toon({ color: 'blue', emissive: 'blue', emissiveIntensity: 0.5 }));
  group.add(nodeMesh);
  const termMeshes = PHASE.map((c) => {
    const m = new Mesh(new CylinderGeometry(0.11, 0.11, 0.1, 24).rotateX(Math.PI / 2), K.toon({ color: c, emissive: c, emissiveIntensity: 0.4 }));
    group.add(m);
    return m;
  });
  const tTags = PHASE.map((c, k) => {
    const t = tag(`L${k + 1}`, 20, c);
    group.add(t);
    return t;
  });
  const nTag = tag('N', 20, 'blue');
  group.add(nTag);
  const node = new Vector3(0, -0.15, 0.02);
  const terminals = [new Vector3(), new Vector3(), new Vector3()];
  const d = new Vector3();
  const a = new Vector3();
  const b = new Vector3();
  const set = (delta: number): void => {
    const k = Math.max(0, Math.min(1, delta));
    const lines: { points: Vector3[] }[] = [];
    for (let i = 0; i < 3; i++) {
      // Y: coil along its spoke; Δ: coil on the side between corners i and i+1
      const yDir = dir(i, new Vector3());
      const yC = node.clone().addScaledVector(yDir, 0.72);
      const ci = dir(i, new Vector3()).multiplyScalar(R_TRI).add(node);
      const cj = dir((i + 1) % 3, new Vector3()).multiplyScalar(R_TRI).add(node);
      const dC = ci.clone().add(cj).multiplyScalar(0.5);
      const dDir = cj.clone().sub(ci).normalize();
      const c = yC.lerp(dC, k);
      d.copy(yDir).lerp(dDir, k).normalize();
      const coil = coils[i]!;
      coil.position.copy(c);
      coil.rotation.z = Math.atan2(d.y, d.x) - Math.PI / 2;
      // terminal: Y = beyond the outer end of the spoke; Δ = corner i
      terminals[i]!.copy(node).addScaledVector(yDir, 1.45).lerp(ci, k);
      termMeshes[i]!.position.copy(terminals[i]!);
      tTags[i]!.position.copy(terminals[i]!).addScaledVector(yDir, 0.32);
      // wires: coil ends to their nodes
      a.copy(c).addScaledVector(d, -COIL_L / 2);
      b.copy(c).addScaledVector(d, COIL_L / 2);
      const inner = node.clone().lerp(ci, k); // Y: neutral node; Δ: corner i
      const outer = terminals[i]!.clone().lerp(cj, k); // Y: terminal i; Δ: corner i+1
      lines.push({ points: [inner.clone(), a.clone()] }, { points: [b.clone(), outer] });
    }
    wires.setLines(lines);
    nodeMesh.position.copy(node);
    nodeMesh.scale.setScalar(Math.max(0.001, 1 - k));
    nTag.position.copy(node).add(new Vector3(0.28, -0.22, 0));
    nTag.opacity = 1 - k;
  };
  set(0);
  return { group, set, terminals, node, coils, nTag };
}
