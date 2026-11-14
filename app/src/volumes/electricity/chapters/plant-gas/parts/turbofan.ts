/**
 * «Порівняти з авіадвигуном» (step 3): a turbofan at the same scale (≈ 4 m long, fan ⌀ ≈ 3 m) — nacelle cut
 * open on the viewer's side, fan, core with compressor / combustor / turbine bands in the same colours as the
 * big machine, and a `sky` jet / bypass stream at the back. Axis along X, air toward +X; origin at the fan.
 */
import { Builder, type KitModel } from '@/kit';

export function buildTurbofan(): KitModel {
  const b = new Builder('turbofan');
  // nacelle: a lathe shell open over the front-facing third (phiStart/phiLength leave a window toward +Z)
  b.lathe(
    [[1.55, -0.3], [1.62, 0.2], [1.6, 2.2], [1.25, 3.4], [1.17, 3.4], [1.5, 2.2], [1.52, 0.2], [1.45, -0.3]],
    { axis: 'x', seg: 40, phiStart: 0.6, phiLength: Math.PI * 2 - 1.2, slot: 'gloss', c: ['mist', 'white'], crease: 40 },
  );
  // fan: hub cone + 18 wide blades
  b.cone(0.45, 0.6, { axis: 'x', seg: 24, slot: 'gloss', c: 'steel.light', at: [-0.2, 0, 0], tip: 0.05 });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    b.box(0.06, 1.0, 0.36, { r: 0.02, slot: 'metal', c: 'sky', at: [0.25, Math.cos(a) * 0.95, Math.sin(a) * 0.95], rot: [a, 0.5, 0], mid: true });
  }
  // core: compressor (sky→amber), combustor (orange), turbine (coral), nozzle
  b.cyl(0.62, 1.2, { axis: 'x', rTop: 0.52, seg: 28, slot: 'gloss', c: ['sky', 'amber'], at: [0.45, 0, 0] });
  b.cyl(0.6, 0.55, { axis: 'x', seg: 28, slot: 'gloss', c: ['orange', 'amber'], at: [1.65, 0, 0] });
  b.cyl(0.58, 0.8, { axis: 'x', rTop: 0.5, seg: 28, slot: 'gloss', c: ['coral', 'coral.dark'], at: [2.2, 0, 0] });
  b.cone(0.4, 1.1, { axis: 'x', seg: 20, slot: 'metal', c: 'steel', at: [3.0, 0, 0], tip: 0.05 });
  // pylon stub
  b.box(2.2, 0.9, 0.3, { r: 0.1, c: 'mist', at: [1.6, 1.55, 0] });
  b.anchor('jet', 4.2, 0, 0).anchor('fan', 0, 1.7, 0.4);
  return b.build();
}
