/**
 * Data of step 9. `STATIONS` = the document's table of Ukrainian hydro stations («Інтерактив» of
 * `role-ukraine`; the export does not carry it — request filed), copied cell by cell and pinned to the
 * document by `__tests__/stations.test.ts`; `lonLat` are approximate positions for the schematic map (ours).
 * `RECORDS` = the record holders named in the step's facts, with the figure the facts give.
 * `UKRAINE` = a coarse outline of Ukraine in its internationally recognised borders (Crimea included,
 * DECISIONS §7), lon / lat in degrees — a schematic for the hologram, not a cartographic source.
 */
export interface Station {
  name: string;
  type: 'ГЕС' | 'ГАЕС';
  powerMW: string;
  firstUnit: string;
  lonLat: [number, number];
}

/** The table's header, as in the document. */
export const STATION_HEAD = ['Станція', 'Тип', 'Потужність, MW (≈)', 'Пуск першого агрегата'] as const;

export const STATIONS: readonly Station[] = [
  { name: 'Київська ГЕС', type: 'ГЕС', powerMW: '410–440', firstUnit: '1964', lonLat: [30.5, 50.6] },
  {
    name: 'Київська ГАЕС',
    type: 'ГАЕС',
    powerMW: '235 (турбінний режим)',
    firstUnit: '1970',
    lonLat: [30.2, 50.45],
  },
  { name: 'Канівська ГЕС', type: 'ГЕС', powerMW: '440–500', firstUnit: '1972', lonLat: [31.5, 49.75] },
  { name: 'Кременчуцька ГЕС', type: 'ГЕС', powerMW: '630–700', firstUnit: '1959', lonLat: [33.4, 49.08] },
  {
    name: 'Середньодніпровська ГЕС',
    type: 'ГЕС',
    powerMW: '350–390',
    firstUnit: '1963',
    lonLat: [34.6, 48.52],
  },
  {
    name: 'ДніпроГЕС',
    type: 'ГЕС',
    powerMW: '1570 (до пошкодження 2024 р.)',
    firstUnit: '1932',
    lonLat: [35.08, 47.87],
  },
  {
    name: 'Каховська ГЕС',
    type: 'ГЕС',
    powerMW: '335 (зруйнована 06.06.2023)',
    firstUnit: '1955',
    lonLat: [33.37, 46.78],
  },
  { name: 'Дністровська ГЕС', type: 'ГЕС', powerMW: '700', firstUnit: '1981', lonLat: [27.45, 48.6] },
  {
    name: 'Дністровська ГАЕС',
    type: 'ГАЕС',
    powerMW: '1296 (турбінний) / 1684 (насосний)',
    firstUnit: '2009',
    lonLat: [27.15, 48.45],
  },
  {
    name: 'Ташлицька ГАЕС («Енергоатом»)',
    type: 'ГАЕС',
    powerMW: '300–450 (турбінний режим)',
    firstUnit: '2006',
    lonLat: [31.1, 47.82],
  },
];

export const RECORDS: readonly [string, string][] = [
  ['«Три ущелини»', '22,5 GW'],
  ['Itaipu', '14 GW'],
  ['Baihetan', '16 GW'],
  ['Bieudron', '1883 m'],
  ['Fengning', '3,6 GW'],
];

/** The Dnipro from the northern border to the estuary (lon, lat). */
export const DNIPRO: readonly [number, number][] = [
  [30.55, 51.45],
  [30.5, 50.9],
  [30.55, 50.45],
  [31.2, 50.0],
  [31.5, 49.75],
  [32.2, 49.4],
  [32.9, 49.2],
  [33.4, 49.08],
  [34.0, 48.8],
  [34.6, 48.52],
  [35.05, 48.35],
  [35.08, 47.87],
  [34.9, 47.64],
  [34.4, 47.52],
  [33.9, 47.3],
  [33.37, 46.78],
  [32.9, 46.66],
  [32.3, 46.58],
];

/** The Dniester through the Dniester stations. */
export const DNIESTER: readonly [number, number][] = [
  [25.9, 48.75],
  [26.6, 48.62],
  [27.45, 48.6],
  [28.2, 48.2],
  [29.0, 47.6],
  [29.6, 46.9],
  [30.1, 46.4],
];

export const UKRAINE: readonly [number, number][] = [
  [23.6, 51.52],
  [25.5, 51.92],
  [27.7, 51.6],
  [29.3, 51.38],
  [30.6, 51.3],
  [31.6, 52.1],
  [33.0, 52.35],
  [34.1, 51.7],
  [35.3, 51.1],
  [35.9, 50.5],
  [37.4, 50.38],
  [38.2, 50.0],
  [39.3, 49.9],
  [40.15, 49.6],
  [39.75, 48.8],
  [39.9, 48.2],
  [38.85, 47.85],
  [38.25, 47.1],
  [37.5, 47.05],
  [36.8, 46.7],
  [35.4, 46.35],
  [34.8, 46.15],
  [34.1, 46.0],
  [35.0, 45.65],
  [35.6, 45.4],
  [36.6, 45.4],
  [36.4, 45.1],
  [35.3, 44.95],
  [34.4, 44.5],
  [33.5, 44.55],
  [33.5, 45.1],
  [32.5, 45.4],
  [33.6, 45.9],
  [33.5, 46.1],
  [32.4, 46.4],
  [31.6, 46.6],
  [30.8, 46.5],
  [30.2, 45.85],
  [29.7, 45.65],
  [29.6, 45.25],
  [28.25, 45.45],
  [28.95, 46.0],
  [30.1, 46.45],
  [29.2, 47.5],
  [28.2, 48.2],
  [27.5, 48.45],
  [26.6, 48.25],
  [25.0, 47.85],
  [23.4, 48.0],
  [22.15, 48.4],
  [22.6, 49.1],
  [22.7, 49.6],
  [23.4, 50.4],
  [24.1, 50.9],
];
