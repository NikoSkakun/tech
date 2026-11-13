/**
 * Step 12 `scale-and-future` — the scale ribbon from a phone (15 Wh) to storage plants (GWh) and on to
 * recycling; the pack-price curve 2010–2025 and the «Скільки протягне?» calculator on the board.
 * Models: `runtimeHours`, `packCostUsd`, `PACK_PRICE_USD_PER_KWH` (§M8).
 *
 * The document's cross-references appear as «Див. також» chips in the step panel (the HUD renders them from
 * the content), so the step declares no links of its own.
 */
import { Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '@/audio';
import { fmtNumber, fmtSI } from '@/content';
import { damp } from '@/engine/api';
import { createOrbs, createParticles, pointEmitter } from '@/fx';
import { PACK_PRICE_USD_PER_KWH, packCostUsd, runtimeHours } from '@electricity/sim/lab-battery';
import { K } from '@/style';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { note } from '../notes';
import { SCALE_STOPS, createScaleItem, type ScaleStopId } from '../parts/scale-sites';
import { frame } from '../shots';
import { group, mesh, tag } from '../world';

const ID = 'scale-and-future';
const PITCH = 2.7; // distance between stops on the ribbon
const NAMES: Record<ScaleStopId, string> = {
  phone: L.stopPhone,
  laptop: L.stopLaptop,
  ebike: L.stopEbike,
  station: L.stopStation,
  home: L.stopHome,
  ev: L.stopEv,
  bess: L.stopBess,
  plant: L.stopPlant,
  recycling: L.stopRecycling,
};
/** Recovered metals flying out of the black mass: Li, Ni, Co, Cu, Al. */
const NUGGETS = ['lime', 'green', 'blue', 'orange', 'mist'] as const;
const YEARS = Object.keys(PACK_PRICE_USD_PER_KWH).map(Number);

export const scaleAndFuture: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const ribbon = group('ribbon');
  const belt = new Mesh(
    new RoundedBoxGeometry(PITCH * SCALE_STOPS.length + 2, 0.08, 1.9, 2, 0.03),
    K.toon({ gradient: { bottom: 'bg.indigo', top: 'slate', range: [-0.04, 0.04] } }),
  );
  belt.position.set((PITCH * (SCALE_STOPS.length - 1)) / 2, 0.04, 0);
  belt.receiveShadow = true;
  ribbon.add(belt);
  const energy = (wh: readonly [number, number] | null): string =>
    wh === null
      ? ''
      : wh[0] === wh[1]
        ? fmtSI(wh[0], 'Wh')
        : wh[1] >= 1e9
          ? `${fmtSI(wh[0], 'Wh')} … GWh`
          : `${fmtNumber(wh[0] / 10 ** (3 * Math.floor(Math.log10(wh[1]) / 3)))}–${fmtSI(wh[1], 'Wh')}`;
  const items = SCALE_STOPS.map((stop, i) => {
    const holder = group(`stop:${stop.id}`, i * PITCH, 0.08, 0, [createScaleItem(stop.id)]);
    // log-scale tick under every stop
    ribbon.add(mesh(new RoundedBoxGeometry(0.06, 0.02, 1.7, 1, 0.01), mats.light, i * PITCH, 0.09, 0, false));
    // The energy chip rides on the ribbon, not in the holder: the holder shrinks with the distance from the
    // centre and would shrink the text under the legible size.
    const chip = tag(energy(stop.wh), 24, 'lime', 'mono');
    chip.position.set(i * PITCH, 2.6, 0);
    ribbon.add(holder, chip);
    return { ...stop, holder, chip };
  });
  // recycling: black mass pours out of the shredder, coloured nuggets of recovered metals fly off
  const recycling = items[items.length - 1]!.holder;
  const blackMass = createParticles(ctx, {
    count: ctx.quality.count(60),
    emitter: pointEmitter([0.95, 0.5, 0], { axis: [1, -0.4, 0], spread: 0.35 }),
    sprite: 'disc',
    blend: 'normal',
    color: ['ink', 'slate'],
    life: [0.6, 1.0],
    speed: [0.6, 1.2],
    gravity: [0, -3, 0],
    size: [0.05, 0.07, 0.04],
  });
  recycling.add(blackMass);
  const nuggetOrbs = NUGGETS.map((c, k) => {
    const o = createOrbs({ kind: 'blob', color: c, count: 1, radius: 0.085, halo: false });
    recycling.add(o);
    return { o, k };
  });
  const set = group(`set:${ID}`, 1.0, 0, 0.6, [ribbon]);
  lab.stageRoot.add(set);

  /* --------------------------------------------------------------------------------------- state */
  let pos = 0;
  const page = (p: 'price' | 'calc') => (): boolean => ui.value<string>('page12') === p;
  const year = (): number => ui.value<number>('year12');
  const hours = (): number =>
    runtimeHours(ui.value<number>('energy12'), ui.value<number>('dod12'), ui.value<number>('power12'));
  const v = new Vector3();
  const smooth = (a: number, b: number, x: number): number => {
    const k = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return k * k * (3 - 2 * k);
  };
  const centred = (i: number) => (): boolean => Math.abs(i - pos) < 0.5;
  const top = (i: number) => (): Vector3 => items[i]!.holder.getWorldPosition(v).setY(v.y + 1.75);
  ui.onChange('scale12', () => audio.play('whooshUp', { gain: 0.25 }));

  return {
    id: ID,
    shots: {
      [ID]: frame([1.0, 1.65, 0.6], 7.6, 3.9, { azimuth: 0.1, elevation: 0.16 }),
    },
    stage: { show: [ribbon], enter: (info) => void (info.instant && (pos = ui.value<number>('scale12'))) },
    ui: {
      hint: L.hint12,
      honesty: ['notToScale', 'simplified'],
      controls: [
        {
          type: 'slider',
          id: 'scale12',
          label: L.scale,
          min: 0,
          max: SCALE_STOPS.length - 1,
          step: 1,
          value: 4,
          format: (i) => energy(SCALE_STOPS[Math.round(i)]!.wh) || '↻',
        },
      ],
      board: {
        size: 'md',
        children: [
          {
            type: 'segmented',
            id: 'page12',
            items: [
              { id: 'price', label: L.boardPrice },
              { id: 'calc', label: L.howLong },
            ],
            value: 'price',
          },
          /* ---- page 1: the price of a pack by year, and what 10 kWh would have cost ---- */
          {
            type: 'chart',
            id: 'chart12',
            visible: page('price'),
            chart: {
              height: 190,
              x: {
                min: YEARS[0]!,
                max: YEARS[YEARS.length - 1]!,
                label: L.axisYear,
                ticks: [2010, 2015, 2020, 2025],
              },
              y: { min: 0, max: 1600, label: L.axisUsdKwh },
              series: [{ id: 'price', color: 'lime', kind: 'area' }],
              onScrub: (x) =>
                ui.set('year12', Math.min(Math.max(Math.round(x), 2010), 2025), { notify: true }),
            },
            init: (chart) => chart.setData('price', YEARS, YEARS.map((y) => PACK_PRICE_USD_PER_KWH[y]!)), // prettier-ignore
            update: (chart) =>
              chart.setMarker('year', {
                x: year(),
                y: PACK_PRICE_USD_PER_KWH[year()]!,
                color: 'white',
                label: String(year()),
              }),
          },
          {
            type: 'slider',
            id: 'year12',
            label: L.axisYear,
            min: 2010,
            max: 2025,
            step: 1,
            value: 2025,
            format: (y) => String(y),
            visible: page('price'),
          },
          note('title12', L.cost10kwh, 'info', page('price')),
          {
            type: 'stats',
            id: 'cost12',
            visible: page('price'),
            items: [
              { label: '$/kWh', get: () => fmtNumber(PACK_PRICE_USD_PER_KWH[year()]!, { digits: 0 }) },
              { label: '10 kWh', get: () => `${fmtNumber(packCostUsd(10, year()), { digits: 0 })} $` },
              {
                label: L.stationary2025,
                get: () => `${fmtNumber(packCostUsd(10, 2025, true), { digits: 0 })} $`,
              },
            ],
          },
          note('approx12', L.approxPrices, 'honesty', page('price')),
          /* ---- page 2: «Скільки протягне?» — t = W·DoD·η / P ---- */
          {
            type: 'slider',
            id: 'energy12',
            label: L.calcEnergy,
            min: 0.1,
            max: 30,
            scale: 'log',
            step: 2,
            unit: 'kWh',
            value: 10,
            visible: page('calc'),
          },
          { type: 'slider', id: 'dod12', label: L.calcDod, min: 50, max: 100, step: 5, unit: '%', value: 90, visible: page('calc') }, // prettier-ignore
          {
            type: 'slider',
            id: 'power12',
            label: L.calcPower,
            min: 0.01,
            max: 5,
            scale: 'log',
            step: 2,
            unit: 'kW',
            value: 0.3,
            visible: page('calc'),
          },
          {
            type: 'stats',
            id: 'hours12',
            columns: 1,
            visible: page('calc'),
            items: [{ label: L.calcHours, get: hours, unit: 'h', digits: 1, color: () => 'lime' }],
          },
        ],
      },
      callouts: items.map((it, i) => ({
        anchor: top(i),
        text: NAMES[it.id],
        color: 'lime' as const,
        side: 'up' as const,
        visible: centred(i),
      })),
      hotspots: [
        {
          anchor: () => items[5]!.holder.getWorldPosition(v).set(v.x + 0.5, v.y + 0.5, v.z + 0.6),
          content: 'second-life',
          visible: centred(5),
        },
        {
          anchor: () => items[6]!.holder.getWorldPosition(v).set(v.x + 0.5, v.y + 0.9, v.z + 0.5),
          content: 'sodium-ion',
          visible: centred(6),
        },
      ],
    },
    probe: () => ({
      pos,
      year: year(),
      cost: packCostUsd(10, year()),
      hours: hours(),
      page: ui.value<string>('page12'),
    }),
    update(dt, t) {
      // the ribbon slides so that the chosen stop sits in the middle; stops grow as they arrive
      pos = damp(pos, ui.value<number>('scale12'), 4, dt);
      ribbon.position.x = -pos * PITCH;
      items.forEach((it, i) => {
        const d = Math.abs(i - pos);
        const s = d <= 1 ? 1 - 0.42 * smooth(0, 1, d) : 0.58 * (1 - smooth(1.7, 2.7, d));
        it.holder.scale.setScalar(Math.max(s, 1e-3) * 1.25);
        it.holder.visible = s > 0.01;
        it.holder.position.y = 0.08 + Math.sin(t * 1.4 + i) * 0.03 * (1 - Math.min(d, 1));
        it.holder.children[0]!.rotation.y = Math.sin(t * 0.5 + i) * 0.35;
        // energy chips: full size for the stop in the middle and its neighbours, gone beyond
        const near = 1 - smooth(0.9, 1.5, d);
        it.chip.visible = near > 0.02 && it.wh !== null;
        it.chip.opacity = near;
        it.chip.position.y = 0.4 + 2.3 * s * 1.25 + 0.25;
      });
      const here = 1 - Math.min(Math.abs(items.length - 1 - pos), 1);
      blackMass.rate = here;
      nuggetOrbs.forEach(({ o, k }) => {
        const ph = (t * 0.45 + k / NUGGETS.length) % 1;
        o.position.set(1.05 + ph * 0.6, 0.5 + 1.5 * ph - 2.4 * ph * ph, (k - 2) * 0.36 * ph);
        o.radius = 0.085 * Math.sin(Math.PI * ph) * here + 1e-4;
      });
    },
  };
};
