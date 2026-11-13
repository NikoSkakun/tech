/**
 * Step 2 `electron-sea` — inside the copper lattice: 600 electrons of the Drude gas (§2) race at v_F in all
 * directions and scatter now and then (flash); one is marked in `yellow` with a long trail. With the field on,
 * `amber` arrows appear and the whole cloud drifts against them (drift exaggerated ×10⁸); the transfer counter
 * at the cross-section counts net crossings — a random walk around 0 without the field, a steady climb with it.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtUnit } from '@/content';
import { createHalo, createVectorArrow, RibbonLines } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import {
  createElectronGas,
  driftVelocity,
  ELECTRON_GAS,
  resistanceVisuals,
  scatteringTimeS,
} from '@electricity/sim/matter';
import { sci } from '../fmt';
import type { StepFactory } from '../chapter';
import { group } from '../chapter';
import { docLabel } from '../content';
import { DOC, L } from '../labels';
import { CELL_NM, createElectronHall, FOLD, FOLD_NM, UNITS_PER_NM } from '../parts/electron-hall';
import { HERO_Y } from '../world';

const ID = 'electron-sea';
const BOX = ELECTRON_GAS.boxNm;
const HALF = (FOLD * CELL_NM * UNITS_PER_NM) / 2;
const FOLLOW_S = 6;
/** The hall floats above the podium so that the view inside it shows only crystal. */
const HALL_Y = HERO_Y + 1.6;
const EYE = new Vector3(1.55, 0.12, 1.6);
const ORIGIN = new Vector3();

