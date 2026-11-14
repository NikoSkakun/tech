/**
 * Geometry of the hero gas turbine (document: «14-ступінчастий осьовий компресор з поворотними лопатками входу,
 * кільцева камера згоряння з 12–16 пальниками, 4-ступінчаста турбіна, вихлопний дифузор»). Shaft along X, air
 * flows toward +X, the generator couples at x = 0 (cold end). Metres, real proportions (≈ 13 m × ⌀ 5 m).
 *
 * Built as three section models (compressor · combustor · turbine) so that a section can be highlighted on
 * its own; each has an `inner` model (rotor part + static vanes) and a `casing` model (closed shells only, so a
 * `Cutaway` clips nothing but the casing).
 */
import { Builder, type G, addBladeRow, type KitModel } from '@/kit';
import { col } from '@/style';

export type GtSection = 'compressor' | 'combustor' | 'turbine';
export const GT_SECTIONS: readonly GtSection[] = ['compressor', 'combustor', 'turbine'];

/** Stations along the shaft, metres from the coupling. */
export const GT_X = { plenum0: 0.7, igv: 2.35, comp0: 2.55, comp1: 7.0, burn0: 7.1, burn1: 9.0, turb0: 9.1, turb1: 10.9, end: 13.2 } as const;
export const GT_STAGES = { compressor: 14, turbine: 4, burners: 14 } as const;
/** Flow-path radii (hub, tip) at the ends of the compressor and turbine. */
const COMP_R = { hub: [0.66, 0.9], tip: [1.5, 1.04] } as const;
const TURB_R = { hub: [0.86, 0.8], tip: [1.12, 1.5] } as const;

export interface GtModels {
  inner: Record<GtSection, KitModel>;
  casing: Record<GtSection, KitModel>;
  /** Name of the rotor part in each inner model. */
  rotor: 'rotor';
}

/** Closed wall of revolution: outer radii `outer` and a wall of thickness `t` along X ([x, r] points). */
function shell(outer: readonly (readonly [number, number])[], t: number): G.Pt[] {
  const out = outer.map(([x, r]) => [r, x] as G.Pt);
  const inn = [...outer].reverse().map(([x, r]) => [r - t, x] as G.Pt);
  return [...out, ...inn, out[0] as G.Pt];
}

function compressor(): { inner: KitModel; casing: KitModel } {
  const b = new Builder('gt-compressor');
  const rotor = b.part('rotor');
  const n = GT_STAGES.compressor;
  // inlet plenum around the shaft (air arrives from the filter house above) and the variable inlet guide vanes
  b.lathe([[0.5, GT_X.plenum0], [2.3, GT_X.plenum0], [2.3, GT_X.plenum0 + 0.25], [1.65, GT_X.igv - 0.15], [1.55, GT_X.igv], [0.5, GT_X.igv - 0.4]], { axis: 'x', seg: 40, slot: 'gloss', c: ['sky.dark', 'sky'], crease: 40 });
  addBladeRow(b, GT_X.igv, 0.62, 1.52, 30, { c: 'cyan', stagger: 1.0, slot: 'gloss', chord: 0.32 });
  b.anchor('igv', GT_X.igv, 1.55, 0.2);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = GT_X.comp0 + 0.12 + t * (GT_X.comp1 - GT_X.comp0 - 0.3);
    const hub = COMP_R.hub[0] + t * (COMP_R.hub[1] - COMP_R.hub[0]);
    const tip = COMP_R.tip[0] + t * (COMP_R.tip[1] - COMP_R.tip[0]);
    // air heats as it is squeezed: blades shade from `sky` to `amber`
    const c = col('sky').lerp(col('amber'), t);
    rotor.cyl(hub, 0.16, { axis: 'x', seg: 28, slot: 'metal', c: 'steel', at: [x - 0.08, 0, 0], bevel: 0.01 });
    addBladeRow(rotor, x, hub, tip - 0.02, 26 + i, { c, stagger: 0.75, slot: 'gloss', chord: 0.2 - t * 0.06 });
    // stator vanes (static, a shade darker) between rotor rows
    addBladeRow(b, x + 0.15, hub + 0.03, tip, 30 + i, { c: c.clone().multiplyScalar(0.72), stagger: -0.6, slot: 'gloss', chord: 0.14 - t * 0.04 });
  }
  b.anchor('bleed', GT_X.comp0 + 0.62 * (GT_X.comp1 - GT_X.comp0), 1.95, 0.4);
  b.anchor('compressor', (GT_X.comp0 + GT_X.comp1) / 2, 0, 0);
  rotor.cyl(0.32, GT_X.comp1, { axis: 'x', seg: 18, slot: 'metal', c: 'mist', at: [0.05, 0, 0], bevel: 0.02 });
  // coupling flange and front bearing pedestal
  rotor.cyl(0.62, 0.22, { axis: 'x', seg: 28, slot: 'metal', c: 'steel.light', at: [0, 0, 0], bevel: 0.04 });
  b.anchor('starter', 0, 0.8, 0);
  b.box(0.9, 3.6 - 0.6, 2.4, { r: 0.12, slot: 'matte', c: ['slate', 'steel'], at: [0.5, -3.6, 0] });
  const inner = b.build();
  const c = new Builder('gt-compressor-casing');
  // bleed-air manifold ring on the outside (a pipe ring around the casing at the 10th stage)
  c.lathe(shell([[GT_X.igv - 0.1, 1.78], [GT_X.comp0 + 1.4, 1.62], [GT_X.comp1 - 0.4, 1.34], [GT_X.comp1, 1.5]], 0.12), { axis: 'x', seg: 48, slot: 'gloss', c: ['sky.light', 'white'], crease: 40 });
  c.ring(1.62, 0.12, { axis: 'x', seg: 40, tubeSeg: 8, slot: 'metal', c: 'teal', at: [GT_X.comp0 + 0.62 * (GT_X.comp1 - GT_X.comp0), 0, 0] });
  return { inner, casing: c.build() };
}

