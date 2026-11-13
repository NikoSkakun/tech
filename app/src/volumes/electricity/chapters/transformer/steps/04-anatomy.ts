/**
 * Step 4 `anatomy` — the 250 MVA, 330/110 kV power transformer on its pad, evening substation light. Opens with the
 * tank already lifted off (glass ghost) so the oil, the cut-open HV / LV windings and the three-limb core show;
 * five layer toggles (and a click on a layer in the scene) take the layers off and put them back. The load slider
 * drives model Т3: convection speed, the top-oil thermometer, the fans (ONAN → ONAF above 70 °C). «Внутрішня
 * іскра» plays the Buchholz sequence: arc → gas bubbles to the relay → float drops → «Газовий захист: вимкнення» →
 * the knife switches on the HV bushings open.
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import type { Actor } from '@/engine/api';
import { createArc, createFlow, createSparks } from '@/fx';
import { STATUS } from '@/ui3d';
import { OIL, createOilThermal } from '@electricity/sim/transformer';
import type { StepFactory } from '../chapter';
import { doc, hot, splitList } from '../labels';
import { OWN } from '../labels-own';
import { limbX } from '../parts/active-part';
import { LAYER_IDS, type LayerId } from '../parts/power-layers';
import { COVER, TK } from '../parts/power-exterior';
import { group, tag } from '../world';
import { POWER_SCALE, sharePower } from './shared-power';

const ID = 'anatomy';
const toggleId = (l: LayerId): string => `layer-${l}`;
/** Time base of the spark sequence (s since the button). */
const SEQ = { arc: 0.7, float: 2.2, trip: 2.8 } as const;

