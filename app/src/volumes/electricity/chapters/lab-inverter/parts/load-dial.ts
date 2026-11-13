/**
 * The big load dial over the inverter in step 12: 0…14 kW with the zones of «ЛІ-6» — green up to the rated
 * 6 kW, amber up to the 12 kW it stands for 10 s, red beyond (instant trip). The needle is a part.
 */
import type { Group } from 'three';
import { Builder } from '@/kit';
import type { ColorLike } from '@/style';

export const DIAL_MAX_KW = 14;
/** Sweep of the scale, radians (from −SWEEP/2 on the left to +SWEEP/2 on the right). */
const SWEEP = 3.5;

export interface LoadDial {
  group: Group;
  /** Needle to a load in kW (clamped to the scale). */
  set(kW: number): void;
}

export function createLoadDial(ratedKw: number, peakKw: number): LoadDial {
  const b = new Builder('load-dial');
  const R = 1.0;
  b.cyl(R * 1.18, 0.12, { axis: 'z', seg: 64, slot: 'gloss', c: ['bg.indigo', 'slate'], at: [0, 0, -0.06] });
  b.cyl(R * 1.06, 0.02, { axis: 'z', seg: 64, slot: 'gloss', c: 'ink', at: [0, 0, 0.06] });
  // zones: 56 small tiles along the arc
  const N = 56;
  for (let i = 0; i < N; i++) {
    const kw = ((i + 0.5) / N) * DIAL_MAX_KW;
    const a = -SWEEP / 2 + ((i + 0.5) / N) * SWEEP;
    const c: ColorLike = kw <= ratedKw ? 'green' : kw <= peakKw ? 'amber' : 'red';
    b.box(0.085, 0.2, 0.02, {
      r: 0,
      mid: true,
      slot: 'glow',
      c,
      at: [Math.sin(a) * R * 0.86, Math.cos(a) * R * 0.86, 0.085],
      rot: [0, 0, -a],
    });
  }
  // ticks every 2 kW
  for (let kw = 0; kw <= DIAL_MAX_KW; kw += 2) {
    const a = -SWEEP / 2 + (kw / DIAL_MAX_KW) * SWEEP;
    b.box(0.03, 0.14, 0.02, {
      r: 0,
      mid: true,
      c: 'white',
      at: [Math.sin(a) * R * 0.64, Math.cos(a) * R * 0.64, 0.085],
      rot: [0, 0, -a],
    });
  }
  const needle = b.part('needle', { at: [0, 0, 0.11] });
  needle.box(0.05, 0.78, 0.03, { r: 0.012, c: 'white', at: [0, -0.08, 0] });
  needle.cyl(0.1, 0.06, { axis: 'z', seg: 20, slot: 'metal', c: 'mist', at: [0, 0, -0.01] });
  const model = b.build();
  const part = model.part('needle');
  return {
    group: model.group,
    set: (kW) =>
      (part.rotation.z = SWEEP / 2 - (Math.min(Math.max(kW, 0), DIAL_MAX_KW) / DIAL_MAX_KW) * SWEEP),
  };
}
