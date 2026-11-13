/**
 * A round analogue panel meter (ammeter / voltmeter / frequency meter) on a short post: dark bezel, light face
 * with a scale arc, a needle that swings over ±50° (`setNeedle(0…1)`), and a coloured ring that marks what it
 * measures. The face looks toward +Z. Origin = foot of the post on the floor (or the back of the case with
 * `post: false`, for consoles). The numbers are a world tag (`tag`) placed by the step.
 */
import { CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { G } from '@/kit';
import { K, type ColorLike } from '@/style';

export interface Meter {
  group: Group;
  needle: Group;
  /** Needle position 0 (left end of the scale) … 1 (right end). */
  setNeedle(v: number): void;
  /** Local point just above the face (for the value tag). */
  label: Vector3;
  /** Local centre of the face. */
  face: Vector3;
}

export function createMeter(o: { ring?: ColorLike; size?: number; post?: number | false } = {}): Meter {
  const s = o.size ?? 0.42;
  const postH = o.post === false ? 0 : (o.post ?? 0.7);
  const group = new Group();
  group.name = 'meter';
  if (postH > 0) {
    const post = new Mesh(G.cyl(0.05, postH, { seg: 12 }), K.metal({ color: 'slate' }));
    const foot = new Mesh(G.cyl(0.18, 0.06, { seg: 24 }), K.toon({ color: 'ink' }));
    post.castShadow = true;
    group.add(post, foot);
  }
  const head = new Group();
  head.position.y = postH + s;
  group.add(head);
  const case_ = new Mesh(new CylinderGeometry(s, s * 1.04, 0.16, 40).rotateX(Math.PI / 2), K.toon({ color: 'ink', rim: 0.8 }));
  case_.castShadow = true;
  const ring = new Mesh(G.ring(s * 0.98, 0.03, 48, 6).rotateX(Math.PI / 2), K.toon({ color: o.ring ?? 'teal', emissive: o.ring ?? 'teal', emissiveIntensity: 0.4, keepHue: true }));
  ring.position.z = 0.08;
  const face = new Mesh(new CylinderGeometry(s * 0.88, s * 0.88, 0.02, 40).rotateX(Math.PI / 2), K.toon({ color: 'white', highlight: 0.1 }));
  face.position.z = 0.08;
  head.add(case_, ring, face);
  // scale ticks over ±50°
  for (let i = 0; i <= 10; i++) {
    const a = ((-50 + i * 10) * Math.PI) / 180;
    const tick = new Mesh(new RoundedBoxGeometry(0.012, i % 5 === 0 ? 0.09 : 0.05, 0.01, 1, 0.004), K.toon({ color: 'ink' }));
    const r = s * 0.7;
    tick.position.set(Math.sin(a) * r, Math.cos(a) * r - s * 0.25, 0.1);
    tick.rotation.z = -a;
    head.add(tick);
  }
  const needle = new Group();
  needle.position.set(0, -s * 0.25, 0.11);
  const blade = new Mesh(new RoundedBoxGeometry(0.018, s * 0.78, 0.01, 1, 0.005).translate(0, s * 0.39, 0), K.toon({ color: 'coral' }));
  const hub = new Mesh(new CylinderGeometry(0.035, 0.035, 0.03, 16).rotateX(Math.PI / 2), K.toon({ color: 'ink' }));
  needle.add(blade, hub);
  head.add(needle);
  return {
    group,
    needle,
    setNeedle(v: number) {
      const k = Math.max(-0.05, Math.min(1.05, v));
      needle.rotation.z = -((-50 + 100 * k) * Math.PI) / 180;
    },
    label: new Vector3(0, postH + s * 2 + 0.22, 0),
    face: new Vector3(0, postH + s, 0.1),
  };
}
