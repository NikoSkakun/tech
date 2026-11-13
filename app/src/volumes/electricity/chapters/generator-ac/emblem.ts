import { Float32BufferAttribute, Group, Mesh, TorusGeometry, CylinderGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { K, SEMANTIC, col, type ColorLike } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a stator ring with three coils at 120° in
 * the phase colours (one vertex-coloured mesh), a two-pole rotor (coral N / blue S) and one glowing period of
 * the sine across the front.
 */
export default function emblem(): Group {
  const g = new Group();
  // stator ring + coils merged, coloured per vertex
  const parts: BufferGeometry[] = [];
  const ring = new TorusGeometry(0.62, 0.13, 16, 48);
  paint(ring, 'steel');
  parts.push(ring);
  [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3].forEach((c, k) => {
    const coil = new CylinderGeometry(0.16, 0.16, 0.3, 20);
    const a = Math.PI / 2 - (k * 2 * Math.PI) / 3;
    coil.rotateZ(Math.PI / 2 - a);
    coil.translate(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0);
    paint(coil, c);
    parts.push(coil);
  });
  const stator = new Mesh(mergeGeometries(parts), K.toon({ vertexColors: true, gloss: 0.4 }));
  // rotor: two half cylinders
  const n = new CylinderGeometry(0.2, 0.2, 0.36, 24, 1, false, 0, Math.PI);
  paint(n, SEMANTIC.poleN);
  const s = new CylinderGeometry(0.2, 0.2, 0.36, 24, 1, false, Math.PI, Math.PI);
  paint(s, SEMANTIC.poleS);
  const rotor = new Mesh(mergeGeometries([n, s]), K.toon({ vertexColors: true, gloss: 0.6 }));
  rotor.rotation.x = Math.PI / 2;
  rotor.rotation.y = 0.5;
  const wave = new Mesh(
    mergeGeometries([halfWave(-0.2, 1), halfWave(0.2, -1)]),
    K.glow({ color: SEMANTIC.current, intensity: 1.7, keepHue: true, whiten: 0.1 }),
  );
  wave.position.z = 0.32;
  g.add(stator, rotor, wave);
  g.rotation.set(0.15, -0.4, 0);
  return g;
}

function halfWave(x: number, dir: 1 | -1): TorusGeometry {
  const t = new TorusGeometry(0.2, 0.045, 10, 24, Math.PI);
  if (dir < 0) t.rotateZ(Math.PI);
  t.translate(x, 0, 0);
  return t;
}

function paint(geo: BufferGeometry, token: ColorLike): void {
  const c = col(token);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3));
}
