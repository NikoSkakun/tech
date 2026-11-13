/**
 * The twin experiments of step 2: the same transistor used as a half-open «кран» (linear regulator) and as a
 * «ключ» (fully on / fully off). Each stands on its plinth with a heat sink, a thermometer and a loss tag;
 * a little emblem on the plinth says which is which (a valve wheel / a rocker switch).
 */
import { Group, Mesh, TorusGeometry } from 'three';
import { applyHeat, createHalo, createHeatShimmer, type HeatShimmer } from '@/fx';
import { Builder, levelTube, type LevelTube } from '@/kit';
import { K, heatRamp, type KToonMaterial } from '@/style';
import type { Text3D } from '@/text';
import { tag } from '../world';
import { addHeatSink, addTransistor } from './components';

export interface Twin {
  group: Group;
  thermo: LevelTube;
  tag: Text3D;
  /** Loss in W → heat glow, shimmer, thermometer (log scale: 1 W … 4 kW), tag text is set by the step. */
  setLoss(pW: number): void;
  /** Dim the twin that is not selected (0.35…1). */
  setFocus(on: boolean): void;
  /** The key twin blinks its gate LED while switching. */
  blink(on: boolean): void;
}

export function createTwin(kind: 'tap' | 'switch'): Twin {
  const b = new Builder(`twin-${kind}`);
  b.cyl(0.95, 0.16, { seg: 48, c: ['bg.indigo', 'slate'] });
  b.cyl(0.82, 0.03, { seg: 48, slot: 'matte', c: 'ink', at: [0, 0.16, 0] });
  addHeatSink(b, [0, 0.19, -0.05], 1.0, 0.95, 0.4, 8);
  // the transistor is its own slot (`gloss`) so that only it glows with heat
  addTransistor(b, [0, 0.19, 0.06], 0.8);
  if (kind === 'tap') {
    // valve wheel: a "tap" that throttles
    b.cyl(0.05, 0.22, { axis: 'z', seg: 10, slot: 'metal', c: 'steel', at: [0.62, 0.42, 0.25] });
    b.ring(0.17, 0.035, { axis: 'z', seg: 24, c: 'coral', at: [0.62, 0.42, 0.47] });
    for (const a of [0, Math.PI / 2])
      b.box(0.34, 0.04, 0.04, { r: 0.01, mid: true, c: 'coral', at: [0.62, 0.42, 0.47], rot: [0, 0, a] });
  } else {
    // rocker switch: on / off, nothing in between
    b.box(0.3, 0.42, 0.12, { r: 0.04, c: 'white', at: [0.62, 0.22, 0.36] });
    b.box(0.2, 0.26, 0.1, {
      r: 0.03,
      mid: true,
      slot: 'toon',
      c: 'teal',
      at: [0.62, 0.43, 0.44],
      rot: [0.35, 0, 0],
    });
  }
  b.box(0.05, 0.05, 0.03, { r: 0, slot: 'glow', c: 'cyan', at: [-0.3, 0.26, 0.2] });
  const model = b.build();
  const hot = model.mats.get('gloss') as KToonMaterial;
  const led = model.mats.get('glow') as unknown as { intensity: number };
  const thermo = levelTube({ height: 1.25, radius: 0.085, color: 'orange', level: 0.2, ticks: 5 });
  thermo.group.position.set(-0.68, 0.19, 0.3);
  const halo = createHalo({ color: 'orange', size: 2.2, intensity: 0 });
  halo.position.set(0, 0.8, 0.1);
  const shimmer: HeatShimmer = createHeatShimmer({ width: 1.0, height: 1.2, lines: 5, intensity: 0 });
  shimmer.position.set(0, 1.2, -0.2);
  const label = tag('', 24, 'white', 'mono');
  label.position.set(0, 2.15, 0);
  const group = new Group();
  group.name = `twin-${kind}`;
  group.add(model.group, thermo.group, halo, shimmer, label);
  // selection ring on the plinth
  const ring = K.glow({
    color: kind === 'tap' ? 'coral' : 'teal',
    intensity: 0.15,
    whiten: 0,
    keepHue: true,
    falloff: 0,
  });
  const hoop = new Mesh(new TorusGeometry(0.9, 0.022, 8, 64).rotateX(Math.PI / 2), ring);
  hoop.position.y = 0.19;
  group.add(hoop);
  return {
    group,
    thermo,
    tag: label,
    setLoss(pW) {
      // log scale: 1 W → 0, 4 kW → 1 (a linear scale would hide the switch's 16 W next to the tap's 1700 W)
      const k = Math.min(1, Math.max(0, Math.log10(Math.max(pW, 1)) / Math.log10(4000)));
      thermo.level = 0.06 + 0.92 * k;
      thermo.setColor(heatRamp(k));
      applyHeat(hot, k * k, 1.6);
      halo.intensity = 1.5 * k * k * k;
      shimmer.intensity = k > 0.35 ? 1.1 * k : 0.25 * k;
    },
    setFocus(on) {
      label.opacity = on ? 1 : 0.55;
      ring.intensity = on ? 1.6 : 0.15;
    },
    blink: (on) => (led.intensity = on ? 2.4 : 0.2),
  };
}
