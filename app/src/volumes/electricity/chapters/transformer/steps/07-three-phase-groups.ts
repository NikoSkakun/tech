/**
 * Step 7 `three-phase-groups` — the three-limb core close up: windings cut open, phase bands L1 / L2 / L3, `magenta`
 * flux orbs on each limb running up and down 120° apart (their sum is zero at every instant — the board traces the
 * three fluxes and the sum). Over the core two clock faces: HV (always 12 o'clock) and LV, whose hour hand shows
 * the vector group (Dyn11 → 11). In front, the terminal board 1U 1V 1W / 2U 2V 2W 2N. The unbalance slider (only
 * with a neutral) skews the three LV phase voltages — three times more for Yyn0 than for Dyn11. Model: Т6.
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { SEMANTIC } from '@/style';
import { type Chart } from '@/ui3d';
import { limbFluxes, unbalancedVoltages, vectorGroup, type HvConnection, type LvConnection } from '@electricity/sim/transformer';
import type { StepFactory } from '../chapter';
import { doc, hot, pairTitle, splitList } from '../labels';
import { OWN } from '../labels-own';
import { createClockDial } from '../parts/clock-dial';
import { createThreeLimb } from '../parts/three-limb';
import { group, tag } from '../world';

const ID = 'three-phase-groups';
const SLOW = 50;
const SCALE = 0.6;
const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export const threePhaseGroups: StepFactory = (tx) => {
  const { ui, ctx } = tx;
  const limbs = createThreeLimb(ctx);
  const core = group('three-limb', 0, 0, -0.3, [limbs.group]);
  core.scale.setScalar(SCALE);
  // screen-space tags still take the parents' scale: undo it so the marks keep their ≥ 16 px size
  for (const g of Object.values(limbs.terminals)) g.scale.setScalar(1 / SCALE);
  const hvDial = createClockDial();
  hvDial.group.position.set(-1.25, 3.55, -0.2);
  const lvDial = createClockDial();
  lvDial.group.position.set(1.25, 3.55, -0.2);
  const hvTag = tag(OWN.hvDial, 21, 'coral');
  hvTag.position.set(-1.25, 2.5, -0.2);
  const lvTag = tag(OWN.lvDial, 21, 'sky');
  lvTag.position.set(1.25, 2.5, -0.2);
  const set = group(`set:${ID}`, 0, 0, 0, [core, hvDial.group, lvDial.group, hvTag, lvTag]);
  tx.stageRoot.add(set);

  const hv = (): HvConnection => (ui.value<string>('hv7') === 'D' ? 'D' : 'Y');
  const lv = (): LvConnection => ui.value<string>('lv7') as LvConnection;
  const vg = (): ReturnType<typeof vectorGroup> => vectorGroup(hv(), lv());
  const unb = (): number => (vg().neutral ? ui.value<number>('unb7') / 100 : 0);
  const volts = (): [number, number, number] => unbalancedVoltages(hv(), lv(), unb()) ?? [230, 230, 230];
  let tDisplay = 0;
  let pulse = 0;
  let pushed = -1;
  const applyGroup = (instant: boolean): void => {
    hvDial.set(hv() === 'Y' ? 'star' : 'delta', 0, instant);
    lvDial.set(lv() === 'd' ? 'delta' : 'star', vg().lvAngleCwDeg, instant);
  };
  const at = (v: Vector3): (() => Vector3) => {
    const out = new Vector3();
    return () => core.localToWorld(out.copy(v));
  };
  const atWorld = (x: number, y: number, z: number): (() => Vector3) => {
    const out = new Vector3();
    return () => tx.stageRoot.localToWorld(out.set(x, y, z));
  };
  const plot = (c: Chart): void => {
    if (tDisplay - pushed < 1 / 30) return;
    pushed = tDisplay;
    const f = limbFluxes(tDisplay / SLOW);
    f.forEach((v, k) => c.push(`f${k}`, tDisplay, v));
    c.push('sum', tDisplay, f[0] + f[1] + f[2]);
  };
  const hvItems = splitList(doc(ID, 0));
  const lvItems = splitList(doc(ID, 1));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.4, 2.9, 8.1],
        target: [0, 2.05, -0.3],
        fov: 32,
        frameAspect: 1.3,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0, 2.1, -0.3], radius: 3.2 },
      },
    },
    stage: {
      show: [set],
      enter: (info) => {
        applyGroup(info.instant);
        pushed = -1;
        pulse = 0;
      },
    },
    ui: {
      hint: OWN.hint7,
      honesty: [{ slowed: SLOW }, { kind: 'simplified', text: doc(ID, 5) }],
      controls: [
        { type: 'segmented', id: 'hv7', label: pairTitle(doc(ID, 0)), items: hvItems.map((s) => ({ id: s, label: s })), value: 'D', onChange: () => applyGroup(false) },
        { type: 'segmented', id: 'lv7', label: pairTitle(doc(ID, 1)), items: lvItems.map((s) => ({ id: s, label: s })), value: 'yn', onChange: () => applyGroup(false) },
        { type: 'readout', id: 'group7', label: OWN.group7, text: () => vg().label },
        { type: 'slider', id: 'unb7', label: doc(ID, 3), min: 0, max: 100, step: 5, value: 0, unit: '%', digits: 0, disabled: () => !vg().neutral, hint: doc(ID, 7) },
        { type: 'note', id: 'neutral7', text: doc(ID, 7), icon: 'info', visible: () => !vg().neutral },
        {
          type: 'stats',
          id: 'volts7',
          columns: 3,
          visible: () => vg().neutral,
          items: [0, 1, 2].map((k) => ({ label: `L${k + 1}`, get: () => fmtUnit(volts()[k]!, 'V', { digits: 1 }), color: () => PHASE[k]! })),
        },
        { type: 'button', id: 'pulse7', label: doc(ID, 8), icon: 'play', onClick: () => ((pulse = 3), tx.sound.click(1.3)) },
      ],
      board: {
        title: OWN.board7,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'flux7',
            chart: {
              height: 150,
              window: 2,
              x: { min: 0, max: 2, label: OWN.tSlow },
              y: { min: -1.2, max: 1.2, label: 'Φ' },
              series: [
                { id: 'f0', label: 'Φ₁', color: PHASE[0] },
                { id: 'f1', label: 'Φ₂', color: PHASE[1] },
                { id: 'f2', label: 'Φ₃', color: PHASE[2] },
                { id: 'sum', label: 'Φ₁ + Φ₂ + Φ₃', color: 'white', dash: true },
              ],
            },
            init: () => (pushed = -1),
            update: plot,
          },
        ],
      },
      callouts: [
        { anchor: at(new Vector3(-2.0, 0.4, 2.3)), text: OWN.terminals, side: 'down' },
      ],
      hotspots: [
        { anchor: atWorld(1.25 + 0.6, 3.55 + 0.55, -0.1), content: hot(ID, 0) },
        { anchor: at(limbs.terminal('2N')), content: hot(ID, 1), visible: () => vg().neutral },
        { anchor: atWorld(-2.6, 0.5, 1.2), title: doc(ID, 6), text: OWN.simplified7, visible: () => vg().neutral },
      ],
    },
    probe: () => ({ hv: hv(), lv: lv(), group: vg().label, clock: vg().clock, unb: unb(), v: volts(), pulse }),
    update(dt) {
      tDisplay += dt;
      const f = limbFluxes(tDisplay / SLOW);
      pulse = Math.max(0, pulse - dt);
      limbs.fluxes.forEach((fl, k) => {
        fl.speed = 1.4 * f[k]!;
        fl.intensity = 1 + (pulse > 0 ? 1.2 * Math.abs(f[k]!) : 0);
      });
      limbs.terminals['2N']!.visible = vg().neutral;
      lvTag.text = `${OWN.lvDial} · ${vg().label}`;
      const v = volts();
      lvDial.setLengths([0, 1, 2].map((k) => 1 + ((v[k]! - 230) / 230) * 4) as [number, number, number]);
      hvDial.update(dt);
      lvDial.update(dt);
      tx.sound.hum = 0.14;
    },
  };
};
