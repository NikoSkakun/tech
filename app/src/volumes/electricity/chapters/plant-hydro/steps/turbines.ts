/**
 * Step 5 `turbines` — «Турбіни Каплана, Френсіса, Пелтона». The stand of three runners (`turbine-stand.ts`)
 * and on the board the H–Q map (`HeatMap`, log–log, zones of M4) with the draggable point «ваша ГЕС» (its start
 * = H and Q of step 2) plus the efficiency curves of M2 with markers at the current load. The recommended
 * runner gets a yellow ring and «вибрано». «Навантаження» 10…110 %: Kaplan blades turn, Pelton nozzles switch
 * off (6 → 1), Francis below 40 % shows the amber vortex rope. The jet speed v = √(2·g·H) for the Pelton.
 * The dock repeats the map point as two sliders (H, Q) — nothing depends on dragging.
 */
import { Vector3 } from 'three';
import { HeatMap } from '@/ui3d';
import {
  chooseTurbine,
  jetVelocityMs,
  peltonNozzles,
  turbineEfficiency,
  TURBINE_ZONES,
  type Turbine,
} from '@electricity/sim/plant-hydro';
import { HOTSPOTS } from '../hotspots';
import { buildTurbineStand } from '../parts/turbine-stand';
import { hot } from './hot';
import type { StepFactory } from './types';

const KINDS: readonly Turbine[] = ['kaplan', 'francis', 'pelton'];
const XS = Array.from({ length: 51 }, (_, i) => 10 + i * 2);
const inZone = (t: Turbine, h: number, q: number): boolean => {
  const z = TURBINE_ZONES[t];
  return h >= z.headM[0] && h <= z.headM[1] && q >= z.flowM3s[0] && q <= z.flowM3s[1];
};
/** Zone code for the map colours: 1 Kaplan, 2 Francis, 3 Pelton, overlaps in between, 0 none. */
function zone(h: number, q: number): number {
  const codes = KINDS.map((t, i) => (inZone(t, h, q) ? i + 1 : 0)).filter((c) => c > 0);
  return codes.length ? codes.reduce((a, c) => a + c, 0) / codes.length : 0;
}

