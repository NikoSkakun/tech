/**
 * Step 1 `mutual-induction` — Faraday's ring on the studio disc. The left (`coral`) winding is fed by a bench
 * source through a selector «постійний / змінний» and a power lever; the right (`sky`) winding drives a
 * centre-zero galvanometer and a lamp. On AC the `magenta` flux runs round the ring one way and the other, the
 * `cyan` electrons of the second winding swing, `yellow` energy crosses the ring and the lamp glows; on DC the
 * flux stands still, the lamp is dark and the needle only kicks when the flux is switched on or off.
 * Model: Т1 (`teachingTransformer` for DC, `frequencyDemoEmfV` — constant primary current amplitude).
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { createHalo, createWire } from '@/fx';
import { STATUS } from '@/ui3d';
import { TEACHING, frequencyDemoEmfV, teachingTransformer } from '@electricity/sim/transformer';
import type { StepFactory } from '../chapter';
import { doc, hot, splitCaps } from '../labels';
import { OWN } from '../labels-own';
import { createGalvanometer, createLampStand, createSource, createStand } from '../parts/faraday-kit';
import { shareTeaching } from './shared-teaching';
import { group } from '../world';
import { CY, LIMB_X } from '../parts/teaching';

const ID = 'mutual-induction';
/** Display frequency = real / 50 («сповільнено ×50»). */
const SLOW = 50;
/** EMF of the second winding at 50 Hz in this demo (N₁ = 500, N₂ = 50 of model Т1). */
const EMF50 = TEACHING.primaryV / 10;

