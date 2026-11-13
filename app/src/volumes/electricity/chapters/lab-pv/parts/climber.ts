/**
 * The MPPT «альпініст» (step 10): a capsule figure with a helmet and a `cyan` head-lamp — the operating point
 * walking on the P-V ridge — plus the decision arrow over its head (`green` = "power grew, keep going",
 * `red` = "power fell, turn around") and the flags it plants during a global scan.
 */
import { Group, InstancedMesh, Matrix4, Mesh, type Object3D, type Vector3 } from 'three';
import { createHalo } from '@/fx';
import { Builder } from '@/kit';
import { K } from '@/style';
import { shadows } from '../world';

export interface Climber {
  /** The figure with its arrow — move it with `place`. */
  group: Group;
  /** The figure (anchor for the hotspot and the QA probe). */
  body: Object3D;
  /** Scan flags, in the mountain's frame (add it next to the ridge, not under the figure). */
  flags: InstancedMesh;
  /** Place the figure on a ridge point; `lean` −1…1 tilts it toward the walking direction. */
  place(at: Vector3, lean: number, t: number): void;
  /** Decision arrow: direction ±1 along the voltage axis, `good` picks green / red; 0 hides it. */
  decide(direction: number, good: boolean): void;
  /** Flags of a global scan: show the first `count` of the given ridge points (the best one is taller). */
  setFlags(points: readonly Vector3[], count: number, best: number): void;
}

const FLAGS = 41;

export function createClimber(): Climber {
  const group = new Group();
  group.name = 'climber';
  const b = new Builder('climber');
  b.capsule(0.11, 0.2, { seg: 16, slot: 'gloss', c: ['coral.dark', 'coral'], at: [0, 0.11, 0] });
  b.sphere(0.1, { seg: 18, slot: 'gloss', c: 'white', at: [0, 0.5, 0] });
  b.sphere(0.105, { seg: 18, slot: 'gloss', c: 'sky', at: [0, 0.535, 0], s: [1, 0.62, 1] }); // helmet
  b.box(0.05, 0.26, 0.05, { r: 0.02, c: 'slate', at: [-0.13, 0.12, 0.02], rot: [0, 0, 0.5] });
  b.box(0.05, 0.2, 0.05, { r: 0.02, c: 'slate', at: [0.12, 0.14, 0.02], rot: [0, 0, -0.4] });
  const body = shadows(b.build().group);
  body.scale.setScalar(1.7);
  const lamp = createHalo({ color: 'cyan', size: 0.5, intensity: 1.5, amount: 0.3 });
  lamp.position.set(0, 0.56, 0.11);
  body.add(lamp);
  group.add(body);

  // decision arrow: one geometry (pointing +X), a green and a red mesh
  const arrowGeo = new Builder('arrow')
    .cone(0.09, 0.22, { seg: 12, axis: 'x' })
    .box(0.2, 0.07, 0.07, { r: 0.02, mid: true, at: [-0.1, 0, 0] })
    .geometry('toon');
  const arrow = new Group();
  const good = new Mesh(arrowGeo, K.glow({ color: 'green', intensity: 1.6, keepHue: true, whiten: 0 }));
  const bad = new Mesh(arrowGeo, K.glow({ color: 'red', intensity: 1.6, keepHue: true, whiten: 0 }));
  arrow.add(good, bad);
  arrow.position.y = 1.45;
  arrow.scale.setScalar(1.5);
  arrow.visible = false;
  group.add(arrow);

  const flagGeo = new Builder('flag')
    .box(0.015, 0.3, 0.015, { r: 0, c: 'mist' })
    .box(0.12, 0.08, 0.01, { r: 0, c: 'yellow', at: [0.065, 0.21, 0] })
    .geometry('toon');
  const flags = new InstancedMesh(flagGeo, K.toon({ color: 'white', vertexColors: true }), FLAGS);
  flags.count = 0;
  flags.frustumCulled = false;
  const m4 = new Matrix4();

  return {
    group,
    body,
    flags,
    place(at, lean, t) {
      group.position.copy(at);
      body.rotation.z = -lean * 0.22;
      body.position.y = Math.abs(Math.sin(t * 5)) * 0.03; // keeps treading
    },
    decide(direction, isGood) {
      arrow.visible = direction !== 0;
      good.visible = isGood;
      bad.visible = !isGood;
      arrow.rotation.y = direction < 0 ? Math.PI : 0;
    },
    setFlags(points, count, best) {
      flags.count = Math.min(count, points.length, FLAGS);
      for (let i = 0; i < flags.count; i++) {
        const s = i === best ? 1.7 : 1;
        flags.setMatrixAt(i, m4.makeScale(s, s, s).setPosition(points[i]!));
      }
      flags.instanceMatrix.needsUpdate = true;
    },
  };
}
