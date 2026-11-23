/**
 * «Чому лід тане, а вода кипить?» — two roads of heat on the sample of molecules (`@water/sim/process`).
 *
 * The slider is the heat the pad has given. Forward, the picture is the live simulation and cannot run ahead of the
 * molecules (the slider's fill shows where it is); backward, it replays the states it passed. The thermometer and
 * its trace on the chart are the lumped model of a real gram of water (`sim/scale.ts`): a real glass stands at
 * exactly 0 °C and 100 °C while it melts and boils, which a sample of 252 molecules can only show smeared.
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { LOOK_SCALE } from '@/style';
import type { ChartApi } from '@/ui3d';
import LIQUID from '@water/sim/fixtures/liquid.json';
import type { Placed } from '@water/sim/lattice';
import type { Process } from '@water/sim/process';
import { heated, heatTo } from '@water/sim/scale';
import { BOIL_HEAT, boilProcess, boilState, MELT_HEAT, meltProcess } from '@water/sim/setups';
import { createSample, SAMPLE_SHOT } from '@water/shared/sample';
import { caption } from './content';

const STEP_IDS = ['melt', 'plateau', 'boil', 'shelf', 'back'] as const;
type StepId = (typeof STEP_IDS)[number];
type Road = 'melt' | 'boil';
/** Simulated time units per second of screen time: at rest, and while the road is being walked forward. */
const RATE = 5;
const RATE_FORWARD = 13;
/** Goals: how far along the road. */
const GOAL: Record<StepId, number> = { melt: 0.9, plateau: 0.97, boil: 0.45, shelf: 0.97, back: 0.05 };
/** Slider marks: where the middle of the standing thermometer lies on each road. */
const MELT_MID = (heatTo(0, 0.5) - heatTo(-20)) / MELT_HEAT;
const BOIL_MID = (heatTo(100, 0.45) - heatTo(20)) / BOIL_HEAT;

interface Scrub {
  target: number;
  shown: number;
  drag: boolean;
  told: number;
}

/** Goals reached in this session (module state survives a rebuild of the scene). */
const REACHED = new Set<StepId>();

