/**
 * Step 8 `ions-photons` — «Іони і світло: стрибки між рівнями». A hydrogen atom between a level diagram and a
 * photon gun. The gun fires photons of the chosen energy; the atom model (sim §3: `createHydrogenAtom`)
 * decides: absorbed (the cloud swells to a higher level), passed through, or ionised (the electron leaves).
 * 1,2 s later the atom falls back, emitting photons whose lines add up on the spectrum strip.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import { damp, toOverlay } from '@/engine/api';
import {
  createElectron,
  createFlash,
  createPhoton,
  createProton,
  createTrail,
  wavelengthToColor,
  type Photons,
} from '@/fx';
import { hud } from '@/hud';
import {
  GROUND_RESONANCES_EV,
  IONIZATION_EDGE_EV,
  MAX_LEVEL,
  PHOTON_ENERGY_RANGE_EV,
  createHydrogenAtom,
  photonWavelengthNm,
  sampleOrbital,
} from '@electricity/sim/atom';
import { K } from '@/style';
import { Text3D } from '@/text';
import { anchorWhen, qaProbe, type StepFactory } from './chapter';
import { hotspotName } from './content';
import { L } from './labels';
import { ProbabilityCloud } from './parts/cloud';
import { createLevelDiagram } from './parts/level-diagram';
import { MUZZLE_X, createPhotonGun } from './parts/photon-gun';
import { createSpectrumStrip } from './parts/spectrum-strip';

const ATOM = new Vector3(0.2, 0.9, 0);
const GUN = new Vector3(6.6, 0.9, 0);
const PHOTON_SPEED = 9;
const POOL = 18;
/** Cloud radius factor per level (visual: the cloud swells with n; true radii grow as n²). */
const swell = (n: number): number => 0.6 + 0.32 * (n - 1);

interface Flight {
  photon: Photons;
  tag: Text3D;
  active: boolean;
  age: number;
  life: number;
  origin: Vector3;
  dir: Vector3;
  /** Incoming shot: energy to hand to the atom on arrival (seconds left), else −1. */
  arrive: number;
  energy: number;
  quiet: boolean;
}

