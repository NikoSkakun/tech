/**
 * Induced surface charge of the conductor in step 5: free electrons (`cyan` dots) that crowd toward the side
 * the field comes from, and the `coral` «+» marks with a halo on the opposite side where they are missing.
 * `shift` 0…1 (sim: `inducedShiftFraction`, σ ∝ E₀) is how far they have moved.
 */
import { Group, Vector3 } from 'three';
import { createHalo, createOrbs } from '@/fx';
import { SEMANTIC } from '@/style';
import { CONDUCTOR } from '../layout';
import { smooth } from '../chapter';

const R = CONDUCTOR.radius;
const N = 46;
const PLUS = 9;

export interface Induced {
  group: Group;
  /** 0 = evenly spread (no field) … 1 = fully shifted (100 kV/m). */
  shift: number;
  /** Hide the dots of the removed quarter (cutaway). */
  cut: boolean;
  update(t: number): void;
}

export function createInduced(): Induced {
  const group = new Group();
  group.name = 'induced-charge';
  const electrons = createOrbs({ kind: 'electron', count: N, radius: 0.075 });
  const plus = createOrbs({ kind: 'ion', color: SEMANTIC.proton, glyph: 'plus', count: PLUS, radius: 0.13 });
  const halo = createHalo({ color: SEMANTIC.proton, size: R * 2.6, intensity: 0, amount: 0.2 });
  halo.position.x = R * 0.75;
  const haloMinus = createHalo({ color: SEMANTIC.electron, size: R * 2.6, intensity: 0, amount: 0.2 });
  haloMinus.position.x = -R * 0.75;
  group.add(halo, haloMinus, electrons, plus);
  // evenly spread home directions (Fibonacci sphere)
  const home = Array.from({ length: N }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    return new Vector3(Math.cos(i * 2.39996) * r, y, Math.sin(i * 2.39996) * r);
  });
  const d = new Vector3();
  const state: Induced = {
    group,
    shift: 0,
    cut: false,
    update(t) {
      const s = state.shift;
      home.forEach((h, i) => {
        // drift of the whole electron "skin" against the field, plus a little thermal wandering
        d.copy(h);
        d.x -= 1.5 * s;
        d.y += 0.07 * Math.sin(t * 1.3 + i);
        d.z += 0.07 * Math.cos(t * 1.1 + i * 1.7);
        d.normalize();
        const hidden = state.cut && d.x > 0 && d.z > 0;
        electrons.setPosition(i, d.x * R * 1.03, d.y * R * 1.03, d.z * R * 1.03, hidden ? 0 : 1);
      });
      electrons.commit();
      for (let i = 0; i < PLUS; i++) {
        // «+» marks on the far side: density ∝ cos θ, so they sit around the pole and grow with the shift
        const ring = i === 0 ? 0 : i < 5 ? 0.55 : 1.0;
        const a = i * 1.571 + (i < 5 ? 0 : 0.78);
        d.set(Math.cos(ring), Math.sin(ring) * Math.cos(a), Math.sin(ring) * Math.sin(a));
        const hidden = state.cut && d.z > 0.05;
        plus.setPosition(
          i,
          d.x * R * 1.03,
          d.y * R * 1.03,
          d.z * R * 1.03,
          hidden ? 0 : smooth(0.05 + ring * 0.25, 0.3 + ring * 0.5, s) * Math.cos(ring * 0.9),
        );
      }
      plus.commit();
      halo.intensity = 0.75 * s;
      haloMinus.intensity = 0.6 * s;
    },
  };
  return state;
}
