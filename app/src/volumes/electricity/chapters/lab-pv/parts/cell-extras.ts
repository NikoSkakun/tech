/**
 * Around the cut cell of step 3: the «стрічка еволюції» — five miniature cells (one per technology, tappable)
 * with the two "sisters" (thin-film module, perovskite / silicon tandem) at its ends — and the texture
 * microscope: three big pyramids on a dish with a `yellow` ray that bounces from one into the next.
 */
import { Group, Mesh, type Object3D } from 'three';
import { createBeam, type Beam } from '@/fx';
import { Builder } from '@/kit';
import { K } from '@/style';
import { CELL_TECHS, type TechId } from '../data/cell-tech';
import { shadows } from '../world';

export interface CellExtras {
  group: Group;
  /** Miniatures by technology (pick targets, probes). */
  tiles: Record<TechId, Object3D>;
  sisters: { thinFilm: Object3D; tandem: Object3D };
  microscope: Object3D;
  /** Highlight the selected technology; animate the ray (drawn only while `ray`: the microscope view). */
  update(selected: TechId, t: number, ray: boolean): void;
}

const PITCH = 0.92;

export function createCellExtras(): CellExtras {
  const group = new Group();
  group.name = 'cell-extras';
  const rail = new Builder('evolution-rail');
  rail.box(7.2, 0.08, 0.9, { r: 0.04, slot: 'gloss', c: ['bg.indigo', 'slate'] });
  const strip = new Group();
  strip.position.set(0.1, 0, 2.9);
  strip.scale.setScalar(0.7);
  strip.add(shadows(rail.build().group, false));
  const tiles = {} as Record<TechId, Object3D>;
  const mini = (name: string, layers: readonly (readonly [string, number])[], x: number): Object3D => {
    const b = new Builder(name);
    let y = 0;
    for (const [color, h] of [...layers].reverse()) {
      b.box(0.62, h, 0.42, { r: 0.015, slot: 'gloss', c: color, at: [0, y, 0] });
      y += h;
    }
    const g = shadows(b.build().group);
    g.position.set(x, 0.08, 0);
    strip.add(g);
    return g;
  };
  CELL_TECHS.forEach((tech, i) => {
    const l = tech.layers;
    tiles[tech.id] = mini(`mini-${tech.id}`, [[l.grid ? 'mist' : (l.arc?.color ?? 'blue'), 0.02], [l.arc?.color ?? 'blue', 0.03], [l.front?.color ?? 'sky', 0.05], [l.base?.color ?? 'teal', 0.16], [l.back?.color ?? 'sky', 0.04], [l.rear?.color ?? 'steel', 0.03]], (i - 2) * PITCH);
  });
  const thinFilm = mini('mini-thin-film', [['ink', 0.04], ['slate', 0.03], ['sky.light', 0.12]], -3 * PITCH - 0.15);
  const tandem = mini('mini-tandem', [['violet', 0.09], ['sky.light', 0.04], ['blue', 0.03], ['teal', 0.16], ['steel', 0.03]], 3 * PITCH + 0.15);
  const marker = new Mesh(new Builder('marker').ring(0.5, 0.025, { seg: 40 }).geometry('toon'), K.glow({ color: 'yellow', intensity: 1.6, keepHue: true, whiten: 0 }));
  marker.scale.set(1, 1, 0.72);
  marker.position.y = 0.1;
  strip.add(marker);
  group.add(strip);

  // microscope dish: three pyramids and the bouncing ray
  const dish = new Group();
  dish.position.set(-1.55, 0, -2.5);
  dish.rotation.y = -0.6; // the ray's plane faces the microscope shot
  const d = new Builder('texture-dish');
  d.cyl(1.0, 0.14, { seg: 48, slot: 'gloss', c: ['bg.indigo', 'slate'] });
  d.cyl(0.9, 0.04, { seg: 48, c: 'teal.dark', at: [0, 0.14, 0] });
  for (const x of [-0.56, 0, 0.56]) d.cone(0.4, 0.5, { seg: 4, c: ['teal.dark', 'blue'], at: [x, 0.18, 0], rot: [0, Math.PI / 4, 0] });
  dish.add(shadows(d.build().group));
  const pts: [number, number, number][] = [[-1.5, 2.3, 0.1], [-0.42, 0.44, 0.1], [-0.16, 0.42, 0.1], [0.05, 0.12, 0.1]];
  const beams: Beam[] = [0, 1, 2].map((k) => {
    const beam = createBeam({ from: pts[k]!, to: pts[k + 1]!, color: 'yellow', width: 0.035, intensity: k === 2 ? 0.8 : 1.4, ripple: 0 });
    dish.add(beam);
    return beam;
  });
  group.add(dish);

  return {
    group,
    tiles,
    sisters: { thinFilm, tandem },
    microscope: dish,
    update(selected, t, ray) {
      for (const b of beams) b.visible = ray;
      const i = CELL_TECHS.findIndex((x) => x.id === selected);
      marker.position.x += ((i - 2) * PITCH - marker.position.x) * 0.2;
      CELL_TECHS.forEach((tech, k) => (tiles[tech.id].position.y = 0.08 + (k === i ? 0.1 + Math.sin(t * 2.4) * 0.02 : 0)));
      // the ray is drawn in three strokes, 2.4 s per loop: in, across to the neighbour, into the silicon
      const u = (t % 2.4) / 2.4;
      beams.forEach((b, k) => (b.reach = Math.min(1, Math.max(0, u * 4 - k))));
    },
  };
}