export const anatomy: StepFactory = (tx) => {
  const { ui, ctx } = tx;
  const P = sharePower(tx);
  const layerActors = tx.share('power-actors', () => {
    const map = {} as Record<LayerId, Actor>;
    for (const l of LAYER_IDS) map[l] = ctx.stage.actor(P.layers[l], { appear: 'fade', inDuration: 0.6, outDuration: 0.45 });
    return { map, ghost: ctx.stage.actor(P.ghost, { appear: 'fade' }), body: ctx.stage.actor(P.exterior.group, { appear: 'pop' }) };
  });
  // spark effects live in a group at the transformer's scale, so their coordinates are metres too
  const fx = group('spark-fx');
  fx.scale.setScalar(POWER_SCALE);
  const arcAt = new Vector3(limbX(0) + 0.2, TK.y0 + 1.2, 1.15);
  const arc = createArc({ from: [arcAt.x - 0.25, arcAt.y + 0.3, arcAt.z], to: [arcAt.x + 0.2, arcAt.y - 0.25, arcAt.z], color: 'red', branches: 2, continuous: false, width: 0.06 });
  const sparks = createSparks(ctx, { color: 'orange', size: 0.06 });
  const gasIn = P.anchor('gasIn');
  const relay = P.anchor('buchholz');
  const gas = createFlow(ctx, {
    kind: 'blob',
    color: 'white',
    paths: [arcAt.clone(), new Vector3(arcAt.x - 0.2, COVER - 0.25, 0.4), new Vector3(gasIn.x, COVER - 0.15, gasIn.z), gasIn.clone(), relay.clone().setY(relay.y - 0.25)],
    count: 40,
    radius: 0.06,
    speed: 1.4,
    spread: 0.06,
    name: 'gas',
  });
  gas.density = 0;
  fx.add(arc, sparks, gas);
  const thermoTag = tag('', 21, 'white');
  const t0 = P.anchor('thermo0');
  thermoTag.position.set(t0.x + 0.75, t0.y + 0.1, t0.z).multiplyScalar(POWER_SCALE);
  const set = group(`set:${ID}`, 0, 0, 0, [fx, thermoTag]);
  tx.stageRoot.add(set);

  const oil = createOilThermal(OIL.loadRange.default);
  const load = (): number => ui.value<number>('load4') / 100;
  let spark = -1;
  const tripped = (): boolean => spark >= SEQ.trip;
  const on = (l: LayerId): boolean => ui.value<boolean>(toggleId(l));
  const applyLayers = (instant: boolean): void => {
    for (const l of LAYER_IDS) ctx.stage.toggle(layerActors.map[l], on(l), { instant });
    ctx.stage.toggle(layerActors.ghost, !on('tank'), { instant });
  };
  // direct manipulation: click a layer in the scene to lift it off; the toggles put layers back
  for (const l of LAYER_IDS) {
    if (l === 'oil') continue;
    ctx.input.register(P.layers[l], {
      tooltip: OWN.layerClick,
      cursor: 'pointer',
      click: () => ui.set(toggleId(l), false, { notify: true }),
      // a faded-out layer stays in the scene graph: it must not catch the clicks meant for the layers inside
      enabled: () => tx.isCurrent(ID) && on(l),
    });
  }
  // (the glass ghost is not clickable: it encloses every layer and would catch their clicks)
  const layerNames = splitList(doc(ID, 0));
  // QA: a point on the front of the right HV winding (a click there lifts the HV layer off)
  ctx.qa.probe('hv-layer', P.point(limbX(2) + 0.82, TK.y0 + 1.7, 0.5)); // beside the cut window

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [5.0, 4.5, 10.8],
        target: [-0.2, 2.25, 0.2],
        fov: 32,
        frameAspect: 1.45,
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [-0.3, 2.1, 0], radius: 3.9 },
      },
    },
    stage: {
      show: [layerActors.body, ...Object.values(layerActors.map), layerActors.ghost, set],
      envTune: { top: 'bg.deep', mid: 'bg.violet', keyColor: 'amber.light', keyIntensity: 1.05, rimColor: 'amber', rimIntensity: 0.6 },
      enter: (info) => {
        applyLayers(info.instant);
        spark = -1;
        oil.setLoad(load());
      },
    },
    ui: {
      hint: OWN.hint4,
      honesty: ['notToScale', { kind: 'simplified', text: doc(ID, 2) }, { text: OWN.sped4 }],
      controls: [
        { type: 'slider', id: 'load4', label: doc(ID, 1), min: 0, max: 120, step: 5, value: 60, unit: '%', digits: 0, onChange: (v) => oil.setLoad(v / 100) },
        ...LAYER_IDS.map((l, i) => ({
          type: 'toggle' as const,
          id: toggleId(l),
          label: layerNames[i]!,
          value: l !== 'tank',
          onChange: () => {
            applyLayers(false);
            tx.sound.click(l === 'tank' ? 0.8 : 1.1);
          },
        })),
        { type: 'readout', id: 'oil4', label: OWN.topOil, text: () => fmtUnit(oil.state.thermometerC, '°C', { digits: 1 }), color: () => (oil.state.thermometerC > 85 ? STATUS.warning : STATUS.ok) },
        { type: 'readout', id: 'cool4', label: OWN.cooling, text: () => (oil.state.fansOn ? OWN.onaf : OWN.onan) },
        { type: 'note', id: 'gas4', text: doc(ID, 4), icon: 'warning', color: STATUS.alarm, visible: () => tripped() },
        { type: 'button', id: 'spark4', label: doc(ID, 3), icon: 'lightning', primary: true, visible: () => !tripped(), disabled: () => spark >= 0, onClick: () => (spark = 0) },
        { type: 'button', id: 'reset4', label: OWN.reclose, icon: 'resetView', visible: () => tripped(), onClick: () => ((spark = -1), tx.sound.relay()) },
      ],
      callouts: [
        { anchor: P.point(limbX(1), TK.y0 + 0.4, 0.55), text: OWN.core, side: 'down', visible: () => on('core') && !on('tank') },
        { anchor: P.at('oltcDrive'), text: OWN.oltc, side: 'right' },
        { anchor: P.at('lv2'), text: OWN.lvBushings, side: 'up' },
      ],
      hotspots: [
        { anchor: P.point(2.1, COVER + 2.2, 0.75), content: hot(ID, 0) },
        { anchor: P.at('conservator'), content: hot(ID, 1) },
        { anchor: P.at('breather'), content: hot(ID, 2) },
        { anchor: P.at('buchholz'), content: hot(ID, 3) },
        { anchor: P.point(-TK.L / 2 - 1.0, TK.y0 + 2.3, 1.45), content: hot(ID, 4) },
        { anchor: P.point(limbX(2), TK.y0 + 1.7, 1.0), content: hot(ID, 5), visible: () => !on('tank') && (on('hv') || on('lv')) },
        { anchor: P.point(-0.9, TK.y0 + 3.0, 1.3), content: hot(ID, 6), visible: () => !on('tank') && on('oil') },
      ],
    },
    probe: () => ({
      load: load(),
      oilC: oil.state.thermometerC,
      fans: oil.state.fansOn,
      layers: LAYER_IDS.map((l) => (on(l) ? 1 : 0)).join(''),
      spark,
      tripped: tripped(),
      gas: gas.density,
    }),
    update(dt, t) {
      const s = oil.step(dt);
      const live = !tripped();
      // convection ∝ heat flow: ~β² of the load losses plus the constant iron losses (Т3 R = 5)
      const drive = live ? (1 + 5 * s.loadPu * s.loadPu) / 6 : 0.05;
      P.oilFlow.speed = 0.25 + 0.9 * drive * (s.fansOn ? 1.25 : 1);
      if (spark >= 0) spark += dt;
      const sp = spark;
      arc.power = sp >= 0 && sp < SEQ.arc ? 1 : 0;
      if (sp >= 0 && sp < SEQ.arc && Math.floor(t * 12) !== Math.floor((t - dt) * 12)) {
        arc.strike(0.15);
        sparks.burst([arcAt.x, arcAt.y, arcAt.z], 10, [0, 1, 0.3], 0.8);
        if (sp < dt * 1.5) tx.sound.zap();
      }
      gas.density = sp > 0.2 && sp < SEQ.trip + 0.8 ? 1 : 0;
      const float = sp < SEQ.float ? 0 : Math.min(1, (sp - SEQ.float) / 0.5);
      const blades = sp < SEQ.trip ? 0 : Math.min(1, (sp - SEQ.trip) / 0.4);
      if (sp >= SEQ.trip && sp - dt < SEQ.trip) tx.sound.breaker();
      P.update(dt, { fans: live && s.fansOn, thermo: [s.thermometerC, s.thermometerC + 12 * s.loadPu * s.loadPu], blades, float });
      thermoTag.text = fmtUnit(s.thermometerC, '°C', { digits: 0 });
      tx.sound.hum = live ? 0.16 + 0.1 * s.loadPu : 0;
      tx.sound.buzz = live && s.fansOn ? 0.18 : 0;
      tx.sound.buzzPitch = 0.6;
    },
  };
};

