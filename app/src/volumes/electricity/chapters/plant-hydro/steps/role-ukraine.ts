/**
 * Step 9 `role-ukraine` — «Роль ГЕС, рекорди, Україна». Dawn over the island; above it the hologram of Ukraine
 * (`ukraine-map.ts`) with the Dnipro cascade, the Dniester stations, the pumped-storage plants, small hydro in
 * the Carpathians and the dashed bed of the former Kakhovka reservoir. A click on a pin (or the «Станція»
 * slider) selects a station: its row is highlighted in the board table (name, type, power, first unit, the
 * document's data «станом на 2022 р.»). «Водний рік» changes the bar of the cascade's yearly output
 * (illustrative −30 % / 0 / +25 %). The record table of the facts, and the two links of the document.
 */
import { Vector3 } from 'three';
import { crossTargets, splitCaption } from '../content';
import { HOTSPOTS } from '../hotspots';
import { HOLO } from '../shots';
import { buildUkraineMap } from '../parts/ukraine-map';
import { RECORDS, STATION_HEAD, STATIONS } from '../stations';
import { hot } from './hot';
import type { StepFactory } from './types';

const YEAR = { dry: 70, mean: 100, wet: 125 } as const;

export const roleUkraine: StepFactory = ({ ctx, ui, L }) => {
  const map = buildUkraineMap();
  map.group.position.set(...HOLO);
  map.group.rotation.x = -0.18;
  ctx.root.add(map.group);
  const aMap = ctx.stage.actor(map.group, { appear: 'grow' });
  ctx.qa.probe('ru.pin', () => map.stationAt(2, new Vector3()));
  const selected = (): number => ui.value<number>('ru.st');
  const active = (): boolean => ctx.stage.current === 'role-ukraine';
  map.proxies.forEach((p, i) =>
    ctx.input.register(p, {
      tooltip: STATIONS[i]!.name,
      enabled: active,
      click: () => ui.set('ru.st', i, { notify: true }),
    }),
  );
  const year = splitCaption(L.waterYear, ' / '); // «Водний рік» · посушливий / середній / багатоводний
  const links = crossTargets('крок 9');
  const go = (mark: string): void => {
    const target = links.find((x) => x.includes(mark));
    if (target) ctx.nav.open(target);
  };
  const asOf = L.asOf.replace('…', '2022 р.');
  const kakhovka = STATIONS.findIndex((s) => s.name.startsWith('Каховська'));
  ctx.qa.expose('ru', () => ({ selected: selected() }));
  return {
    id: 'role-ukraine',
    stage: { camera: 'role-ukraine', show: [aMap], env: 'golden' },
    ui: {
      honesty: ['notToScale', { kind: 'illustrative', text: L.illustration }],
      controls: [
        {
          type: 'slider',
          id: 'ru.st',
          label: L.station,
          min: 0,
          max: STATIONS.length - 1,
          step: 1,
          value: 5,
          format: (i) => STATIONS[Math.round(i)]?.name ?? '',
        },
        {
          type: 'segmented',
          id: 'ru.year',
          label: year.label,
          value: 'mean',
          items: [
            { id: 'dry', label: year.items[0] ?? 'dry' },
            { id: 'mean', label: year.items[1] ?? 'mean' },
            { id: 'wet', label: year.items[2] ?? 'wet' },
          ],
        },
        {
          type: 'button',
          id: 'ru.wind',
          label: L.nextWind,
          icon: 'arrowRight',
          primary: true,
          onClick: () => go('plant-wind'),
        },
        {
          type: 'button',
          id: 'ru.gallery',
          label: L.backGallery,
          icon: 'arrowLeft',
          onClick: () => go('plants/gallery'),
        },
      ],
      board: {
        title: L.station,
        size: 'sm',
        children: [
          {
            // the station card: the document's table row of the selected station
            type: 'table',
            id: 'ru.card',
            rows: () => {
              const st = STATIONS[selected()]!;
              return [
                [STATION_HEAD[0], st.name],
                [STATION_HEAD[1], st.type],
                [STATION_HEAD[2], st.powerMW],
                [STATION_HEAD[3], st.firstUnit],
              ];
            },
          },
          {
            type: 'note',
            id: 'ru.asof',
            icon: 'info',
            text: () => `${STATIONS[selected()]!.name} · ${asOf}`,
          },
          {
            type: 'chart',
            id: 'ru.year',
            chart: {
              height: 90,
              x: { min: 0, max: 2, label: '' },
              y: { min: 0, max: 130, label: `${L.cascadeOutput}, %` },
              series: [{ id: 'y', color: 'blue', kind: 'bars' }],
            },
            update: (c) => c.setData('y', [1], [YEAR[ui.value<keyof typeof YEAR>('ru.year')]]),
          },
          { type: 'table', id: 'ru.records', head: [L.records, ''], rows: RECORDS.map(([a, b]) => [a, b]) },
        ],
      },
      callouts: [
        {
          anchor: () => map.stationAt(selected(), new Vector3()),
          text: () => STATIONS[selected()]!.name,
          side: 'up',
          priority: 0,
        },
      ],
      hotspots: [hot(() => map.stationAt(kakhovka, new Vector3()), HOTSPOTS['role-ukraine'].kakhovka)],
    },
    update(_dt, t) {
      map.setSelected(selected());
      map.update(t);
    },
  };
};
