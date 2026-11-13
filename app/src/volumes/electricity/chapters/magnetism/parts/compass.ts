/**
 * Compasses. `createCompass` — one hero compass: brass case, white card with 12 marks (north mark coral), glass
 * cover, a needle that is a little magnet (N half coral, S half blue). `addCompassBodies` adds many static
 * bodies into one builder and `createNeedles` draws all their needles as one instanced mesh (step `oersted`).
 * Needles lie along local +x; `heading` is the sim angle from east (rad): rotation.y = heading, so north
 * (π/2) points to world −z.
 */
import { InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type Group, type Object3D } from 'three';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';

/** Case, card and marks of a compass of radius `r` at the builder's current frame. */
export function addCompassBody(b: Builder, r: number, at: [number, number, number] = [0, 0, 0]): void {
  b.frame({ at }, () => {
    b.cyl(r, r * 0.26, { seg: 40, slot: 'metal', c: 'amber', bevel: r * 0.05 });
    b.cyl(r * 0.88, r * 0.03, { at: [0, r * 0.26, 0], seg: 40, c: 'white' });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      b.box(r * 0.045, r * 0.02, k % 3 ? r * 0.1 : r * 0.2, {
        at: [Math.sin(a) * r * 0.72, r * 0.29, -Math.cos(a) * r * 0.72],
        rot: [0, -a, 0],
        r: 0,
        c: k === 0 ? 'coral' : 'ink',
      });
    }
    b.cyl(r * 0.06, r * 0.16, { at: [0, r * 0.26, 0], seg: 10, slot: 'metal', c: 'mist' });
  });
}

/** Needle geometry builder (local +x = N), length 1.6·r. */
function addNeedle(b: Builder, r: number): void {
  const l = r * 0.78;
  b.cone(r * 0.12, l, { axis: 'x', seg: 4, c: SEMANTIC.poleN, s: [1, 0.3, 1] });
  b.frame({ rot: [0, Math.PI, 0] }, () => b.cone(r * 0.12, l, { axis: 'x', seg: 4, c: SEMANTIC.poleS, s: [1, 0.3, 1] }));
  b.cyl(r * 0.07, r * 0.05, { seg: 10, slot: 'metal', c: 'amber', at: [0, -r * 0.02, 0] });
}

export interface CompassModel {
  group: Group;
  needle: Object3D;
  /** Top of the card (for callouts / hotspots). */
  top: Object3D;
  heading: number;
  update(): void;
}

export function createCompass(r = 0.4): CompassModel {
  const b = new Builder('compass');
  addCompassBody(b, r);
  const nb = b.part('needle', { at: [0, r * 0.36, 0] });
  addNeedle(nb, r);
  b.anchor('top', 0, r * 0.4, 0);
  const model = b.build();
  const cover = new Mesh(new Builder('cover').cyl(r * 0.9, r * 0.02, { seg: 40 }).geometry('toon'), K.glass({ color: 'sky', opacity: 0.08, edgeOpacity: 0.4 }));
  cover.position.y = r * 0.46;
  model.group.add(cover);
  model.group.traverse((o) => ((o as Mesh).castShadow = true));
  const needle = model.part('needle');
  const self: CompassModel = {
    group: model.group,
    needle,
    top: model.anchor('top'),
    heading: Math.PI / 2,
    update() {
      needle.rotation.y = self.heading;
    },
  };
  self.update();
  return self;
}

export interface NeedleSet {
  mesh: InstancedMesh;
  /** Place needle `i` at a local point with a heading (sim angle from east). */
  set(i: number, x: number, y: number, z: number, heading: number): void;
  commit(): void;
}

/** `count` compass needles of radius `r` as one instanced mesh. */
export function createNeedles(count: number, r: number): NeedleSet {
  const b = new Builder('needles');
  addNeedle(b, r);
  const mesh = new InstancedMesh(b.geometry('toon'), b.mats.get('toon'), count);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const m4 = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const p = new Vector3();
  const one = new Vector3(1, 1, 1);
  return {
    mesh,
    set(i, x, y, z, heading) {
      mesh.setMatrixAt(i, m4.compose(p.set(x, y, z), q.setFromAxisAngle(up, heading), one));
    },
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
