/**
 * «Що таке тепло?» — one sample of molecules, simulated live (`@water/sim`), five ways of looking at it.
 *
 * The slider of a step is the pad's temperature: the bath of the simulation follows it, the molecules answer within
 * a second, and the thermometer reads their own motion (smoothed over ≈ 1.2 s — a sample of 252 molecules never
 * sits perfectly still on one reading). Nothing is scripted: the trembling, the colours of slow and fast
 * molecules and the levelling of the two halves in `flow` are what the solver computes.
 */
import { Mesh, TorusGeometry, Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { K, LOOK_SCALE } from '@/style';
import LIQUID from '@water/sim/fixtures/liquid.json';
import type { Placed } from '@water/sim/lattice';
import type { WaterMd } from '@water/sim/md';
import { fromCelsius, toCelsius } from '@water/sim/scale';
import { BOX_W, iceSample, liquidSample } from '@water/sim/setups';
import { createSample, SAMPLE_SHOT } from '@water/shared/sample';
import { caption } from './content';

type StepId = 'jiggle' | 'temperature' | 'spread' | 'flow' | 'zero';
/** Simulated time units per second of screen time, and the most steps one frame may take. */
const RATE = 5;
const MAX_STEPS = 40;
/** `flow`: once the partition is lifted the levelling is shown faster (it takes ≈ 150 time units). */
const RATE_LEVELLING = 13;
/** `flow`: the two halves before the partition is lifted, °C; the levelled halves differ by less than this. */
const HOT = 88;
const COLD = 4;
const LEVEL = 15;
/** `spread`: the water's temperature, °C. */
const WARM = 45;

/** A slider the scene follows: `target` from the hand, `shown` on screen (UI_API §3.3). */
interface Scrub {
  target: number;
  shown: number;
  drag: boolean;
  told: number;
}
const scrub = (v: number): Scrub => ({ target: v, shown: v, drag: false, told: NaN });

/** Goals reached in this session (module state survives a rebuild of the scene). */
const REACHED = new Set<StepId>();

export default defineScene((ctx) => {
  const { root, stage, camera } = ctx;
  const sample = createSample();
  root.add(sample.group);
  ctx.env.setScale(13, { adaptFrom: LOOK_SCALE.micro });
  ctx.post.base({ dofAperture: 0.5, bloomIntensity: 0.9 });
  camera.shots({ sample: SAMPLE_SHOT });

  const ice = iceSample(-20);
  const water = liquidSample(LIQUID as unknown as Placed[], 20);
  let flow = liquidSample(LIQUID as unknown as Placed[], 45, 21);
  const pads: Record<'jiggle' | 'temperature' | 'zero', Scrub> = {
    jiggle: scrub(-20),
    temperature: scrub(20),
    zero: scrub(-20),
  };
  const seen = { jiggle: [false, false], temperature: [false, false] };
  let lifted = false;
  let tintOn = false;
  let swaps = 0;
  let lastFastest = -1;
  /** The thermometer's reading: the sample's own temperature, smoothed. */
  let reading = fromCelsius(-20);
  let left = 0;
  let right = 0;

  const ring = new Mesh(new TorusGeometry(0.62, 0.06, 10, 40), K.glow({ color: 'white', intensity: 1.6, falloff: 1 }));
  ring.visible = false;
  sample.frame.add(ring);
  const ringAt = new Vector3();
  const top = new Vector3();

  const startFlow = (): void => {
    flow = liquidSample(LIQUID as unknown as Placed[], 45, 21);
    flow.placePartition(BOX_W / 2);
    flow.heating = { mode: 'halves', at: BOX_W / 2, left: fromCelsius(HOT), right: fromCelsius(COLD), tau: 0.8 };
    // a moment unseen, so that the halves are hot and cold when the step opens
    flow.step(500);
    lifted = false;
  };

  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const pad = (step: 'jiggle' | 'temperature' | 'zero', min: number, max: number, marks: [number, number][]) => ({
    type: 'slider' as const,
    id: `pad-${step}`,
    label: caption(step, 0),
    min,
    max,
    value: pads[step].target,
    unit: '°C',
    digits: 0,
    marks: marks.map(([value, i]) => ({ value, label: caption(step, i) })),
    onChange: (v: number) => (pads[step].target = v),
    onInput: (_v: number, how: 'drag' | 'jump' | 'step') => (pads[step].drag = how === 'drag'),
  });
  const reads = (step: StepId) => ({
    anchor: () => sample.thermometer.top.getWorldPosition(top),
    text: () => fmtUnit(sample.thermometer.celsius, '°C', { digits: 0 }),
    side: 'right' as const,
    visible: () => stage.current === step,
  });

  stage.define({
    jiggle: { camera: 'sample' },
    temperature: { camera: 'sample' },
    spread: { camera: 'sample' },
    flow: { camera: 'sample' },
    zero: { camera: 'sample' },
  });
  ui.define({
    jiggle: {
      controls: [pad('jiggle', -200, -1, [[-200, 1], [-1, 2]])],
      callouts: [reads('jiggle')],
      reset: true,
      goal: () => REACHED.has('jiggle'),
    },
    temperature: {
      controls: [pad('temperature', 1, 99, [[1, 1], [45, 2], [99, 3]])],
      callouts: [reads('temperature')],
      reset: true,
      goal: () => REACHED.has('temperature'),
    },
    spread: {
      controls: [
        { type: 'toggle', id: 'tint', label: caption('spread', 0), value: false, onChange: (v: boolean) => (tintOn = v) },
      ],
      callouts: [
        {
          anchor: () => ring.getWorldPosition(ringAt),
          text: caption('spread', 1),
          side: 'up',
          visible: () => stage.current === 'spread' && ring.visible,
        },
      ],
      reset: true,
      goal: () => REACHED.has('spread'),
    },
    flow: {
      controls: [
        { type: 'readout', id: 'left', label: caption('flow', 2), unit: '°C', digits: 0, get: () => left },
        { type: 'readout', id: 'right', label: caption('flow', 3), unit: '°C', digits: 0, get: () => right },
        { type: 'button', id: 'lift', label: caption('flow', 0), primary: true, visible: () => !lifted, onClick: () => (lifted = true) },
        { type: 'button', id: 'again', label: caption('flow', 1), visible: () => lifted, onClick: startFlow },
      ],
      goal: () => REACHED.has('flow'),
    },
    zero: {
      controls: [pad('zero', -273, -1, [[-273, 1], [-1, 2]])],
      callouts: [reads('zero')],
      reset: true,
      goal: () => REACHED.has('zero'),
    },
  });

  /** The simulation a step looks at. */
  const sim = (id: StepId): WaterMd => (id === 'jiggle' || id === 'zero' ? ice : id === 'flow' ? flow : water);
  ctx.qa.expose('heat', () => {
    const id = stage.current as StepId;
    return {
      step: id,
      celsius: Math.round(sample.thermometer.celsius),
      model: Math.round(sim(id).temperature * 1000) / 1000,
      bridges: sample.molecules.bridgeCount,
      left: Math.round(left),
      right: Math.round(right),
      lifted,
      swaps,
      reached: [...REACHED],
    };
  });

  // QA: `__app.read('heat:charge')` shows the «+» tips and the «−» sides on the sample (the look of chapter 3)
  ctx.qa.expose('heat:charge', () => (sample.molecules.charge = sample.molecules.charge > 0 ? 0 : 1));

  return {
    enterStep(id) {
      const step = id as StepId;
      for (const k of ['jiggle', 'temperature', 'zero'] as const) {
        pads[k].target = pads[k].shown = k === 'temperature' ? 20 : -20;
        pads[k].drag = false;
        pads[k].told = NaN;
      }
      tintOn = false;
      swaps = 0;
      if (step === 'flow') startFlow();
      sample.thermometer.group.visible = step !== 'flow';
      sample.thermometer.range(step === 'zero' ? -273 : step === 'jiggle' ? -200 : 0, step === 'jiggle' || step === 'zero' ? 0 : 100);
      reading = fromCelsius(step === 'temperature' ? 20 : step === 'spread' ? WARM : step === 'flow' ? (HOT + COLD) / 2 : -20);
    },
    update(dt) {
      const id = stage.current as StepId;
      const md = sim(id);
      let padHeat = 0;
      if (id === 'jiggle' || id === 'temperature' || id === 'zero') {
        const s = pads[id];
        const before = s.shown;
        s.shown = s.drag ? s.target : s.shown + (s.target - s.shown) * (1 - Math.exp(-dt / 0.25));
        if (!(Math.abs(s.shown - s.told) < 0.05)) ui.patch(`pad-${id}`, { current: (s.told = s.shown) });
        md.heating = { mode: 'bath', temperature: fromCelsius(s.shown), tau: 0.7 };
        padHeat = Math.max(-1, Math.min(1, (s.shown - before) / Math.max(dt, 1e-3) / 60));
        if (id === 'jiggle') {
          if (s.shown < -150) seen.jiggle[0] = true;
          if (s.shown > -10) seen.jiggle[1] = true;
          if (seen.jiggle[0] && seen.jiggle[1]) REACHED.add('jiggle');
        } else if (id === 'temperature') {
          if (s.shown < 15) seen.temperature[0] = true;
          if (s.shown > 85) seen.temperature[1] = true;
          if (seen.temperature[0] && seen.temperature[1]) REACHED.add('temperature');
        } else if (s.shown <= -270) REACHED.add('zero');
      } else if (id === 'spread') {
        md.heating = { mode: 'bath', temperature: fromCelsius(WARM), tau: 1.5 };
      } else if (lifted) {
        md.partition = null;
        md.heating = { mode: 'off' };
      }
      const rate = id === 'flow' && lifted ? RATE_LEVELLING : RATE;
      if (dt > 0) md.step(Math.max(1, Math.min(MAX_STEPS, Math.round((rate * dt) / md.dt))));
      reading += (md.temperature - reading) * (1 - Math.exp(-dt / 1.2));
      sample.thermometer.set(toCelsius(reading));

      const view = sample.molecules;
      const tinted = id === 'flow' || (id === 'spread' && tintOn);
      view.speedTint += ((tinted ? 1 : 0) - view.speedTint) * Math.min(1, dt * 4);
      view.meanEnergy = 3 * (id === 'flow' ? fromCelsius((HOT + COLD) / 2) : Math.max(reading, 0.02));
      view.sync(md, dt);
      if (id === 'spread') {
        ring.visible = tintOn && view.fastest >= 0;
        if (ring.visible) {
          view.position(view.fastest, ringAt);
          ring.position.lerp(ringAt, Math.min(1, dt * 16));
          if (view.fastest !== lastFastest && lastFastest >= 0) swaps++;
          lastFastest = view.fastest;
          if (swaps >= 3) REACHED.add('spread');
        }
      } else ring.visible = false;
      if (id === 'flow') {
        const k = 1 - Math.exp(-dt / 0.8);
        left += (toCelsius(md.temperatureIn(-1, BOX_W / 2)) - left) * k;
        right += (toCelsius(md.temperatureIn(BOX_W / 2, BOX_W + 1)) - right) * k;
        if (lifted && Math.abs(left - right) < LEVEL) REACHED.add('flow');
      }
      sample.partition = id === 'flow' && !lifted ? 1 : 0;
      sample.heat = padHeat;
      sample.update(dt);
    },
  };
});
