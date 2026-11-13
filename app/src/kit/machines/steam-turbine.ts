/**
 * Steam turbine: bladed rotor (HP → IP → double-flow LP sections) in horizontally split casings. The upper
 * casing halves with the cross-over pipes are one part that lifts off, exactly how a real turbine is opened;
 * the lower halves keep the fixed diaphragms between the rotating stages. Casing colours follow the steam:
 * HP coral (hottest) → IP amber → LP sky (cool, wet steam). Shaft along X, steam flows toward +X.
 * Units: metres (a 4-section set is ≈ 26 m long); origin on the shaft axis at the HP end.
 *
 * Parts: `rotor` (spins about X), `casingTop`. Anchors: `steamIn`, `reheatOut`, `reheatIn`, `exhaustN` (under
 * each LP), `<section>N` (top of each section), `coupling` (generator end), `axis0`.
 */
import { col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { addPipe } from '../industrial/piping';
import { addBearing, addBladeRow, addCoupling, addHalfShell, type CasingProfile } from './common';

export type TurbineSection = 'hp' | 'ip' | 'lp';

interface SectionSpec {
  length: number;
  /** Blade root and tip radius at the inlet and at the exhaust of the flow path. */
  hub: [number, number];
  tip: [number, number];
  stages: number;
  casing: number;
  color: 'coral' | 'amber' | 'sky';
}

const SPECS: Record<TurbineSection, SectionSpec> = {
  hp: { length: 3.0, hub: [0.42, 0.46], tip: [0.62, 0.84], stages: 7, casing: 1.25, color: 'coral' },
  ip: { length: 3.4, hub: [0.5, 0.56], tip: [0.8, 1.2], stages: 7, casing: 1.6, color: 'amber' },
  lp: { length: 5.2, hub: [0.62, 0.72], tip: [1.05, 2.05], stages: 5, casing: 2.55, color: 'sky' },
};

export interface SteamTurbineOptions {
  /** Sections from the steam inlet to the generator. Default HP, IP, LP, LP. */
  sections?: readonly TurbineSection[];
  /** Height of the shaft axis above the model origin plane (the operating floor). Default 3.2. */
  axisHeight?: number;
}

export interface SteamTurbine extends KitModel {
  /** Rotor speed in rad/s for `update` (real: 314 rad/s at 3000 rpm — show it slowed down). */
  speed: number;
  /** Total length along X (the generator couples at x = length). */
  readonly length: number;
  /** Lift the upper casing halves: 0 closed … 1 raised. */
  setOpen(open: number): void;
}

/** Adds the turbine into `b` with the shaft axis at y = axisHeight. Returns its length and the part names. */
export function addSteamTurbine(b: Builder, o: SteamTurbineOptions = {}): { length: number; rotor: string; top: string } {
  const sections = o.sections ?? ['hp', 'ip', 'lp', 'lp'];
  const ay = o.axisHeight ?? 3.2;
  const shaftR = 0.3;
  const gap = 1.5; // bearing span between casings
  const rotorName = b.fullName('rotor');
  const topName = b.fullName('casingTop');
  const rotor = b.part('rotor', { at: [0, ay, 0] });
  const top = b.part('casingTop', { at: [0, ay, 0] });
  let x = gap;
  const count: Record<string, number> = {};
  let length = 0;
  b.frame({ at: [0, ay, 0] }, () => {
    addBearing(b, gap * 0.45, ay, shaftR);
    sections.forEach((kind, si) => {
      const s = SPECS[kind];
      const c = col(s.color);
      const x0 = x;
      const x1 = x + s.length;
      const mid = (x0 + x1) / 2;
      const id = `${kind}${(count[kind] = (count[kind] ?? 0) + 1)}`;
      // flow path: LP is double-flow (steam enters in the middle and expands both ways)
      const flows = kind === 'lp' ? [-1, 1] : [1];
      for (const dir of flows) {
        const start = kind === 'lp' ? mid : x0 + 0.35;
        const span = (kind === 'lp' ? s.length / 2 : s.length) - 0.55;
        for (let i = 0; i < s.stages; i++) {
          const t = (i + 0.5) / s.stages;
          const sx = start + dir * (0.15 + t * span);
          const hub = s.hub[0] + (s.hub[1] - s.hub[0]) * t;
          const tip = s.tip[0] + (s.tip[1] - s.tip[0]) * Math.pow(t, 1.4);
          rotor.cyl(hub, (span / s.stages) * 0.5, { axis: 'x', seg: 18, slot: 'metal', c: 'steel', at: [sx - (span / s.stages) * 0.25, 0, 0], bevel: 0.02 });
          addBladeRow(rotor, sx, hub, tip, 26 + i * 2, { c: 'mist', stagger: dir * 0.6 });
          // fixed diaphragm ahead of each rotating row, in the lower half only
          const dx = sx - dir * (span / s.stages) * 0.5;
          addHalfShell(b, [[dx - 0.03, tip + 0.06], [dx + 0.03, tip + 0.06]], { half: 'lower', t: tip - hub - 0.02, c: col('steel.light'), flange: false, seg: 12 });
        }
      }
      // casing: barrel with end walls narrowing to the shaft glands
      const profile: CasingProfile = [[x0, shaftR + 0.25], [x0 + 0.02, s.casing * 0.62], [x0 + s.length * 0.2, s.casing], [x1 - s.length * 0.2, s.casing], [x1 - 0.02, s.casing * 0.62], [x1, shaftR + 0.25]];
      addHalfShell(b, profile, { half: 'lower', t: 0.14, c });
      addHalfShell(top, profile, { half: 'upper', t: 0.14, c });
      b.box(s.length * 0.7, ay - s.casing * 0.6, s.casing * 1.3, { r: 0.15, slot: 'matte', c: ['steel', 'mist'], at: [mid, -ay, 0] });
      top.anchor(id, mid, s.casing + 0.3, 0);
      if (kind === 'lp') {
        b.box(s.length * 0.62, 0.5, s.casing * 1.5, { r: 0.1, slot: 'gloss', c: c.clone().multiplyScalar(0.85), at: [mid, -s.casing - 0.35, 0] });
        b.anchor(`exhaust${count[kind]}`, mid, -s.casing - 0.4, 0);
      }
      x = x1;
      addBearing(b, x + gap * 0.5, ay, shaftR);
      if (si < sections.length - 1) addCoupling(rotor, x + gap * 0.5 + shaftR * 2.4, shaftR);
      x += gap;
    });
    length = x;
    rotor.cyl(shaftR, length - 0.1, { axis: 'x', seg: 14, slot: 'metal', c: 'mist', at: [0.05, 0, 0], bevel: 0.03 });
    addCoupling(rotor, length - 0.15, shaftR);
    b.anchor('coupling', length, 0, 0);
    b.anchor('axis0', 0, 0, 0);
  });
  // steam admission to HP from below through two stop/control valves; reheat lines; cross-over pipes to the LPs
  let xs = gap;
  sections.forEach((kind, i) => {
    const s = SPECS[kind];
    if (kind === 'hp') {
      for (const side of [-1, 1]) {
        addPipe(b, [[xs + 0.7, 0.2, side * 2.6], [xs + 0.7, ay - 0.2, side * 2.6], [xs + 0.7, ay - 0.2, side * 1.0]], { radius: 0.26, color: 'red', flangeEvery: 0 });
        b.sphere(0.5, { seg: 12, slot: 'gloss', c: 'red', at: [xs + 0.7, ay - 0.2, side * 2.6] });
      }
      b.anchor('steamIn', xs + 0.7, 0.2, 2.6);
      b.anchor('reheatOut', xs + s.length - 0.5, ay - s.casing, 0);
    }
    if (kind === 'ip' && i > 0) b.anchor('reheatIn', xs + 0.6, ay - s.casing, 0);
    if (kind === 'ip' || (kind === 'hp' && !sections.includes('ip'))) {
      const from = xs + s.length - 0.7;
      sections.forEach((k2, j) => {
        if (k2 !== 'lp') return;
        let lx = gap;
        for (let q = 0; q < j; q++) lx += SPECS[sections[q]!].length + gap;
        const target = lx + SPECS.lp.length / 2;
        const z = (j % 2 ? -1 : 1) * 0.75;
        addPipe(top, [[from, s.casing * 0.8, z], [from, SPECS.lp.casing + 1.3, z], [target, SPECS.lp.casing + 1.3, z], [target, SPECS.lp.casing - 0.1, z]], { radius: 0.42, color: 'mist', bend: 1.0, flangeEvery: 0 });
      });
    }
    xs += s.length + gap;
  });
  return { length, rotor: rotorName, top: topName };
}

export function steamTurbine(o: SteamTurbineOptions = {}): SteamTurbine {
  const b = new Builder('steam-turbine');
  const info = addSteamTurbine(b, o);
  const model = b.build();
  const turbine: SteamTurbine = Object.assign(model, {
    speed: 2.5,
    length: info.length,
    setOpen: (open: number): void => void (model.part(info.top).position.y = (o.axisHeight ?? 3.2) + open * 5),
  });
  turbine.update = (dt) => {
    model.part(info.rotor).rotation.x += turbine.speed * dt;
  };
  return turbine;
}