export default defineScene((ctx) => {
  const { root, stage, camera } = ctx;
  const sample = createSample();
  root.add(sample.group);
  ctx.env.setScale(13, { adaptFrom: LOOK_SCALE.micro });
  ctx.post.base({ dofAperture: 0.5, bloomIntensity: 0.9 });
  camera.shots({ sample: SAMPLE_SHOT });
  stage.define(Object.fromEntries(STEP_IDS.map((id) => [id, { camera: 'sample' }])));

  // the roads are made when first needed and kept: `back` replays what `melt` and `plateau` walked
  const roads: { melt: Process | null; boil: Process | null } = { melt: null, boil: null };
  const road = (which: Road): Process =>
    (roads[which] ??= which === 'melt' ? meltProcess() : boilProcess(LIQUID as unknown as Placed[]));
  const roadOf = (id: StepId): Road => (id === 'boil' || id === 'shelf' ? 'boil' : 'melt');
  const scrubs: Record<StepId, Scrub> = Object.fromEntries(
    STEP_IDS.map((id) => [id, { target: 0, shown: 0, drag: false, told: NaN }]),
  ) as Record<StepId, Scrub>;
  /** `back`: the road there is still playing by itself. */
  let replaying = false;
  let chartTold = NaN;
  const top = new Vector3();

  /** The thermometer of the real glass at the place `s` of a road. */
  const celsius = (which: Road, s: number): number =>
    which === 'melt' ? heated(s * MELT_HEAT).celsius : boilState(s).celsius;

  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const slider = (id: StepId) => {
    const boil = roadOf(id) === 'boil';
    return {
      type: 'slider' as const,
      id: `heat-${id}`,
      label: caption(id, 0),
      min: 0,
      max: 1,
      value: 0,
      format: () => '',
      marks: [
        { value: 0, label: caption(id, 1) },
        { value: boil ? BOIL_MID : MELT_MID, label: caption(id, 2) },
        { value: 1, label: caption(id, 3) },
      ],
      disabled: () => id === 'back' && replaying,
      onChange: (v: number) => (scrubs[id].target = v),
      onInput: (_v: number, how: 'drag' | 'jump' | 'step') => (scrubs[id].drag = how === 'drag'),
    };
  };
  /** The trace of the thermometer along the road, up to where the picture is. */
  const trace = (id: StepId, chart: ChartApi): void => {
    const which = roadOf(id);
    const s = roads[which]?.shown ?? 0;
    if (Math.abs(s - chartTold) < 0.002) return;
    chartTold = s;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k <= 200; k++) {
      const u = Math.min(s, k / 200);
      xs.push(u * 100);
      ys.push(celsius(which, u));
      if (u >= s) break;
    }
    chart.setData('trace', xs, ys);
    chart.setMarker('now', { x: s * 100, y: celsius(which, s), color: 'coral', guides: false });
  };
  const chart = (id: StepId) => {
    const boil = roadOf(id) === 'boil';
    return {
      type: 'chart' as const,
      id: `trace-${id}`,
      chart: {
        height: 190,
        x: { min: 0, max: 100, label: caption(id, 6) },
        y: { min: boil ? 0 : -20, max: boil ? 120 : 20, label: caption(id, 7) },
        series: [{ id: 'trace', label: caption(id, 5), color: 'coral' as const, width: 3 }],
      },
      init: (c: ChartApi) => {
        chartTold = NaN;
        trace(id, c);
      },
      update: (c: ChartApi) => trace(id, c),
    };
  };
  const reads = (id: StepId) => ({
    anchor: () => sample.thermometer.top.getWorldPosition(top),
    text: () => fmtUnit(sample.thermometer.celsius, '°C', { digits: 0 }),
    side: 'right' as const,
    visible: () => stage.current === id,
  });
  ui.define({
    melt: { controls: [slider('melt')], callouts: [reads('melt')], goal: () => REACHED.has('melt') },
    plateau: { controls: [slider('plateau'), chart('plateau')], callouts: [reads('plateau')], goal: () => REACHED.has('plateau') },
    boil: { controls: [slider('boil')], callouts: [reads('boil')], goal: () => REACHED.has('boil') },
    shelf: { controls: [slider('shelf'), chart('shelf')], callouts: [reads('shelf')], goal: () => REACHED.has('shelf') },
    back: {
      controls: [
        slider('back'),
        { type: 'note', id: 'replaying', text: caption('back', 5), visible: () => replaying },
      ],
      callouts: [reads('back')],
      goal: () => REACHED.has('back'),
    },
  });

  ctx.qa.expose('phase', () => {
    const id = stage.current as StepId;
    const p = roads[roadOf(id)];
    return {
      step: id,
      shown: p ? Math.round(p.shown * 1000) / 1000 : 0,
      celsius: Math.round(sample.thermometer.celsius),
      living: p ? p.md.living : 0,
      bridges: sample.molecules.bridgeCount,
      replaying,
      reached: [...REACHED],
    };
  });

  return {
    enterStep(id) {
      const step = id as StepId;
      const which = roadOf(step);
      const p = road(which);
      const s = scrubs[step];
      s.drag = false;
      s.told = NaN;
      chartTold = NaN;
      replaying = false;
      if (step === 'back') {
        // the way back starts from the water: if the road there was not walked to its end, it plays by itself first
        replaying = p.shown < 0.999;
        s.target = s.shown = replaying ? p.shown : 1;
      } else {
        // every other step starts its road from the beginning
        p.update(0, 0);
        s.target = s.shown = 0;
      }
      ui.set(`heat-${step}`, s.target);
      sample.thermometer.range(which === 'melt' ? -25 : 0, which === 'melt' ? 25 : 120);
    },
    update(dt) {
      const id = stage.current as StepId;
      const which = roadOf(id);
      const p = road(which);
      const s = scrubs[id];
      if (replaying) {
        s.target = s.shown = 1;
        if (p.shown >= 0.999) {
          replaying = false;
          ui.set('heat-back', 1);
        }
      } else s.shown = s.drag ? s.target : s.shown + (s.target - s.shown) * (1 - Math.exp(-dt / 0.25));
      const before = p.shown;
      const forward = s.shown > p.shown + 0.002;
      // no more than 40 solver steps a frame, whatever the frame took
      p.update(s.shown, Math.min((forward ? RATE_FORWARD : RATE) * dt, 40 * p.md.dt));
      if (!(Math.abs(p.shown - s.told) < 0.001)) ui.patch(`heat-${id}`, { current: (s.told = p.shown) });
      sample.thermometer.set(celsius(which, p.shown));
      if (id === 'back') {
        if (!replaying && p.shown <= GOAL.back) REACHED.add('back');
      } else if (p.shown >= GOAL[id]) REACHED.add(id);
      sample.heat = p.shown > before + 1e-5 ? 1 : p.shown < before - 1e-5 ? -1 : 0;
      sample.molecules.sync(p, dt);
      sample.update(dt);
    },
  };
});
