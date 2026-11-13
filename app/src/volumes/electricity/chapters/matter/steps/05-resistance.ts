/**
 * Step 5 `resistance` — where resistance comes from (§5). The copper close-up trembles with √T, impurities
 * (`violet`) and a vacancy break the order, electrons scatter at a rate ∝ ρ; the thermometer, the «ρ» needle
 * meter and the ρ(T) chart on the board follow the same model sample. «Надпровідність» swaps in the mercury
 * sub-scene: below 4,15 K ρ = 0, Cooper pairs circle a ring and the hour counter runs on.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtUnit, NBSP } from '@/content';
import type { Chart } from '@/ui3d';
import {
  MERCURY,
  mercuryResistivityOhmM,
  METALS,
  RESISTANCE_RANGES,
  resistanceVisuals,
  resistivityOhmM,
  type MetalId,
} from '@electricity/sim/matter';
import { sci } from '../fmt';
import type { StepFactory } from '../chapter';
import { group } from '../chapter';
import { docItems, docLabel } from '../content';
import { DOC, L } from '../labels';
import { createCryostat } from '../parts/cryostat';
import { createNeedleMeter, createThermometer } from '../parts/instruments';
import { createScatterCrystal } from '../parts/scatter-crystal';
import { HERO_Y } from '../world';

const ID = 'resistance';
const HG_SHOT = 'resistance-hg';
const IDS: MetalId[] = ['Cu', 'Al', 'Fe', 'W', 'NiCr'];
const fmtRho = (rho: number): string => (rho === 0 ? `0${NBSP}Ω·m` : `${sci(rho, 2)}${NBSP}Ω·m`);

export const resistanceStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const set = group(`set:${ID}`);
  lab.stand.add(set);
  const copper = group('copper5');
  const crystal = createScatterCrystal(ctx);
  crystal.group.position.set(-1.0, HERO_Y + 0.1, -0.2);
  crystal.group.rotation.y = 0.55;
  const thermo = createThermometer();
  thermo.group.position.set(2.05, 0.05, 1.2);
  const meter = createNeedleMeter();
  meter.group.position.set(2.85, 0.05, -0.1);
  meter.group.rotation.y = -0.35;
  copper.add(crystal.group, thermo.group, meter.group);
  const cryo = createCryostat(ctx);
  cryo.group.position.set(0, 0.05, 0);
  set.add(copper, cryo.group);
  ctx.stage.actor(copper);
  ctx.stage.actor(cryo.group);

  let sc = false; // the mercury sub-scene is on screen
  let scShare = 1;
  let hours = 0;
  const metal = (): MetalId => ui.value<string>('metal5') as MetalId;
  const tempC = (): number => ui.value<number>('T5');
  const imp = (): number => ui.value<number>('imp5');
  const hgK = (): number => ui.value<number>('Thg5');
  const rho = (): number => resistivityOhmM(metal(), tempC(), imp());
  const hg = (): ReturnType<typeof mercuryResistivityOhmM> => mercuryResistivityOhmM(hgK());
  const show = (on: boolean): void => {
    sc = on;
    hours = 0;
    ctx.stage.toggle(copper, !on);
    ctx.stage.toggle(cryo.group, on);
    audio.play(on ? 'whooshDown' : 'whooshUp');
    ctx.camera.go(on ? HG_SHOT : ID, { duration: 1.6 });
  };

  let chartKey = '';
  const curve = (c: Chart): void => {
    const key = `${metal()}:${imp()}`;
    if (key === chartKey) return;
    chartKey = key;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let t = RESISTANCE_RANGES.temperatureC.min; t <= RESISTANCE_RANGES.temperatureC.max; t += 10) {
      xs.push(t);
      ys.push(resistivityOhmM(metal(), t, imp()) * 1e8);
    }
    c.setData('rho', xs, ys);
  };
  const hgCurve = (c: Chart): void => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = MERCURY.range.min; k <= MERCURY.range.max + 1e-9; k += 0.05) {
      xs.push(k);
      ys.push(mercuryResistivityOhmM(k).resistivityOhmM * 1e10);
    }
    c.setData('hg', xs, ys);
  };

  const v = new Vector3();
  const w = (obj: { localToWorld(p: Vector3): Vector3 }, local: Vector3): Vector3 =>
    obj.localToWorld(v.copy(local));
  ctx.qa.probe('crystal5', crystal.group);
  ctx.qa.probe('ring5', () => w(cryo.group, cryo.ring));
  ctx.qa.expose(ID, () => ({
    sc,
    metal: metal(),
    rhoOhmM: rho(),
    jitter: crystal.jitter,
    scattering: crystal.scattering,
    impurity: imp(),
    hgRho: hg().resistivityOhmM,
    superconducting: hg().superconducting,
    hours,
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.6, 4.3, 10.6],
        target: [0.5, 2.2, 0],
        fov: 32,
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [0.5, 2.2, 0], radius: 3.3 },
      },
      [HG_SHOT]: {
        position: [0.3, 3.4, 7.4],
        target: [0, 1.5, 0],
        fov: 32,
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [0, 1.5, 0], radius: 2.6 },
      },
    },
    stage: {
      show: [copper, cryo.group],
      enter() {
        sc = false;
        hours = 0;
        ctx.stage.toggle(cryo.group, false, { instant: true });
      },
    },
    ui: {
      honesty: [
        { kind: 'simplified', text: DOC.simplified },
        { sped: 3600, visible: () => sc },
      ],
      controls: [
        {
          type: 'segmented',
          id: 'metal5',
          items: docItems(ID, 0).map((label, i) => ({ id: IDS[i]!, label })),
          value: 'Cu',
          visible: () => !sc,
        },
        {
          type: 'slider',
          id: 'T5',
          label: L.res.temp,
          ...RESISTANCE_RANGES.temperatureC,
          value: RESISTANCE_RANGES.temperatureC.default,
          unit: '°C',
          digits: 0,
          visible: () => !sc,
        },
        {
          type: 'slider',
          id: 'imp5',
          label: docLabel(ID, 2),
          ...RESISTANCE_RANGES.impurityPct,
          value: RESISTANCE_RANGES.impurityPct.default,
          unit: '%',
          digits: 1,
          visible: () => !sc,
        },
        {
          type: 'slider',
          id: 'Thg5',
          label: L.res.hgTemp,
          min: MERCURY.range.min,
          max: MERCURY.range.max,
          step: MERCURY.range.step,
          value: 3,
          unit: 'K',
          digits: 2,
          visible: () => sc,
        },
        {
          type: 'stats',
          id: 'out5',
          visible: () => !sc,
          items: [
            { label: L.res.rho, get: () => fmtRho(rho()) },
            {
              label: L.res.alpha,
              get: () => `${fmtNumber(METALS[metal()].alphaPerK, { maxDigits: 5 })}${NBSP}K⁻¹`,
            },
          ],
        },
        {
          type: 'stats',
          id: 'hgout5',
          visible: () => sc,
          items: [
            { label: L.res.rho, get: () => fmtRho(hg().resistivityOhmM) },
            { label: L.res.hours, get: () => fmtNumber(hours, { digits: 0, group: true }) },
          ],
        },
        {
          type: 'button',
          id: 'sc5',
          label: docLabel(ID, 3),
          icon: 'star',
          primary: true,
          onClick: () => show(true),
          visible: () => !sc,
        },
        {
          type: 'button',
          id: 'back5',
          label: docLabel(ID, 5),
          icon: 'arrowLeft',
          onClick: () => show(false),
          visible: () => sc,
        },
      ],
      board: {
        title: L.res.chart,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'chart5',
            visible: () => !sc,
            chart: {
              height: 190,
              x: { min: -100, max: 300, label: 't, °C' },
              y: { min: 0.5, max: 200, log: true, label: 'ρ, 10⁻⁸ Ω·m' },
              series: [{ id: 'rho', label: 'ρ(t)', color: 'orange' }],
            },
            update: (c: Chart) => {
              curve(c);
              c.setMarker('now', { x: tempC(), y: rho() * 1e8 });
            },
          },
          {
            type: 'chart',
            id: 'hg5',
            visible: () => sc,
            chart: {
              height: 190,
              x: { min: 2, max: 10, label: 'T, K' },
              y: { min: 0, max: 1.5, label: 'ρ, 10⁻¹⁰ Ω·m' },
              series: [{ id: 'hg', label: 'Hg', color: 'sky', kind: 'step' }],
            },
            init: hgCurve,
            update: (c: Chart) => c.setMarker('now', { x: hgK(), y: hg().resistivityOhmM * 1e10 }),
          },
        ],
      },
      callouts: [
        {
          anchor: () => w(thermo.group, thermo.top),
          text: () => fmtUnit(tempC(), '°C', { digits: 0 }),
          color: 'orange',
          side: 'up',
          visible: () => !sc,
        },
        { anchor: () => w(meter.group, meter.face), text: 'ρ', side: 'right', visible: () => !sc },
        {
          anchor: () => w(crystal.group, crystal.impurityAt),
          text: L.res.impurity,
          color: 'violet',
          side: 'left',
          visible: () => !sc && imp() > 0.05,
        },
        { anchor: () => w(cryo.group, cryo.drop), text: L.res.mercury, side: 'left', visible: () => sc },
        {
          anchor: () => w(cryo.group, cryo.ring),
          text: () => (hg().superconducting ? L.res.ringOn : L.res.ringOff),
          color: 'sky',
          side: 'up',
          visible: () => sc,
        },
      ],
      hotspots: [
        { anchor: () => w(crystal.group, crystal.vacancy), content: 'vacancy', visible: () => !sc },
        {
          anchor: () => w(crystal.group, v.set(-1.2, 1.4, 1.6)),
          content: 'nichrome',
          visible: () => !sc && metal() === 'NiCr',
        },
        {
          anchor: () => w(cryo.group, cryo.ring).add(new Vector3(1.2, -0.4, 0)),
          content: 'mri-magnet',
          visible: () => sc,
        },
      ],
    },
    update(dt, t) {
      const vis = resistanceVisuals(metal(), tempC(), imp());
      crystal.jitter = vis.jitterRelative;
      crystal.scattering = vis.scatteringRelative;
      crystal.impurity = imp();
      crystal.alloy = metal() === 'NiCr';
      crystal.update(dt, t);
      thermo.level = (tempC() - RESISTANCE_RANGES.temperatureC.min) / 400;
      thermo.heat = thermo.level;
      thermo.update();
      // the needle on a log scale: 1×10⁻⁸ … 2×10⁻⁶ Ω·m
      meter.value = Math.log10(rho() / 1e-8) / Math.log10(200);
      meter.update(dt);
      scShare += ((hg().superconducting ? 1 : 0) - scShare) * Math.min(dt * 3, 1);
      cryo.superconducting = scShare;
      cryo.update(dt, t);
      if (sc && hg().superconducting) hours += dt; // 1 s on stage = 1 h (chip «прискорено ×3600»)
      lab.live.crackle = sc ? (hg().superconducting ? 0 : 0.4) : 0.5;
      lab.live.crackleRate = sc ? 0.3 : Math.min(vis.scatteringRelative / 4, 1);
    },
  };
};
