/**
 * Step 5 `electron` — «Електрон». The hero electron character with its spin ring on the left; on the right a
 * toy balance with one proton on the left pan. Scoops pour electrons onto the right pan: the beam follows
 * θ = θ_max·clamp((N − 1836)/1836, −1, 1) (sim `electronBalance`) and levels at exactly 1836. «Порівняти
 * заряди» turns it into a charge balance: one proton against one electron is level at once.
 */
import { ConeGeometry, Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import { damp, toOverlay } from '@/engine/api';
import { createElectron, createFlash, createOrbs, createParticles, createProton, pointEmitter } from '@/fx';
import { BALANCE_ELECTRONS, electronBalance } from '@electricity/sim/atom';
import { K } from '@/style';
import { Label } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { formula } from '../content';
import { L } from '../labels';
import { createConsole } from '../parts/console';
import { PAN_RADIUS, PIVOT_Y, createScales } from '../parts/scales';
import { createScoops } from '../parts/scoops';

const MAX_TILT = 0.26;
/** The pile holds what three «+1000» scoops can pour; more is refused. */
const PILE_LAYERS = 13;
const PER_LAYER = 230;
const CAPACITY = PILE_LAYERS * PER_LAYER;
const GRAIN = 0.07;
/** Hero electron (left) and balance (right): the two halves of the frame. */
const HERO = { x: -3.5, y: 0.75, radius: 1.3, ring: 2.25 };
const SCALES = { x: 2.7, y: -3.5 };
/** Horizontal distance from the pivot to a pan (`parts/scales.ts`). */
const ARM = 2.5;
/** Electrons per scoop — the three buttons of the document: +1, +100, +1000. */
const SCOOPS = [1, 100, 1000] as const;

export const electronStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'electron';
  const set = new Group();
  set.name = 'electron-set';
  ctx.root.add(set);

  // hero electron with the spin ring: a thin tilted ring whose arrowhead runs around it
  const hero = createElectron({ radius: HERO.radius });
  const spin = new Group();
  const ringMaterial = K.glow({ color: 'cyan.light', intensity: 1.1, keepHue: true });
  const ring = new Mesh(new TorusGeometry(HERO.ring, 0.035, 8, 120), ringMaterial);
  const head = new Mesh(new ConeGeometry(0.19, 0.56, 20), ringMaterial);
  head.position.set(HERO.ring, 0, 0);
  spin.add(ring, head);
  const spinTilt = new Group();
  spinTilt.rotation.set(1.2, 0, 0.32);
  spinTilt.add(spin);
  const electron = new Group();
  electron.position.set(HERO.x, HERO.y, 0);
  electron.add(hero, spinTilt);

  const scales = createScales();
  scales.group.position.set(SCALES.x, SCALES.y, 0);
  const proton = createProton({ radius: 0.72 });
  proton.position.y = 0.72;
  scales.left.add(proton);
  // the heap: a rounded cone of small electron characters filling up layer by layer
  const pile = createOrbs({ kind: 'electron', count: CAPACITY, radius: GRAIN, halo: false });
  for (let i = 0; i < CAPACITY; i++) {
    const layer = Math.floor(i / PER_LAYER);
    const j = i % PER_LAYER;
    const r = PAN_RADIUS * 0.84 * (1 - 0.055 * layer) * Math.sqrt((j + 0.5) / PER_LAYER);
    const a = j * 2.39996 + layer * 0.7;
    pile.setPosition(i, Math.cos(a) * r, GRAIN * (0.8 + layer * 1.45), Math.sin(a) * r);
  }
  pile.commit();
  pile.instances = 0;
  const single = createElectron({ radius: 0.72 });
  single.position.y = 0.72;
  scales.right.add(pile, single);
  const pour = createParticles(ctx, {
    count: 220,
    loop: false,
    emitter: pointEmitter([0, 0, 0], { axis: [0, -1, 0], spread: 0.22 }),
    sprite: 'soft',
    color: ['white', 'cyan'],
    life: [0.45, 0.75],
    speed: [2.5, 4.5],
    gravity: [0, -7, 0],
    size: [0.2, 0.12],
    intensity: 1.6,
  });
  // the scoops hang in a row over the right pan, small to large
  const scoops = createScoops([
    [SCALES.x + ARM - 1.15, 1.7, 0.2],
    [SCALES.x + ARM - 0.3, 2.1, 0],
    [SCALES.x + ARM + 0.8, 2.6, -0.2],
  ]);
  const flash = createFlash({ size: 6, color: 'green', speed: 0.7 });
  flash.position.set(SCALES.x, SCALES.y + PIVOT_Y, 0.5);

  // counter above the balance
  const count = new Label('0', { font: 'mono', size: 40, color: 'cyan', nowrap: true, reserve: 8 });
  const counter = createConsole(ctx, {
    name: 'electron-counter',
    twin: true, // the dock's «Електронів на шальці» readout
    width: 204,
    unit: 0.0195,
    top: [SCALES.x - 1.7, 4.35, 0],
    children: [new Label(L.electron.count, { size: 15, color: 'mist', nowrap: true }), count],
  });
  toOverlay(flash);
  set.add(electron, scales.group, scoops.model.group, pour, flash, counter.surface);

  /* ------------------------------------------------------------------------------------ interaction */
  const state = {
    count: 0,
    shown: 0,
    charge: 0,
    angle: MAX_TILT,
    velocity: 0,
    celebrated: false,
    hover: 0,
    text: '',
  };
  const isCharge = (): boolean => state.charge > 0.5;
  const add = (n: number): void => {
    const scoop = SCOOPS.indexOf(n as (typeof SCOOPS)[number]);
    if (isCharge()) {
      ui.set('compare', false);
      setCharge(false);
    }
    const next = Math.min(state.count + n, CAPACITY);
    if (next === state.count) return;
    state.count = next;
    state.celebrated = false;
    audio.play('tick', { pitch: 1 + Math.min(n, 1000) / 2000 });
    // the stream leaves the brim of the scoop that was used, a moment after it starts to tip
    scoops.tip(scoop);
    scoops.model.anchors[`scoop${scoop}.brim`]!.getWorldPosition(pour.position);
    pour.position.y -= 0.25;
    stage.scope.delay(0.18, () => pour.emit(Math.min(8 + Math.round(n / 8), 130), { speed: 3.5 }));
  };
  const reset = (): void => {
    state.count = 0;
    state.celebrated = false;
    audio.play('click');
  };
  const setCharge = (onNow: boolean, instant = false): void => {
    if (instant) state.charge = onNow ? 1 : 0;
    else stage.scope.to(state, { charge: onNow ? 1 : 0 }, { duration: 0.5, ease: 'power2.inOut' });
  };
  ctx.input.register(hero, {
    tooltip: L.electron.hero,
    enabled: on,
    hover: (over) => stage.scope.to(state, { hover: over ? 1 : 0 }, { duration: 0.12 }),
  });
  ctx.input.register(scales.group, { tooltip: L.electron.scales, enabled: on });
  const scoopLabels = [L.electron.add1, L.electron.add100, L.electron.add1000];
  scoops.cups.forEach((cup, i) =>
    ctx.input.register(cup, {
      tooltip: scoopLabels[i],
      cursor: 'pointer',
      enabled: on,
      click: () => add(SCOOPS[i]!),
    }),
  );

  /* ------------------------------------------------------------------------------- stage & step UI */
  stage.define({
    electron: {
      show: [set],
      params: { scaleExp: -18 },
      camera: 'electron',
      enter(info) {
        state.charge = ui.value<boolean>('compare') ? 1 : 0;
        if (info.instant) {
          state.shown = state.count;
          state.angle = state.charge > 0.5 ? 0 : -electronBalance(state.count, MAX_TILT).tiltRad;
          state.velocity = 0;
        }
      },
    },
  });

  const spinPoint = new Vector3();
  ui.define({
    electron: {
      hint: L.electron.hint,
      honesty: ['illustrative', 'simplified'],
      controls: [
        {
          type: 'toggle',
          id: 'compare',
          label: L.electron.compare,
          value: false,
          onChange: (v) => {
            audio.play('toggle');
            setCharge(v);
          },
        },
        {
          type: 'readout',
          id: 'onPan',
          label: L.electron.count,
          digits: 0,
          get: () => (isCharge() ? 1 : Math.round(state.shown)),
          color: (v) => (v === BALANCE_ELECTRONS ? 'green' : 'cyan'),
        },
        { type: 'button', id: 'add1', label: L.electron.add1, onClick: () => add(1) },
        { type: 'button', id: 'add100', label: L.electron.add100, onClick: () => add(100) },
        { type: 'button', id: 'add1000', label: L.electron.add1000, primary: true, onClick: () => add(1000) },
        { type: 'button', id: 'resetPan', label: L.electron.reset, icon: 'resetView', onClick: reset },
      ],
      callouts: [
        {
          // the top of the spin ring, clear of the electron's face
          anchor: () => spinTilt.localToWorld(spinPoint.set(0, HERO.ring, 0)),
          text: L.electron.spin,
          color: 'cyan',
          side: 'up',
        },
        {
          anchor: [HERO.x, HERO.y - HERO.radius - 0.9, 0],
          text: formula('electron', 0),
          color: 'cyan',
          side: 'down',
        },
        { anchor: proton, text: L.electron.charges, color: 'green', side: 'up', visible: isCharge },
      ],
      hotspots: [
        {
          anchor: () => spinTilt.localToWorld(spin.position.clone().set(-HERO.ring, 0, 0)),
          content: 'spin-arrow',
        },
        {
          anchor: () => electron.position.clone().setX(electron.position.x - HERO.radius * 0.8),
          content: 'electron-glow',
        },
      ],
    },
  });
  // the body of the middle scoop, a little under its brim
  ctx.qa.probe('electron.scoop', () => scoops.cups[1]!.getWorldPosition(new Vector3()).setY(1.85));
  ctx.qa.expose('electron', () => ({ count: state.count, angle: state.angle, charge: state.charge }));

  /* -------------------------------------------------------------------------------------- per frame */
  return {
    update(dt, t) {
      electron.position.y = HERO.y + Math.sin(t * 1.3) * 0.18;
      scoops.update(dt, t);
      counter.pin();
      spin.rotation.z = t * 0.9;
      hero.intensity = 1.12 + 0.5 * state.hover + Math.sin(t * 4) * 0.04;
      hero.glow = 1 + state.hover;

      // the heap grows as the stream lands: ease the shown count toward the real one
      const rate = Math.max(Math.abs(state.count - state.shown) * 4, 30);
      const step =
        Math.sign(state.count - state.shown) * Math.min(Math.abs(state.count - state.shown), rate * dt);
      state.shown += step;
      const mass = 1 - state.charge;
      pile.instances = Math.round(state.shown);
      pile.visible = mass > 0.02 && pile.instances > 0;
      pile.scale.setScalar(Math.max(mass, 1e-3));
      single.visible = state.charge > 0.02;
      single.scale.setScalar(Math.max(state.charge, 1e-3));

      // beam: a damped spring toward the tilt of the balance model (level in the charge comparison)
      const balance = electronBalance(state.shown, MAX_TILT);
      const target = -balance.tiltRad * mass;
      state.velocity += ((target - state.angle) * 38 - state.velocity * 5.5) * dt;
      state.angle += state.velocity * dt;
      scales.tilt = state.angle;
      const level = (isCharge() || balance.balanced) && Math.abs(state.angle) < 0.02;
      scales.lamp.intensity = damp(scales.lamp.intensity, level ? 1.8 : 0.25, 8, dt);
      if (!isCharge() && state.count === BALANCE_ELECTRONS && balance.balanced && !state.celebrated) {
        state.celebrated = true;
        flash.fire();
        audio.play('success');
        ui.toast(L.electron.balanced, { icon: 'check', tone: 'ok', duration: 6 });
      }
      const text = isCharge() ? '1' : fmtNumber(Math.round(state.shown));
      if (text !== state.text) count.text = state.text = text;
    },
  };
};
