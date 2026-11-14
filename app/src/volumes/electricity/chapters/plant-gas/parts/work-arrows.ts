/**
 * The work balance over the shaft (steps 3–4): a thick `yellow` arrow «робота турбіни» leaves the turbine
 * toward the cold end and splits — the lower branch «компресору» turns down into the compressor, the upper
 * branch «генератору» runs on to the coupling. Thickness ∝ specific work (w_t = w_c + w_net), so the split is
 * exactly the model's compressor share. Built in the GT's local frame (X along the shaft, Y up), flat in XY.
 */
import { Group, Mesh, Vector3 } from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { GT_X } from './gt-model';

/** Metres of arrow thickness per kJ/kg. */
const M_PER_KJ = 0.0016;
const Y0 = 2.9; // bottom of the stack of bars, above the casing

export interface WorkArrows {
  group: Group;
  /** Anchor points (local) for the three labels. */
  at: { turbine: Vector3; compressor: Vector3; generator: Vector3 };
  set(wTurbine: number, wComp: number): void;
}

export function buildWorkArrows(): WorkArrows {
  const group = new Group();
  group.name = 'work-arrows';
  const gold = K.toon({ color: 'yellow', emissive: 'yellow', emissiveIntensity: 0.35 });
  const deep = K.toon({ color: 'amber', emissive: 'amber', emissiveIntensity: 0.3 });
  const box = G.rbox(1, 1, 1, 0.08);
  const tip = G.cone(0.5, 1, { seg: 3 });
  const mk = (geo: typeof box, mat: typeof gold): Mesh => {
    const m = new Mesh(geo, mat);
    group.add(m);
    return m;
  };
  const turb = mk(box, gold);
  const gen = mk(box, gold);
  const genTip = mk(tip, gold);
  const comp = mk(box, deep);
  const compDown = mk(box, deep);
  const compTip = mk(tip, deep);
  const xSplit = GT_X.turb0 - 0.2;
  const xTurbEnd = GT_X.turb1;
  const xGen = -0.6;
  const xComp = (GT_X.comp0 + GT_X.comp1) / 2 + 0.6;
  const at = { turbine: new Vector3(), compressor: new Vector3(), generator: new Vector3() };
  const api: WorkArrows = {
    group,
    at,
    set(wT, wC) {
      const tT = Math.max(0.05, wT * M_PER_KJ);
      const tC = Math.max(0.03, Math.min(wT, wC) * M_PER_KJ);
      const tG = Math.max(0.0, tT - tC);
      // turbine bar (full thickness) from the turbine to the split
      turb.scale.set(xTurbEnd - xSplit, tT, 0.3);
      turb.position.set((xTurbEnd + xSplit) / 2, Y0 + tT / 2, 0);
      // generator branch on top, running on to the coupling
      gen.visible = genTip.visible = tG > 0.02;
      gen.scale.set(xSplit - xGen, Math.max(0.01, tG), 0.3);
      gen.position.set((xSplit + xGen) / 2, Y0 + tC + tG / 2, 0);
      genTip.scale.set(Math.max(0.3, tG * 1.8), 0.9, 0.3);
      genTip.rotation.set(0, 0, Math.PI / 2);
      genTip.position.set(xGen - 0.45, Y0 + tC + tG / 2, 0);
      // compressor branch below, then down onto the compressor casing
      comp.scale.set(xSplit - xComp, tC, 0.3);
      comp.position.set((xSplit + xComp) / 2, Y0 + tC / 2, 0);
      compDown.scale.set(tC, 0.6, 0.3);
      compDown.position.set(xComp - tC / 2, Y0 - 0.3 + tC / 2, 0);
      compTip.scale.set(Math.max(0.3, tC * 1.8), 0.6, 0.3);
      compTip.rotation.set(0, 0, Math.PI);
      compTip.position.set(xComp - tC / 2, Y0 - 0.55, 0);
      at.turbine.set((xTurbEnd + xSplit) / 2, Y0 + tT, 0);
      at.generator.set(xGen + 1.2, Y0 + tC + tG, 0);
      at.compressor.set(xComp + 1.2, Y0 + tC / 2, 0);
    },
  };
  api.set(1000, 480);
  return api;
}
