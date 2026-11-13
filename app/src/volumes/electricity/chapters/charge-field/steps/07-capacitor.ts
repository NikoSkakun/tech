/**
 * Step 7 `capacitor` — «Конденсатор: енергія в полі». Parallel plates fed by a battery "pump"; sliders U, A, d
 * and the dielectric drive the sim (`parallelPlateCapacitor`: C = ε₀ε_rA/d, Q, E, W); the block's molecules
 * polarise; E above the breakdown field → spark, U rebounds to 0,9·E_b·d; «Розрядити через лампочку» flashes
 * the lamp with a brightness that follows log W.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtSci, fmtSI } from '@/content';
import { damp } from '@/engine/api';
import { createArc, createSparks } from '@/fx';
import {
  CAPACITOR_RANGES as R,
  DIELECTRICS,
  parallelPlateCapacitor,
  type CapacitorState,
  type DielectricId,
} from '@electricity/sim/charge-field';
import type { ColorToken } from '@/style';
import { clamp, type StepFactory } from '../chapter';
import { cap as capitalise, docItems, docLabel } from '../content';
import { L } from '../labels';
import { CAPACITOR } from '../layout';
import { createCapCircuit } from '../parts/cap-circuit';
import { createCapacitor } from '../parts/capacitor';
import { sound } from '../sound';

const MATERIALS: readonly DielectricId[] = ['air', 'ptfe', 'glass', 'ceramic'];
const TINT: Record<DielectricId, ColorToken> = { air: 'sky', ptfe: 'white', glass: 'sky', ceramic: 'amber' };

export const capacitorStep: StepFactory = ({ ctx, ui, world }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'capacitor';
  const set = new Group();
  set.name = 'step-capacitor';
  const cap = createCapacitor();
  const circuit = createCapCircuit(ctx);
  const spark = createArc({
    color: 'violet.light',
    width: 0.07,
    intensity: 3.4,
    branches: 2,
    continuous: false,
  });
  const sparks = createSparks(ctx, { count: 50, color: 'violet.light', size: 0.12 });
  set.add(cap.group, circuit.group, spark, sparks);
  ctx.root.add(set);
  const blockIn = stage.param('blockIn', 0, { duration: 0.6, ease: 'power2.inOut' });

  const params = (): Parameters<typeof parallelPlateCapacitor>[0] => ({
    voltageV: ui.value<number>('capU'),
    areaM2: ui.value<number>('capA') * 1e-4,
    gapM: ui.value<number>('capD') * 1e-3,
    dielectric: ui.value<DielectricId>('dielectric'),
  });
  const sim = (): CapacitorState => parallelPlateCapacitor(params());
  let shownMaterial: DielectricId = 'air';
  let level = 1; // how full the capacitor is, relative to what the sliders ask for
  let phase: 'hold' | 'discharge' = 'hold';
  let flash = 0;
  let lastQ = 0;
  let routed = '';
  let breakdowns = 0;
  let cooldown = 0;
  let flashes = 0;

  const swapBlock = (): void => {
    const next = ui.value<DielectricId>('dielectric');
    stage.setParam('blockIn', 0, { duration: 0.3 });
    stage.scope.delay(0.32, () => {
      shownMaterial = next;
      stage.setParam('blockIn', next === 'air' ? 0 : 1);
    });
  };
  ui.onChange('dielectric', () => on() && swapBlock());
  const discharge = (): void => {
    if (phase !== 'hold') return;
    const s = sim();
    phase = 'discharge';
    flashes++;
    flash = s.lampVisible ? 0.25 + 0.75 * s.lampBrightness : 0;
    if (s.lampVisible) audio.play('zap', { gain: 0.3 + 0.5 * s.lampBrightness, pitch: 1.3 });
    else ui.toast(capitalise(docLabel('capacitor', 2)), { icon: 'info' });
    // the battery tops the plates up again after the flash
    stage.scope.delay(1.6, () => (phase = 'hold'));
  };
  const breakdown = (s: CapacitorState): void => {
    breakdowns++;
    cooldown = 1.5;
    const h = cap.sideUnits * 0.3;
    spark.from.set(h * Math.cos(breakdowns * 2.1), cap.yTop, h * Math.sin(breakdowns * 2.1));
    spark.to.set(spark.from.x * 0.8, cap.yBottom, spark.from.z * 0.8);
    spark.strike(0.4);
    sparks.burst([spark.to.x, spark.to.y, spark.to.z], 26, [0, 1, 0], 1.4);
    audio.play('spark', { gain: 1 });
    level = 0; // U drops to zero, then the source brings it to the rebound value
    ui.set('capU', Math.floor(s.reboundVoltageV / R.voltageV.step) * R.voltageV.step);
    ui.toast(L.capacitor.breakdown, { tone: 'warning', icon: 'lightning' });
    if (params().dielectric === 'air')
      stage.scope.delay(2.2, () => void ui.toast(L.capacitor.paschen, { icon: 'info', duration: 7 }));
  };
  ctx.qa.expose('capacitor', () => ({
    ...sim(),
    ...params(),
    level,
    phase,
    breakdowns,
    flashes,
    blockIn: blockIn.value,
    lamp: circuit.lamp,
    wide,
    plateCharges: cap.charges,
    callout: L.capacitor.plus.replace('+Q', `+${charge()}`),
  }));

  const spot = new Vector3();
  const lowSpot = new Vector3();
  const canSpot = new Vector3();
  // The frame follows the plates: the close shot while they (and the props beside them) fit into it, the wide
  // one for big plates; hysteresis keeps the camera still while the slider is moved around the threshold.
  let wide = false;
  const pickFrame = (): boolean => {
    const side = Math.sqrt(params().areaM2) * CAPACITOR.unitsPerMetre;
    return side > (wide ? CAPACITOR.wideFrom - 0.35 : CAPACITOR.wideFrom);
  };
  const charge = (): string => fmtSI(sim().chargeC * level, 'C');
  const [air, ptfe, glass, ceramic] = docItems('capacitor', 0);
  const names = [air, ptfe, glass, ceramic];

  return {
    id: 'capacitor',
    stage: {
      show: [world.top.object, set],
      camera: 'capacitor',
      enter(info) {
        wide = false;
        wide = pickFrame();
        void ctx.camera.go(wide ? 'capacitorWide' : 'capacitor', { instant: info.instant });
        phase = 'hold';
        level = 1;
        flash = 0;
        routed = '';
        shownMaterial = ui.value<DielectricId>('dielectric');
        stage.setParam('blockIn', shownMaterial === 'air' ? 0 : 1, { instant: true });
        lastQ = sim().chargeC;
      },
    },
    ui: {
      honesty: ['simplified', { kind: 'notToScale', text: L.capacitor.gapChip }],
      controls: [
        {
          type: 'slider',
          id: 'capU',
          label: L.capacitor.u,
          min: R.voltageV.min,
          max: R.voltageV.max,
          step: R.voltageV.step,
          value: R.voltageV.default,
          unit: 'V',
          digits: 0,
        },
        {
          type: 'slider',
          id: 'capA',
          label: L.capacitor.area,
          min: R.areaM2.min * 1e4,
          max: R.areaM2.max * 1e4,
          step: 25,
          value: R.areaM2.default * 1e4,
          unit: 'cm²',
          digits: 0,
        },
        {
          type: 'slider',
          id: 'capD',
          label: L.capacitor.gap,
          min: R.gapM.min * 1e3,
          max: R.gapM.max * 1e3,
          step: R.gapM.step * 1e3,
          value: R.gapM.default * 1e3,
          unit: 'mm',
          digits: 1,
        },
        {
          type: 'segmented',
          id: 'dielectric',
          value: 'air',
          items: MATERIALS.map((id, i) => ({ id, label: names[i]! })),
        },
        {
          type: 'button',
          id: 'discharge',
          label: docLabel('capacitor', 1),
          icon: 'lightning',
          primary: true,
          disabled: () => phase !== 'hold',
          onClick: discharge,
        },
      ],
      board: {
        title: L.capacitor.board,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'capStats',
            columns: 2,
            items: [
              { label: L.capacitor.c, get: () => fmtSI(sim().capacitanceF, 'F') },
              { label: L.capacitor.q, get: () => fmtSI(sim().chargeC, 'C'), color: () => 'cyan' },
              {
                label: L.capacitor.e,
                get: () => `${fmtNumber(sim().fieldVPerM / 1e6, { maxDigits: 2 })} kV/mm`,
                color: () => (sim().breakdownRatio > 0.8 ? 'red' : 'amber'),
              },
              { label: L.capacitor.w, get: () => fmtSI(sim().energyJ, 'J'), color: () => 'yellow' },
            ],
          },
          // The secondary numbers in a quiet key–value list under the four the step teaches: +Q and −Q stand on
          // the plates themselves (callouts), the list states how many electrons that is and what they add up to.
          {
            type: 'table',
            id: 'capMore',
            rows: () => [
              [L.capacitor.n, sim().electrons > 0 ? fmtSci(sim().electrons * level, 1) : '0'],
              [L.capacitor.sum, '0 C'],
            ],
          },
        ],
      },
      callouts: [
        {
          anchor: () => spot.set(-cap.sideUnits / 2, cap.yTop + 0.2, -cap.sideUnits / 2),
          text: () => L.capacitor.plus.replace('+Q', `+${charge()}`),
          side: 'up',
          color: 'coral',
        },
        {
          // the front edge, right of the centre: the label hangs below the plate, clear of the dock on the right
          anchor: () => lowSpot.set(cap.sideUnits * 0.2, cap.yBottom - 0.12, cap.sideUnits / 2),
          text: () => L.capacitor.minus.replace('−Q', `−${charge()}`),
          side: 'down',
          color: 'cyan',
        },
      ],
      hotspots: [
        {
          anchor: () => new Vector3(cap.sideUnits * 0.25, (cap.yTop + cap.yBottom) / 2, cap.sideUnits / 2),
          content: 'dielectric-molecules',
          visible: () => blockIn.value > 0.9,
        },
        {
          anchor: () => canSpot.copy(circuit.supercap.position).setY(1.15),
          content: 'supercapacitor',
        },
      ],
    },
    update(dt, t) {
      const p = params();
      const s = sim();
      // one spark per breakdown: while the learner keeps pulling the slider past the limit, the voltage is
      // simply held at the rebound value until the cool-down has passed
      cooldown = Math.max(cooldown - dt, 0);
      if (s.breakdown && phase === 'hold') {
        if (cooldown > 0) ui.set('capU', Math.floor(s.reboundVoltageV / R.voltageV.step) * R.voltageV.step);
        else breakdown(s);
      }
      // the charge follows the source with a short lag; a discharge empties it in ≈ 0,5 s
      level = damp(level, phase === 'discharge' ? 0 : 1, phase === 'discharge' ? 7 : 3.5, dt);
      Object.assign(cap.view, {
        side: Math.sqrt(p.areaM2),
        gap: p.gapM,
        field: s.fieldVPerM,
        level,
        permittivity: DIELECTRICS[shownMaterial].permittivity,
        blockIn: blockIn.value,
        blockColor: TINT[shownMaterial],
      });
      cap.update(dt, t);
      const key = `${cap.sideUnits.toFixed(3)}|${cap.yTop.toFixed(3)}`;
      if (key !== routed) {
        routed = key;
        circuit.route(cap.sideUnits / 2, cap.yBottom, cap.yTop);
      }
      if (on() && pickFrame() !== wide) {
        wide = !wide;
        void ctx.camera.go(wide ? 'capacitorWide' : 'capacitor', { duration: 1 });
      }
      // electrons run in the wires only while the charge on the plates changes
      const q = s.chargeC * level;
      const rate = Math.abs(q - lastQ) / (Math.max(q, lastQ) + 1e-15) / Math.max(dt, 1e-3);
      const growing = q >= lastQ;
      lastQ = q;
      const busy = clamp(rate * 0.6, 0, 1);
      circuit.charging = damp(circuit.charging, phase === 'discharge' ? 0 : busy, 8, dt);
      circuit.discharging = damp(circuit.discharging, phase === 'discharge' && level > 0.03 ? 1 : 0, 8, dt);
      circuit.flow.speed = phase === 'discharge' || growing ? 2.6 : -2.6;
      flash = damp(flash, 0, 2.6, dt);
      circuit.lamp = phase === 'discharge' ? flash : damp(circuit.lamp, 0, 6, dt);
      circuit.update(t);
      sound.hum = 0.3 * circuit.charging + 0.15 * Math.min(s.breakdownRatio, 1);
    },
  };
};
