/**
 * Step 8 `pn-junction` — the p-n junction and the diode (§8). One source voltage drives everything: the circuit
 * (source + 220 Ω + diode) is solved by the sim, the depletion region and the energy hill follow U_D, carriers
 * rush across in forward bias, the lamp and the ammeter follow I, and the board plots the operating point on
 * the I–V curve (with a log inset for the tiny reverse current). «Перевернути діод» turns the block around.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtSI, fmtUnit } from '@/content';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import type { Chart } from '@/ui3d';
import { DIODE, diodeCircuit, diodeIvCurve } from '@electricity/sim/matter';
import type { StepFactory } from '../chapter';
import { group } from '../chapter';
import { docLabel } from '../content';
import { DOC, L } from '../labels';
import { createCircuit } from '../parts/circuit';
import { BAR, createPnBlock } from '../parts/pn-block';
import { HERO_Y, narrow, roomy } from '../world';

const ID = 'pn-junction';
/** Drawn depletion width per μm (not to scale: the real one is a fraction of a micrometre). */
const UNITS_PER_UM = 2.3;
const CURVE = diodeIvCurve();

export const pnStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const set = group(`set:${ID}`);
  lab.stand.add(set);
  const block = createPnBlock(ctx);
  block.group.position.set(0, HERO_Y + 0.2, 0);
  // diode symbol on the casing: triangle (p → n) and the cathode bar, plus the cathode stripe on the n end
  const sb = new Builder('diode-symbol');
  sb.box(1.1, 0.42, 0.04, { r: 0.05, c: 'bg.deep', at: [0, -0.9, 0.57], mid: true });
  sb.cyl(0.15, 0.03, { seg: 3, c: 'white', axis: 'z', at: [-0.08, -0.9, 0.59], rot: [0, 0, -Math.PI / 2] });
  sb.box(0.03, 0.3, 0.03, { r: 0, c: 'white', at: [0.1, -0.9, 0.6], mid: true });
  sb.box(0.12, 1.42, 1.22, { r: 0.03, c: 'mist', at: [BAR - 0.2, 0, 0], mid: true });
  const symbol = sb.build().group;
  block.group.add(symbol);
  const circuit = createCircuit(-(BAR + 0.14), BAR + 0.14, HERO_Y + 0.2);
  set.add(block.group, circuit.group);

  let flipped = false;
  const us = (): number => ui.value<number>('Us8');
  const state = (): ReturnType<typeof diodeCircuit> => diodeCircuit(us(), flipped);
  const flip = (): void => {
    flipped = !flipped;
    audio.play('whooshUp', { gain: 0.6 });
    ctx.stage.scope.to(
      block.group.rotation,
      { y: flipped ? Math.PI : 0 },
      { duration: 0.9, ease: 'power2.inOut' },
    );
  };
  ui.onChange('Us8', () => audio.play('tick', { pitch: 1 + us() / 12, gain: 0.35 }));

  const v = new Vector3();
  const at = (local: Vector3): Vector3 => block.group.localToWorld(v.copy(local));
  ctx.qa.probe('block8', block.group);
  ctx.qa.probe('lamp8', () => set.localToWorld(v.copy(circuit.lampAt)));
  ctx.qa.expose(ID, () => ({ ...state(), flipped, width: block.width, join: block.join }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.4, HERO_Y + 2.3, 9.0],
        target: [0, HERO_Y - 0.5, 0.6],
        fov: 32,
        frameAspect: 1.3,
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [0, HERO_Y - 0.4, 0.6], radius: 3.4 },
      },
    },
    stage: {
      show: [block.group, circuit.group],
      enter(info) {
        // script: coming from doping, the p and n bars slide together into the junction
        block.join = !info.instant && info.from === 'doping' && !ctx.reducedMotion ? 0 : 1;
        flipped = false;
        block.group.rotation.y = 0;
      },
    },
    ui: {
      honesty: [{ kind: 'notToScale', text: DOC.notToScale }, 'simplified'],
      controls: [
        {
          type: 'slider',
          id: 'Us8',
          label: L.pn.source,
          ...DIODE.sourceRange,
          value: DIODE.sourceRange.default,
          unit: 'V',
          digits: 2,
        },
        {
          type: 'stats',
          id: 'out8',
          items: [
            { label: L.pn.ud, get: () => fmtUnit(state().diodeV, 'V', { digits: 3 }) },
            { label: L.pn.i, get: () => fmtSI(state().currentA, 'A', { maxDigits: 3 }) },
            { label: L.pn.w, get: () => fmtUnit(state().depletionWidthUm, 'μm', { digits: 2 }) },
            { label: L.pn.barrier, get: () => fmtUnit(state().barrierV, 'V', { digits: 2 }) },
          ],
        },
        { type: 'button', id: 'flip8', label: docLabel(ID, 1), icon: 'resetView', onClick: flip },
      ],
      board: {
        title: L.pn.chart,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'iv8',
            chart: {
              height: 170,
              x: { min: -1, max: 0.8, label: 'U_D, V' },
              y: { min: -1, max: 30, label: 'I, mA' },
              series: [{ id: 'iv', label: 'I(U_D)', color: 'yellow' }],
            },
            init: (c: Chart) => {
              const pts = CURVE.filter((p) => p.currentA < 0.032);
              c.setData(
                'iv',
                pts.map((p) => p.diodeV),
                pts.map((p) => p.currentA * 1e3),
              );
            },
            update: (c: Chart) => c.setMarker('now', { x: state().diodeV, y: state().currentA * 1e3 }),
          },
          {
            type: 'chart',
            id: 'log8',
            chart: {
              height: 110,
              x: { min: -1, max: 0.8, label: 'U_D, V' },
              y: { min: 1e-13, max: 0.1, log: true, label: '|I|, A' },
              series: [{ id: 'abs', label: '|I|', color: 'yellow', opacity: 0.7 }],
            },
            init: (c: Chart) =>
              c.setData(
                'abs',
                CURVE.map((p) => p.diodeV),
                CURVE.map((p) => Math.max(Math.abs(p.currentA), 1e-13)),
              ),
            update: (c: Chart) =>
              c.setMarker('now', { x: state().diodeV, y: Math.max(Math.abs(state().currentA), 1e-13) }),
          },
        ],
      },
      callouts: [
        {
          anchor: () => at(new Vector3(-BAR / 2, 0.85, 0)),
          text: L.pn.p,
          color: SEMANTIC.pRegion,
          side: 'up',
        },
        {
          anchor: () => at(new Vector3(BAR / 2, 0.85, 0)),
          text: L.pn.n,
          color: SEMANTIC.nRegion,
          side: 'up',
        },
        {
          anchor: () => at(block.hillTop),
          // on a phone the three top labels collide: the barrier value is in the dock
          visible: () => block.join > 0.98 && !narrow(lab),
          text: () => `${L.pn.hill} ${fmtUnit(state().barrierV, 'V', { digits: 2 })}`,
          color: 'sky',
          side: 'up',
        },
        {
          anchor: () => set.localToWorld(v.copy(circuit.source)),
          text: () => `U_s = ${fmtUnit(us(), 'V', { digits: 2 })}`,
          side: 'down',
          // secondary (the dock shows U_s too): only in a roomy window
          visible: () => roomy(lab),
        },
        {
          anchor: () => set.localToWorld(v.copy(circuit.resistor)),
          text: L.pn.resistor,
          side: 'down',
          visible: () => roomy(lab),
        },
      ],
      hotspots: [
        { anchor: () => at(block.ionAnchor), content: 'fixed-ions' },
        { anchor: () => at(new Vector3(0, -0.9, 0.62)), content: 'diode-symbol' },
      ],
    },
    update(dt, t) {
      const s = state();
      block.width = Math.max(s.depletionWidthUm * UNITS_PER_UM, 0.12);
      block.barrier = s.barrierV;
      // carriers cross at a rate that grows with log I (0 below ~1 μA)
      block.flow = s.forward
        ? Math.min(Math.max(Math.log10(Math.max(s.currentA, 1e-12) / 1e-6) / 4, 0), 1)
        : 0;
      block.update(dt, t);
      circuit.lamp = s.lampBrightness;
      circuit.meter = Math.abs(s.currentA) / DIODE.lampFullScaleA;
      circuit.current = s.currentA / DIODE.lampFullScaleA;
      circuit.update(dt);
      lab.live.buzz = Math.min(Math.abs(s.currentA) / DIODE.lampFullScaleA, 1) * 0.7;
    },
  };
};
