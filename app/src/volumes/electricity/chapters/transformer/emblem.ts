import { ExtrudeGeometry, Group, Mesh, Path, Shape, TorusGeometry } from 'three';
import { K } from '@/style';
import { COPPER_PRIMARY, COPPER_SECONDARY } from './world';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a rectangular steel core frame with a
 * coral-copper coil on the left limb and a sky-copper coil on the right — the teaching transformer of the chapter.
 */
export default function emblem(): Group {
  const g = new Group();
  // core: a rounded rectangular frame with a window, extruded to a slab
  const outer = new Shape();
  roundRect(outer, 0.62, 0.72, 0.1);
  const hole = new Path();
  roundRect(hole, 0.36, 0.46, 0.04);
  outer.holes.push(hole);
  const geo = new ExtrudeGeometry(outer, { depth: 0.3, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -0.15);
  const core = new Mesh(geo, K.metal({ color: 'steel', specular: 0.7 }));
  // two coils: a stack of thick rings on each vertical limb, merged as one torus pair per side
  const coil = (color: typeof COPPER_PRIMARY, x: number): Mesh => {
    const m = new Mesh(new TorusGeometry(0.2, 0.09, 12, 28), K.metal({ color, specular: 0.85, shininess: 60 }));
    m.rotation.x = Math.PI / 2;
    m.scale.set(1, 1, 2.6);
    m.position.set(x, 0, 0);
    return m;
  };
  g.add(core, coil(COPPER_PRIMARY, -0.49), coil(COPPER_SECONDARY, 0.49));
  g.rotation.set(0.2, -0.4, 0);
  return g;
}

/** Rounded rectangle centred on the origin (half sizes `hx`, `hy`). */
function roundRect(p: Shape | Path, hx: number, hy: number, r: number): void {
  p.moveTo(-hx + r, -hy);
  p.lineTo(hx - r, -hy);
  p.quadraticCurveTo(hx, -hy, hx, -hy + r);
  p.lineTo(hx, hy - r);
  p.quadraticCurveTo(hx, hy, hx - r, hy);
  p.lineTo(-hx + r, hy);
  p.quadraticCurveTo(-hx, hy, -hx, hy - r);
  p.lineTo(-hx, -hy + r);
  p.quadraticCurveTo(-hx, -hy, -hx + r, -hy);
}
