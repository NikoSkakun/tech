/**
 * The floor of the machine hall: a soft `slate` disc with a degree scale around its rim (0…360°, a tick every
 * 5°, longer every 30°, a glowing `teal` mark at 0°) — the chapter's recurring "angle" motif. The tick ring
 * turns slowly when `spin` is set (the rotor angle of the step on screen can be mirrored on it).
 */
import { CylinderGeometry, Group, InstancedMesh, LatheGeometry, Matrix4, Mesh, Quaternion, Vector2, Vector3, Euler } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { K } from '@/style';
import { FLOOR_R } from '../world';

export interface Turntable {
  group: Group;
  /** The tick ring (rotate it about Y to echo a rotor angle). */
  ring: Group;
}

export function createTurntable(): Turntable {
  const group = new Group();
  group.name = 'turntable';
  // disc with a rounded rim: lathe profile bottom → top (normals outward)
  const r = FLOOR_R;
  const h = 0.16;
  const profile: Vector2[] = [new Vector2(0, -0.02), new Vector2(r - 0.05, -0.02)];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    profile.push(new Vector2(r - 0.08 + Math.cos(a) * 0.08, h / 2 + Math.sin(a) * (h / 2 + 0.01)));
  }
  profile.push(new Vector2(0, h));
  const disc = new Mesh(
    new LatheGeometry(profile, 96),
    K.toon({ gradient: { bottom: 'bg.indigo', top: 'slate', range: [-0.02, h] }, rim: 0.6, highlight: 0.15 }),
  );
  disc.receiveShadow = true;
  group.add(disc);
  // inner inset where the machines stand (slightly darker)
  const inset = new Mesh(new CylinderGeometry(r * 0.78, r * 0.78, 0.02, 96), K.toon({ color: 'slate', rim: 0.3, highlight: 0.1 }));
  inset.position.y = h + 0.005;
  inset.receiveShadow = true;
  group.add(inset);

  const ring = new Group();
  ring.position.y = h;
  group.add(ring);
  const tick = new RoundedBoxGeometry(0.035, 0.02, 1, 2, 0.008);
  const ticks = new InstancedMesh(tick, K.toon({ color: 'mist', emissive: 'mist', emissiveIntensity: 0.25 }), 72);
  const m = new Matrix4();
  const q = new Quaternion();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const major = i % 6 === 0;
    const len = major ? 0.42 : 0.2;
    const rr = r * 0.86 + len / 2;
    q.setFromEuler(new Euler(0, -a + Math.PI / 2, 0));
    m.compose(new Vector3(Math.cos(a) * rr, 0.012, Math.sin(a) * rr), q, new Vector3(major ? 1.6 : 1, 1, len));
    ticks.setMatrixAt(i, m);
  }
  ring.add(ticks);
  const zero = new Mesh(new RoundedBoxGeometry(0.09, 0.03, 0.6, 2, 0.015), K.glow({ color: 'teal', intensity: 1.5, keepHue: true, whiten: 0 }));
  zero.position.set(r * 0.86 + 0.3, 0.015, 0);
  zero.rotation.y = Math.PI / 2;
  ring.add(zero);
  return { group, ring };
}