export const turbines: StepFactory = ({ ctx, ui, L, stand }) => {
  const rig = buildTurbineStand(ctx);
  stand.top.add(rig.group);
  const aRig = ctx.stage.actor(rig.group, { appear: 'grow' });
  const H = (): number => ui.value<number>('tb.h');
  const Q = (): number => ui.value<number>('tb.q');
  const load = (): number => ui.value<number>('tb.load') / 100;
  const pick = () => chooseTurbine(H(), Q());
  const name = (t: Turbine): string => (t === 'kaplan' ? L.kaplan : t === 'francis' ? L.francis : L.pelton);
  const map = new HeatMap({
    height: 170,
    x: { min: 0.1, max: 1000, log: true, label: 'Q, m³/s' },
    y: { min: 2, max: 2000, log: true, label: 'H, m' },
    nx: 64,
    ny: 48,
    value: (q, h) => zone(h, q),
    min: 0,
    max: 3,
    ramp: ['bg.deep', 'teal', 'blue', 'sky'],
    marker: { x: 966, y: 80.6 },
    onPick: (q, h) => {
      ui.set('tb.q', q, { notify: true });
      ui.set('tb.h', h, { notify: true });
    },
  });
  const v = new Vector3();
  ctx.qa.expose('turbines', () => ({
    chosen: pick().turbines,
    nozzles: rig.jets.filter((j) => j.visible).length,
    rope: rig.rope.visible,
  }));
  const callout = (t: Turbine) => ({
    anchor: () => rig.at(t, v.clone()),
    text: () => (pick().turbines.includes(t) ? `${name(t)} · ${L.chosen}` : name(t)),
    priority: KINDS.indexOf(t),
    // the middle label goes below its runner, so three labels never stack on a narrow screen
    side: t === 'francis' ? ('down' as const) : ('up' as const),
  });
  return {
    id: 'turbines',
    stage: {
      camera: 'turbines',
      show: [stand.group, aRig],
      // the point starts where step 2 left H and Q
      enter: () => {
        ui.set('tb.h', ui.value<number>('we.h'));
        ui.set('tb.q', ui.value<number>('we.q'));
        map.setMarker(Q(), H());
      },
    },
    ui: {
      honesty: [{ kind: 'simplified', text: L.illustrativeCurves }, 'notToScale', { slowed: 10 }],
      controls: [
        { type: 'slider', id: 'tb.load', label: L.load, min: 10, max: 110, step: 1, unit: '%', value: 85 },
        {
          type: 'slider',
          id: 'tb.h',
          label: L.head,
          min: 2,
          max: 1900,
          scale: 'log',
          step: 3,
          unit: 'm',
          value: 80.6,
          onChange: () => map.setMarker(Q(), H()),
        },
        {
          type: 'slider',
          id: 'tb.q',
          label: L.flow,
          min: 0.1,
          max: 1000,
          scale: 'log',
          step: 3,
          unit: 'm³/s',
          value: 966,
          onChange: () => map.setMarker(Q(), H()),
        },
        {
          type: 'note',
          id: 'tb.vortex',
          text: L.vortex,
          icon: 'warning',
          color: 'amber',
          visible: () => load() < 0.4,
        },
      ],
      board: {
        title: L.mapTitle,
        size: 'sm',
        children: [
          { type: 'custom', id: 'tb.map', node: map },
          {
            type: 'readout',
            id: 'tb.rec',
            label: L.yourPlant,
            text: () => pick().turbines.map(name).join(' / ') + (pick().bulb ? ` (${L.orBulb})` : ''),
          },
          {
            type: 'chart',
            id: 'tb.eff',
            chart: {
              height: 130,
              x: { min: 10, max: 110, label: `${L.load}, %` },
              y: { min: 0.4, max: 1, label: 'η' },
              series: [
                { id: 'kaplan', label: L.kaplan, color: 'teal' },
                { id: 'francis', label: L.francis, color: 'blue' },
                { id: 'pelton', label: L.pelton, color: 'sky' },
              ],
            },
            init: (c) =>
              KINDS.forEach((t) =>
                c.setData(
                  t,
                  XS,
                  XS.map((x) => turbineEfficiency(t, x / 100)),
                ),
              ),
            update: (c) =>
              KINDS.forEach((t) =>
                c.setMarker(t, {
                  x: load() * 100,
                  y: turbineEfficiency(t, load()),
                  color: t === 'kaplan' ? 'teal' : t === 'francis' ? 'blue' : 'sky',
                }),
              ),
          },
          {
            type: 'readout',
            id: 'tb.jet',
            label: L.jet,
            unit: 'm/s',
            digits: 0,
            get: () => jetVelocityMs(H()),
          },
        ],
      },
      callouts: [callout('kaplan'), callout('francis'), callout('pelton')],
      hotspots: [
        hot(() => rig.at('deflector', v.clone()), HOTSPOTS.turbines.deflector),
        hot(() => rig.at('servo', v.clone()), HOTSPOTS.turbines.servo),
      ],
    },
    update(dt, t) {
      const x = load();
      const chosen = pick().turbines;
      for (const k of KINDS) rig.rings[k].visible = chosen.includes(k);
      // runners: slowed down (on screen ≈ 1/10 of the real speed); Kaplan blades follow the load
      rig.kaplan.group.rotation.y += dt * 2.4 * Math.min(1, x + 0.2);
      rig.kaplan.setPitch(0.12 + 0.48 * Math.min(1, x));
      rig.francis.group.rotation.y += dt * 2 * Math.min(1, x + 0.2);
      rig.pelton.rotation.y -= dt * 2.8;
      const n = peltonNozzles(x);
      rig.jets.forEach((j, i) => (j.visible = i < n));
      rig.spray.rate = n / 6;
      rig.rope.visible = x < 0.4;
      rig.rope.rotation.y = t * 4;
      for (const f of rig.flows) f.speed = 7 * Math.min(1.1, x);
    },
  };
};