export const seaStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const set = group(`set:${ID}`, 0, HALL_Y, 0);
  lab.stand.add(set);
  const gas = createElectronGas({ fieldVPerM: 0, temperatureC: 20 }, 7);
  const hall = createElectronHall(ctx, gas);
  hall.eye.copy(EYE);
  const halo = createHalo({ color: 'yellow', size: 0.9, intensity: 2.2 });
  const trail = new RibbonLines({ capacity: 400, color: 'yellow', width: 0.05, intensity: 1.6 });
  // cross-section of the transfer counter: a thin amber frame across the window (plane x = const)
  const fb = new Builder('section');
  for (const [y, z, w, d] of [
    [HALF, 0, 0.05, 2 * HALF],
    [-HALF, 0, 0.05, 2 * HALF],
    [0, HALF, 2 * HALF, 0.05],
    [0, -HALF, 2 * HALF, 0.05],
  ] as const)
    fb.box(0.02, w === 0.05 ? 0.02 : w, d === 0.05 ? 0.02 : d, {
      r: 0,
      slot: 'glow',
      c: 'amber.dark',
      at: [0, y, z],
      mid: true,
    });
  const section = fb.build().group;
  const arrows = new Group();
  const fieldArrows = [-1, 0, 1].map((k) => {
    const ar = createVectorArrow({ color: SEMANTIC.fieldE });
    ar.position.set(-1.9 + 0.3 * k, 0.75 + 0.3 * k, -0.6 - 0.7 * k);
    ar.scale.setScalar(0.4);
    arrows.add(ar);
    return ar;
  });
  const driftArrow = createVectorArrow({ color: SEMANTIC.electron });
  driftArrow.position.set(0.2, -0.6, -1.1);
  driftArrow.scale.setScalar(0.4);
  arrows.add(driftArrow);
  set.add(hall.group, halo, trail, section, arrows);
  ctx.stage.actor(arrows);

  /* ------------------------------------------------------------------------------------- state */
  const field = (): number => (ui.value<boolean>('field2') ? ui.value<number>('E2') : 0);
  const tempC = (): number => ui.value<number>('T2');
  const drift = (): ReturnType<typeof driftVelocity> => driftVelocity(field(), tempC());
  let follow = 0; // seconds left of the drone ride
  let transfer = 0;
  let scatterRate = 0;
  const hero = new Vector3(); // unwrapped position of the highlighted electron, nm
  const prev = new Vector3();
  const prevX = new Float32Array(ELECTRON_GAS.count);
  const history: Vector3[] = [];
  const trailLines: { points: Vector3[] }[] = [];

  const resetView = (): void => {
    hall.centre.set(FOLD_NM / 2, FOLD_NM / 2, FOLD_NM / 2);
    const p = gas.positions;
    hero.set(p[3 * hall.hero]!, p[3 * hall.hero + 1]!, p[3 * hall.hero + 2]!);
    prev.copy(hero);
    for (let i = 0; i < ELECTRON_GAS.count; i++) prevX[i] = p[3 * i]! % FOLD_NM;
    history.length = 0;
    transfer = 0;
    follow = 0;
  };
  resetView();
  ui.onChange('field2', (on) => {
    audio.play('toggle');
    if (lab.isCurrent(ID)) ctx.stage.toggle(arrows, on as boolean);
  });
  ui.onChange('follow2', (on) => {
    audio.play(on ? 'whooshUp' : 'click');
    follow = on ? FOLLOW_S : 0;
  });

  const v = new Vector3();
  // anchors that wander through the hall: annotate them only while they are well inside the frame
  const ndc = new Vector3();
  const onScreen = (world: Vector3): boolean => {
    ndc.copy(world).project(ctx.camera.camera);
    return ndc.z < 1 && Math.abs(ndc.x) < 0.8 && Math.abs(ndc.y) < 0.8;
  };
  const flashShown = new Vector3(-0.6, 0.1, -0.9);
  const w = new Vector3();
  ctx.qa.probe('section2', section);
  ctx.qa.expose(ID, () => ({
    field: field(),
    driftMmS: drift().driftMPerS * 1e3,
    oneIn: drift().oneIn,
    transfer,
    scatterRate,
    follow,
    centre: hall.centre.toArray(),
    tauFs: scatteringTimeS(tempC()) * 1e15,
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [EYE.x, HALL_Y + EYE.y, EYE.z],
        target: [-0.55, HALL_Y - 0.12, -0.5],
        fov: 46,
        drift: 0.4,
        orbit: { azimuth: 0.6, polar: 0.3, zoom: [0.8, 1.2] },
        fit: { center: [-0.55, HALL_Y, -0.5], radius: 1.8 },
      },
    },
    stage: {
      show: [hall.group, halo, trail, section, arrows],
      post: { dofAperture: 0.5 },
      // depth cue inside the crystal: far rows sink into the indigo haze
      envTune: { fogDensity: 0.32, fogColor: 'bg.deep' },
      enter() {
        ctx.stage.toggle(arrows, ui.value<boolean>('field2'), { instant: true });
        if (ui.value<boolean>('follow2')) ui.set('follow2', false);
        resetView();
      },
    },
    ui: {
      honesty: [
        { slowed: 5e14, text: DOC.slowed },
        { kind: 'simplified', text: DOC.balls },
        { enlarged: 1e8, text: DOC.driftChip, visible: () => field() > 0 },
      ],
      controls: [
        { type: 'toggle', id: 'field2', label: docLabel(ID, 0), value: false },
        {
          type: 'slider',
          id: 'E2',
          label: L.sea.field,
          min: ELECTRON_GAS.fieldRange.min,
          max: ELECTRON_GAS.fieldRange.max,
          step: ELECTRON_GAS.fieldRange.step,
          value: ELECTRON_GAS.fieldRange.default,
          unit: 'V/m',
          digits: 2,
          disabled: () => !ui.value<boolean>('field2'),
        },
        {
          type: 'slider',
          id: 'T2',
          label: docLabel(ID, 4),
          min: ELECTRON_GAS.temperatureRange.min,
          max: ELECTRON_GAS.temperatureRange.max,
          step: 5,
          value: 20,
          unit: '°C',
          digits: 0,
        },
        { type: 'toggle', id: 'follow2', label: docLabel(ID, 2), value: false },
        {
          type: 'stats',
          id: 'out2',
          items: [
            { label: L.sea.drift, get: () => fmtUnit(drift().driftMPerS * 1e3, 'mm/s', { maxDigits: 2 }) },
            { label: L.sea.ratio, get: () => (field() > 0 ? `1 : ${sci(drift().oneIn, 1)}` : '0') },
            { label: L.sea.scatters, get: () => fmtNumber(scatterRate, { digits: 0 }) },
            { label: DOC.transferred, get: () => fmtNumber(transfer, { digits: 0, sign: true }) },
          ],
        },
      ],
      callouts: [
        {
          anchor: () => set.localToWorld(v.set(sectionX(), HALF * 0.55, -0.4)),
          text: () => `${DOC.transferred}: ${fmtNumber(transfer, { digits: 0, sign: true })}`,
          color: 'amber',
          side: 'up',
        },
        {
          anchor: () => halo.getWorldPosition(v),
          visible: () => onScreen(halo.getWorldPosition(v)),
          text: L.sea.follow,
          color: 'yellow',
          side: 'right',
        },
        {
          anchor: () => fieldArrows[2]!.getWorldPosition(v).add(new Vector3(0.6, 0, 0)),
          text: L.sea.fieldArrow,
          color: SEMANTIC.fieldE,
          side: 'up',
          visible: () => field() > 0,
        },
      ],
      hotspots: [
        { anchor: () => set.localToWorld(v.copy(flashShown)), content: 'scattering-flash' },
        { anchor: () => set.localToWorld(v.set(sectionX(), -HALF * 0.35, 0.3)), content: 'drift-counter' },
      ],
    },
    update(dt, t) {
      gas.set({ fieldVPerM: field(), temperatureC: tempC() });
      gas.step(Math.min(dt, 0.1));
      scatterRate += (gas.scatteredLastStep / Math.max(dt, 1e-3) - scatterRate) * Math.min(dt * 1.5, 1);
      countCrossings();
      trackHero(dt);
      hall.jitter = 0.012 * resistanceVisuals('Cu', tempC()).jitterRelative;
      hall.update(t);
      if (onScreen(set.localToWorld(v.copy(hall.lastFlash)))) flashShown.copy(hall.lastFlash);
      hall.electronAt(hall.hero, v);
      halo.position.copy(v);
      updateTrail(v);
      section.position.x = sectionX();
      const e = field();
      for (const ar of fieldArrows) ar.set(ORIGIN, w.set(1.5 + 3 * e, 0, 0));
      driftArrow.set(ORIGIN, w.set(-(0.8 + 2.2 * e), 0, 0));
      lab.live.crackle = 0.6;
      lab.live.crackleRate = Math.min(scatterRate / 120, 1);
      lab.live.buzz = e > 0 ? 0.3 + 0.5 * e : 0;
    },
  };

  function sectionX(): number {
    const c = hall.centre.x;
    const x = FOLD_NM / 2 - FOLD_NM * Math.round((FOLD_NM / 2 - c) / FOLD_NM);
    return (x - c) * UNITS_PER_NM;
  }

  /** Net crossings of the plane x = FOLD_NM/2 (folded sim coordinates): + = against the field (electron drift). */
  function countCrossings(): void {
    const p = gas.positions;
    const mid = FOLD_NM / 2;
    for (let i = 0; i < ELECTRON_GAS.count; i++) {
      const x = p[3 * i]! % FOLD_NM;
      const x0 = prevX[i]!;
      if (Math.abs(x - x0) < FOLD_NM / 2) {
        if (x0 >= mid && x < mid) transfer++;
        else if (x0 < mid && x >= mid) transfer--;
      }
      prevX[i] = x;
    }
  }

  function trackHero(dt: number): void {
    const p = gas.positions;
    const k = 3 * hall.hero;
    v.set(p[k]!, p[k + 1]!, p[k + 2]!);
    // unwrap: the step is far below half a box
    const d = v.clone().sub(prev);
    d.set(
      d.x - BOX * Math.round(d.x / BOX),
      d.y - BOX * Math.round(d.y / BOX),
      d.z - BOX * Math.round(d.z / BOX),
    );
    hero.add(d);
    prev.copy(v);
    if (follow > 0) {
      follow -= dt;
      // the drone keeps the electron a little ahead of the camera, damped
      hall.centre.lerp(hero, Math.min(dt * 2.2, 1));
      if (follow <= 0) ui.set('follow2', false);
    }
  }

  /** The long trail: the unwrapped path of the electron, hung behind its current display position. */
  function updateTrail(at: Vector3): void {
    history.push(hero.clone());
    if (history.length > 150) history.shift();
    const pts = history.map((h) => h.clone().sub(hero).multiplyScalar(UNITS_PER_NM).add(at));
    trailLines[0] = { points: pts };
    trail.setLines(trailLines);
  }
};