export const mutualInduction: StepFactory = (tx) => {
  const { ui } = tx;
  const T = shareTeaching(tx);
  const stand = createStand(CY - 1.33);
  const source = createSource();
  source.group.position.set(-3.15, 0, 0.2);
  const galv = createGalvanometer();
  galv.group.position.set(3.25, 0, 0.1);
  const bulb = createLampStand();
  bulb.group.position.set(2.2, 0, 0.95);
  const halo = createHalo({ color: 'yellow', size: 1.4, intensity: 0 });
  halo.position.set(2.2, 0.75, 0.95);
  const lead = (x: number, top: boolean): Vector3 => new Vector3(x, CY + (top ? 0.56 : -0.56), 0.24);
  const w = (pts: Vector3[], speed: number): ReturnType<typeof createWire> =>
    createWire(pts, { radius: 0.028, color: 'ink', repeat: 1.4, speed, power: 0, detail: 14 });
  const s = source.group.position;
  const wires = {
    p1: w([new Vector3(s.x - 0.22, 0.98, s.z + 0.05), new Vector3(s.x - 0.1, 1.9, 0.3), new Vector3(-2.1, 2.55, 0.3), lead(-LIMB_X, true)], 1.2),
    p2: w([new Vector3(s.x + 0.22, 0.98, s.z + 0.05), new Vector3(-2.2, 1.0, 0.4), lead(-LIMB_X, false)], 0),
    s1: w([lead(LIMB_X, true), new Vector3(2.4, 2.5, 0.3), new Vector3(3.0, 1.1, 0.4), new Vector3(2.97, 0.2, 0.22)], 1.2),
    s2: w([new Vector3(3.53, 0.2, 0.22), new Vector3(3.3, 0.35, 1.3), new Vector3(2.37, 0.22, 1.07)], 1.2),
    s3: w([new Vector3(2.03, 0.22, 1.07), new Vector3(1.5, 0.4, 0.9), lead(LIMB_X, false)], 1.2),
  };
  const set = group(`set:${ID}`, 0, 0, 0, [stand.group, source.group, galv.group, bulb.group, halo, ...Object.values(wires)]);
  tx.stageRoot.add(set);

  const supplyIds = ['dc', 'ac'] as const;
  const ac = (): boolean => ui.value<string>('supply1') === 'ac';
  const on = (): boolean => ui.value<boolean>('power1');
  const f = (): number => ui.value<number>('f1');
  const dc = (): ReturnType<typeof teachingTransformer> =>
    teachingTransformer({ primaryTurns: 500, secondaryTurns: 50, loadOhm: 2.3, loadConnected: true, supply: 'dc' });
  /** Amplitude of the second winding's EMF now (0 on DC or with the power off). */
  const emf = (): number => (on() && ac() ? frequencyDemoEmfV(f(), EMF50) : 0);

  let phase = 0;
  let kick = 0;
  let dcLevel = 0;
  let lampP = 0;
  let needle = 0;
  const at = (x: number, y: number, z: number): (() => Vector3) => {
    const out = new Vector3();
    return () => tx.stageRoot.localToWorld(out.set(x, y, z));
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.2, 2.6, 8.6],
        target: [0, 1.5, 0.2],
        fov: 30,
        frameAspect: 1.75,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0, 1.5, 0.2], radius: 4.1 },
      },
    },
    stage: {
      show: [T.group, set],
      params: { coreMorph: 0 },
      enter: () => {
        T.setTurns(500, 50, true);
        dcLevel = on() && !ac() ? 1 : 0;
        kick = 0;
      },
    },
    ui: {
      hint: OWN.hint1,
      honesty: [{ slowed: SLOW }, { kind: 'notToScale', text: OWN.swing1 }, { kind: 'simplified', text: doc(ID, 5) }],
      controls: [
        {
          type: 'segmented',
          id: 'supply1',
          items: splitCaps(doc(ID, 0)).map((label, i) => ({ id: supplyIds[i]!, label })),
          value: 'ac',
          onChange: () => tx.sound.click(1.2),
        },
        { type: 'toggle', id: 'power1', label: doc(ID, 1), value: true, onChange: () => tx.sound.relay() },
        {
          type: 'slider',
          id: 'f1',
          label: doc(ID, 3),
          min: TEACHING.frequencyRangeHz.min,
          max: TEACHING.frequencyRangeHz.max,
          step: 1,
          value: 50,
          unit: 'Hz',
          digits: 0,
          disabled: () => !ac(),
        },
        { type: 'note', id: 'dcNote1', text: doc(ID, 2), icon: 'warning', color: STATUS.alarm, visible: () => on() && !ac() },
        {
          type: 'readout',
          id: 'emf1',
          label: OWN.emf2,
          text: () => fmtUnit(emf(), 'V', { digits: 1 }),
        },
        {
          type: 'readout',
          id: 'i1',
          label: OWN.primaryA1,
          text: () => (!on() ? fmtUnit(0, 'A', { digits: 0 }) : ac() ? OWN.constAmp : fmtUnit(dc().primaryA, 'A', { digits: 0 })),
          color: () => (on() && !ac() ? STATUS.alarm : STATUS.ok),
        },
      ],
      callouts: [
        { anchor: at(-LIMB_X - 0.5, CY + 0.2, 0.2), text: OWN.primary, color: 'coral', side: 'left' },
        { anchor: at(LIMB_X + 0.55, CY + 0.2, 0.2), text: OWN.secondary, color: 'sky', side: 'right' },
        { anchor: at(-3.15, 1.05, 0.2), text: `${OWN.source} · ${doc(ID, 4)}`, side: 'left' },
        { anchor: at(0, CY + 1.0, 0.3), text: OWN.flux, color: 'magenta', side: 'up', visible: () => on() },
        { anchor: at(2.2, 0.02, 1.4), text: OWN.lamp, side: 'down' },
      ],
      hotspots: [
        { anchor: at(-0.82, CY - 0.82, 0.25), content: hot(ID, 0) },
        { anchor: at(3.25, 1.05, 0.3), content: hot(ID, 1) },
      ],
    },
    probe: () => ({ ac: ac(), on: on(), f: f(), emf: emf(), lamp: lampP, needle, flux: T.flux.speed, dcLevel }),
    update(dt) {
      T.update(dt);
      const level = on() && !ac() ? 1 : 0;
      if (level !== dcLevel) {
        kick = level > dcLevel ? 1 : -1; // flux switched on / off: the only moments the needle moves on DC
        dcLevel = level;
        tx.sound.click(0.7);
      }
      kick *= Math.exp(-dt / 0.45);
      const fd = (on() && ac() ? f() : 0) / SLOW;
      phase = (phase + dt * fd * Math.PI * 2) % (Math.PI * 2);
      const e = emf() / EMF50; // 1 at 50 Hz
      const flux = on() ? (ac() ? (f() > 0 ? Math.sin(phase) : 0) : 0) : 0;
      T.flux.density = on() ? 1 : 0;
      T.flux.speed = flux * 1.6;
      T.ePrimary.speed = on() ? (ac() ? Math.sin(phase) * 0.9 : 1.4) : 0;
      T.eSecondary.speed = -Math.cos(phase) * 0.9 * e;
      T.energy.density = Math.min(1, e * e) * 0.9;
      needle = -Math.cos(phase) * 0.75 * Math.min(1.3, e) + kick * 0.9;
      galv.setNeedle(needle);
      source.setPower(on() ? 1 : 0);
      source.setSupply(ac() ? 1 : 0);
      lampP = Math.min(1.2, e * e * 0.75);
      bulb.lamp.setPower(lampP);
      halo.intensity = lampP * 0.9;
      const pw = Math.min(1, e * e);
      wires.p1.material.power = on() ? (ac() ? 0.25 + 0.6 * pw : 0.05) : 0;
      for (const k of ['s1', 's2', 's3'] as const) wires[k].material.power = 0.7 * pw;
      T.heat(on() && !ac() ? 0.8 : 0, 0);
      tx.sound.hum = on() && ac() ? 0.12 + 0.12 * Math.min(1, f() / 50) : 0.03;
      tx.sound.humPitch = Math.max(0.2, (2 * f()) / 50);
    },
  };
};
