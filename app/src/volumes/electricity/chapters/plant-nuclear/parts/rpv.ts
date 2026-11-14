/**
 * The VVER-1000 reactor pressure vessel at real size (metres; local y = 0 at the bottom of the vessel):
 * a forged steel vessel (Ø 4,5 m, wall ≈ 0,2 m with a thin stainless cladding, ≈ 10,9 m without the head) whose
 * quarter facing the cameras is a separate model (`quarter`) that slides away for the cutaway; the core barrel
 * (likewise split); the core of 163 assemblies (instanced, emissive — `setGlow`); the protective-tube unit;
 * 61 control-rod clusters (part of `rods`, slide down into the core); the head with 61 drive «pencils»;
 * four pairs of nozzles (inlet = cold, lower row; outlet = hot, upper row) toward the four loops.
 */
import { Color, CylinderGeometry, Group, InstancedMesh, Matrix4 } from 'three';
import { G, Builder, type KitModel } from '@/kit';
import { K, heatRamp } from '@/style';
import { LOOPS } from '../layout';
import { FA, hexLattice } from './fuel-models';

export const VESSEL = { r: 2.27, wall: 0.19, flange: 10.3, top: 10.9, coreY: 2.8, coreH: 3.53, nozzleIn: 7.9, nozzleOut: 9.2, barrelR: 1.85 } as const;
const CUT = { start: Math.PI / 4, length: Math.PI / 2 }; // the quarter facing +Z (the cameras): kit lathe x = r·cos φ, z = r·sin φ

function vesselSection(): [number, number][] {
  const { r, wall } = VESSEL;
  const ri = r - wall;
  const out: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * (Math.PI / 2);
    out.push([Math.max(0.02, Math.cos(a) * r), r + Math.sin(a) * r]);
  }
  out.push([r, VESSEL.flange], [r + 0.2, VESSEL.flange], [r + 0.2, VESSEL.top], [ri, VESSEL.top], [ri, r]);
  for (let i = 10; i >= 0; i--) {
    const a = -Math.PI / 2 + (i / 10) * (Math.PI / 2);
    out.push([Math.max(0.02, Math.cos(a) * ri), r + Math.sin(a) * ri]);
  }
  return out;
}

function addShell(b: Builder, phiStart: number, phiLength: number): void {
  const o = { phiStart, phiLength, seg: Math.round((48 * phiLength) / (Math.PI * 2)) + 2 };
  const v = G.revolve(vesselSection(), o);
  b.add(v.shell, { slot: 'metal', c: ['steel', 'steel.light'] });
  if (v.caps) b.add(v.caps, { slot: 'matte', c: 'slate.light' });
  // stainless cladding: a thin bright layer on the inside
  const ri = VESSEL.r - VESSEL.wall;
  const clad = G.revolve([[ri - 0.03, VESSEL.r], [ri, VESSEL.r], [ri, VESSEL.top - 0.05], [ri - 0.03, VESSEL.top - 0.05]], o);
  b.add(clad.shell, { slot: 'gloss', c: 'mist.light' });
}

function addBarrel(b: Builder, phiStart: number, phiLength: number): void {
  const o = { phiStart, phiLength, seg: Math.round((40 * phiLength) / (Math.PI * 2)) + 2 };
  const r = VESSEL.barrelR;
  const s = G.revolve([[r - 0.07, 1.4], [r, 1.4], [r, VESSEL.flange], [r + 0.16, VESSEL.flange], [r + 0.16, VESSEL.flange + 0.2], [r - 0.07, VESSEL.flange + 0.2]], o);
  b.add(s.shell, { slot: 'metal', c: ['blue.dark', 'steel'] });
  if (s.caps) b.add(s.caps, { slot: 'matte', c: 'slate.light' });
}

export interface Rpv {
  group: Group;
  vessel: KitModel;
  quarter: KitModel;
  barrel: KitModel;
  barrelQuarter: KitModel;
  head: KitModel;
  core: InstancedMesh;
  /** Control-rod clusters: `rods.position.y` 0 = withdrawn … −ROD_TRAVEL = fully in. */
  rods: Group;
  /** Core glow 0…1 (∝ fission power) and its profile (centre hotter). */
  setGlow(level: number): void;
}

export const ROD_TRAVEL = 3.6;

