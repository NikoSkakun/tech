/**
 * The small weather station of step 6: a cell thermometer and an air thermometer (kit `levelTube`s on a
 * stand), a cup anemometer that keeps turning (the NMOT model assumes 1 m/s of wind) and the heat shimmer that
 * rises from a hot module. Pure builder; the step sets temperatures every frame.
 */
import { Group, type Object3D } from 'three';
import { createHeatShimmer } from '@/fx';
import { Builder, levelTube } from '@/kit';
import { temperatureRamp } from '@/style';
import { shadows } from '../world';

export interface Weather {
  group: Group;
  /** Rising wavy lines; place it over the module's top edge. */
  shimmer: Object3D & { intensity: number };
  anchors: { cell: Object3D; air: Object3D; wind: Object3D };
  /** Temperatures in °C; `airShown` 0…1 fades the air instruments (they matter only in the NMOT mode). */
  set(cellC: number, airC: number, t: number): void;
}

/** Thermometer scale of both tubes, °C. */
const T_MIN = -30;
const T_MAX = 90;
const level = (c: number): number => (c - T_MIN) / (T_MAX - T_MIN);

export function createWeather(): Weather {
  const group = new Group();
  group.name = 'weather';
  const b = new Builder('weather-stand');
  b.cyl(0.42, 0.07, { seg: 32, c: 'bg.indigo' });
  b.cyl(0.36, 0.05, { seg: 32, slot: 'gloss', c: ['slate', 'steel'], at: [0, 0.06, 0] });
  b.box(0.07, 1.7, 0.07, { r: 0.02, slot: 'metal', c: 'steel', at: [0.22, 0.1, 0] });
  b.box(0.36, 0.06, 0.07, { r: 0.02, slot: 'metal', c: 'steel.light', at: [0.08, 1.74, 0] });
  const mill = b.part('anemometer', { at: [0.22, 1.86, 0] });
  mill.cyl(0.03, 0.1, { seg: 12, slot: 'metal', c: 'steel.light', at: [0, -0.06, 0] });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    mill.rod([0, 0, 0], [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], 0.012, { slot: 'metal', c: 'steel.light' });
    mill.sphere(0.06, { seg: 14, slot: 'gloss', c: 'sky', at: [Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22] });
  }
  const stand = b.build();
  group.add(shadows(stand.group));
  const cell = levelTube({ height: 1.25, radius: 0.085, color: 'orange', level: level(25), ticks: 6 });
  cell.group.position.set(-0.12, 0.12, 0.08);
  const air = levelTube({ height: 0.8, radius: 0.05, color: 'sky', level: level(25), ticks: 4 });
  air.group.position.set(0.02, 0.86, 0.02);
  group.add(cell.group, air.group);
  const shimmer = createHeatShimmer({ width: 2.6, height: 3.6, lines: 11, intensity: 0, speed: 0.8 });
  const spin = stand.part('anemometer');
  const c = temperatureRamp(0.5);

  return {
    group,
    shimmer,
    anchors: { cell: cell.anchor('top'), air: air.anchor('top'), wind: spin },
    set(cellC, airC, t) {
      cell.level = level(cellC);
      air.level = level(airC);
      cell.setColor(temperatureRamp(level(cellC), c));
      air.setColor(temperatureRamp(level(airC), c));
      spin.rotation.y = t * 2.4; // 1 m/s of the NMOT definition, drawn as a lazy turn
      // shimmer appears above ≈ 35 °C in the cell and is strong by 70 °C
      shimmer.intensity = Math.min(1, Math.max(0, (cellC - 35) / 35)) * 1.5;
    },
  };
}