export const ionsPhotonsStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'ions-photons';
  const set = new Group();
  set.name = 'photon-lab';
  ctx.root.add(set);

  const proton = createProton({ radius: 0.3 });
  proton.position.copy(ATOM);
  const cloud = new ProbabilityCloud({ capacity: 2600, size: 0.1, intensity: 0.24 });
  cloud.setPoints(sampleOrbital('1s', 2600, 5));
  cloud.swirl = 0.25;
  cloud.position.copy(ATOM);
  toOverlay(cloud);
  const free = createElectron({ radius: 0.2 });
  const trail = createTrail(free, { color: 'cyan', duration: 0.5, width: 0.14 });
  const flash = createFlash({ size: 3.2, color: 'cyan', speed: 0.45 });
  flash.position.copy(ATOM);
  const gun = createPhotonGun();
  gun.group.position.copy(GUN);
  const grip = new Mesh(new SphereGeometry(1.5, 12, 8), K.flat('cyan'));
  grip.material.colorWrite = false;
  grip.material.depthWrite = false;
  gun.group.add(grip);
  const diagram = createLevelDiagram(ctx, MAX_LEVEL, L.photons.limit);
  diagram.surface.position.set(-5.7, 1.0, 0);
  diagram.surface.scale.multiplyScalar(0.92);
  const strip = createSpectrumStrip(ctx, { uv: L.photons.uv, ir: L.photons.ir, title: L.photons.spectrum });
  strip.surface.position.set(0.6, -4.7, 0.5);
  set.add(proton, cloud, free, trail, flash, gun.group, diagram.surface, strip.surface);

  const flights: Flight[] = Array.from({ length: POOL }, () => {
    const photon = createPhoton({ wavelength: 550, length: 1.5, amplitude: 0.14, width: 0.06 });
    const tag = new Text3D('', {
      font: 'bodyBold',
      size: 15,
      color: 'white',
      billboard: true,
      screenSpace: true,
      anchorX: 'center',
      anchorY: 'bottom',
    });
    tag.position.y = 0.3;
    photon.add(tag);
    toOverlay(tag);
    photon.visible = false;
    set.add(photon);
    return {
      photon,
      tag,
      active: false,
      age: 0,
      life: 1,
      origin: new Vector3(),
      dir: new Vector3(),
      arrive: -1,
      energy: 0,
      quiet: false,
    };
  });

  /* --------------------------------------------------------------------------------- model binding */
  const atom = createHydrogenAtom({ rng: ctx.random.fork('hydrogen') });
  const state = {
    spread: swell(1),
    bound: 1,
    shots: 0,
    kick: 0,
    hover: 0,
    freeAge: 99,
    freeIn: false,
    energy: PHOTON_ENERGY_RANGE_EV.default as number,
  };
  const freeDir = new Vector3();
  const launch = (nm: number, origin: Vector3, dir: Vector3, life: number): Flight | null => {
    const f = flights.find((x) => !x.active);
    if (!f) return null;
    const look = wavelengthToColor(nm);
    f.photon.setWavelength(nm);
    f.tag.text = look.band === 'uv' ? L.photons.uv : look.band === 'ir' ? L.photons.ir : '';
    f.tag.visible = look.band !== 'visible';
    f.active = true;
    f.age = 0;
    f.life = life;
    f.origin.copy(origin);
    f.dir.copy(dir).normalize();
    f.arrive = -1;
    f.photon.rotation.z = Math.atan2(f.dir.y, f.dir.x);
    return f;
  };
  const setLevel = (instant = false): void => {
    const level = atom.state.level;
    diagram.setLevel(level, instant);
    const bound = level === 'ionized' ? 0 : 1;
    const spread = level === 'ionized' ? state.spread * 1.6 : swell(level);
    ctx.tweens.to(state, { spread, bound }, { duration: instant ? 0 : 0.5, ease: 'back.out' });
    if (instant) Object.assign(state, { spread, bound });
  };
  const muzzle = new Vector3(GUN.x + MUZZLE_X, GUN.y, 0);
  const shoot = (offsetY = 0, delay = 0, quiet = false): void => {
    const origin = muzzle.clone().setY(muzzle.y + offsetY);
    const f = launch(photonWavelengthNm(state.energy), origin, new Vector3(-1, 0, 0), 2.2);
    if (!f) return;
    f.age = -delay;
    f.arrive = (origin.x - ATOM.x) / PHOTON_SPEED;
    f.energy = state.energy;
    f.quiet = quiet;
  };
  const fire = (count = 1): void => {
    state.shots += count;
    audio.play('zap', { gain: 0.45, pitch: 0.7 + state.energy / 16 });
    ctx.tweens
      .timeline()
      .to(state, { kick: 1 }, { duration: 0.06 })
      .to(state, { kick: 0 }, { duration: 0.35, ease: 'power2.out' });
    for (let i = 0; i < count; i++) shoot(count > 1 ? ((i % 5) - 2) * 0.16 : 0, i * 0.11, i > 0);
  };
  /** A photon reaches the atom: the model decides what happens. */
  const arrive = (f: Flight): void => {
    const result = atom.fire(f.energy);
    if (result.kind === 'passed') {
      if (!f.quiet) hud()?.toast(L.photons.passed, { icon: 'info', duration: 4.5, maxWidth: 520 });
      return; // flies on through the atom
    }
    f.active = false;
    f.photon.visible = false;
    flash.fire();
    audio.play(result.kind === 'ionized' ? 'spark' : 'success', { gain: 0.5 });
    if (result.kind === 'absorbed')
      diagram.transition(result.from, result.to, wavelengthToColor(photonWavelengthNm(f.energy)).color);
    else {
      diagram.transition(result.from, MAX_LEVEL + 1, 'cyan');
      // the freed electron leaves with E_k = E − 13,6 eV: faster for a harder photon
      freeDir.set(-0.75, 0.66, 0);
      state.freeAge = 0;
      state.freeIn = false;
      trail.reset();
    }
    setLevel();
  };

  ctx.input.register(grip, {
    tooltip: L.photons.gun,
    enabled: on,
    hover: (over) => ctx.tweens.to(state, { hover: over ? 1 : 0 }, { duration: 0.12 }),
    click: () => fire(),
  });

  /* ------------------------------------------------------------------------------- stage & step UI */
  ctx.camera.shots({
    photons: {
      position: [-0.5, 0.4, 21],
      target: [-0.5, -0.9, 0],
      frameAspect: 1.5,
      orbit: { azimuth: 0.25, polar: 0.15 },
    },
  });
  stage.define({
    'ions-photons': {
      show: [set],
      camera: 'photons',
      post: { bloomIntensity: 1.15 },
      enter() {
        atom.reset();
        setLevel(true);
        for (const f of flights) {
          f.active = false;
          f.photon.visible = false;
        }
        state.freeAge = 99;
        state.energy = ui.value<number>('photonE');
      },
    },
  });

  const resonances = [...GROUND_RESONANCES_EV, IONIZATION_EDGE_EV].map((e) => Math.round(e * 100) / 100);
  ui.define({
    'ions-photons': {
      hint: L.photons.hint,
      honesty: [{ slowed: 1e9 }, 'simplified'],
      controls: [
        {
          type: 'slider',
          id: 'photonE',
          label: L.photons.energy,
          ...PHOTON_ENERGY_RANGE_EV,
          value: PHOTON_ENERGY_RANGE_EV.default,
          unit: 'eV',
          digits: 2,
          // unlabelled notches at the resonances and the ionisation edge — to be found by feel (magnetic)
          marks: resonances.map((value) => ({ value, label: '' })),
          snaps: resonances,
          onChange: (v) => (state.energy = v),
        },
        {
          type: 'readout',
          id: 'lambda',
          label: L.photons.wavelength,
          unit: 'nm',
          digits: 1,
          get: () => photonWavelengthNm(state.energy),
        },
        {
          type: 'readout',
          id: 'level',
          label: L.photons.level,
          format: (v) => (v === 0 ? 'H⁺' : fmtNumber(v)),
          get: () => (atom.state.level === 'ionized' ? 0 : atom.state.level),
        },
        {
          type: 'readout',
          id: 'ek',
          label: L.photons.kinetic,
          unit: 'eV',
          digits: 2,
          get: () => atom.state.lastKineticEnergyEv ?? 0,
        },
        {
          type: 'button',
          id: 'fire',
          label: L.photons.fire,
          icon: 'lightning',
          primary: true,
          onClick: () => fire(),
        },
        { type: 'button', id: 'volley', label: L.photons.volley, onClick: () => fire(10) },
        {
          type: 'button',
          id: 'clearSpectrum',
          label: L.photons.clear,
          icon: 'resetView',
          onClick: () => strip.clear(),
        },
      ],
      callouts: [
        { anchor: [GUN.x, GUN.y + 1.1, 0], text: L.photons.gun, color: 'cyan', side: 'up' },
        {
          anchor: anchorWhen(ctx, () => on() && atom.state.level === 'ionized', proton),
          text: L.photons.ion,
          color: 'coral',
          side: 'down',
        },
      ],
      hotspots: [
        { anchor: [-3.6, 4.2, 0], title: hotspotName('ions-photons', 0) },
        { anchor: [6.3, -3.95, 0.5], title: hotspotName('ions-photons', 1) },
      ],
    },
  });
  qaProbe(ctx, 'photons.level', () => (atom.state.level === 'ionized' ? 0 : atom.state.level));
  qaProbe(ctx, 'photons.lines', () => strip.count());
  qaProbe(ctx, 'photons.shots', () => state.shots);
  qaProbe(ctx, 'photons.gun', () => GUN.clone());

  /* -------------------------------------------------------------------------------------- per frame */
  const out = new Vector3();
  return {
    update(dt, t) {
      // decays and recapture come from the model: every emitted photon flies off and marks the spectrum
      for (const ph of atom.step(dt)) {
        const look = wavelengthToColor(ph.wavelengthNm);
        const angle = ctx.random.range(0.5, 2.7) * (ctx.random.next() < 0.5 ? 1 : -1);
        launch(ph.wavelengthNm, ATOM, out.set(Math.cos(angle), Math.sin(angle), 0), 1.5);
        diagram.transition(Number.isFinite(ph.from) ? ph.from : MAX_LEVEL + 1, ph.to, look.color);
        strip.add(ph.wavelengthNm);
        audio.play('tick', { pitch: Math.min(0.5 + ph.energyEv / 6, 2.2), gain: 0.5 });
        if (!Number.isFinite(ph.from)) {
          state.freeAge = 0; // a new electron arrives from the edge of the frame
          state.freeIn = true;
          trail.reset();
        }
        setLevel();
      }
      for (const f of flights) {
        if (!f.active) continue;
        f.age += dt;
        f.photon.visible = f.age >= 0;
        if (f.age < 0) continue;
        f.photon.position.copy(f.origin).addScaledVector(f.dir, f.age * PHOTON_SPEED);
        f.photon.fade = Math.min(1, f.age / 0.08) * Math.min(1, Math.max(f.life - f.age, 0) / 0.3);
        if (f.arrive >= 0 && f.age >= f.arrive) {
          f.arrive = -1;
          arrive(f);
        }
        if (f.age >= f.life) {
          f.active = false;
          f.photon.visible = false;
        }
      }
      // cloud: swells with the level, dissolves when the atom is ionised
      cloud.spread = state.spread;
      cloud.intensity = 0.24 * Math.max(state.bound, 0);
      cloud.visible = state.bound > 0.02;
      proton.position.y = ATOM.y + Math.sin(t * 1.4) * 0.05;
      // the free electron: leaves after ionisation, returns at recapture
      state.freeAge += dt;
      const speed = 5 + 2.5 * Math.sqrt(atom.state.lastKineticEnergyEv ?? 0);
      const travel = state.freeIn ? Math.max(0.45 - state.freeAge, 0) * 22 : state.freeAge * speed;
      free.visible = trail.visible = state.freeIn ? state.freeAge < 0.45 : state.freeAge < 1.8;
      free.position.copy(ATOM).addScaledVector(freeDir, travel + 0.4);
      // gun: lens in the photon's colour, recoil, hover glow
      gun.lens.color.copy(wavelengthToColor(photonWavelengthNm(state.energy)).color);
      gun.kick = damp(gun.kick, Math.max(state.kick, 0.25 * state.hover), 20, dt);
      diagram.update(dt);
    },
  };
};
