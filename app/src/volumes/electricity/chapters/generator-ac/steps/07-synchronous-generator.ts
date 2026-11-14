/**
 * Step 7 `synchronous-generator` — the power-station turbogenerator in cutaway (housing, stator with phase bars,
 * 2-pole rotor with field winding, hydrogen coolers, exciter and AVR), and the slow many-pole hydrogenerator
 * for comparison. On entry the camera flies along the air gap. «Струм збудження» sets the no-load EMF with
 * saturation (`openCircuitEmfKV`); pole pairs set the speed for 50 Hz (`generatorSpeedRpm`). Layer toggles take
 * the housing / stator / rotor / coolers away.
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { hydrogenerator } from '@/kit';
import { SYNCHRONOUS_GENERATOR, generatorSpeedRpm, openCircuitEmfKV } from '@electricity/sim/generator-ac';
import type { StepFactory } from '../chapter';
import { doc, splitAll, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { AXIS_Y, createTurboGen } from '../parts/turbo-gen';
import { group, roomy, tag } from '../world';

const ID = 'synchronous-generator';
const SLOW_TURBO = 100;
const SLOW_HYDRO = 10;
const LAYERS = ['housing', 'stator', 'rotor', 'cooling'] as const;
const GAP_SHOT = `${ID}-gap`;
const GAP_HYDRO = `${ID}-gap-hydro`;

export const synchronousGenerator: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const set = group(ID, 0, 0.16, 0);
  hall.stageRoot.add(set);
  const tg = createTurboGen();
  tg.group.scale.setScalar(0.82);
  const turbo = group('turbo', 0, 0, 0, [tg.group]);
  const hydro = hydrogenerator({ poles: 80, cut: 1.7, runnerDepth: 0, scale: 0.3 });
  const hydroSet = group('hydro', 0, 0, 0, [hydro.group]);
  set.add(turbo, hydroSet);
  ctx.stage.actor(turbo, { appear: 'grow' });
  ctx.stage.actor(hydroSet, { appear: 'grow' });
  const layers = LAYERS.map((name) => {
    const part = tg.part(name);
    ctx.stage.actor(part, { appear: 'fade' });
    return part;
  });
  const emfTag = tag('', 22, 'teal', 'mono');
  emfTag.position.copy(tg.anchorLocal('avr')).multiplyScalar(0.82).add(new Vector3(0, 0.8, 0.2));
  const nTag = tag('', 20, 'white', 'mono');
  nTag.position.set(0, 4.3, 0);
  set.add(emfTag, nTag);

  const st = { angle: 0, flyT: -1, shot: ID as string };
  const isHydro = (): boolean => ui.value<string>('type7') === 'hydro';
  const p = (): number => (isHydro() ? Math.round(ui.value<number>('p7')) : SYNCHRONOUS_GENERATOR.polePairs.turbo);
  const n = (): number => generatorSpeedRpm(p());
  const emf = (): number => openCircuitEmfKV(ui.value<number>('if7') / 100);
  /** The fly-through along the air gap (turbo or hydro), then back to the machine — on entry and on demand. */
  const fly = (delay = 0): void => {
    st.flyT = 0;
    ctx.stage.scope.delay(delay, () => {
      st.shot = isHydro() ? GAP_HYDRO : GAP_SHOT;
      ctx.camera.go(st.shot, { duration: 2.2 });
    });
    ctx.stage.scope.delay(delay + 3.4, () => {
      st.shot = ID;
      ctx.camera.go(ID, { duration: 2.4 });
    });
  };
  const sync = (instant: boolean): void => {
    if (ctx.stage.shown(turbo) === isHydro()) ctx.stage.toggle(turbo, !isHydro(), { instant });
    if (ctx.stage.shown(hydroSet) !== isHydro()) ctx.stage.toggle(hydroSet, isHydro(), { instant });
    LAYERS.forEach((l, i) => {
      const want = ui.value<boolean>(`lay7${l}`);
      if (ctx.stage.shown(layers[i]!) !== want) ctx.stage.toggle(layers[i]!, want, { instant });
    });
  };
  const mid = new Vector3();
  const at = (name: string): Vector3 => tg.group.localToWorld(mid.copy(tg.anchorLocal(name)));
  const layerNames = splitAll(doc(ID, 5));

  return {
    id: ID,
    shots: {
      [ID]: { position: [4.6, 5.4, 9.6], target: [0.3, 1.5, 0], fov: 34, fit: { center: [0.2, 1.6, 0], radius: 4.6 } },
      // hydro: from the cut-away opening, low, along the exposed air gap between the pole shoes and the core
      [GAP_HYDRO]: { position: [1.15, 0.95, 1.25], target: [-0.35, 0.8, 0.75], fov: 46, drift: 0.2, fit: { center: [0.6, 0.85, 0.9], radius: 1.0 } },
      [GAP_SHOT]: { position: [-3.4, AXIS_Y * 0.82 + 0.75, 0.55], target: [2.4, AXIS_Y * 0.82 + 0.35, 0.1], fov: 46, drift: 0.2, fit: { center: [0, 1.5, 0], radius: 2 } },
    },
    stage: {
      show: [set, ...layers],
      enter: (info) => {
        sync(true);
        st.flyT = -1;
        st.shot = ID;
        if (info.instant || isHydro()) return;
        fly(0.2);
      },
    },
    ui: {
      honesty: [{ slowed: SLOW_TURBO, visible: () => !isHydro() }, { slowed: SLOW_HYDRO, visible: () => isHydro() }, 'notToScale', { kind: 'simplified', text: OWN.saturationModel }],
      controls: [
        {
          type: 'segmented',
          id: 'type7',
          items: splitPair(doc(ID, 0)).map((label, i) => ({ id: i === 0 ? 'turbo' : 'hydro', label })),
          value: 'turbo',
          onChange: () => hall.sound.relay(),
        },
        { type: 'slider', id: 'p7', label: doc(ID, 1), min: 1, max: 40, step: 1, value: SYNCHRONOUS_GENERATOR.polePairs.hydro, visible: () => isHydro() },
        { type: 'slider', id: 'if7', label: doc(ID, 2), min: 50, max: 150, step: 1, value: 100, unit: '%' },
        ...LAYERS.map((l, i) => ({
          type: 'toggle' as const,
          id: `lay7${l}`,
          label: layerNames[i] ?? l,
          value: true,
          visible: () => !isHydro(),
          onChange: () => hall.sound.click(1.1),
        })),
        { type: 'button', id: 'fly7', label: OWN.flyGap, icon: 'play', onClick: () => fly(), disabled: () => st.flyT >= 0 },
        {
          type: 'stats',
          id: 'read7',
          columns: 3,
          items: [
            { label: 'n = 60·50/p', get: () => fmtUnit(n(), 'rpm', { digits: 0 }) },
            { label: 'f', get: () => fmtUnit(50, 'Hz') },
            { label: 'ℰ', get: () => fmtUnit(emf(), 'kV', { digits: 1 }), color: () => 'teal' },
          ],
        },
      ],
      callouts: [
        { anchor: () => at('exciter'), text: OWN.exciter, side: 'up', visible: () => !isHydro() && roomy(hall) },
        { anchor: () => at('term1'), text: OWN.statorTerminals, side: 'down', visible: () => !isHydro() },
      ],
      hotspots: [
        { anchor: () => tg.part('stator').localToWorld(mid.copy(tg.anchorLocal('bars')).sub(new Vector3(0, AXIS_Y, 0))), content: 'stator-bars', visible: () => !isHydro() && ui.value<boolean>('lay7stator') },
        { anchor: () => tg.part('rotor').localToWorld(mid.set(-1.2, 0.75, 0)), content: 'rotor', visible: () => !isHydro() && ui.value<boolean>('lay7rotor') },
        { anchor: () => tg.part('cooling').localToWorld(mid.set(0.6, 0.5, 0.65)), content: 'hydrogen-cooler', visible: () => !isHydro() && ui.value<boolean>('lay7cooling') },
        { anchor: () => at('avr'), content: 'voltage-regulator', visible: () => !isHydro() },
        { anchor: () => hydro.group.localToWorld(mid.copy(hydro.anchorLocal('poles'))), content: 'hydro-poles', visible: () => isHydro() },
      ],
    },
    probe: () => ({
      type: ui.value<string>('type7'),
      p: p(),
      n: n(),
      emfKV: emf(),
      layers: LAYERS.map((l) => (ctx.stage.shown(layers[LAYERS.indexOf(l)]!) ? 1 : 0)).join(''),
      angle: st.angle,
      flying: st.flyT >= 0,
      shot: st.shot,
    }),
    update(dt) {
      if (!hall.isCurrent(ID)) return;
      sync(false);
      if (st.flyT >= 0 && (st.flyT += dt) > 5.9) st.flyT = -1;
      const slow = isHydro() ? SLOW_HYDRO : SLOW_TURBO;
      const w = (2 * Math.PI * (n() / 60)) / slow;
      st.angle += w * dt;
      tg.part('rotor').rotation.x = st.angle;
      hydro.speed = w;
      hydro.update?.(dt, 0);
      emfTag.text = `${OWN.avrTag}: ${fmtUnit(emf(), 'kV', { digits: 1 })}`;
      emfTag.visible = !isHydro();
      nTag.text = `n = ${fmtUnit(n(), 'rpm', { digits: 0 })} → 50 Hz`;
      hall.sound.turbine = isHydro() ? 0.12 : 0.3;
      hall.sound.turbinePitch = isHydro() ? 0.3 : 0.9;
      hall.sound.hum = 0.1 + 0.15 * (emf() / 27);
    },
  };
};
