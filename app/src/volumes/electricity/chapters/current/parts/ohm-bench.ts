/**
 * Step 4 test rig: two clamp posts with a wire sample stretched between them. The sample's look follows the
 * sliders — colour = material, thickness ∝ √A (log-mapped), and the length shows as turns on a spool in the
 * middle (a 10 m sample would not fit the table: «не в масштабі»). `glow` (0…1) is the Joule heating from the
 * simulation (`orange` along the heat ramp). Terminals `a` (left post) / `b` (right post) at table level on the back side; `va` / `vb` on the front (voltmeter).
 */
import { CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, TorusGeometry, type Object3D } from 'three';
import { applyHeat } from '@/fx';
import { Builder } from '@/kit';
import { K, col, type ColorLike } from '@/style';
import type { BenchMaterial } from '@electricity/sim/current';

export interface OhmBench {
  group: Group;
  a: Object3D;
  b: Object3D;
  /** Second pair of terminals (front side) for the voltmeter. */
  va: Object3D;
  vb: Object3D;
  /** Middle of the sample; the spool. */
  sample: Object3D;
  spool: Object3D;
  /** The wire sample with its spool (an actor: hidden when the lamp is the sample). */
  wire: Group;
  set(material: BenchMaterial, lengthM: number, areaMm2: number, glow: number): void;
}

export const OHM_RIG = { x0: -1.5, x1: 1.5, y: 0.95 } as const;
const TINT: Record<BenchMaterial, ColorLike> = { Cu: 'orange', Al: 'mist', Fe: 'steel', NiCr: 'slate' };
const MAX_TURNS = 14;

export function createOhmBench(): OhmBench {
  const { x0, x1, y } = OHM_RIG;
  const b = new Builder('ohm-rig');
  b.box(x1 - x0 + 1.3, 0.1, 1.0, { r: 0.04, c: ['ink', 'slate'] });
  for (const x of [x0, x1]) {
    b.box(0.3, y - 0.05, 0.3, { at: [x, 0.1, 0], r: 0.05, c: ['slate', 'steel'] });
    b.box(0.36, 0.2, 0.36, { at: [x, y - 0.1, 0], r: 0.05, slot: 'metal', c: 'amber' }); // jaw
    b.cyl(0.07, 0.16, { at: [x, y + 0.1, 0], seg: 14, slot: 'gloss', c: 'coral' }); // thumb screw
    for (const z of [-0.4, 0.4]) b.cyl(0.085, 0.14, { at: [x, 0.1, z], seg: 16, slot: 'metal', c: 'mist' }); // terminals
  }
  b.box(0.5, 0.36, 0.5, { at: [0, 0.1, 0], r: 0.06, c: 'slate' }); // spool stand
  b.anchor('a', x0, 0.16, -0.4)
    .anchor('b', x1, 0.16, -0.4)
    .anchor('va', x0, 0.16, 0.4)
    .anchor('vb', x1, 0.16, 0.4)
    .anchor('sample', 0.75, y, 0)
    .anchor('spool', 0, y + 0.42, 0);
  const model = b.build();

  // sample: unit-radius parts scaled per frame (one material so that it heats and tints as one piece)
  const mat = K.metal({ color: 'slate', specular: 0.6 });
  const wire = new Mesh(new CylinderGeometry(1, 1, x1 - x0, 14).rotateZ(Math.PI / 2), mat);
  wire.position.set(0, y, 0);
  const ringGeo = (r: number): TorusGeometry =>
    new TorusGeometry(0.3, r, 8, 32).rotateY(Math.PI / 2) as TorusGeometry;
  const turns = new InstancedMesh(ringGeo(0.04), mat, MAX_TURNS);
  const flange = new CylinderGeometry(0.42, 0.42, 0.04, 28).rotateZ(Math.PI / 2);
  const dark = K.toon({ color: 'ink' });
  const sampleGroup = new Group();
  sampleGroup.name = 'sample';
  const f1 = new Mesh(flange, dark);
  const f2 = new Mesh(flange, dark);
  sampleGroup.add(wire, turns, f1, f2);
  model.group.add(sampleGroup);
  for (const m of [wire, turns, f1, f2]) m.castShadow = true;

  const m4 = new Matrix4();
  const tint = col('slate');
  let key = '';
  return {
    group: model.group,
    a: model.anchor('a'),
    b: model.anchor('b'),
    va: model.anchor('va'),
    vb: model.anchor('vb'),
    sample: model.anchor('sample'),
    spool: model.anchor('spool'),
    wire: sampleGroup,
    set(material, lengthM, areaMm2, glow) {
      applyHeat(mat, glow, 2.4);
      const k = `${material}|${lengthM}|${areaMm2}`;
      if (k === key) return;
      key = k;
      mat.color.copy(col(TINT[material], tint));
      // A: 0,01…1 mm² → radius 0.018…0.075 (∝ √A would span ×10; the log map keeps the thin wire visible)
      const r = 0.018 + 0.057 * ((Math.log10(areaMm2) + 2) / 2);
      wire.scale.set(1, r, r);
      // L: 0,1…10 m → 0…14 turns on the spool (log), so the picture changes all along the slider
      const n = Math.round(((Math.log10(lengthM) + 1) / 2) * MAX_TURNS);
      const pitch = Math.max(2.2 * r, 0.05);
      const half = ((n - 1) * pitch) / 2;
      turns.geometry.dispose();
      turns.geometry = ringGeo(r); // the wire radius changes only while a slider moves
      for (let i = 0; i < MAX_TURNS; i++) {
        const s = i < n ? 1 : 0;
        turns.setMatrixAt(i, m4.makeScale(s, s, s).setPosition(-half + i * pitch, y, 0));
      }
      turns.instanceMatrix.needsUpdate = true;
      turns.visible = n > 0;
      f1.position.set(-half - pitch, y, 0);
      f2.position.set(half + pitch, y, 0);
      f1.visible = f2.visible = n > 0;
    },
  };
}
