/**
 * Squirrel-cage rotor standing on its shaft (axis +Y), for the flat stator of step 6: a laminated steel core
 * with a quarter cut away (cutaway), aluminium bars (`orange`) in its slots, two end rings, a fan on top as the
 * mechanical load, and cyan "current dots" riding the bars (direction alternates around the rotor, set by
 * `setCurrents`). Origin = centre of the core; rotate `group.rotation.y`.
 */
import { CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createOrbs, type Orbs } from '@/fx';
import { G } from '@/kit';
import { K } from '@/style';

export const CAGE = { bars: 16, r: 0.66, h: 0.86 } as const;
const DOTS = 3;

export interface CageRotor {
  group: Group;
  dots: Orbs;
  /** Bar k angle in the rotor frame (rad, CCW from +X seen from above). */
  barAngle(k: number): number;
  /** Per-bar current −1…1 (sign = direction, |v| = brightness) and the dots' phase along the bars. */
  setCurrents(values: ArrayLike<number>, phase: number): void;
  /** Local point on bar 0 (hotspot anchor). */
  bar0: Vector3;
}

export function createCageRotor(): CageRotor {
  const group = new Group();
  group.name = 'cage-rotor';
  const { r, h, bars } = CAGE;
  const core = G.revolve(
    [[0.12, -h / 2 + 0.06], [r + 0.04, -h / 2 + 0.06], [r + 0.04, h / 2 - 0.06], [0.12, h / 2 - 0.06]],
    { seg: 64, phiStart: Math.PI * 0.15, phiLength: Math.PI * 1.5 },
  );
  const steel = K.metal({ color: 'steel', specular: 0.5 });
  group.add(new Mesh(core.shell, steel));
  if (core.caps) group.add(new Mesh(core.caps, K.toon({ color: 'slate' })));
  for (let i = -3; i <= 3; i++) {
    const groove = new Mesh(G.ring(r + 0.045, 0.008, 64, 3), K.toon({ color: 'slate' }));
    groove.position.y = i * 0.11;
    group.add(groove);
  }
  const alu = K.metal({ color: 'orange', specular: 0.8 });
  const barGeo = new RoundedBoxGeometry(0.07, h + 0.08, 0.07, 1, 0.02);
  const barAngle = (k: number): number => (k / bars) * Math.PI * 2;
  for (let k = 0; k < bars; k++) {
    const b = new Mesh(barGeo, alu);
    const a = barAngle(k);
    b.position.set(Math.cos(a) * r, 0, -Math.sin(a) * r);
    group.add(b);
  }
  for (const y of [-h / 2 - 0.02, h / 2 + 0.02]) {
    const ring = new Mesh(new CylinderGeometry(r + 0.06, r + 0.06, 0.1, 48, 1, true), alu);
    ring.position.y = y;
    const lip = new Mesh(G.ring(r + 0.02, 0.05, 48, 8), alu);
    lip.position.y = y;
    group.add(ring, lip);
  }
  const shaft = new Mesh(G.cyl(0.08, h + 1.6, { seg: 16 }), K.metal({ color: 'mist' }));
  shaft.position.y = -h / 2 - 0.6;
  group.add(shaft);
  // the fan on top: hub + four blades (the mechanical load)
  const fan = new Group();
  fan.position.y = h / 2 + 0.75;
  fan.add(new Mesh(G.cyl(0.12, 0.14, { seg: 20 }), K.toon({ color: 'ink' })));
  for (let i = 0; i < 4; i++) {
    const blade = new Mesh(new RoundedBoxGeometry(0.55, 0.03, 0.2, 2, 0.015), K.toon({ color: 'sky', gloss: 0.5 }));
    blade.position.set(Math.cos((i * Math.PI) / 2) * 0.38, 0.07, -Math.sin((i * Math.PI) / 2) * 0.38);
    blade.rotation.set(0.35, (i * Math.PI) / 2, 0);
    fan.add(blade);
  }
  group.add(fan);
  const dots = createOrbs({ kind: 'electron', count: bars * DOTS, radius: 0.045, instanceColors: true });
  group.add(dots);
  const values = new Float32Array(bars);
  return {
    group,
    dots,
    barAngle,
    bar0: new Vector3(r, 0.2, 0),
    setCurrents(v, phase) {
      for (let k = 0; k < bars; k++) values[k] = v[k] ?? 0;
      for (let k = 0; k < bars; k++) {
        const a = barAngle(k);
        const s = values[k]!;
        for (let d = 0; d < DOTS; d++) {
          // dots run along the bar in the direction of its current; frac wraps in 0…1
          const frac = (((d / DOTS + Math.sign(s) * phase) % 1) + 1) % 1;
          const i = k * DOTS + d;
          dots.setPosition(i, Math.cos(a) * (r + 0.04), -h / 2 + frac * h, -Math.sin(a) * (r + 0.04), Math.abs(s) > 0.05 ? 1 : 0.001);
          dots.setInstanceColor(i, 'cyan', 0.6 + 1.6 * Math.abs(s));
        }
      }
      dots.commit();
    },
  };
}
