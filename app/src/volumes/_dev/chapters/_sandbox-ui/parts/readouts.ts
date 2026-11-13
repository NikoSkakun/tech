import { Chart, Gauge, Label, Panel, ProgressRing, Readout, STATUS, UiNode, col, row } from '@/ui3d';

export interface ReadoutsDemo {
  node: UiNode;
  update(t: number): void;
}

/** Gauges, numeric readouts and charts (I-V curve with a marker, live three-phase plot, stacked day profile). */
export function readoutsDemo(): ReadoutsDemo {
  const power = new Readout({ label: 'Потужність P', unit: 'W', value: 440, digits: 0, size: 'lg' });
  const eff = new Readout({ label: 'ККД η', unit: '%', digits: 1, value: 21.4, color: STATUS.ok });
  const freq = new Gauge({
    min: 49,
    max: 51,
    value: 50,
    unit: 'Hz',
    digits: 2,
    label: 'Частота f',
    size: 150,
    zones: [
      { from: 49, to: 49.8, color: STATUS.alarm },
      { from: 49.8, to: 49.95, color: STATUS.warning },
      { from: 49.95, to: 50.05, color: STATUS.ok },
      { from: 50.05, to: 50.2, color: STATUS.warning },
      { from: 50.2, to: 51, color: STATUS.alarm },
    ],
  });
  const soc = new Gauge({
    kind: 'linear',
    min: 0,
    max: 100,
    value: 72,
    unit: '%',
    digits: 0,
    label: 'Рівень заряду (SOC)',
    zones: [
      { from: 0, to: 20, color: STATUS.alarm },
      { from: 20, to: 90, color: STATUS.ok },
      { from: 90, to: 100, color: STATUS.warning },
    ],
  });
  const ring = new ProgressRing({ value: 0.7, size: 64, label: '7/10' });

  const iv = new Chart({
    height: 210,
    x: { min: 0, max: 45, label: 'U, V' },
    y: { min: 0, max: 15, label: 'I, A' },
    y2: { min: 0, max: 500, label: 'P, W' },
    series: [
      { id: 'iv', label: 'I(U)', color: 'sky' },
      { id: 'pv', label: 'P(U)', color: 'yellow', axis: 'y2', kind: 'area' },
    ],
  });
  // single-diode-like curve of the 440 W lab module (V_oc 39,4 V, I_sc 13,9 A)
  const us: number[] = [];
  const is: number[] = [];
  const ps: number[] = [];
  for (let i = 0; i <= 120; i++) {
    const u = (39.4 * i) / 120;
    const cur = Math.max(13.9 * (1 - Math.exp((u - 39.4) / 2.6)), 0);
    us.push(u);
    is.push(cur);
    ps.push(u * cur);
  }
  iv.setData('iv', us, is);
  iv.setData('pv', us, ps);

  const live = new Chart({
    height: 170,
    window: 0.06,
    x: { min: 0, max: 0.06, label: 't, s', tickCount: 3 },
    y: { min: -340, max: 340, label: 'u, V', ticks: [-325, 0, 325] },
    series: [
      { id: 'l1', label: 'L1', color: 'yellow' },
      { id: 'l2', label: 'L2', color: 'green' },
      { id: 'l3', label: 'L3', color: 'red' },
    ],
  });

  const day = new Chart({
    height: 190,
    x: { min: 0, max: 24, label: 'год', ticks: [0, 6, 12, 18, 24] },
    y: { min: -4, max: 6, label: 'P, kW' },
    series: [
      { id: 'pv', label: 'PV', color: 'amber', stack: 'a' },
      { id: 'grid', label: 'Мережа', color: 'white', stack: 'a' },
      { id: 'bat', label: 'Батарея ±', color: 'lime', stack: 'a' },
    ],
  });
  const hours = Array.from({ length: 49 }, (_, i) => i / 2);
  day.setData(
    'pv',
    hours,
    hours.map((h) => Math.max(0, 5 * Math.sin(((h - 6) / 12) * Math.PI))),
  );
  day.setData(
    'grid',
    hours,
    hours.map((h) => (h < 6 || h > 19 ? 1.2 : 0.1)),
  );
  day.setData(
    'bat',
    hours,
    hours.map((h) => (h > 9 && h < 15 ? -2.5 : h > 18 && h < 23 ? 1.6 : 0)),
  );

  const node = new UiNode({
    dir: 'row',
    gap: 18,
    align: 'start',
    children: [
      new Panel({
        width: 470,
        gap: 14,
        children: [
          new Label('Прилади', { font: 'display', size: 30 }),
          row({ gap: 26, align: 'end' }, power, eff, ring),
          row({ gap: 20, align: 'center', width: 'fill' }, freq, col({ width: 'fill', gap: 10 }, soc)),
          live,
        ],
      }),
      new Panel({
        width: 520,
        gap: 14,
        children: [new Label('Графіки', { font: 'display', size: 30 }), iv, day],
      }),
    ],
  });

  let last = -1;
  return {
    node,
    update(t) {
      // operating point slides along the I-V curve; the live plot is a 50 Hz three-phase system slowed ×50
      const k = Math.floor((0.5 + 0.5 * Math.sin(t * 0.6)) * 120);
      iv.setMarker('op', { x: us[k]!, y: is[k]!, color: 'sky', label: `${Math.round(ps[k]!)} W` });
      if (t - last > 1 / 120) {
        last = t;
        const ts = t / 50;
        for (const [id, shift] of [
          ['l1', 0],
          ['l2', -2.094],
          ['l3', 2.094],
        ] as const)
          live.push(id, ts, 325 * Math.sin(2 * Math.PI * 50 * ts + shift));
      }
      freq.setNow(50 + 0.12 * Math.sin(t * 0.9));
      power.setNow(ps[k]!);
    },
  };
}
