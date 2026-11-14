import { ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, LatheGeometry, Mesh, TorusGeometry, Vector2, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { K, col, type ColorLike } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a little floating island with a cooling tower
 * and a stack (one vertex-coloured mesh), circled by the glowing world ring — the archipelago of power plants
 * feeding one grid.
 */
export default function emblem(): Group {
  const g = new Group();
  const parts: BufferGeometry[] = [];
  const top = new CylinderGeometry(0.62, 0.6, 0.12, 40);
  paint(top, 'green');
  parts.push(top);
  const rock = new ConeGeometry(0.6, 0.55, 40);
  rock.rotateX(Math.PI);
  rock.translate(0, -0.33, 0);
  paint(rock, 'bg.plum');
  parts.push(rock);
  // hyperbolic cooling tower (lathe, bottom → top)
  const prof = [[0.2, 0], [0.15, 0.22], [0.13, 0.36], [0.15, 0.48]].map(([r, y]) => new Vector2(r, y));
  const tower = new LatheGeometry(prof, 32);
  tower.translate(-0.18, 0.06, 0.05);
  paint(tower, 'mist');
  parts.push(tower);
  const stack = new CylinderGeometry(0.035, 0.05, 0.62, 16);
  stack.translate(0.24, 0.37, -0.12);
  paint(stack, 'coral');
  parts.push(stack);
  const hall = new CylinderGeometry(0.16, 0.16, 0.2, 4);
  hall.rotateY(Math.PI / 4);
  hall.translate(0.18, 0.16, 0.18);
  paint(hall, 'amber');
  parts.push(hall);
  const body = new Mesh(mergeGeometries(parts), K.toon({ vertexColors: true, gloss: 0.3 }));
  const ring = new Mesh(new TorusGeometry(0.86, 0.045, 12, 64), K.glow({ color: 'yellow', intensity: 1.6, keepHue: true, whiten: 0.1 }));
  ring.rotation.x = Math.PI / 2 - 0.35;
  ring.position.y = 0.05;
  g.add(body, ring);
  g.rotation.set(0.2, -0.5, 0);
  return g;
}

function paint(geo: BufferGeometry, token: ColorLike): void {
  const c = col(token);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3));
}
