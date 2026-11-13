import { Group, Mesh, TorusGeometry } from 'three';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a horseshoe magnet with N (coral) and
 * S (blue) pole tips and a glowing magenta field arc jumping between them — «магнетизм».
 */
export default function emblem(): Group {
  const g = new Group();
  const b = new Builder('magnetism-emblem');
  // the bend: a half ring of steel; the legs; pole tips in the semantic colours
  b.add(new TorusGeometry(0.42, 0.17, 14, 32, Math.PI), { c: 'steel', at: [0, 0.12, 0] });
  for (const [x, c] of [
    [-0.42, SEMANTIC.poleN],
    [0.42, SEMANTIC.poleS],
  ] as const) {
    b.cyl(0.17, 0.42, { seg: 20, c: 'steel', at: [x, -0.3, 0] });
    b.cyl(0.175, 0.2, { seg: 20, c, at: [x, -0.5, 0], bevel: 0.03 });
  }
  const magnet = new Mesh(b.geometry('toon'), b.mats.get('toon'));
  const arc = new Mesh(
    new TorusGeometry(0.42, 0.045, 10, 40, Math.PI),
    K.glow({ color: SEMANTIC.fieldB, intensity: 1.6, falloff: 0, whiten: 0, keepHue: true }),
  );
  arc.rotation.z = Math.PI;
  arc.position.set(0, -0.5, 0.05);
  arc.scale.set(1, 0.55, 1);
  g.add(magnet, arc);
  g.position.y = 0.18;
  return g;
}
