/**
 * Step 3 rig on the stand: a cross-section of a dam standing on its rock foundation, the reservoir water
 * behind it (a glass block up to the level), the triangle of `blue` pressure arrows that lengthen with depth,
 * and for scale a person and a 10-storey house. The section morphs between the four types (`dam-profiles.ts`,
 * 0.8 s): gravity, arch (+ a small plan view of the arch between two rock banks), embankment (with its clay
 * core) and the low run-of-river weir (+ its powerhouse standing in line with the weir). The grout curtain is a
 * row of cement columns under the heel; the inspection gallery a lit tunnel in the body.
 * Toy scale: 0,4 toy metres per real metre (`S`). Origin: foot of the upstream face on the rock top.
 */
import { BufferGeometry, Group, Mesh, Shape, Vector3, CylinderGeometry, ConeGeometry } from 'three';
import { K } from '@/style';
import { Builder, G } from '@/kit';
import {
  CORE,
  DAM_HEIGHT,
  PROFILES,
  blend,
  resample,
  upstreamFaceX,
  type DamType,
  type Pt,
} from './dam-profiles';

export const S = 0.4;
const N = 64;
const DEPTH = 30;
const UPSTREAM = -112; // m: where the water block ends
/** Arrow length per toy metre of depth (the pressure diagram is a triangle: p ∝ depth). */
const ARROW = 0.42;

const shape = (pts: readonly Pt[]): Shape => {
  const s = new Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x * S, y * S) : s.lineTo(x * S, y * S)));
  s.closePath();
  return s;
};

export interface DamSection {
  group: Group;
  /** Current blended state: the type shown, morph progress, water level as a fraction of the dam height. */
  set(from: DamType, to: DamType, t: number, levelFrac: number): void;
  /** Anchors (local → world through the group): grout curtain, gallery, person, house, crest, bottom of the water. */
  at(
    name: 'grout' | 'gallery' | 'person' | 'house' | 'crest' | 'bottom' | 'core' | 'plan',
    out: Vector3,
  ): Vector3;
  update(t: number): void;
}

