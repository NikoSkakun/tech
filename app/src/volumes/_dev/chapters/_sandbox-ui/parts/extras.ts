import { Chart, HeatMap, Label, Panel, PhasorScope, RadarChart, UiNode, honesty, row } from '@/ui3d';

export interface ExtrasDemo {
  node: UiNode;
  update(t: number): void;
}

/** The charts the chapter authors asked for: phasors + scope, radar, heat map with a marker, log-axis spectrum. */
export function extrasDemo(): ExtrasDemo {
  const phasors = new PhasorScope({
    phasors: [
      { id: 'u', label: 'u(t)', color: 'yellow', amplitude: 1, phase: 0 },
      { id: 'i', label: 'i(t), cos φ = 0,8', color: 'cyan', amplitude: 0.7, phase: -0.6435 },
    ],
  });
  const radar = new RadarChart({
    size: 190,
    axes: ['Енергія', 'Потужність', 'Безпека', 'Ресурс', 'Ціна'],
    series: [
      { id: 'lfp', label: 'LFP', color: 'lime', values: [0.55, 0.7, 0.95, 0.95, 0.8] },
      { id: 'nmc', label: 'NMC', color: 'pink', values: [0.9, 0.8, 0.6, 0.6, 0.55] },
    ],
  });
  // yearly yield of a PV array vs tilt and azimuth (illustrative cosine model, kWh per kW)
  const yieldAt = (az: number, tilt: number): number =>
    1150 *
    (0.62 + 0.38 * Math.cos(((tilt - 35) / 90) * Math.PI * 0.9) * Math.cos((az / 180) * Math.PI * 0.75));
  const heat = new HeatMap({
    height: 220,
    x: { min: -90, max: 90, label: 'азимут, °', ticks: [-90, -45, 0, 45, 90] },
    y: { min: 0, max: 90, label: 'нахил, °', ticks: [0, 30, 60, 90] },
    value: yieldAt,
    min: 500,
    max: 1150,
    unit: 'kWh/kW',
    marker: { x: 0, y: 35 },
  });
  const spectrum = new Chart({
    height: 190,
    x: { min: 0, max: 22, label: 'номер гармоніки', ticks: [1, 5, 9, 13, 17, 21] },
    y: { min: 0.1, max: 100, log: true, label: 'амплітуда, %' },
    series: [{ id: 'h', color: 'violet', kind: 'bars' }],
  });
  const ns = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  spectrum.setData(
    'h',
    ns,
    ns.map((n) => 100 / n ** 1.6),
  );
  const node = new UiNode({
    dir: 'row',
    gap: 18,
    align: 'start',
    children: [
      new Panel({
        width: 500,
        gap: 12,
        children: [
          row(
            { gap: 10 },
            new Label('Фазори й осцилограма', { font: 'display', size: 24 }),
            honesty.slowed(100),
          ),
          phasors,
          new Label('Спектр (логарифмічна вісь)', { font: 'display', size: 24 }),
          spectrum,
        ],
      }),
      new Panel({
        width: 480,
        gap: 12,
        children: [
          new Label('Теплова мапа з маркером', { font: 'display', size: 24 }),
          heat,
          new Label('Радар', { font: 'display', size: 24 }),
          radar,
        ],
      }),
    ],
  });
  return { node, update: (t) => phasors.setAngle(t * 1.2) };
}
