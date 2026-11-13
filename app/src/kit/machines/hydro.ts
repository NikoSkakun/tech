/**
 * Vertical hydrogenerator (salient-pole synchronous machine, low speed, many poles) with an optional Francis
 * runner on the same shaft. Shaft along Y. The stator ring has a cutaway window; the rotor rim carries pole
 * shoes alternating N coral / S blue with copper field coils; the stator winding is phase-coloured; the upper
 * bracket holds the thrust bearing and the exciter cap. Origin: generator floor level on the shaft axis.
 * Units: metres (stator bore ≈ 9 m).
 *
 * Parts: `rotor` (spins about Y: poles, spider, shaft, runner). Anchors: `stator`, `poles`, `thrustBearing`,
 * `exciter`, `u`, `v`, `w`, `runner` (if present), `shaft`.
 */
import { SEMANTIC, col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';
import { addFrancisRunner } from './runners';

export interface HydrogeneratorOptions {
  /** Number of poles (real machines: 20–100; 24 reads well). Default 24. */
  poles?: number;
  /** Angle of the cutaway window in the stator, radians. Default 1.8. */
  cut?: number;
  /** Francis runner below, at this depth under the generator floor (0 = no runner). Default 9. */
  runnerDepth?: number;
  scale?: number;
}

export interface Hydrogenerator extends KitModel {
  /** Rotor speed in rad/s for `update` (real: 6–15 rad/s; e.g. 125 rpm = 13 rad/s). */
  speed: number;
}

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export function hydrogenerator(o: HydrogeneratorOptions = {}): Hydrogenerator {
  const k = o.scale ?? 1;
  const poles = o.poles ?? 24;
  const cut = o.cut ?? 1.8;
  const depth = o.runnerDepth ?? 9;
  const rBore = 4.4 * k;
  const rCore = 5.3 * k;
  const rFrame = 5.9 * k;
  const h = 2.2 * k; // core height
  const y0 = 1.2 * k; // bottom of the core above the floor
  const frame = col('teal');
  const b = new Builder('hydrogenerator');
  // window toward the viewer (+Z): lathe φ = π/2 is +Z
  const win = { phiStart: Math.PI / 2 + cut / 2, phiLength: Math.PI * 2 - cut };
  const ringSection = (r0: number, r1: number, ya: number, yb: number): G.Pt[] => [[r0, ya], [r1, ya], [r1, yb], [r0, yb]];
  // stator: frame, core, winding bars with end rings, air coolers around
  const f = G.revolve(ringSection(rCore, rFrame, y0 - 0.5 * k, y0 + h + 0.5 * k), { seg: 48, ...win });
  b.add(f.shell, { slot: 'gloss', c: [frame.clone().multiplyScalar(0.78), frame] });
  if (f.caps) b.add(f.caps, { slot: 'gloss', c: col('coral').lerp(col('white'), 0.45) });
  const core = G.revolve(ringSection(rBore, rCore, y0, y0 + h), { seg: 48, ...win });
  b.add(core.shell, { slot: 'metal', c: col('slate').lerp(col('steel'), 0.35) });
  if (core.caps) b.add(core.caps, { slot: 'metal', c: 'steel.light' });
  const bars = poles * 3;
  for (let i = 0; i < bars; i++) {
    const a = (i / bars) * Math.PI * 2;
    const d = a - Math.PI / 2;
    if (cut > 0 && Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < cut / 2) continue;
    b.cyl(0.06 * k, h + 0.7 * k, { seg: 5, slot: 'gloss', c: PHASE[i % 3]!, at: [Math.cos(a) * (rBore + 0.1 * k), y0 - 0.35 * k, Math.sin(a) * (rBore + 0.1 * k)], bevel: 0 });
  }
  for (const y of [y0 - 0.4 * k, y0 + h + 0.4 * k]) {
    const ring = G.revolve(ringSection(rBore + 0.02 * k, rBore + 0.3 * k, y - 0.08 * k, y + 0.08 * k), { seg: 48, ...win });
    b.add(ring.shell, { slot: 'gloss', c: 'orange' });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < cut / 2 + 0.2) continue;
    b.box(1.6 * k, h * 0.9, 0.5 * k, { r: 0.1 * k, slot: 'gloss', c: 'sky', at: [Math.cos(a) * (rFrame + 0.2 * k), y0 + h * 0.05, Math.sin(a) * (rFrame + 0.2 * k)], rot: [0, Math.PI / 2 - a, 0] });
  }
  b.cyl(rFrame + 1.0 * k, 0.5 * k, { seg: 48, slot: 'matte', c: ['steel', 'mist'], at: [0, y0 - 1.0 * k, 0] });
  b.anchor('stator', 0, y0 + h, rFrame);
  (['u', 'v', 'w'] as const).forEach((name, i) => {
    const a = -0.5 + i * 0.22;
    b.cyl(0.18 * k, 1.0 * k, { seg: 8, slot: 'gloss', c: PHASE[i]!, at: [Math.cos(a) * (rFrame + 0.3 * k), y0 + h + 0.3 * k, -Math.sin(a) * (rFrame + 0.3 * k)] });
    b.anchor(name, Math.cos(a) * (rFrame + 0.3 * k), y0 + h + 1.4 * k, -Math.sin(a) * (rFrame + 0.3 * k));
  });
  // upper bracket: six arms to a central hub carrying the thrust bearing and exciter cap
  const yb = y0 + h + 1.2 * k;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    b.beam([Math.cos(a) * 1.2 * k, yb + 0.5 * k, Math.sin(a) * 1.2 * k], [Math.cos(a) * rFrame, yb - 0.4 * k, Math.sin(a) * rFrame], 0.5 * k, { h: 0.7 * k, r: 0.1 * k, slot: 'gloss', c: frame });
  }
  b.cyl(1.7 * k, 1.1 * k, { seg: 28, slot: 'gloss', c: frame, at: [0, yb, 0], bevel: 0.15 * k });
  b.cyl(1.1 * k, 0.9 * k, { seg: 24, slot: 'gloss', c: ['amber', 'yellow'], at: [0, yb + 1.1 * k, 0], bevel: 0.2 * k });
  b.anchor('thrustBearing', 1.7 * k, yb + 0.5 * k, 0);
  b.anchor('exciter', 0, yb + 2.1 * k, 0);
  // rotor (part): rim with pole shoes and coils, spider arms, shaft, runner
  const rotor = b.part('rotor');
  const rRim = rBore - 0.5 * k;
  rotor.add(G.revolve(ringSection(rRim - 0.45 * k, rRim, y0 + 0.1 * k, y0 + h - 0.1 * k), { seg: 48 }).shell, { slot: 'metal', c: 'steel' });
  for (let i = 0; i < poles; i++) {
    const a = (i / poles) * Math.PI * 2;
    const w = ((rRim * Math.PI * 2) / poles) * 0.62;
    rotor.frame({ rot: [0, -a, 0] }, () => {
      rotor.box(0.36 * k, h - 0.3 * k, w, { r: 0.05 * k, slot: 'gloss', c: i % 2 ? 'blue' : SEMANTIC.proton, at: [rRim + 0.2 * k, y0 + 0.15 * k, 0] });
      rotor.box(0.2 * k, h - 0.7 * k, w + 0.14 * k, { r: 0.04 * k, slot: 'metal', c: 'orange', at: [rRim + 0.1 * k, y0 + 0.35 * k, 0] });
    });
  }
  rotor.anchor('poles', 0, y0 + h / 2, rRim + 0.4 * k);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rotor.beam([0, y0 + h / 2, 0], [Math.cos(a) * (rRim - 0.3 * k), y0 + h / 2, Math.sin(a) * (rRim - 0.3 * k)], 0.3 * k, { h: h * 0.7, slot: 'metal', c: 'steel.light' });
  }
  rotor.cyl(0.8 * k, h + 0.4 * k, { seg: 20, slot: 'metal', c: 'steel.light', at: [0, y0 - 0.2 * k, 0] });
  rotor.cyl(0.45 * k, yb + 0.4 * k + depth, { seg: 16, slot: 'metal', c: 'mist', at: [0, -depth, 0], bevel: 0.03 });
  if (depth > 0) {
    rotor.frame({ at: [0, -depth - 0.9 * k, 0] }, () => addFrancisRunner(rotor, { radius: 1.9 * k }), 'runner.');
    rotor.anchor('runner', 0, -depth, 2 * k);
  }
  rotor.anchor('shaft', 0.5 * k, -depth / 2, 0);
  const model = b.build();
  const gen: Hydrogenerator = Object.assign(model, { speed: 1.2 });
  gen.update = (dt) => {
    model.part('rotor').rotation.y += gen.speed * dt;
  };
  return gen;
}
