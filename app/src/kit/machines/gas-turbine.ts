/**
 * Heavy-duty gas turbine (Brayton cycle), shaft along X, air flows toward +X:
 * inlet bellmouth → axial compressor (many stages, the flow path narrows: `sky` → `blue`) → ring of combustor
 * cans (`orange`, with the fuel-gas manifold in `violet`) → turbine (few stages, the path widens: `red`) →
 * exhaust diffuser. The upper casing half is a part that lifts off; the rotor spins. The generator couples at
 * the cold (compressor) end, x = 0. Units: metres (≈ 12 m long); origin on the shaft axis.
 *
 * Parts: `rotor`, `casingTop`. Anchors: `airIn`, `compressor`, `combustor`, `fuel`, `turbine`, `exhaust`, `coupling`.
 */
import { col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { addBearing, addBladeRow, addCoupling, addHalfShell, type CasingProfile } from './common';

export interface GasTurbine extends KitModel {
  speed: number;
  readonly length: number;
  setOpen(open: number): void;
}

export function addGasTurbine(b: Builder, o: { axisHeight?: number } = {}): { length: number; rotor: string; top: string } {
  const ay = o.axisHeight ?? 2.6;
  const rotorName = b.fullName('rotor');
  const topName = b.fullName('casingTop');
  const rotor = b.part('rotor', { at: [0, ay, 0] });
  const top = b.part('casingTop', { at: [0, ay, 0] });
  const shaftR = 0.25;
  const xc0 = 2.2; // compressor start
  const xc1 = 6.2; // compressor end / combustor start
  const xt0 = 7.6; // turbine start
  const xt1 = 9.4; // turbine end
  const length = 12.2;
  b.frame({ at: [0, ay, 0] }, () => {
    addBearing(b, 1.0, ay, shaftR);
    addCoupling(rotor, 0.2, shaftR);
    // inlet bellmouth (full ring, static)
    b.lathe([[0.75, 0], [1.9, 0.0], [1.75, 0.25], [1.25, 0.75], [1.2, 0.9], [1.05, 0.9], [1.1, 0.7], [0.75, 0.15]], { axis: 'x', seg: 28, slot: 'gloss', c: ['sky', 'sky.light'], at: [xc0 - 0.9, 0, 0], crease: 50 });
    b.anchor('airIn', xc0 - 1.1, 0, 0);
    // compressor: 12 stages, hub rises and tips fall along the flow
    const stages = 12;
    for (let i = 0; i < stages; i++) {
      const t = i / (stages - 1);
      const x = xc0 + 0.15 + t * (xc1 - xc0 - 0.4);
      const hub = 0.5 + t * 0.32;
      const tip = 1.12 - t * 0.14;
      rotor.cyl(hub, 0.2, { axis: 'x', seg: 18, slot: 'metal', c: 'steel', at: [x - 0.1, 0, 0], bevel: 0.01 });
      addBladeRow(rotor, x, hub, tip, 24 + i, { c: col('sky').lerp(col('blue'), t), stagger: 0.75, slot: 'gloss' });
    }
    // turbine: 4 stages, growing
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const x = xt0 + 0.25 + t * (xt1 - xt0 - 0.5);
      const hub = 0.72 - t * 0.06;
      const tip = 1.05 + t * 0.3;
      rotor.cyl(hub, 0.3, { axis: 'x', seg: 18, slot: 'metal', c: 'steel', at: [x - 0.15, 0, 0], bevel: 0.01 });
      addBladeRow(rotor, x, hub, tip, 30 + i * 2, { c: col('coral').lerp(col('red'), 1 - t), stagger: -0.7, slot: 'gloss', chord: 0.3 });
    }
    rotor.cyl(shaftR, length - 1.4, { axis: 'x', seg: 14, slot: 'metal', c: 'mist', at: [0.05, 0, 0], bevel: 0.02 });
    rotor.cyl(0.6, xt0 - xc1 + 0.4, { axis: 'x', seg: 18, slot: 'metal', c: 'steel.light', at: [xc1 - 0.2, 0, 0] });
    // casings: compressor (cool), combustor wrapper, turbine (hot), each split horizontally
    const comp: CasingProfile = [[xc0, 1.24], [xc1 - 0.3, 1.08], [xc1, 1.3]];
    const mid: CasingProfile = [[xc1, 1.3], [xc1 + 0.3, 1.55], [xt0 - 0.2, 1.55], [xt0, 1.3]];
    const turb: CasingProfile = [[xt0, 1.3], [xt0 + 0.3, 1.25], [xt1, 1.5]];
    for (const [profile, c] of [[comp, col('sky.light')], [mid, col('amber')], [turb, col('coral')]] as const) {
      addHalfShell(b, profile, { half: 'lower', t: 0.1, c });
      addHalfShell(top, profile, { half: 'upper', t: 0.1, c });
    }
    top.anchor('compressor', (xc0 + xc1) / 2, 1.5, 0);
    top.anchor('turbine', (xt0 + xt1) / 2, 1.7, 0);
    // combustor cans around the middle casing, leaning into the flow, with fuel nozzles and the gas ring main
    const cans = 10;
    for (let i = 0; i < cans; i++) {
      const a = (i / cans) * Math.PI * 2 + 0.31;
      const host = Math.sin(a) > 0.05 ? top : b; // cans above the joint lift off with the upper half
      host.frame({ at: [xc1 + 0.75, Math.sin(a) * 1.5, Math.cos(a) * 1.5], rot: [-a + Math.PI / 2, 0, 0] }, () => {
        host.cyl(0.3, 1.2, { seg: 12, slot: 'gloss', c: ['orange', 'amber'], at: [-0.3, 0.05, 0], rot: [0, 0, 0.6], bevel: 0.08 });
        host.cyl(0.12, 0.3, { seg: 8, slot: 'metal', c: 'slate', at: [-1.0, 1.02, 0], rot: [0, 0, 0.6] });
      });
    }
    b.ring(2.45, 0.09, { axis: 'x', seg: 36, tubeSeg: 6, slot: 'gloss', c: 'violet', at: [xc1 - 0.35, 0, 0] });
    b.anchor('fuel', xc1 - 0.35, -2.45, 0);
    b.anchor('combustor', xc1 + 0.7, 0, 2.3);
    // exhaust diffuser and rear bearing; skid
    b.lathe([[1.5, 0], [2.0, 2.2], [2.0, 2.6], [1.86, 2.6], [1.86, 2.2], [1.4, 0.1]], { axis: 'x', seg: 28, slot: 'gloss', c: ['coral.dark', 'coral'], at: [xt1, 0, 0], crease: 50 });
    b.cone(0.7, 1.6, { axis: 'x', seg: 16, slot: 'metal', c: 'steel', at: [xt1 + 0.1, 0, 0] });
    b.anchor('exhaust', length, 0, 0);
    b.anchor('coupling', 0, 0, 0);
    for (const x of [xc0 + 0.6, xc1 + 0.7, xt1 - 0.3]) b.box(0.9, ay - 1.0, 2.6, { r: 0.12, slot: 'matte', c: ['steel', 'mist'], at: [x, -ay, 0] });
    b.box(length - 1, 0.4, 3.4, { r: 0.1, slot: 'metal', c: 'slate', at: [length / 2, -ay, 0] });
  });
  return { length, rotor: rotorName, top: topName };
}

export function gasTurbine(o: { axisHeight?: number } = {}): GasTurbine {
  const b = new Builder('gas-turbine');
  const info = addGasTurbine(b, o);
  const model = b.build();
  const gt: GasTurbine = Object.assign(model, {
    speed: 3,
    length: info.length,
    setOpen: (open: number): void => void (model.part(info.top).position.y = (o.axisHeight ?? 2.6) + open * 4),
  });
  gt.update = (dt) => {
    model.part(info.rotor).rotation.x += gt.speed * dt;
  };
  return gt;
}
