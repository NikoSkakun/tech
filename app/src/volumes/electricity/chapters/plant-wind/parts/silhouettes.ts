/**
 * Step 10 «Порівняти розміри»: dark flat silhouettes at the scale of the offshore turbine (tip ≈ 260 m):
 * the Eiffel Tower (330 m), the Motherland Monument in Kyiv (102 m with sword and shield), an Airbus A380
 * head-on (wingspan 80 m) and a person. Simple outlines, no detail — they are yardsticks.
 */
import { Group } from 'three';
import { Builder, G, type KitModel } from '@/kit';
import { col } from '@/style';

const EIFFEL: [number, number][] = [[-62, 0], [-41, 0], [-30, 26], [0, 41], [30, 26], [41, 0], [62, 0], [33, 57], [35, 62], [20, 112], [21, 118], [7, 272], [8, 280], [2.5, 300], [1, 330], [-1, 330], [-2.5, 300], [-8, 280], [-7, 272], [-21, 118], [-20, 112], [-35, 62], [-33, 57]];
const MOTHERLAND: [number, number][] = [[-14, 0], [14, 0], [9, 40], [6, 41], [6, 72], [8, 80], [9.4, 100], [10, 102], [8, 99], [5.5, 84], [3, 86], [2.3, 90], [0, 92], [-2.3, 90], [-3, 86], [-6, 82], [-13, 85], [-14.6, 77], [-13, 70], [-6, 74], [-6, 41], [-9, 40]];

export interface Silhouettes {
  group: Group;
  /** Pieces with the real height (or span) they stand for, left to right. */
  items: { id: 'eiffel' | 'motherland' | 'a380' | 'person'; model: KitModel; top: number }[];
}

/** `scale` = toy metres per real metre. Pieces stand on y = 0 along +X, facing +Z. */
export function buildSilhouettes(scale: number): Silhouettes {
  const group = new Group();
  group.name = 'size-silhouettes';
  const ink = col('bg.indigo').lerp(col('slate'), 0.55);
  const depth = 0.7 / scale;
  const piece = (fn: (b: Builder) => void): KitModel => {
    const b = new Builder('silhouette');
    b.frame({ s: scale }, () => fn(b));
    const m = b.build();
    group.add(m.group);
    return m;
  };
  const flat = (outline: [number, number][]) => (b: Builder): void => void b.add(G.extrude(outline, depth), { c: ink, slot: 'matte', at: [0, 0, -depth / 2] });
  const eiffel = piece(flat(EIFFEL));
  const motherland = piece(flat(MOTHERLAND));
  const a380 = piece((b) => {
    b.capsule(3.6, 8.6, { axis: 'y', c: ink, slot: 'matte', at: [0, 8.2, 0], seg: 16 }); // fuselage, head-on
    for (const s of [-1, 1]) {
      b.beam([s * 3, 6.6, 0], [s * 40, 10.4, 0], 1.3, { c: ink, h: 1.0 });
      for (const x of [14.5, 26]) b.cyl(1.6, depth, { axis: 'z', c: ink, slot: 'matte', seg: 14, at: [s * x, 5.4 + (x - 14.5) * 0.11, -depth / 2] });
      b.beam([s * 1, 13.5, 0], [s * 15, 14.4, 0], 0.8, { c: ink, h: 0.7 }); // tailplane
    }
    b.box(1.3, 12.2, depth, { r: 0.3, c: ink, slot: 'matte', at: [0, 12, 0] }); // fin: 24 m above the ground
    for (const s of [-1, 1]) b.box(1.2, 4.2, depth, { r: 0.2, c: ink, slot: 'matte', at: [s * 5.4, 0, 0] }); // gear
  });
  const person = piece((b) => {
    b.capsule(0.28, 1.55, { axis: 'y', c: ink, slot: 'matte', at: [0, 0.78, 0], seg: 8 });
    b.sphere(0.17, { c: ink, slot: 'matte', at: [0, 1.66, 0], seg: 8 });
  });
  // left to right with air between them
  const gap = 5;
  let x = 0;
  const place = (m: KitModel, half: number): void => {
    x += half * scale;
    m.group.position.x = x;
    x += half * scale + gap;
  };
  place(eiffel, 62);
  place(motherland, 15);
  place(a380, 40);
  place(person, 3);
  group.position.x = -x / 2;
  return {
    group,
    items: [
      { id: 'eiffel', model: eiffel, top: 330 * scale },
      { id: 'motherland', model: motherland, top: 102 * scale },
      { id: 'a380', model: a380, top: 24 * scale },
      { id: 'person', model: person, top: 1.8 * scale },
    ],
  };
}
