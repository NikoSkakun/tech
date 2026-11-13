/**
 * Step 12 `scale-and-future` — the scale ribbon from a phone (15 Wh) to storage plants (GWh) and on to
 * recycling; the pack-price curve 2010–2025 on the holo board; the «Скільки протягне?» calculator.
 * Models: `runtimeHours`, `packCostUsd`, `PACK_PRICE_USD_PER_KWH` (§M8).
 */
import { Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '@/audio';
import { fmtNumber, fmtSI } from '@/content';
import { damp } from '@/engine/api';
import { createOrbs, createParticles, pointEmitter } from '@/fx';
import { PACK_PRICE_USD_PER_KWH, packCostUsd, runtimeHours } from '@electricity/sim/lab-battery';
import { K } from '@/style';
import { Chart, Chip, Readout, Slider, Tabs, col, row } from '@/ui3d';
import { notices, statGrid } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { SCALE_STOPS, createScaleItem, type ScaleStopId } from '../parts';
import { group, mesh, nowhere, tag } from '../world';

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
/** In-app links of the document's «Перехресні посилання» (chapter/step). */
const LINKS = ['lab-hybrid-home/overview', 'home/backup', 'plant-future/bess', 'grid/future-grid'] as const;

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
    const chip = tag(energy(stop.wh), 22, 'lime', 'mono');
    chip.position.set(0, 2.0, 0);
    holder.add(chip);
    ribbon.add(holder);
    return { ...stop, holder };
  });
  // recycling: black mass pours out of the shredder, coloured nuggets of recovered metals fly off
  const recycling = items[items.length - 1]!.holder;
  const blackMass = createParticles(ctx, {
    count: 60,
    emitter: pointEmitter([0.75, 0.55, 0], { axis: [1, -0.4, 0], spread: 0.35 }),
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

  /* --------------------------------------------------------------------------------------- board */
  const years = Object.keys(PACK_PRICE_USD_PER_KWH).map(Number);
  const chart = new Chart({
    height: 190,
    x: {
      min: years[0]!,
      max: years[years.length - 1]!,
      label: L.axisYear,
      ticks: [2010, 2015, 2020, 2025],
      format: (y) => String(Math.round(y)),
    },
    y: { min: 0, max: 1600, label: L.axisUsdKwh },
    series: [{ id: 'price', color: 'lime', kind: 'area' }],
    onScrub: (x) => ui.drive('year12', Math.min(Math.max(Math.round(x), 2010), 2025)),
  });
  chart.setData(
    'price',
    years,
    years.map((y) => PACK_PRICE_USD_PER_KWH[y]!),
  );
  const yearSlider = new Slider({
    label: L.axisYear,
    min: 2010,
    max: 2025,
    step: 1,
    value: 2025,
    format: (y) => String(y),
    onChange: (y) => yearPick.set(y),
  });
  const yearPick = ui.external('year12', 2025, (y) => (yearSlider.value = Number(y)));
  const cost = statGrid([{ name: '10 kWh', color: 'lime' }], ['$/kWh', '$', L.stationary2025], 70);
  const notes = notices(
    'notes12',
    { title: { text: L.cost10kwh, tone: 'info' }, approx: { text: L.approxPrices, tone: 'honesty' } },
    ['title', 'approx'],
  );
  // links of the document's cross-references: shown for chapters that exist in this build
  const links = LINKS.flatMap((target) => {
    const [chapterId, stepId] = target.split('/') as [string, string];
    const chapter = ctx.nav.chapter(chapterId);
    return chapter
      ? [
          new Chip({
            text: `→ ${chapter.title}`,
            kind: 'plain',
            icon: 'link',
            maxWidth: 440,
            onClick: () => void ctx.nav.goto(chapterId, stepId),
          }),
        ]
      : [];
  });
  // second page of the board: the «Скільки протягне?» calculator (three sliders and the answer)
  const calc = {
    energy: new Slider({
      label: L.calcEnergy,
      min: 0.1,
      max: 30,
      scale: 'log',
      step: 2,
      unit: 'kWh',
      value: 10,
      onChange: (x) => picks.energy.set(x),
    }),
    dod: new Slider({
      label: L.calcDod,
      min: 50,
      max: 100,
      step: 5,
      unit: '%',
      value: 90,
      onChange: (x) => picks.dod.set(x),
    }),
    power: new Slider({
      label: L.calcPower,
      min: 0.01,
      max: 5,
      scale: 'log',
      step: 2,
      unit: 'kW',
      value: 0.3,
      onChange: (x) => picks.power.set(x),
    }),
  };
  const picks = {
    energy: ui.external('energy12', 10, (x) => (calc.energy.value = Number(x))),
    dod: ui.external('dod12', 90, (x) => (calc.dod.value = Number(x))),
    power: ui.external('power12', 0.3, (x) => (calc.power.value = Number(x))),
  };
  const hours = new Readout({ label: L.calcHours, unit: 'h', digits: 1, size: 'lg', duration: 0 });
  const pricePane = col({ gap: 8, width: 'fill', children: [chart, yearSlider, notes.spec.node, cost.node] });
  const calcPane = col({
    gap: 10,
    width: 'fill',
    visible: false,
    children: [calc.energy, calc.dod, calc.power, hours],
  });
  const pages = new Tabs<'price' | 'calc'>({
    items: [
      { id: 'price', label: L.boardPrice },
      { id: 'calc', label: L.howLong },
    ],
    value: 'price',
    onChange: (id) => page.set(id),
  });
  const page = ui.external('page12', 'price', (id) => (pages.value = id as 'price' | 'calc'));
  ui.onChange('page12', (id) => {
    pricePane.visible = id === 'price';
    calcPane.visible = id === 'calc';
  });
  lab.holo.add(ID, {
    width: 520,
    children: [pages, pricePane, calcPane, row({ wrap: true, gap: 8, width: 'fill', children: links })],
  });

  /* --------------------------------------------------------------------------------------- state */
  let pos = 0;
  let shownYear = 0;
  const v = new Vector3();
  const smooth = (a: number, b: number, x: number): number => {
    const k = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return k * k * (3 - 2 * k);
  };
  const centred = (i: number): boolean => Math.abs(i - pos) < 0.5;
  const top = (i: number) => (): Vector3 =>
    centred(i) ? items[i]!.holder.getWorldPosition(v).setY(v.y + 1.75) : nowhere(ctx, v);
  ui.onChange('scale12', () => audio.play('whooshUp', { gain: 0.25 }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [1.5, 3.3, 9.6],
        target: [-0.75, 1.95, 0.4],
        fov: 28,
        orbit: { azimuth: 0.8, polar: 0.3 },
      },
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
      callouts: items.map((it, i) => ({
        anchor: top(i),
        text: NAMES[it.id],
        color: 'lime' as const,
        side: 'up' as const,
      })),
      hotspots: [
        {
          anchor: () => items[5]!.holder.getWorldPosition(v).set(v.x + 0.5, v.y + 0.5, v.z + 0.6),
          title: 'Second life — друге життя',
        },
        {
          anchor: () => items[6]!.holder.getWorldPosition(v).set(v.x + 0.5, v.y + 0.9, v.z + 0.5),
          title: 'Sodium-ion — натрій-іон',
        },
      ],
    },
    probe: () => ({
      pos,
      year: ui.value<number>('year12'),
      cost: packCostUsd(10, ui.value<number>('year12')),
      hours: runtimeHours(
        ui.value<number>('energy12'),
        ui.value<number>('dod12'),
        ui.value<number>('power12'),
      ),
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
      });
      const here = 1 - Math.min(Math.abs(items.length - 1 - pos), 1);
      blackMass.rate = here;
      nuggetOrbs.forEach(({ o, k }) => {
        const ph = (t * 0.45 + k / NUGGETS.length) % 1;
        o.position.set(0.95 + ph * 1.5, 0.5 + 1.9 * ph - 2.7 * ph * ph, (k - 2) * 0.25 * ph);
        o.radius = 0.085 * Math.sin(Math.PI * ph) * here + 1e-4;
      });
      hours.setNow(
        runtimeHours(ui.value<number>('energy12'), ui.value<number>('dod12'), ui.value<number>('power12')),
      );
      // price board: marker and the cost of a 10 kWh pack in the chosen year (§M8)
      const year = ui.value<number>('year12');
      if (year !== shownYear) {
        shownYear = year;
        chart.setMarker('year', {
          x: year,
          y: PACK_PRICE_USD_PER_KWH[year]!,
          color: 'white',
          label: String(year),
        });
        cost.set(0, 0, fmtNumber(PACK_PRICE_USD_PER_KWH[year]!, { digits: 0 }));
        cost.set(0, 1, fmtNumber(packCostUsd(10, year), { digits: 0 }));
        cost.set(0, 2, `${fmtNumber(packCostUsd(10, 2025, true), { digits: 0 })} $`);
      }
    },
  };
};
