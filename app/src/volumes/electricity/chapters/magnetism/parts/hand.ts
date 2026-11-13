/**
 * A holographic hand for the right- / left-hand rules: a softly glowing glass hand built from rounded
 * primitives. `createGripHand` — the right-hand grip rule: the thumb points up the local +y axis (along the
 * conventional current), the four fingers curl around the axis counter-clockwise seen from above (the sense
 * of **B**). The hand wraps a conductor of radius ≈ `r` at the origin.
 */
import { Group, Mesh, TorusGeometry } from 'three';
import { Builder } from '@/kit';
import { K } from '@/style';

export function handMaterial() {
  return K.glass({ color: 'sky', opacity: 0.38, edgeOpacity: 0.95 });
}

export function createGripHand(r = 0.12): Group {
  const g = new Group();
  g.name = 'grip-hand';
  const mat = handMaterial();
  const b = new Builder('hand');
  // palm: a rounded block hugging the conductor from the back (−x side), thumb up along +y
  b.box(r * 1.5, r * 3.2, r * 2.6, { at: [-r * 1.9, -r * 1.6, 0], r: r * 0.6 });
  b.capsule(r * 0.42, r * 2.6, { at: [-r * 1.15, r * 1.6, 0] });
  b.sphere(r * 0.5, { at: [-r * 1.2, r * 0.25, 0] });
  b.box(r * 1.1, r * 1.6, r * 1.8, { at: [-r * 2.5, -r * 4.0, 0], r: r * 0.4 });
  g.add(new Mesh(b.geometry('toon'), mat));
  // four curled fingers: partial tori around the axis, stacked under the thumb
  for (let k = 0; k < 4; k++) {
    const f = new Mesh(new TorusGeometry(r * 1.35, r * 0.36, 10, 28, Math.PI * 1.45), mat);
    f.rotation.x = -Math.PI / 2;
    // start behind the conductor (palm side) and curl counter-clockwise seen from +y
    f.rotation.z = Math.PI * 0.8;
    f.position.y = -r * (0.2 + k * 0.78);
    f.scale.setScalar(1 - k * 0.05);
    g.add(f);
  }
  return g;
}

/**
 * A flat open left hand for the left-hand rule: palm normal local +y, four fingers along +z, thumb sticking
 * out along +x (= n × f for a left hand). Orient it so that **B** enters the palm (B = −n), the fingers follow
 * the current; the thumb then shows the Ampère force.
 */
export function createLeftHand(s = 0.12): Group {
  const g = new Group();
  g.name = 'left-hand';
  const b = new Builder('left-hand');
  b.box(s * 3.2, s * 0.9, s * 3.4, { at: [0, 0, 0], r: s * 0.4, mid: true });
  for (let k = 0; k < 4; k++) b.capsule(s * 0.36, s * (3.0 - Math.abs(k - 1.4) * 0.35), { axis: 'z', at: [-s * 1.15 + k * s * 0.76, 0, s * 2.9], seg: 10 });
  b.capsule(s * 0.42, s * 2.4, { axis: 'x', at: [s * 2.7, 0, -s * 0.4], seg: 10 });
  b.box(s * 1.8, s * 0.8, s * 1.4, { at: [0, 0, -s * 2.2], r: s * 0.35, mid: true });
  g.add(new Mesh(b.geometry('toon'), handMaterial()));
  return g;
}