export function buildRpv(): Rpv {
  const group = new Group();
  const vb = new Builder('rpv-vessel');
  addShell(vb, CUT.start + CUT.length, Math.PI * 2 - CUT.length);
  // nozzles toward the loops: inlet (lower) and outlet (upper)
  for (const az of LOOPS.azimuths)
    for (const [y, c] of [[VESSEL.nozzleIn, 'steel'], [VESSEL.nozzleOut, 'steel.light']] as const)
      vb.cyl(0.5, 1.3, { axis: 'x', seg: 20, slot: 'metal', c, at: [Math.sin(az) * (VESSEL.r - 0.1), y, Math.cos(az) * (VESSEL.r - 0.1)], rot: [0, az - Math.PI / 2, 0] });
  const vessel = vb.build();
  const qb = new Builder('rpv-quarter');
  addShell(qb, CUT.start, CUT.length);
  const quarter = qb.build();
  const bb = new Builder('rpv-barrel');
  addBarrel(bb, CUT.start + CUT.length, Math.PI * 2 - CUT.length);
  bb.cyl(VESSEL.barrelR - 0.05, 0.25, { seg: 40, slot: 'metal', c: 'steel', at: [0, 1.4, 0] }); // support plate
  // protective-tube unit above the core: 61 tubes
  for (const p of hexLattice(4, 0.3)) bb.cyl(0.06, 3.2, { seg: 8, slot: 'metal', c: 'steel.light', at: [p.x, VESSEL.coreY + VESSEL.coreH + 0.35, p.z] });
  for (const y of [6.6, 8, 9.4]) bb.cyl(VESSEL.barrelR - 0.08, 0.12, { seg: 40, slot: 'metal', c: 'steel', at: [0, y, 0] });
  // specimen holders (small capsules on the barrel outside, in the downcomer gap)
  for (const az of [2.6, 4.0, 5.4, 0.9]) bb.capsule(0.07, 0.6, { seg: 8, slot: 'gloss', c: 'amber', at: [Math.sin(az) * (VESSEL.barrelR + 0.12), 4.2, Math.cos(az) * (VESSEL.barrelR + 0.12)] });
  bb.anchor('specimen', Math.sin(0.9) * (VESSEL.barrelR + 0.12), 4.5, Math.cos(0.9) * (VESSEL.barrelR + 0.12));
  const barrel = bb.build();
  const bq = new Builder('rpv-barrel-quarter');
  addBarrel(bq, CUT.start, CUT.length);
  const barrelQuarter = bq.build();
  // head: dome + upper unit + 61 drive pencils + top plate
  const hb = new Builder('rpv-head');
  hb.dome(VESSEL.r + 0.2, 1.3, { seg: 48, slot: 'metal', c: ['steel', 'steel.light'], at: [0, VESSEL.top, 0] });
  hb.cyl(1.9, 0.6, { seg: 40, slot: 'metal', c: 'slate.light', at: [0, VESSEL.top + 1.2, 0] });
  for (const p of hexLattice(4, 0.32)) {
    hb.cyl(0.075, 4.2, { seg: 10, slot: 'metal', c: ['steel', 'mist'], at: [p.x, VESSEL.top + 1.2, p.z] });
    hb.cyl(0.11, 0.5, { seg: 10, slot: 'metal', c: 'violet.dark', at: [p.x, VESSEL.top + 3.6, p.z] }); // electromagnet coils
  }
  hb.cyl(1.75, 0.25, { seg: 40, slot: 'metal', c: 'slate', at: [0, VESSEL.top + 5.4, 0] });
  for (const a of [0, 2.1, 4.2]) hb.rod([Math.cos(a) * 1.7, VESSEL.top + 1.2, Math.sin(a) * 1.7], [Math.cos(a) * 1.6, VESSEL.top + 5.4, Math.sin(a) * 1.6], 0.09, { c: 'slate' });
  hb.anchor('drives', 0, VESSEL.top + 4.2, 0);
  const head = hb.build();
  // core: 163 hex prisms, self-lit (`K.glow`), colours along the heat ramp, hotter in the middle
  const spots = hexLattice(7, FA.pitch, true);
  const prism = new CylinderGeometry(FA.flat / Math.sqrt(3) - 0.006, FA.flat / Math.sqrt(3) - 0.006, VESSEL.coreH, 6).rotateY(Math.PI / 6).translate(0, VESSEL.coreH / 2, 0);
  const glowMat = K.glow({ color: 'white', intensity: 1.4, whiten: 0, keepHue: true });
  const core = new InstancedMesh(prism, glowMat, spots.length);
  const m = new Matrix4();
  spots.forEach((s, i) => core.setMatrixAt(i, m.makeTranslation(s.x, VESSEL.coreY, s.z)));
  const rods = new Group();
  const rodMesh = new InstancedMesh(new CylinderGeometry(0.05, 0.05, VESSEL.coreH, 8).translate(0, VESSEL.coreH / 2, 0), K.metal({ color: 'slate' }), 61);
  hexLattice(4, 0.3).forEach((p, i) => rodMesh.setMatrixAt(i, m.makeTranslation(p.x, VESSEL.coreY + VESSEL.coreH + 0.05, p.z)));
  rods.add(rodMesh);
  group.add(vessel.group, quarter.group, barrel.group, barrelQuarter.group, head.group, core, rods);
  const c = new Color();
  const rMax = 7 * FA.pitch;
  return {
    group,
    vessel,
    quarter,
    barrel,
    barrelQuarter,
    head,
    core,
    rods,
    setGlow(level) {
      spots.forEach((s, i) => {
        const radial = 1 - 0.55 * Math.min(1, Math.hypot(s.x, s.z) / rMax) ** 2;
        c.copy(heatRamp(Math.min(1, 0.15 + 0.85 * radial * level))).multiplyScalar(0.25 + 0.95 * level * radial);
        core.setColorAt(i, c);
      });
      if (core.instanceColor) core.instanceColor.needsUpdate = true;
    },
  };
}
