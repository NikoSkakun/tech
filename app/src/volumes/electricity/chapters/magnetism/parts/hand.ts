/**
 * Cues for the right- / left-hand rules. `createCurlCue` — the right-hand grip rule as the textbook icon: a
 * bold `magenta` curl arrow round the wire whose sense is **B** when the current (the step's `yellow` arrow,
 * the "thumb") points up local +y; counter-clockwise seen from above. (A glass grip hand built from
 * primitives read as a blob at the step's camera distance — P-magnetism punch list item 4.)
 * `createLeftHand` — a holographic open left hand for the Ampère force.
 */
import { ConeGeometry, Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';

export function handMaterial() {
  return K.glass({ color: 'sky', opacity: 0.38, edgeOpacity: 0.95 });
}

/** Curl arrow of radius `r` round the local y axis. */
export function createCurlCue(r = 0.3): Group {
  const g = new Group();
  g.name = 'curl-cue';
  const mat = K.glow({ color: SEMANTIC.fieldB, intensity: 1.6, falloff: 0, whiten: 0.15, keepHue: true });
  const arc = Math.PI * 1.55;
  const start = Math.PI * 0.2;
  const end = start + arc;
  // TorusGeometry draws its arc in XY from angle 0; laid flat (x = −π/2) it runs counter-clockwise from +y
  const ring = new Mesh(new TorusGeometry(r, r * 0.09, 8, 48, arc), mat);
  ring.rotation.set(-Math.PI / 2, 0, start, 'XYZ');
  // arrowhead at the end of the arc, along the counter-clockwise tangent (−sin a, 0, −cos a)
  const head = new Mesh(new ConeGeometry(r * 0.27, r * 0.62, 16), mat);
  head.position.set(Math.cos(end) * r, 0, -Math.sin(end) * r);
  head.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(-Math.sin(end), 0, -Math.cos(end)));
  g.add(ring, head);
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
