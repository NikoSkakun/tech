/**
 * Step 8 `metrics` — «Показники: потужність, енергія, КВВП, вартість, CO₂». Above the hub floats the year carpet:
 * 365 day tiles lit by the plant's daily output (plants sim M5 `dayTiles`). P_inst and CF give the annual energy
 * `W = P·8760 h·CF` and the homes it covers (`annualEnergyTWh`, `homesSupplied`, an estimate). The type switch
 * puts 1000 MW of nuclear / wind / solar with their typical CF; «рік» runs the three odometers together over 10 s
 * (the nuclear, wind and solar islands' lines glow with their running energy). «Показати вартість / CO₂» opens
 * two floating-bar charts from the comparison table (LCOE ranges, lifecycle CO₂).
 */
import { Vector3 } from 'three';
import { annualEnergyTWh, CF_PRESETS, COMPARE_ROWS, dayTiles, homesSupplied, type TileType } from '@electricity/sim/plants';
import type { StepFactory } from '../chapter';
import { doc, splitAll } from '../labels';
import { LISTS, OWN } from '../labels-own';
import { createDayTiles } from '../parts/day-tiles';
import { group, tag } from '../world';

const ID = 'metrics';
const TYPES: readonly TileType[] = ['nuclear', 'wind', 'solar'];
const YEAR_S = 10;
const ISLAND: Record<TileType, 'nuclear' | 'wind' | 'solar'> = { nuclear: 'nuclear', wind: 'wind', solar: 'solar' };
/** Rows of the comparison table on the cost / CO₂ charts (new plants with data in both columns). */
const ROWS = ['coal', 'gasCcgt', 'gasPeaker', 'nuclear', 'hydro', 'windOnshore', 'windOffshore', 'solarPv', 'csp', 'geothermal', 'biomass'];