function combustor(): { inner: KitModel; casing: KitModel } {
  const b = new Builder('gt-combustor');
  const rotor = b.part('rotor');
  rotor.cyl(0.7, GT_X.burn1 - GT_X.burn0 + 0.2, { axis: 'x', seg: 28, slot: 'metal', c: 'steel.light', at: [GT_X.burn0 - 0.1, 0, 0], bevel: 0.04 });
  // annular flame tube: a closed ring section around the shaft
  b.lathe(shell([[GT_X.burn0 + 0.3, 1.25], [GT_X.burn0 + 0.8, 1.95], [GT_X.burn1 - 0.4, 1.95], [GT_X.burn1, 1.3]], 0.1), { axis: 'x', seg: 48, slot: 'gloss', c: ['orange', 'amber'], crease: 30 });
  b.lathe(shell([[GT_X.burn0 + 0.3, 0.95], [GT_X.burn0 + 0.8, 0.82], [GT_X.burn1 - 0.3, 0.82], [GT_X.burn1, 0.92]], 0.08), { axis: 'x', seg: 40, slot: 'gloss', c: ['orange.dark', 'orange'], crease: 30 });
  // burners around the ring, fed from the gas manifold (`violet`)
  for (let i = 0; i < GT_STAGES.burners; i++) {
    const a = (i / GT_STAGES.burners) * Math.PI * 2;
    const y = Math.cos(a);
    const z = Math.sin(a);
    b.frame({ at: [GT_X.burn0 + 0.15, y * 1.42, z * 1.42], rot: [a, 0, 0] }, () => {
      b.cyl(0.13, 0.5, { axis: 'x', seg: 12, slot: 'metal', c: 'slate', at: [-0.2, 0, 0] });
      b.cyl(0.05, 0.9, { seg: 8, slot: 'gloss', c: 'violet', at: [-0.1, 0, 0] });
    });
  }
  b.ring(2.42, 0.1, { axis: 'x', seg: 48, tubeSeg: 8, slot: 'gloss', c: 'violet', at: [GT_X.burn0 + 0.05, 0, 0] });
  b.anchor('fuel', GT_X.burn0 + 0.05, -2.42, 0);
  b.anchor('burner', GT_X.burn0 + 0.6, 1.4, 0.5);
  b.anchor('combustor', (GT_X.burn0 + GT_X.burn1) / 2, 0, 0);
  const inner = b.build();
  const c = new Builder('gt-combustor-casing');
  c.lathe(shell([[GT_X.burn0 - 0.1, 1.5], [GT_X.burn0 + 0.4, 2.3], [GT_X.burn1 - 0.3, 2.3], [GT_X.burn1 + 0.1, 1.7]], 0.12), { axis: 'x', seg: 48, slot: 'gloss', c: ['amber.dark', 'amber'], crease: 30 });
  return { inner, casing: c.build() };
}

