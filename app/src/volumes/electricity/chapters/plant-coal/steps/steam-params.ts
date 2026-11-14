/**
 * Step 5 `steam-params` — «Докритичні, надкритичні, ультранадкритичні». A transparent tube section floats by the
 * boiler: below the critical pressure the water boils (two phases, a white surface, bubbles), above it there is one
 * fluid without a surface. The board shows the p–T phase diagram of water (boiling line ending in the `amber`
 * critical point, the state point), the class badge and three typical units (η, wagons of coal per 1 GWh).
 * Interaction: «Тиск пари» 1…35 MPa and «Температура» 300…720 °C (held at t ≥ t_sat(p) below the critical
 * pressure — the slider snaps), presets (two Ukrainian units, a 1000 MW ultra-supercritical unit, Pingshan II);
 * readouts η (model M2), coal per MWh and CO₂ per kWh (model M1, bituminous coal).
 */
import {
  CRITICAL_PRESSURE_MPA,
  UNIT_PRESETS,
  WAGON_T,
  clampLiveSteamTempC,
  fuelUse,
  saturationTempC,
  steamClass,
  unitEfficiency,
  type SteamClass,
  type UnitParams,
} from '@electricity/sim/plant-coal';
import { Vector3 } from 'three';
import { fmtNumber, fmtPercent } from '@/content';
import type { ControlSpec } from '@/hud';
import { HOTSPOTS } from '../hotspots';
import { ISLAND, RIGS } from '../layout';
import { buildPipeCapsule } from '../parts/pipe-capsule';
import type { StepFactory } from './types';

/** Critical temperature of water, °C (document). */
const T_CRIT = 373.95;
/** Typical units of the three classes (document, «Цифри і факти»). */
const CARDS: readonly [SteamClass, number, number][] = [
  ['subcritical', 17, 540],
  ['supercritical', 24, 566],
  ['usc', 27, 600],
];

export const steamParams: StepFactory = ({ ctx, ui, L, hot }) => {
  const g = ISLAND.ground;
  const capsule = buildPipeCapsule(ctx, new Vector3(RIGS.phase.x, g + RIGS.phase.y, RIGS.phase.z));
  ctx.root.add(capsule.group);
  let preset: Partial<UnitParams> = {};
  const p = (): number => ui.value<number>('sp.p');
  const t = (): number => ui.value<number>('sp.t');
  const params = (): Partial<UnitParams> => ({ ...preset, pressureMPa: p(), tempC: t() });
  const eta = (): number => unitEfficiency(params());
  const fuel = () => fuelUse('bituminous', 1000, eta());
  const className: Record<SteamClass, string> = { subcritical: L.classSub, supercritical: L.classSc, usc: L.classUsc, ausc: L.classAusc };
  // keep the live-steam temperature on or above the boiling line (the slider "snaps")
  const hold = (): void => {
    const c = clampLiveSteamTempC(p(), t());
    if (c > t()) ui.set('sp.t', Math.ceil(c / 5) * 5);
  };
  const apply = (key: keyof typeof UNIT_PRESETS): void => {
    const u = UNIT_PRESETS[key];
    ui.set('sp.p', u.pressureMPa ?? 17);
    ui.set('sp.t', u.tempC ?? 540);
    preset = { aged: u.aged, doubleReheat: u.doubleReheat };
  };
  const phase = (): 'boiling' | 'steam' | 'fluid' => (p() >= CRITICAL_PRESSURE_MPA ? 'fluid' : t() <= saturationTempC(p()) + 4 ? 'boiling' : 'steam');
  // boiling line of the phase diagram: 100 °C at 0,1 MPa … the critical point
  const satP = [0.101, 1, 2, 5, 10, 15, 17, 20, CRITICAL_PRESSURE_MPA];
  const satT = satP.map((x, i) => (i === 0 ? 100 : saturationTempC(x)));
  const presetButtons: ControlSpec[] = (
    [
      ['old200', L.presetOld200],
      ['ua300', L.preset300],
      ['usc1000', L.presetUsc],
      ['pingshan', L.presetPingshan],
    ] as const
  ).map(([key, label]) => ({ type: 'button', id: `sp.${key}`, label, onClick: () => apply(key) }));
  ctx.qa.expose('steam', () => ({ p: p(), t: t(), eta: eta(), cls: steamClass(p(), t()), phase: phase() }));
  return {
    id: 'steam-params',
    stage: { camera: 'steam-params', show: [capsule.group], enter: () => (preset = {}) },
    ui: {
      reset: true,
      honesty: ['simplified', 'notToScale'],
      controls: [
        { type: 'slider', id: 'sp.p', label: L.pressure, min: 1, max: 35, step: 0.5, value: 17, unit: 'MPa', digits: 1, onChange: () => ((preset = {}), hold()) },
        { type: 'slider', id: 'sp.t', label: L.temperature, min: 300, max: 720, step: 5, value: 540, unit: '°C', digits: 0, onChange: () => ((preset = {}), hold()) },
        { type: 'note', id: 'sp.class', icon: 'star', color: 'amber', text: () => `${L.steamClass}: ${className[steamClass(p(), t())]}` },
        { type: 'readout', id: 'sp.eta', label: L.etaNet, get: () => eta() * 100, unit: '%', digits: 1, color: () => 'ui.ok' },
        { type: 'readout', id: 'sp.coal', label: L.coalPerMWh, get: () => fuel().coalKgPerMWh, unit: 'kg', digits: 0 },
        { type: 'readout', id: 'sp.co2', label: L.co2PerKWh, get: () => fuel().co2GPerKWh, unit: 'g', digits: 0 },
      ],
      board: {
        title: L.phaseChart,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'sp.chart',
            chart: { height: 220, x: { min: 0, max: 720, label: 't, °C' }, y: { min: 0, max: 35, label: 'p, MPa' }, series: [{ id: 'sat', label: L.boilingLine, color: 'mist' }] },
            init: (c) => {
              c.setData('sat', satT, satP);
              c.setMarker('crit', { x: T_CRIT, y: CRITICAL_PRESSURE_MPA, color: 'amber', label: L.criticalPoint, guides: false });
            },
            update: (c) => c.setMarker('state', { x: t(), y: p(), color: 'yellow', label: L.state }),
          },
          {
            type: 'table',
            id: 'sp.units',
            head: [L.steamClass, L.etaNet, L.wagonsGWh],
            rows: CARDS.map(([cls, pp, tt]) => {
              const e = unitEfficiency({ pressureMPa: pp, tempC: tt });
              return [className[cls], fmtPercent(e, 1), fmtNumber(fuelUse('bituminous', 1000, e).coalKgPerMWh / WAGON_T, { digits: 1 })];
            }),
            highlight: () => CARDS.findIndex(([cls]) => cls === steamClass(p(), t())),
          },
          ...presetButtons,
        ],
      },
      callouts: [{ anchor: () => capsule.points.fluid.clone().add(new Vector3(0, 10, 0)), text: () => (phase() === 'boiling' ? L.boiling : phase() === 'fluid' ? L.fluid : L.superheatedSteam), side: 'up' }],
      hotspots: [hot(() => capsule.points.fluid, HOTSPOTS['steam-params'].critical), hot(() => capsule.points.wall, HOTSPOTS['steam-params'].alloy)],
    },
    update(_dt, time) {
      capsule.set(phase(), (t() - 300) / 420);
      capsule.group.rotation.x = Math.sin(time * 0.3) * 0.04;
    },
  };
};
