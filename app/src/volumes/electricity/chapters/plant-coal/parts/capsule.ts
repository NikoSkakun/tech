/**
 * Step 2 «капсула часу»: a glass sphere over the hero wagon in which one cycle of coal formation plays (≈ 14 s,
 * loops): ferns and horsetails of the Carboniferous forest grow on a swamp (`green`), fall into it, are buried
 * under layers of sediment, which are pressed together while a glossy `ink` seam appears at the bottom — coal.
 * `phase(u)` is a pure function of the cycle position 0…1 (random-access safe, no history).
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { Builder, type KitModel } from '@/kit';
import { K, col } from '@/style';

export interface Capsule {
  group: Group;
  /** Where the seam lies (hotspot anchor), world. */
  seam: Vector3;
  /** Pose of the cycle, u ∈ [0, 1). */
  phase(u: number): void;
  readonly period: number;
}

const R = 22;

function plant(kind: 'fern' | 'horsetail', h: number): KitModel {
  const b = new Builder(`carbon-${kind}`);
  if (kind === 'fern') {
    b.cyl(0.35, h, { seg: 8, slot: 'matte', c: ['wireBrown', 'amber.dark'] });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.cone(0.9, h * 0.7, { seg: 4, slot: 'soft', c: ['green.dark', 'green'], at: [Math.cos(a) * 1.6, h - 0.6, Math.sin(a) * 1.6], rot: [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2], s: [1, 1, 0.3] });
    }
  } else {
    b.cyl(0.45, h, { seg: 10, slot: 'soft', c: ['green.dark', 'lime'] });
    for (let k = 1; k < 5; k++) b.ring(0.9, 0.18, { seg: 14, slot: 'soft', c: 'green.dark', at: [0, (k / 5) * h, 0] });
  }
  return b.build();
}

export function buildCapsule(): Capsule {
  const group = new Group();
  group.name = 'time-capsule';
  const glass = new Mesh(new SphereGeometry(R, 48, 32), K.glass({ color: 'sky', opacity: 0.08, edgeOpacity: 0.5 }));
  glass.renderOrder = 3;
  group.add(glass);
  const inner = new Group();
  inner.position.y = -R * 0.55;
  group.add(inner);
  // swamp floor
  const floor = new Builder('swamp');
  floor.cyl(R * 0.82, 1, { seg: 40, slot: 'matte', c: ['wireBrown', 'teal.dark'] });
  inner.add(floor.build().group);
  const plants: Group[] = [];
  const spots: [number, number, 'fern' | 'horsetail', number][] = [
    [-7, -3, 'fern', 9],
    [-2, 5, 'horsetail', 12],
    [3, -5, 'fern', 8],
    [7, 3, 'horsetail', 10],
    [0, -1, 'fern', 11],
    [-6, 6, 'horsetail', 8],
  ];
  for (const [x, z, kind, h] of spots) {
    const pivot = new Group();
    pivot.position.set(x, 1, z);
    pivot.add(plant(kind, h).group);
    inner.add(pivot);
    plants.push(pivot);
  }
  // sediment layers (fall from above) and the coal seam that appears as they are pressed
  const layerColors = [col('amber.dark'), col('wireBrown'), col('steel'), col('amber.dark').lerp(col('slate'), 0.5)];
  const layers = layerColors.map((c, i) => {
    const m = new Mesh(new SphereGeometry(1, 32, 6, 0, Math.PI * 2, 0, Math.PI / 2), K.toon({ color: c }));
    m.scale.set(R * (0.8 - i * 0.04), 1.6, R * (0.8 - i * 0.04));
    inner.add(m);
    return m;
  });
  const seamMat = K.toon({ color: 'ink', gloss: 0.9, highlight: 0.8 });
  const seam = new Mesh(new SphereGeometry(1, 40, 6, 0, Math.PI * 2, 0, Math.PI / 2), seamMat);
  seam.scale.set(R * 0.8, 2.4, R * 0.8);
  seam.position.y = 1;
  inner.add(seam);
  const clamp = (x: number): number => Math.max(0, Math.min(1, x));
  const ease = (x: number): number => x * x * (3 - 2 * x);
  return {
    group,
    seam: new Vector3(0, -R * 0.55 + 2, 0),
    period: 14,
    phase(u) {
      const grow = ease(clamp(u / 0.28));
      const fall = ease(clamp((u - 0.3) / 0.14));
      const press = ease(clamp((u - 0.74) / 0.14));
      const gone = clamp((u - 0.6) / 0.1);
      plants.forEach((p, i) => {
        p.scale.setScalar(Math.max(0.001, grow * (1 - gone)));
        p.rotation.z = fall * (i % 2 ? 1.45 : -1.45);
        p.rotation.y = i * 1.1;
      });
      layers.forEach((m, i) => {
        const t0 = 0.46 + i * 0.06;
        const drop = ease(clamp((u - t0) / 0.07));
        const rest = 1.5 + i * 1.6;
        m.visible = u >= t0 && u < 0.97;
        m.position.y = rest * (1 - press * 0.6) + (1 - drop) * R * 1.2;
        m.scale.y = 1.6 * (1 - press * 0.55);
      });
      seam.visible = press > 0.01;
      seam.scale.y = 2.4 * press;
    },
  };
}
