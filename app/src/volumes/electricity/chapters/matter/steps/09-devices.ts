/**
 * Step 9 `devices` — from the p-n junction to devices (§9). Four cut-open mini blocks on pedestals; the tabs
 * drive the camera from one to the next, and each device has one control: the rectifier's input (AC / DC, live
 * in/out traces on the board), the LED's E_g (photon and dome colour, material), the solar cell's irradiance
 * (photon rain, pairs, fan speed) and the MOSFET's gate voltage (channel electrons, lamp). The bridge button
 * leads on to `current`.
 */
import { Box3, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit } from '@/content';
import { Builder } from '@/kit';
import {
  LED_RANGE_EV,
  ledEmission,
  MOSFET,
  mosfetSwitch,
  rectifierSample,
  SOLAR_CELL,
  solarCellActivity,
  type LedMaterial,
} from '@electricity/sim/matter';
import type { StepFactory } from '../chapter';
import { group, smooth } from '../chapter';
import { crossTarget, docItems, docLabel, splitItems } from '../content';
import { DOC, L } from '../labels';
import { createLed, createRectifier } from '../parts/dev-diode-led';
import { createMosfet, createSolar } from '../parts/dev-solar-mosfet';

const ID = 'devices';
const TABS = ['diode', 'led', 'solar', 'mosfet'] as const;
type Tab = (typeof TABS)[number];
// wide spacing: the device in focus fills the shot, its neighbours stay out of it (or barely at the edge)
const XS: Record<Tab, number> = { diode: -3.6, led: -1.2, solar: 1.2, mosfet: 3.6 };
/** Scale of a device on its pedestal: resting, and in focus (it also steps forward). */
const REST = 0.8;
const FOCUS = 1.6;
/** Growth order out of the p-n bar (middle first) and the time after which all have grown, s. */
const BIRTH_ORDER: Record<Tab, number> = { led: 0, solar: 0, diode: 1, mosfet: 1 };
const BORN_DONE = 2;
const SHOT: Record<Tab, string> = {
  diode: ID,
  led: `${ID}-led`,
  solar: `${ID}-solar`,
  mosfet: `${ID}-mosfet`,
};
const MATERIAL: Record<LedMaterial, keyof typeof DOC> = {
  'GaAs/AlGaAs': 'ledIr',
  AlGaInP: 'ledRed',
  'InGaN-green': 'ledGreen',
  'InGaN-blue': 'ledBlue',
  'AlGaN/GaN': 'ledUv',
};

