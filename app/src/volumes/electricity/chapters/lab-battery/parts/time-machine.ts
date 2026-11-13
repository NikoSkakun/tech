/**
 * Step 10: the «машина часу» — a cell under a glass dome with its own climate and a lens on its inside:
 * the SEI film on the graphite thickens with calendar ageing (`sei` 0…1), the cathode particle cracks with
 * cycling (`cracks` 0…1). A warm glow under the dome shows the storage temperature; a tired cell swells.
 */
import { CircleGeometry, CylinderGeometry, type Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ChapterContext } from '@/engine/api';
import { createHalo } from '@/fx';
import { K, heatRamp, type ColorLike } from '@/style';
import type { Mats } from '../world';
import { group, mesh } from '../world';
import { heroCell } from './cells';
import { createRingGauge, type RingGauge } from './rings';

export interface AgingState {
  /** State of health 0…1 (ring). */
  soh: number;
  /** Calendar loss share → SEI thickness, 0…1 of the lens scale. */
  sei: number;
  /** Cycle loss share → cracks in the cathode particle, 0…1. */
  cracks: number;
  /** Climate: 0 = cool … 1 = hot (glow under the dome). */
  heat: number;
}

/** Enlargement of the lens picture (callout anchors of the step are offsets in lens units × this). */
export const LENS_SCALE = 1.34;

export interface AgingStation {
  group: Group;
  lens: Group;
  ring: RingGauge;
  apply(state: AgingState, t: number): void;
}

export function createAgingStation(
  ctx: ChapterContext,
  mats: Mats,
  wrap: ColorLike,
  caption: string,
): AgingStation {
  const g = group('aging-station');
  const trappedMat = K.toon({ color: 'lime', emissive: 'lime', emissiveIntensity: 0.5, keepHue: true });
  g.add(mesh(new CylinderGeometry(1.0, 1.08, 0.3, 48), mats.plinth, 0, 0.15, 0));
  const cell = heroCell(wrap, '21700', 0.62).group;
  cell.position.y = 0.3;
  cell.rotation.y = 0.5;
  const dome = new Mesh(new SphereGeometry(0.95, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass);
  dome.scale.y = 1.25;
  dome.position.y = 1.3;
  dome.renderOrder = 5;
  const wall = new Mesh(new CylinderGeometry(0.95, 0.95, 1.0, 40, 1, true), mats.glass);
  wall.position.y = 0.8;
  wall.renderOrder = 5;
  const climate = createHalo({ color: 'orange', size: 3.2, intensity: 0 });
  climate.position.y = 1.2;
  const hotplate = K.toon({ color: 'slate', gloss: 0.2 });
  g.add(
    cell,
    wall,
    dome,
    climate,
    mesh(new CylinderGeometry(0.8, 0.8, 0.04, 40), hotplate, 0, 0.32, 0, false),
  );
  const ring = createRingGauge(ctx, { size: 1.15, caption, digits: 0 });
  ring.surface.position.set(0, 3.35, 0);
  g.add(ring.surface);

  /* ----------------------------------------------------------------------------------------- lens */
  // the picture inside is authored for R = 0.62 and enlarged as a whole, so its details read at 1280×720
  const lens = group('aging-lens', 0, 1.2, 1.5);
  lens.scale.setScalar(LENS_SCALE);
  const R = 0.62;
  lens.add(mesh(new TorusGeometry(R, 0.05, 12, 64), mats.steel));
  const back = new Mesh(new CircleGeometry(R, 48), K.flat('bg.deep'));
  back.position.z = -0.02;
  const glass = new Mesh(new CircleGeometry(R, 48), mats.glass);
  glass.position.z = 0.16;
  glass.renderOrder = 6;
  lens.add(back, glass);
  // left: a graphite slab and the SEI film on it (grows to the right)
  lens.add(mesh(new RoundedBoxGeometry(0.2, 0.84, 0.1, 2, 0.03), mats.graphite, -0.4, 0, 0.03, false));
  const sei = mesh(
    new RoundedBoxGeometry(1, 0.8, 0.09, 2, 0.02),
    K.toon({ color: 'steel', gloss: 0.2 }),
    -0.3,
    0,
    0.035,
    false,
  );
  lens.add(sei);
  // lithium caught in the film («кожен нанометр SEI — це літій, який більше не гойдається»): dim lime dots
  // that the growing film swallows one after another
  const trapped = [0.05, 0.11, 0.16, 0.21, 0.26].map((x, i) => {
    const dot = mesh(
      new SphereGeometry(0.026, 10, 8),
      trappedMat,
      -0.3 + x,
      -0.26 + ((i * 5) % 7) * 0.085,
      0.09,
      false,
    );
    lens.add(dot);
    return { dot, x };
  });
  // right: a cathode particle with three cracks that open up
  lens.add(mesh(new SphereGeometry(0.23, 28, 20), mats.cathode, 0.24, 0, 0.03, false));
  const crackMat = K.flat('bg.void');
  const cracks = [0.3, 2.2, 4.3].map((a) => {
    const c = new Mesh(new RoundedBoxGeometry(0.3, 0.035, 0.02, 1, 0.01), crackMat);
    c.position.set(0.24 + Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.262);
    c.rotation.z = a + 0.5;
    lens.add(c);
    return c;
  });
  g.add(lens);

  return {
    group: g,
    lens,
    ring,
    apply(s, t) {
      ring.set(s.soh);
      // SEI: from a hair-thin film to a thick crust (lens scale: 0.02 … 0.3 units)
      const w = 0.02 + 0.28 * Math.min(s.sei, 1);
      sei.scale.x = w;
      sei.position.x = -0.3 + w / 2;
      for (const d of trapped) d.dot.visible = w > d.x + 0.02;
      cracks.forEach((c, i) => {
        const open = Math.min(Math.max(s.cracks * 1.3 - i * 0.15, 0), 1);
        c.scale.set(Math.max(open, 0.001), 0.4 + 1.6 * open, 1);
      });
      climate.intensity = 0.55 * s.heat * (0.9 + 0.1 * Math.sin(t * 2));
      heatRamp(s.heat * 0.7, hotplate.emissive);
      hotplate.emissiveIntensity = 1.6 * s.heat;
      // a worn cell swells a little (gas from side reactions)
      const swell = 1 + 0.22 * Math.max(0.85 - s.soh, 0);
      cell.scale.set(0.62 * swell, 0.62, 0.62 * swell);
      cell.rotation.y = 0.5 + Math.sin(t * 0.4) * 0.12;
    },
  };
}
