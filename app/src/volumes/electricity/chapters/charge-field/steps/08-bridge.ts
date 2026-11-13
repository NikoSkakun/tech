/**
 * Step 8 `bridge-to-matter` — «Як змусити заряди текти безперервно?». A 10 F supercapacitor discharges through
 * a lamp when the switch is closed (sim §7 `createDischarge`: U = U₀·e^(−t/RC), τ = 20 s, shown ×4 faster); the
 * board plots U(t) live, the counters show that as many electrons arrive as have left. «Зазирнути в дріт» opens
 * the copper-versus-glass preview of the next chapter, and the bridge button leads there when it exists.
 */
import { Group } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtSci } from '@/content';
import { chargeTransfer, createDischarge, SUPERCAP } from '@electricity/sim/charge-field';
import type { Chart } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { crossTarget, docItems, docLabel } from '../content';
import { DOC, L } from '../labels';
import { createBench } from '../parts/bench';
import { createInsideWire } from '../parts/inside-wire';
import { sound } from '../sound';

const E = chargeTransfer(1).leftChargeC; // the elementary charge, C
const T_MAX = 100; // model seconds on the chart (≈ 5 τ)

export const bridgeStep: StepFactory = ({ ctx, ui, world }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'bridge-to-matter';
  const set = new Group();
  set.name = 'step-bridge';
  const bench = createBench(ctx);
  const inside = createInsideWire(ctx);
  set.add(bench.group);
  ctx.root.add(set, inside.group);
  const insideActor = stage.actor(inside.group);
  const sim = createDischarge();
  const [closeLabel, openLabel] = docItems('bridge-to-matter', 0, '/');
  const target = crossTarget('matter');
  const hasNext = (): boolean => target !== undefined && ctx.nav.locate(target) !== null;

  const xs: number[] = [];
  const ys: number[] = [];
  let drawn = -1;
  let looking = false;
  /** Electrons that have left the «−» plate (= arrived at the «+» plate): ΔQ = C·(U₀ − U). */
  const moved = (): number => (SUPERCAP.capacitanceF * (SUPERCAP.initialV - sim.state.voltageV)) / E;
  const setClosed = (closed: boolean): void => {
    sim.setClosed(closed);
    audio.play('breaker', { gain: 0.6, pitch: closed ? 1.1 : 0.9 });
  };
  ui.onChange('key', (v) => on() && setClosed(v === true));
  const recharge = (): void => {
    sim.recharge();
    xs.length = ys.length = 0;
    drawn = -1;
    audio.play('success', { gain: 0.5 });
  };
  const look = (next: boolean, instant = false): void => {
    looking = next;
    stage.toggle(insideActor, next, { instant });
    void ctx.camera.go(next ? 'inside' : 'bridge', { instant, duration: 2 });
  };
  ctx.input.register(bench.lever, {
    tooltip: () => (sim.state.closed ? openLabel! : closeLabel!),
    enabled: () => on() && !looking,
    hover: (over) => stage.scope.to(bench, { hover: over ? 1 : 0 }, { duration: 0.12 }),
    click: () => ui.set('key', !sim.state.closed, { notify: true }),
  });
  ctx.qa.probe('lever', bench.lever);
  ctx.qa.expose('bridge', () => ({ ...sim.state, moved: moved(), looking, points: xs.length }));

  const drawChart = (chart: Chart): void => {
    if (xs.length === drawn) return;
    drawn = xs.length;
    chart.setData('u', xs, ys);
    chart.setMarker('now', { x: Math.min(sim.state.modelTimeS, T_MAX), y: sim.state.voltageV });
  };

  return {
    id: 'bridge-to-matter',
    stage: {
      show: [world.top.object, set],
      camera: 'bridge',
      enter(info) {
        sim.setClosed(false);
        recharge();
        ui.set('key', false);
        look(false, info.instant);
      },
    },
    ui: {
      honesty: [{ sped: SUPERCAP.sceneSpeedup }, 'simplified'],
      controls: [
        { type: 'toggle', id: 'key', label: docLabel('bridge-to-matter', 0), value: false },
        {
          type: 'stats',
          id: 'bridgeStats',
          items: [
            {
              label: L.bridge.u,
              get: () => `${fmtNumber(sim.state.voltageV, { digits: 2 })} V`,
              color: () => 'pink',
            },
            {
              label: L.bridge.i,
              get: () => `${fmtNumber(sim.state.currentA, { digits: 2 })} A`,
              color: () => 'yellow',
            },
            {
              label: L.bridge.left,
              get: () => (moved() > 1 ? fmtSci(moved(), 1) : '0'),
              color: () => 'cyan',
            },
            {
              label: L.bridge.arrived,
              get: () => (moved() > 1 ? fmtSci(moved(), 1) : '0'),
              color: () => 'cyan',
            },
          ],
        },
        {
          type: 'button',
          id: 'recharge',
          label: docLabel('bridge-to-matter', 1),
          icon: 'resetView',
          onClick: recharge,
        },
        // the document: the button appears once the lamp has gone out
        {
          type: 'button',
          id: 'look',
          label: docLabel('bridge-to-matter', 2),
          icon: 'search',
          primary: true,
          visible: () => !looking && sim.state.modelTimeS > 0 && !sim.state.lampOn,
          onClick: () => look(true),
        },
        {
          type: 'button',
          id: 'lookBack',
          label: L.bridge.back,
          icon: 'arrowLeft',
          visible: () => looking,
          onClick: () => look(false),
        },
        {
          type: 'button',
          id: 'nextMatter',
          label: DOC.nextMatter,
          visible: hasNext,
          onClick: () => target && void ctx.nav.open(target),
        },
      ],
      board: {
        title: L.bridge.chart,
        size: 'sm',
        visible: () => !looking,
        children: [
          {
            type: 'chart',
            id: 'dischargeChart',
            chart: {
              height: 180,
              x: { min: 0, max: T_MAX, label: 't, s' },
              y: { min: 0, max: 3, label: 'U, V' },
              series: [{ id: 'u', color: 'pink', kind: 'area' }],
              legend: false,
            },
            update: drawChart,
          },
        ],
      },
      callouts: [
        {
          anchor: () => inside.copper,
          text: L.bridge.copper,
          side: 'up',
          color: 'orange',
          visible: () => looking,
        },
        {
          anchor: () => inside.glass,
          text: L.bridge.glass,
          side: 'up',
          color: 'sky',
          visible: () => looking,
        },
        {
          anchor: [bench.lamp.x, bench.lamp.y + 0.8, bench.lamp.z],
          text: L.bridge.lamp,
          side: 'up',
          visible: () => !looking,
        },
      ],
      hotspots: [
        { anchor: () => bench.stand, content: 'glass-stand', visible: () => !looking },
        { anchor: () => bench.wire, content: 'copper-wire', visible: () => !looking },
      ],
    },
    update(dt, t) {
      const s = sim.step(dt);
      // one chart point per 0,5 model seconds while the switch is closed
      if (s.modelTimeS <= T_MAX && (xs.length === 0 || s.modelTimeS - xs[xs.length - 1]! >= 0.5)) {
        xs.push(s.modelTimeS);
        ys.push(s.voltageV);
      }
      bench.closed = s.closed;
      bench.brightness = s.brightness;
      bench.current = s.currentA / (SUPERCAP.initialV / SUPERCAP.resistanceOhm);
      bench.update(dt, t);
      inside.drift = bench.current;
      if (looking) inside.update(dt, t);
      sound.hum = 0.35 * s.brightness;
    },
  };
};