function turbine(): { inner: KitModel; casing: KitModel } {
  const b = new Builder('gt-turbine');
  const rotor = b.part('rotor');
  const n = GT_STAGES.turbine;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = GT_X.turb0 + 0.25 + t * (GT_X.turb1 - GT_X.turb0 - 0.5);
    const hub = TURB_R.hub[0] + t * (TURB_R.hub[1] - TURB_R.hub[0]);
    const tip = TURB_R.tip[0] + t * (TURB_R.tip[1] - TURB_R.tip[0]);
    // the first stage is the hottest: `white`-hot `orange`, cooling to `coral` downstream
    const c = col('yellow').lerp(col('orange'), 0.4 + 0.2 * t).lerp(col('coral'), t * 0.8);
    addBladeRow(b, x - 0.17, hub + 0.02, tip, 32 + i * 4, { c: c.clone().multiplyScalar(0.75), stagger: 0.7, slot: 'gloss', chord: 0.18 + t * 0.05 });
    rotor.cyl(hub, 0.26, { axis: 'x', seg: 28, slot: 'metal', c: 'steel', at: [x - 0.13, 0, 0], bevel: 0.02 });
    addBladeRow(rotor, x, hub, tip - 0.02, 40 + i * 6, { c, stagger: -0.7, slot: 'gloss', chord: 0.22 + t * 0.06 });
  }
  b.anchor('blade1', GT_X.turb0 + 0.25, (TURB_R.hub[0] + TURB_R.tip[0]) / 2, 0);
  b.anchor('turbine', (GT_X.turb0 + GT_X.turb1) / 2, 0, 0);
  rotor.cyl(0.32, GT_X.end - GT_X.turb0, { axis: 'x', seg: 18, slot: 'metal', c: 'mist', at: [GT_X.turb0, 0, 0], bevel: 0.02 });
  // exhaust: hub cone and the rear bearing struts
  b.lathe([[0.8, GT_X.turb1], [0.75, GT_X.turb1 + 1.2], [0.4, GT_X.end - 0.2], [0.05, GT_X.end - 0.1]], { axis: 'x', seg: 28, slot: 'metal', c: ['coral.dark', 'steel'], crease: 40 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    b.beam([GT_X.turb1 + 0.8, Math.cos(a) * 0.75, Math.sin(a) * 0.75], [GT_X.turb1 + 0.8, Math.cos(a) * 1.9, Math.sin(a) * 1.9], 0.14, { slot: 'metal', c: 'steel' });
  }
  b.anchor('exhaust', GT_X.end, 0, 0);
  b.box(0.9, 3.0, 2.6, { r: 0.12, slot: 'matte', c: ['slate', 'steel'], at: [GT_X.turb1 + 0.6, -3.6, 0] });
  const inner = b.build();
  const c = new Builder('gt-turbine-casing');
  c.lathe(shell([[GT_X.turb0 - 0.1, 1.72], [GT_X.turb1, 1.95], [GT_X.turb1 + 0.2, 2.0], [GT_X.end, 2.45]], 0.12), { axis: 'x', seg: 48, slot: 'gloss', c: ['coral.dark', 'coral'], crease: 30 });
  return { inner, casing: c.build() };
}

export function buildGtModels(): GtModels {
  const parts = { compressor: compressor(), combustor: combustor(), turbine: turbine() };
  return {
    inner: { compressor: parts.compressor.inner, combustor: parts.combustor.inner, turbine: parts.turbine.inner },
    casing: { compressor: parts.compressor.casing, combustor: parts.combustor.casing, turbine: parts.turbine.casing },
    rotor: 'rotor',
  };
}
