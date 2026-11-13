/**
 * CopperWire — a stripped end of single-core installation wire (1,5 mm²: core ⌀ 1,38 mm) in translucent
 * insulation. The cut face sits at the group's origin and looks along +Z, so scaling the group zooms into the
 * face; the face is the grain mosaic (`grains.ts`). Toy proportions: the insulation is thicker than real.
 */
import { CylinderGeometry, Group, LatheGeometry, Mesh, Object3D, TorusGeometry, Vector2 } from 'three';
import type { Rng } from '@/engine/api';
import { K } from '@/style';
import { createGrainField } from './grains';

export const WIRE_CORE_RADIUS = 0.42;
const LENGTH = 16;
/** Length of bare copper sticking out of the insulation. */
const STRIPPED = 1.5;

export interface CopperWire {
  group: Group;
  /** Anchors for annotations. */
  insulationAnchor: Object3D;
  bodyAnchor: Object3D;
  /** World-space anchor of a crystallite near the middle of the face. */
  grainAnchor: Object3D;
  /** Dithered dissolve of the whole wire, 0…1. */
  fade: number;
}

export function createCopperWire(rng: Rng): CopperWire {
  const group = new Group();
  group.name = 'copper-wire';
  const copper = K.metal({
    color: 'orange',
    gradient: { bottom: 'orange.dark', top: 'amber', range: [-0.5, 0.5] },
  });
  const core = new Mesh(
    new CylinderGeometry(WIRE_CORE_RADIUS, WIRE_CORE_RADIUS, LENGTH, 56, 1, true),
    copper,
  );
  core.rotation.x = Math.PI / 2;
  core.position.z = -LENGTH / 2;

  const grains = createGrainField(rng);
  const faceMaterial = K.metal({ color: 'white', vertexColors: true, specular: 0.45, shininess: 30 });
  const face = new Mesh(grains.geometry, faceMaterial);
  face.scale.setScalar(WIRE_CORE_RADIUS);

  // insulation: thick-walled tube with a rounded lip, lathed from a closed profile (outer wall up, inner wall down)
  const r0 = WIRE_CORE_RADIUS + 0.035;
  const r1 = 0.76;
  const lip = -STRIPPED;
  const profile = [
    [r1, -LENGTH],
    [r1, lip - 0.16],
    [r1 - 0.03, lip - 0.07],
    [r1 - 0.1, lip - 0.015],
    [r1 - 0.17, lip],
    [r0 + 0.06, lip],
    [r0, lip - 0.06],
    [r0, -LENGTH],
  ].map(([x, y]) => new Vector2(x, y));
  const jacket = K.glass({ color: 'sky', opacity: 0.42, edgeOpacity: 0.9 });
  const insulation = new Mesh(new LatheGeometry(profile, 64), jacket);
  insulation.rotation.x = Math.PI / 2;

  // tertiary detail: print marks on the jacket (two thin light rings every few units)
  const ink = K.toon({ color: 'white', emissive: 'white', emissiveIntensity: 0.25 });
  const ring = new TorusGeometry(r1 + 0.004, 0.014, 8, 64);
  const marks: Mesh[] = [];
  for (const z of [-3.4, -3.62, -8.4, -8.62, -13.4, -13.62]) {
    const mark = new Mesh(ring, ink);
    mark.position.z = z;
    marks.push(mark);
  }
  for (const m of [core, face, insulation]) m.castShadow = true;
  group.add(core, face, insulation, ...marks);

  const anchor = (x: number, y: number, z: number): Object3D => {
    const o = new Object3D();
    o.position.set(x, y, z);
    group.add(o);
    return o;
  };
  const g = grains.centres[3] ?? new Vector2();
  const materials = [copper, faceMaterial, jacket, ink];
  let fade = 1;
  return {
    group,
    insulationAnchor: anchor(0, r1, lip - 2.2),
    bodyAnchor: anchor(0, WIRE_CORE_RADIUS, -STRIPPED * 0.5),
    grainAnchor: anchor(g.x * WIRE_CORE_RADIUS, g.y * WIRE_CORE_RADIUS, 0),
    get fade() {
      return fade;
    },
    set fade(v: number) {
      fade = v;
      for (const m of materials) m.fade = v;
      group.visible = v > 0.002;
    },
  };
}
