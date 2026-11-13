/**
 * Step 5 `electron` — «Електрон». The hero electron character with its spin ring on the left; on the right a
 * toy balance with one proton on the left pan. Scoops pour electrons onto the right pan: the beam follows
 * θ = θ_max·clamp((N − 1836)/1836, −1, 1) (sim `electronBalance`) and levels at exactly 1836. «Порівняти
 * заряди» turns it into a charge balance: one proton against one electron is level at once.
 */
import { ConeGeometry, Group, Mesh, TorusGeometry } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import { damp, toOverlay } from '@/engine/api';
import { createElectron, createFlash, createOrbs, createParticles, createProton, pointEmitter } from '@/fx';
import { hud } from '@/hud';
import { BALANCE_ELECTRONS, electronBalance } from '@electricity/sim/atom';
import { K } from '@/style';
import { Label, Panel, worldSurface } from '@/ui3d';
import { anchorWhen, qaProbe, type StepFactory } from './chapter';
import { hotspotName } from './content';
import { L } from './labels';
import { PAN_RADIUS, PIVOT_Y, createScales } from './parts/scales';

const MAX_TILT = 0.26;
/** The pile holds what three «+1000» scoops can pour; more is refused. */
const PILE_LAYERS = 13;
const PER_LAYER = 230;
const CAPACITY = PILE_LAYERS * PER_LAYER;
const GRAIN = 0.07;

export const electronStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'electron';
  const set = new Group();
  set.name = 'electron-set';
  ctx.root.add(set);

  // hero electron with the spin ring: a thin tilted ring whose arrowhead runs around it
  const hero = createElectron({ radius: 1.05 });
  const spin = new Group();
  const ringMaterial = K.glow({ color: 'cyan.light', intensity: 1.1, keepHue: true });
  const ring = new Mesh(new TorusGeometry(1.95, 0.03, 8, 120), ringMaterial);
  const head = new Mesh(new ConeGeometry(0.15, 0.46, 20), ringMaterial);
  head.position.set(1.95, 0, 0);
  spin.add(ring, head);
  const spinTilt = new Group();
  spinTilt.rotation.set(1.2, 0, 0.32);
  spinTilt.add(spin);
  const electron = new Group();
  electron.position.set(-4.3, 0.9, 0);
  electron.add(hero, spinTilt);

  const scales = createScales();
  scales.group.position.set(3.6, -3.4, 0);
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
  pour.position.set(3.6 + 2.5, 1.9, 0);
  const flash = createFlash({ size: 6, color: 'green', speed: 0.7 });
  flash.position.set(3.6, -3.4 + PIVOT_Y, 0.5);

  // counter above the balance
  const counter = worldSurface(ctx, { width: 230, height: 84, unit: 0.02, name: 'electron-counter' });
  const count = new Label('0', { font: 'mono', size: 36, color: 'cyan', nowrap: true, reserve: 8 });
  counter.root.add(
    new Panel({
      variant: 'card',
      width: 230,
      height: 84,
      dir: 'col',
      align: 'center',
      justify: 'center',
      gap: 2,
      children: [new Label(L.electron.count, { size: 16, color: 'mist', nowrap: true }), count],
    }),
  );
  counter.position.set(3.6, 2.6, 0);
  toOverlay(flash);
  set.add(electron, scales.group, pour, flash, counter);

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
    if (isCharge()) {
      ui.set('compare', false);
      setCharge(false);
    }
    const next = Math.min(state.count + n, CAPACITY);
    if (next === state.count) return;
    state.count = next;
    state.celebrated = false;
    audio.play('tick', { pitch: 1 + Math.min(n, 1000) / 2000 });
    pour.emit(Math.min(8 + Math.round(n / 8), 130), { speed: 3.5 });
  };
  const reset = (): void => {
    state.count = 0;
    state.celebrated = false;
    audio.play('click');
  };
  const setCharge = (onNow: boolean, instant = false): void => {
    ctx.tweens.to(state, { charge: onNow ? 1 : 0 }, { duration: instant ? 0 : 0.5, ease: 'power2.inOut' });
    if (instant) state.charge = onNow ? 1 : 0;
  };
  ctx.input.register(hero, {
    tooltip: L.electron.hero,
    enabled: on,
    hover: (over) => ctx.tweens.to(state, { hover: over ? 1 : 0 }, { duration: 0.12 }),
  });
  ctx.input.register(scales.group, { tooltip: L.electron.scales, enabled: on });

  /* ------------------------------------------------------------------------------- stage & step UI */
  ctx.camera.shots({
    electron: {
      position: [0, 0.9, 17],
      target: [0, -0.5, 0],
      frameAspect: 1.45,
      orbit: { azimuth: 0.35, polar: 0.2 },
    },
  });
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
        { anchor: head, text: L.electron.spin, color: 'cyan', side: 'up' },
        {
          anchor: anchorWhen(ctx, () => on() && isCharge(), proton),
          text: L.electron.charges,
          color: 'green',
          side: 'up',
        },
      ],
      hotspots: [
        {
          anchor: () => spinTilt.localToWorld(spin.position.clone().set(-1.95, 0, 0)),
          title: hotspotName('electron', 0),
        },
        {
          anchor: () => electron.position.clone().setY(electron.position.y - 1.5),
          title: hotspotName('electron', 1),
        },
      ],
    },
  });
  qaProbe(ctx, 'electron.count', () => state.count);
  qaProbe(ctx, 'electron.angle', () => state.angle);

  /* -------------------------------------------------------------------------------------- per frame */
  return {
    update(dt, t) {
      electron.position.y = 0.9 + Math.sin(t * 1.3) * 0.18;
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
        hud()?.toast(L.electron.balanced, { icon: 'check', tone: 'ok', duration: 6 });
      }
      const text = isCharge() ? '1' : fmtNumber(Math.round(state.shown));
      if (text !== state.text) count.text = state.text = text;
    },
  };
};
