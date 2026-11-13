/**
 * CopperWire — a stripped end of single-core installation wire (1,5 mm²: core ⌀ 1,38 mm) in translucent
 * insulation. The cut face sits at the group's origin and looks along +Z, so scaling the group zooms into the
 * face; the face is the grain mosaic (`grains.ts`). Toy proportions: the insulation is thicker than real.
 *
 * It is one core of an ordinary three-core house cable (`cable-end.ts`): the sheath and the two other cores
 * give the opening shot its context, and the ring of insulation that was stripped off drifts beside the tip.
 */
import { CylinderGeometry, Group, LatheGeometry, Mesh, Object3D, TorusGeometry, Vector2 } from 'three';
import type { Rng } from '@/engine/api';
import { K, isFadable } from '@/style';
import { createCableEnd } from './cable-end';
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
  /** Presence of the opening shot's context (cable end, stripped sleeve), 0…1. */
  context: number;
  /** Idle life: the stripped-off ring of insulation tumbles slowly (engine-clock seconds). */
  update(t: number): void;
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
  // the piece of insulation that was pulled off the tip: same section as the jacket, drifting beside it
  const sleeveLength = STRIPPED - 0.2;
  const sleeveProfile = [
    [r0, 0],
    [r1 - 0.06, 0],
    [r1, 0.08],
    [r1, sleeveLength - 0.08],
    [r1 - 0.06, sleeveLength],
    [r0, sleeveLength],
    [r0, 0],
  ].map(([x, y]) => new Vector2(x, y));
  const sleeveGlass = K.glass({ color: 'sky', opacity: 0.42, edgeOpacity: 0.9 });
  const sleeve = new Mesh(new LatheGeometry(sleeveProfile, 48), sleeveGlass);
  sleeve.geometry.translate(0, -sleeveLength / 2, 0);
  const cable = createCableEnd();
  for (const m of [core, face, insulation, sleeve]) m.castShadow = true;
  group.add(core, face, insulation, sleeve, cable.group, ...marks);

  const anchor = (x: number, y: number, z: number): Object3D => {
    const o = new Object3D();
    o.position.set(x, y, z);
    group.add(o);
    return o;
  };
  const g = grains.centres[3] ?? new Vector2();
  const materials = [copper, faceMaterial, jacket, ink];
  const contextMaterials = [sleeveGlass, ...cable.mats.list().filter(isFadable)];
  let fade = 1;
  let context = 1;
  const apply = (): void => {
    for (const m of materials) m.fade = fade;
    for (const m of contextMaterials) m.fade = fade * context;
    sleeve.visible = cable.group.visible = fade * context > 0.002;
  };
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
      apply();
      group.visible = v > 0.002;
    },
    get context() {
      return context;
    },
    set context(v: number) {
      context = v;
      apply();
    },
    update(t) {
      sleeve.position.set(0.3 + Math.sin(t * 0.4) * 0.12, 1.9 + Math.sin(t * 0.6) * 0.16, -2.4);
      sleeve.rotation.set(1.1 + t * 0.21, 0.4 + Math.sin(t * 0.3) * 0.5, t * 0.13);
    },
  };
}