export const metrics: StepFactory = (hub) => {
  const { ctx, ui, arch } = hub;
  // the calendar hangs in front of the hub, tilted toward the camera; the live equation floats above it
  // outside the world ring (r = 74 m), so the ring never crosses the calendar
  const set = group(ID, 0, 30, 84);
  hub.stageRoot.add(set);
  const carpet = group('carpet');
  carpet.rotation.x = 1.3;
  carpet.scale.setScalar(1.0);
  set.add(carpet);
  const tiles = createDayTiles();
  carpet.add(tiles.group);
  const eq = tag('', 30, 'yellow', 'display');
  eq.position.set(0, 27.5, 3);
  set.add(eq);
  const num = (v: number, d: number): string => v.toFixed(d).replace('.', ',');
  const type = (): TileType => ui.value<TileType>('type8');
  const P = (): number => ui.value<number>('p8');
  const CF = (): number => ui.value<number>('cf8') / 100;
  const W = (): number => annualEnergyTWh(P(), CF());
  const st = { run: -1 };
  const ran = (t: TileType): number => annualEnergyTWh(1000, CF_PRESETS[t]) * (st.run < 0 ? 0 : Math.min(1, st.run / YEAR_S));
  const rows = ROWS.map((id) => COMPARE_ROWS.find((r) => r.id === id)!);
  const names = rows.map((r) => LISTS.compareShort[COMPARE_ROWS.indexOf(r)] ?? r.id);
  const xs = rows.map((_, i) => i);
  const cost = (): boolean => ui.value<boolean>('cost8');
  const corner = (): Vector3 => carpet.localToWorld(new Vector3(-tiles.width / 2 - 0.5, 0.5, -tiles.depth / 2 - 0.5));
  ctx.qa.probe('tiles', () => set.localToWorld(tiles.group.position.clone()));
  const labelsOf = (v: number): string => names[Math.round(v)] ?? '';

  return {
    id: ID,
    hall: true,
    turboSet: true,
    shots: {
      [ID]: { position: [0, 34, 130], target: [0, 33, 84], fov: 40, drift: 0.5, fit: { center: [0, 37, 84], radius: 37 } },
    },
    stage: {
      show: [set],
      // a deep link shows the finished year; arriving from another step plays it once
      enter: (info) => {
        st.run = info.instant ? YEAR_S : 0;
      },
    },
    ui: {
      honesty: ['illustrative'],
      controls: [
        { type: 'slider', id: 'p8', label: OWN.pInst, min: 10, max: 3000, step: 10, value: 1000, unit: 'MW' },
        { type: 'slider', id: 'cf8', label: OWN.cf, min: 0, max: 100, step: 1, value: 90, unit: '%' },
        {
          type: 'segmented',
          id: 'type8',
          items: splitAll(doc(ID, 3)).map((label, i) => ({ id: TYPES[i]!, label })),
          value: 'nuclear',
          onChange: (v) => {
            ui.set('p8', 1000);
            ui.set('cf8', Math.round(CF_PRESETS[v as TileType] * 100));
            hub.sound.click();
          },
        },
        {
          type: 'stats',
          id: 'read8',
          columns: 2,
          items: [
            { label: `W, ${doc(ID, 0)}`, get: () => W(), unit: 'TWh', digits: 2, color: () => 'yellow' },
            { label: `${OWN.homes}, ${doc(ID, 1)}`, get: () => homesSupplied(W()) / 1e6, unit: OWN.mln, digits: 2, color: () => 'mist' },
          ],
        },
        { type: 'toggle', id: 'cost8', label: doc(ID, 5), value: false, onChange: () => hub.sound.click(0.9) },
        { type: 'button', id: 'year8', label: `${doc(ID, 4)}: 10 s`, icon: 'play', primary: true, onClick: () => ((st.run = 0), hub.sound.whoosh()) },
      ],
      board: {
        title: OWN.metricsBoard,
        size: 'lg',
        children: [
          {
            type: 'stats',
            id: 'odo8',
            visible: () => !cost(),
            items: TYPES.map((t, i) => ({ label: `${splitAll(doc(ID, 3))[i]?.split(' ')[0] ?? t} · ${Math.round(CF_PRESETS[t] * 100)} %`, get: () => ran(t), unit: 'TWh', digits: 2, color: () => (t === 'nuclear' ? 'violet' : t === 'wind' ? 'teal' : 'amber') })),
          },
          {
            type: 'chart',
            id: 'lcoe8',
            visible: () => cost(),
            chart: { height: 170, x: { min: -0.6, max: rows.length - 0.4, label: '', ticks: xs, format: labelsOf }, y: { min: 0, max: 300, label: 'LCOE, $/MWh' }, series: [{ id: 'lo', color: 'mist', kind: 'bars', stack: 'c', opacity: 0 }, { id: 'span', color: 'amber', kind: 'bars', stack: 'c' }] },
            init: (c) => {
              c.setData('lo', xs, rows.map((r) => r.lcoeUsd?.[0] ?? NaN));
              c.setData('span', xs, rows.map((r) => (r.lcoeUsd ? r.lcoeUsd[1] - r.lcoeUsd[0] : NaN)));
            },
          },
          {
            type: 'chart',
            id: 'co28',
            visible: () => cost(),
            chart: { height: 170, x: { min: -0.6, max: rows.length - 0.4, label: '', ticks: xs, format: labelsOf }, y: { min: 0, max: 1000, label: 'CO₂, g/kWh' }, series: [{ id: 'm', color: 'coral', kind: 'bars' }] },
            init: (c) => c.setData('m', xs, rows.map((r) => r.co2Median ?? (r.co2Range ? (r.co2Range[0] + r.co2Range[1]) / 2 : NaN))),
          },
        ],
      },
      hotspots: [{ anchor: corner, content: 'discount-rate' }],
    },
    probe: () => ({ type: type(), P: P(), CF: CF(), W: W(), run: st.run, odo: TYPES.map(ran), cost: cost() }),
    update(dt) {
      if (!hub.isCurrent(ID)) return;
      if (st.run >= 0 && st.run < YEAR_S) st.run = Math.min(YEAR_S, st.run + dt);
      tiles.set(dayTiles(type(), CF()));
      tiles.reveal = st.run < 0 ? 1 : st.run / YEAR_S;
      tiles.update(dt);
      // P_inst × 8760 h × CF = W, with the live numbers (symbols and units only)
      eq.text = `${Math.round(P())} MW × 8760 h × ${num(CF(), 2)}\n= ${num(W(), 2)} TWh`;
      for (const t of TYPES) arch.want.line[ISLAND[t]] = st.run < 0 ? 0.25 : 0.2 + 1.2 * (ran(t) / 7.5);
      arch.want.ring = 0.7;
      hub.sound.hum = 0.06;
    },
  };
};