export const devicesStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const set = group(`set:${ID}`);
  lab.stand.add(set);
  const sb = new Builder('shelf');
  sb.box(9.4, 0.16, 1.4, { r: 0.07, c: ['bg.deep', 'bg.indigo'], at: [0, 0.02, 0] });
  for (const x of Object.values(XS)) {
    sb.cyl(0.6, 0.12, { seg: 48, c: ['slate', 'steel'], at: [x, 0.18, 0] });
    sb.ring(0.58, 0.02, { seg: 64, slot: 'glow', c: 'teal', at: [x, 0.3, 0] });
    sb.box(0.5, 0.1, 0.04, { r: 0.02, slot: 'glow', c: 'teal.dark', at: [x, 0.19, 0.6] });
  }
  const shelf = sb.build().group;
  const rect = createRectifier();
  const led = createLed();
  const solar = createSolar();
  const fet = createMosfet();
  const devs = { diode: rect.group, led: led.group, solar: solar.group, mosfet: fet.group };
  for (const t of TABS) {
    devs[t].position.set(XS[t], 0.3, 0);
    devs[t].scale.setScalar(REST);
    shelf.add(devs[t]);
  }
  set.add(shelf);

  const tab = (): Tab => ui.value<string>('dev9') as Tab;
  const acLabel = docLabel(ID, 2).split(':');
  const acItems = splitItems(acLabel[1] ?? '', '/');
  const mode = (): 'ac' | 'dc' => (ui.value<string>('ac9') === 'dc' ? 'dc' : 'ac');
  const eg = (): number => ui.value<number>('eg9');
  const irr = (): number => ui.value<number>('g9');
  const ugs = (): number => ui.value<number>('ugs9');
  let clock = 0;
  const focus: Record<Tab, number> = { diode: 1, led: 0, solar: 0, mosfet: 0 };
  let born = BORN_DONE; // seconds since the devices began to grow out of the p-n bar
  const sample = (): ReturnType<typeof rectifierSample> => rectifierSample(clock, mode());
  ui.onChange('dev9', () => {
    audio.play('whooshUp', { gain: 0.5 });
    ctx.camera.go(SHOT[tab()], { duration: 1.6 });
  });
  const target = crossTarget('current');
  const next = (): void => {
    if (target && ctx.nav.locate(target)) void ctx.nav.open(target);
  };

  const v = new Vector3();
  const at = (t: Tab, local: Vector3): Vector3 => devs[t].localToWorld(v.copy(local));
  // probe = the device's resting centre (its live bounding box breathes with the fan, the rain and the glow)
  for (const t of TABS) {
    devs[t].updateWorldMatrix(true, true);
    const c = devs[t].worldToLocal(new Box3().setFromObject(devs[t]).getCenter(new Vector3()));
    ctx.qa.probe(`dev9-${t}`, () => devs[t].localToWorld(c.clone()));
  }
  ctx.qa.expose(ID, () => ({
    tab: tab(),
    mode: mode(),
    input: sample().inputV,
    output: sample().outputV,
    led: ledEmission(eg()),
    solar: solarCellActivity(irr()),
    mosfet: mosfetSwitch(ugs()),
  }));
  const shot = (t: Tab) => ({
    position: [XS[t] + 0.35, 2.9, 5.0] as [number, number, number],
    target: [XS[t], 1.25, 0] as [number, number, number],
    fov: 30,
    frameAspect: 1.2,
    orbit: { azimuth: 0.8, polar: 0.3 },
    fit: { center: [XS[t], 1.25, 0] as [number, number, number], radius: 1.8 },
  });

  return {
    id: ID,
    shots: Object.fromEntries(TABS.map((t) => [SHOT[t], shot(t)])),
    stage: {
      show: [shelf],
      enter(info) {
        clock = 0;
        if (info.instant) for (const d of TABS) focus[d] = d === tab() ? 1 : 0;
        // script: the p-n bar multiplies on the shelf — the devices grow out one after another from the middle
        born = !info.instant && info.from === 'pn-junction' && !ctx.reducedMotion ? 0 : BORN_DONE;
        if (tab() !== 'diode') ctx.camera.go(SHOT[tab()], { duration: info.instant ? 0 : 1.6 });
      },
    },
    ui: {
      honesty: [
        { kind: 'simplified', text: DOC.simplified, visible: () => tab() === 'solar' || tab() === 'mosfet' },
      ],
      controls: [
        {
          type: 'segmented',
          id: 'dev9',
          items: docItems(ID, 0).map((label, i) => ({ id: TABS[i]!, label })),
          value: 'diode',
        },
        {
          type: 'segmented',
          id: 'ac9',
          label: acLabel[0]!.trim(),
          items: acItems.map((label, i) => ({ id: i === 0 ? 'ac' : 'dc', label })),
          value: 'ac',
          visible: () => tab() === 'diode',
        },
        {
          type: 'slider',
          id: 'eg9',
          label: L.dev.eg,
          ...LED_RANGE_EV,
          value: LED_RANGE_EV.default,
          unit: 'eV',
          digits: 2,
          visible: () => tab() === 'led',
        },
        {
          type: 'slider',
          id: 'g9',
          label: L.dev.g,
          ...SOLAR_CELL.irradianceRange,
          value: SOLAR_CELL.irradianceRange.default,
          unit: 'W/m²',
          digits: 0,
          visible: () => tab() === 'solar',
        },
        {
          type: 'slider',
          id: 'ugs9',
          label: L.dev.ugs,
          ...MOSFET.gateRange,
          value: MOSFET.gateRange.default,
          unit: 'V',
          digits: 1,
          visible: () => tab() === 'mosfet',
        },
        {
          type: 'stats',
          id: 'led9',
          visible: () => tab() === 'led',
          items: [
            { label: 'λ', get: () => fmtUnit(ledEmission(eg()).wavelengthNm, 'nm', { digits: 0 }) },
            { label: L.dev.material, get: () => DOC[MATERIAL[ledEmission(eg()).material]] },
          ],
        },
        {
          type: 'readout',
          id: 'fan9',
          label: L.dev.fan,
          get: () => solarCellActivity(irr()) * 100,
          unit: '%',
          digits: 0,
          visible: () => tab() === 'solar',
        },
        {
          type: 'readout',
          id: 'id9',
          label: L.dev.lampI,
          get: () => mosfetSwitch(ugs()).lampCurrentA,
          unit: 'A',
          digits: 2,
          visible: () => tab() === 'mosfet',
        },
        {
          type: 'note',
          id: 'ch9',
          text: docLabel(ID, 4),
          icon: 'check',
          visible: () => tab() === 'mosfet' && mosfetSwitch(ugs()).channelFormed,
        },
        { type: 'note', id: 'bridge9', text: DOC.bridgeLine, icon: 'lightning' },
        {
          type: 'button',
          id: 'next9',
          label: DOC.nextCurrent,
          icon: 'next',
          primary: true,
          onClick: next,
          visible: () => !!target && !!ctx.nav.locate(target),
        },
      ],
      board: {
        title: L.dev.chart,
        size: 'sm',
        visible: () => tab() === 'diode',
        children: [
          {
            type: 'chart',
            id: 'rect9',
            chart: {
              height: 170,
              window: 4,
              x: { min: 0, max: 4, label: 't, s' },
              y: { min: -5.5, max: 5.5, label: 'U, V' },
              series: [
                { id: 'in', label: L.dev.input, color: 'sky' },
                { id: 'out', label: L.dev.output, color: 'yellow' },
              ],
            },
            update: (c) => {
              const s = sample();
              c.push('in', clock, s.inputV);
              c.push('out', clock, s.outputV);
            },
          },
        ],
      },
      callouts: TABS.map((t, i) => ({
        // beside the device (upper left), not on it: the right side belongs to the step panel
        anchor: () => at(t, new Vector3(-0.85, 0.85, 0)),
        text: docItems(ID, 0)[i]!,
        side: 'left' as const,
        visible: () => tab() === t,
      })),
      hotspots: [
        { anchor: () => at('mosfet', fet.oxide), content: 'gate-oxide', visible: () => tab() === 'mosfet' },
        { anchor: () => at('led', led.dome), content: 'phosphor', visible: () => tab() === 'led' },
        {
          anchor: () => at('mosfet', new Vector3(-0.6, 0.3, 0.4)),
          content: 'inverter-link',
          visible: () => tab() === 'mosfet',
        },
      ],
    },
    update(dt, t) {
      clock += dt;
      born = Math.min(born + dt, BORN_DONE);
      // one device in focus: it grows and steps forward to the camera, the others rest small at the back
      for (const d of TABS) {
        const want = d === tab() ? 1 : 0;
        const k = (focus[d] += (want - focus[d]) * Math.min(dt * 4, 1));
        const g = smooth(0, 0.7, born - 0.3 * BIRTH_ORDER[d]);
        devs[d].scale.setScalar((REST + (FOCUS - REST) * k) * Math.max(g, 1e-3));
        devs[d].position.z = -0.35 + 0.6 * k;
      }
      const s = sample();
      rect.input = s.inputV;
      rect.output = s.outputV;
      rect.update(dt);
      led.wavelength = ledEmission(eg()).wavelengthNm;
      led.update(dt, t);
      solar.activity = solarCellActivity(irr());
      solar.update(dt, t);
      const m = mosfetSwitch(ugs());
      fet.channel = m.channelFraction;
      fet.lamp = m.lampCurrentA / 0.42;
      fet.update(dt, t);
      lab.live.hum = tab() === 'diode' && mode() === 'ac' ? 0.3 : 0;
      lab.live.buzz =
        tab() === 'mosfet' ? m.channelFraction * 0.5 : tab() === 'solar' ? solar.activity * 0.3 : 0;
    },
  };
};