export function buildDamSection(): DamSection {
  const group = new Group();
  group.name = 'dam-section';
  const concrete = K.toon({ color: 'mist' });
  const clay = K.toon({ color: 'amber.dark' });
  // concrete for gravity / arch / weir, earth and rock fill for the embankment (swapped mid-morph)
  const earth = K.toon({
    color: 'amber.light',
    gradient: { bottom: 'amber.dark', top: 'amber.light', range: [0, 40] },
  });
  const body = new Mesh(new BufferGeometry(), concrete);
  const core = new Mesh(new BufferGeometry(), clay);
  const water = new Mesh(new BufferGeometry(), K.glass({ color: 'sky', opacity: 0.38 }));
  const sheet = new Mesh(new BufferGeometry(), K.glass({ color: 'sky', opacity: 0.75 }));
  group.add(body, core, water, sheet);
  // inspection gallery: a lit tunnel mouth on the cut face (moves with the upstream face of the type shown)
  const gallery = new Group();
  const hole = new Mesh(new CylinderGeometry(1.1, 1.1, 0.4, 16), K.toon({ color: 'ink' }));
  hole.rotation.x = Math.PI / 2;
  const lamp = new Mesh(
    new CylinderGeometry(0.3, 0.3, 0.5, 8),
    K.glow({ color: 'yellow', intensity: 1.4, keepHue: true }),
  );
  lamp.rotation.x = Math.PI / 2;
  lamp.position.y = 0.6;
  gallery.add(hole, lamp);
  group.add(gallery);
  // rock foundation, grout curtain (cement columns going down under the heel), the scale figures
  const b = new Builder('dam-section-static');
  b.box(124, 12, DEPTH + 6, { r: 1, c: ['bg.violet', 'slate'], slot: 'facet', at: [-2, -12, 0] });
  for (let i = 0; i < 6; i++)
    b.cyl(0.45, 9, { c: 'white', at: [3 + i * 0.01, -11 + i * 0.2, DEPTH / 2 + 2.6 - i * 1.8] });
  b.box(5, 12, 5, { r: 0.3, c: ['steel.light', 'mist'], slot: 'matte', at: [36, 0, 6] });
  for (let f = 0; f < 10; f++)
    for (const k of [-1.4, 0, 1.4])
      b.box(0.9, 0.6, 0.1, { r: 0, c: 'sky', slot: 'window', at: [36 + k, 0.6 + f * 1.15, 8.55] });
  b.capsule(0.18, 0.4, { c: 'coral', at: [31, 0, 10] });
  b.sphere(0.16, { c: 'amber.light', at: [31, 0.7, 10] });
  // run-of-river powerhouse in line with the weir (shown only for that type)
  const station = new Builder('ror-station');
  station.box(14, 10, 12, { r: 0.8, c: ['mist', 'white'], slot: 'matte', at: [4, 0, -DEPTH / 2 - 7] });
  station.box(14.4, 1, 12.4, { r: 0.3, c: 'blue', at: [4, 10, -DEPTH / 2 - 7] });
  const ror = station.build().group;
  group.add(b.build().group, ror);
  // plan view of the arch dam (visible for that type): a curved thin wall pushing into two rock banks
  const plan = new Builder('arch-plan');
  const R = 12;
  // three's lathe: φ = 0 points to +Z, so the arch bulges toward the water on the +Z side
  plan.add(
    G.revolve(
      [
        [R, 0],
        [R + 1.2, 0],
        [R + 1.2, 4],
        [R, 4],
      ],
      { seg: 28, phiStart: -0.3 * Math.PI, phiLength: 0.6 * Math.PI },
    ).shell,
    { c: ['steel.light', 'white'], slot: 'matte' },
  );
  plan.add(
    G.revolve(
      [
        [R + 1.3, 0],
        [R + 11, 0],
        [R + 11, 2.6],
        [R + 1.3, 2.6],
      ],
      { seg: 28, phiStart: -0.3 * Math.PI, phiLength: 0.6 * Math.PI },
    ).shell,
    { c: 'sky', slot: 'glass' },
  );
  for (const sx of [-1, 1]) {
    plan.box(9, 7, 22, {
      r: 1.2,
      c: ['slate', 'steel'],
      slot: 'facet',
      at: [sx * (0.81 * R + 4), -1, 0.59 * R + 4],
      rot: [0, sx * 0.6, 0],
    });
    // the arch pushes its load along itself into the rock of the bank
    plan.cone(1.1, 3, {
      c: 'blue',
      at: [sx * 0.86 * R, 2, 0.5 * R],
      rot: [0, 0, (sx * -Math.PI) / 2],
      axis: 'y',
    });
  }
  const planGroup = plan.build().group;
  planGroup.position.set(6, 50, -14);
  planGroup.rotation.x = 0.95;
  group.add(planGroup);
  // pressure diagram: arrows from the water into the upstream face, length ∝ depth
  const arrows: Group[] = [];
  const arrowMat = K.toon({ color: 'blue', emissive: 'blue', emissiveIntensity: 0.7 });
  for (let i = 0; i < 8; i++) {
    const a = new Group();
    const shaft = new Mesh(new CylinderGeometry(0.5, 0.5, 1, 10), arrowMat);
    shaft.rotation.z = -Math.PI / 2;
    shaft.position.x = -0.5;
    shaft.name = 'shaft';
    const head = new Mesh(new ConeGeometry(1.2, 2.2, 14), arrowMat);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.9;
    a.add(shaft, head);
    a.position.z = DEPTH / 2 + 1.2;
    group.add(a);
    arrows.push(a);
  }
  // the pressure diagram's envelope: a translucent triangle behind the arrows (width ∝ depth)
  const epure = new Mesh(new BufferGeometry(), K.glass({ color: 'blue', opacity: 0.5 }));
  epure.position.z = DEPTH / 2 + 1.1;
  group.add(epure);
  let key = '';
  let epureKey = '';
  let level = 0.9;
  let cur: { type: DamType; prof: [number, number][]; face: (y: number) => number; height: number } = {
    type: 'gravity',
    prof: [],
    face: () => 0,
    height: 100,
  };
  const extrude = (m: Mesh, pts: readonly Pt[], depth = DEPTH): void => {
    m.geometry.dispose();
    m.geometry = G.extrude(shape(pts), depth, { bevel: 0.3 });
  };
  return {
    group,
    set(from, to, t, levelFrac) {
      const k = `${from}|${to}|${t.toFixed(3)}|${levelFrac.toFixed(3)}`;
      if (k === key) return;
      key = k;
      level = levelFrac;
      const prof = blend(resample(PROFILES[from], N), resample(PROFILES[to], N), t);
      const height = DAM_HEIGHT[from] + (DAM_HEIGHT[to] - DAM_HEIGHT[from]) * t;
      const face = (y: number): number =>
        upstreamFaceX(PROFILES[from], y) * (1 - t) + upstreamFaceX(PROFILES[to], y) * t;
      cur = { type: t > 0.5 ? to : from, prof, face, height };
      extrude(body, prof);
      extrude(core, blend(resample(CORE[from], 16), resample(CORE[to], 16), t), DEPTH + 0.4);
      // water: from far upstream up to the level, bounded by the upstream face
      const h = levelFrac * height;
      const wpts: Pt[] = [[UPSTREAM, 0]];
      for (let i = 0; i <= 8; i++) wpts.push([face((h * i) / 8) - 0.3, (h * i) / 8]);
      wpts.push([UPSTREAM, h]);
      extrude(
        water,
        h > 0.5
          ? [...wpts.slice(0, 1), ...wpts.slice(1)]
          : [
              [UPSTREAM, 0],
              [UPSTREAM + 1, 0],
              [UPSTREAM + 1, 0.5],
              [UPSTREAM, 0.5],
            ],
        DEPTH - 1,
      );
      // overtopping sheet: over the crest and down the downstream face
      const over = h - height;
      sheet.visible = over > 0.2;
      if (sheet.visible) {
        const top = PROFILES[cur.type];
        const path = [top[top.length - 1]!, ...top.slice(1, -1).slice().reverse()].map(
          ([x, y]) => new Vector3(x * S + 0.6, y * S + 0.5, 0),
        );
        const g = G.tube(G.roundPath(path, 1.5), 0.7, { seg: 8 });
        g.scale(1, 1, (DEPTH - 2) / 1.4);
        sheet.geometry.dispose();
        sheet.geometry = g;
      }
      ror.visible = cur.type === 'runOfRiver';
      gallery.visible = cur.type === 'gravity' || cur.type === 'arch';
      body.material = cur.type === 'embankment' ? earth : concrete;
      gallery.position.set(face(14) * S + 3.2, 14 * S, DEPTH / 2 + 0.25);
      planGroup.visible = cur.type === 'arch';
    },
    at(name, out) {
      const c = cur;
      const top = c.height * S;
      const p =
        name === 'grout'
          ? out.set(3, -8, DEPTH / 2 + 1)
          : name === 'gallery'
            ? out.set(c.face(14) * S + 3.2, 14 * S, DEPTH / 2 + 0.4)
            : name === 'person'
              ? out.set(31, 1.2, 10)
              : name === 'house'
                ? out.set(36, 12.5, 6)
                : name === 'crest'
                  ? out.set(c.face(c.height) * S + 2, top + 1, 0)
                  : name === 'core'
                    ? out.set(3, top * 0.5, DEPTH / 2)
                    : name === 'plan'
                      ? out.set(6, 58, -14)
                      : out.set(c.face(0) * S - 6, 0.5, DEPTH / 2);
      return group.localToWorld(p);
    },
    update(t) {
      const h = level * cur.height;
      const base = cur.face(0) * S;
      const w = h * S * ARROW;
      epure.visible = h > 1;
      const ek = `${base.toFixed(2)}|${w.toFixed(2)}|${h.toFixed(2)}`;
      if (epure.visible && ek !== epureKey) {
        epureKey = ek;
        epure.geometry.dispose();
        epure.geometry = G.extrude(
          [
            [base - w - 1.1, 0.2],
            [base - 1.1, 0.2],
            [cur.face(h) * S - 1.1, h * S],
          ],
          0.2,
        );
      }
      arrows.forEach((a, i) => {
        const y = (h * (i + 0.5)) / arrows.length;
        const depth = h - y;
        const len = Math.max(0.01, depth * S * ARROW);
        a.visible = h > 1;
        a.position.set(cur.face(y) * S - 1.1, y * S, DEPTH / 2 + 1.2);
        const shaft = a.getObjectByName('shaft')!;
        shaft.scale.y = len;
        shaft.position.x = -len / 2;
        a.children[1]!.position.x = 0.9 - 0.15 * Math.sin(t * 3 + i);
      });
    },
  };
}
