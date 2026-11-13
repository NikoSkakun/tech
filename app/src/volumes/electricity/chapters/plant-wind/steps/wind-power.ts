/**
 * Step 2 `wind-power` — «Енергія вітру: закон куба». In front of the hero rotor stands the cylinder of air
 * that passes through it, cut into one-second slices (parts/air-column.ts); the calculator is M1 of the
 * simulation: ρ(T), A = π·D²/4, P = ½·ρ·A·v³. Sliders v, D, T; the D slider resizes the hero rotor.
 */
import { fmtNumber } from '@/content';
import { ROTOR_SILHOUETTES, airDensity, sweptArea, windPowerW } from '@electricity/sim/plant-wind';
import { hotspotNames } from '../content';
import { HERO } from '../layout';
import { Vector3 } from 'three';
import { buildAirColumn, buildConsole } from '../parts';
import type { StepFactory } from './types';

const D0 = 170; // m, the hero's nominal rotor
const VS = Array.from({ length: 51 }, (_, i) => i * 0.5);

export const windPower: StepFactory = ({ ctx, ui, L, live, hero }) => {
  const column = buildAirColumn(ctx, 64);
  // upstream of the rotor plane, on the rotor axis (the wind blows toward +X)
  column.group.position.copy(hero.hub).setX(hero.hub.x - 1.5);
  ctx.root.add(column.group);
  const aColumn = ctx.stage.actor(column.group, { appear: 'fade' });
  const v = (): number => ui.value<number>('wp.v');
  const d = (): number => ui.value<number>('wp.d');
  const rho = (): number => airDensity(ui.value<number>('wp.t'));
  const power = (): number => windPowerW(v(), d(), rho());
  const era = (dM: number): string =>
    ROTOR_SILHOUETTES.reduce((best, s) => (Math.abs(s.diameterM - dM) < Math.abs(best.diameterM - dM) ? s : best)).label;
  let drawn = '';
  let boost = { until: -1, label: '' };
  // «голографічний калькулятор»: the cubic curve with the working point, standing beside the air column
  const calc = buildConsole(ctx, {
    title: 'P = ½·ρ·A·v³',
    width: 430,
    unit: 0.12,
    chart: { height: 210, x: { min: 0, max: 25, label: 'v, m/s' }, y: { min: 0, max: 220, label: 'P, MW' }, series: [{ id: 'p', label: 'P(v)', color: 'sky', kind: 'area' }] },
    readouts: [
      { label: L.pWind, unit: 'MW', digits: 2, get: () => power() / 1e6 },
      { label: L.area, unit: 'm²', digits: 0, get: () => sweptArea(d()) },
    ],
  });
  calc.surface.position.copy(hero.hub).add(new Vector3(44, 10, 0));
  ctx.root.add(calc.surface);
  const aCalc = ctx.stage.actor(calc.surface, { appear: 'pop' });
  const redraw = (t: number): void => {
    const key = `${d()}|${ui.value<number>('wp.t')}`;
    if (key !== drawn) {
      drawn = key;
      calc.chart.setAxis('y', { max: windPowerW(25, d(), rho()) / 1e6 });
      calc.chart.setData('p', VS, VS.map((x) => windPowerW(x, d(), rho()) / 1e6));
    }
    calc.chart.setMarker('now', { x: v(), y: power() / 1e6, color: 'yellow', label: t < boost.until ? boost.label : undefined });
    calc.update();
  };
  const [hsAnemometer] = hotspotNames('wind-power');
  return {
    id: 'wind-power',
    stage: {
      camera: 'wind-power',
      show: [aColumn, aCalc],
      params: { windX: hero.hub.x - 10, windY: hero.hub.y - 46, windZ: hero.hub.z, windLength: 300, windHeight: 92, windWidth: 190 },
    },
    ui: {
      honesty: ['notToScale'],
      controls: [
        { type: 'slider', id: 'wp.v', label: L.v, min: 0, max: 25, step: 0.5, unit: 'm/s', digits: 1, value: 8 },
        { type: 'slider', id: 'wp.d', label: L.d, min: 20, max: 310, step: 5, unit: 'm', value: D0, snaps: ROTOR_SILHOUETTES.map((s) => s.diameterM), format: (x) => `${fmtNumber(x)} m · ${era(x)}` },
        { type: 'slider', id: 'wp.t', label: L.t, min: -30, max: 40, step: 1, unit: '°C', value: 15, format: (x) => `${fmtNumber(x)} °C · ρ = ${fmtNumber(airDensity(x), { digits: 3 })} kg/m³` },
        {
          type: 'button',
          id: 'wp.double',
          label: L.double,
          icon: 'lightning',
          primary: true,
          onClick: () => {
            const from = v() > 12.5 ? 6 : Math.max(1, v());
            const to = from * 2;
            boost = { until: ctx.clock.time + 5.5, label: `×${fmtNumber((to / from) ** 3)}` };
            ctx.tweens.value(from, to, { duration: 1.4, ease: 'power2.inOut' }, (x) => ui.set('wp.v', Math.round(x * 2) / 2));
          },
        },
      ],
      callouts: [{ anchor: () => column.group.localToWorld(column.group.position.clone().set(-column.length * 0.5, column.radius, 0)), text: L.airSecond, side: 'up' }],
      hotspots: [{ anchor: hero.room.at('sensors'), title: hsAnemometer! }],
    },
    update(dt, t) {
      redraw(t);
      calc.surface.quaternion.copy(ctx.camera.camera.quaternion);
      live.windTarget = v();
      // the hero's rotor takes the diameter of the slider; a bigger rotor turns slower (same tip-speed ratio)
      live.rotorScaleTarget = d() / D0;
      const toy = 1 / HERO.realPerToy;
      column.radius = hero.radius * live.rotorScale;
      column.slice = live.wind * toy; // metres of air per second, at the hero's scale
      column.update(dt);
    },
  };
};
