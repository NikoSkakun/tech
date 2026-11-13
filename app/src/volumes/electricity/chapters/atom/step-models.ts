/**
 * Step 6 `models` — «Модель Бора проти квантової». Hydrogen twice: Bohr's electron running on the orbits
 * r_n = n²·a₀, and the quantum cloud that builds up from single "measurements" sampled from |ψ|² of the real
 * orbitals (sim §2: `createOrbitalCloud`; every dot flashes and fades in 6 s). One number — world units per
 * a₀ — scales rings, cloud and the a₀ sphere together, so the two models stay comparable.
 */
import { Group, Mesh, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { damp, toOverlay } from '@/engine/api';
import { RibbonLines, createElectron, createProton, createTrail } from '@/fx';
import {
  ORBITAL_POINTS_RANGE,
  bohrRadiusA0,
  createOrbitalCloud,
  orbitalQuantumNumbers,
  type OrbitalId,
} from '@electricity/sim/atom';
import { K } from '@/style';
import { anchorWhen, qaProbe, type StepFactory } from './chapter';
import { hotspotName } from './content';
import { L } from './labels';
import { ProbabilityCloud } from './parts/cloud';
import { createLevelDiagram } from './parts/level-diagram';

/** World units per Bohr radius: Bohr mode (orbits 1 : 4 : 9 fit the frame) and per shell in the quantum mode. */
const A0_BOHR = 0.58;
const A0_QUANTUM = [1.45, 0.5, 0.27] as const;
const FAMILIES = ['1s', '2s', '2p', '3s', '3p', '3d'] as const;
/** Id of the «Бор» item of the model / orbital tabs. */
const BOHR = 'bohr';
const ORIENTED: Record<string, readonly OrbitalId[]> = {
  '2p': ['2p_x', '2p_y', '2p_z'],
  '3p': ['3p_x', '3p_y', '3p_z'],
  '3d': ['3d_z2', '3d_xz', '3d_xy'],
};

export const modelsStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'models';
  const hydrogen = new Group();
  hydrogen.name = 'hydrogen-models';
  ctx.root.add(hydrogen);

  const proton = createProton({ radius: 0.3 });
  // Bohr: three orbits in a plane tilted toward the viewer, the electron with a trail
  const plane = new Group();
  plane.rotation.x = 1.12;
  const orbitMaterial = K.glow({ color: 'cyan.dark', intensity: 0.9, keepHue: true, whiten: 0 });
  const rings = [1, 2, 3].map((n) => {
    const ring = new Mesh(new TorusGeometry(bohrRadiusA0(n), 0.012 * n + 0.02, 8, 160), orbitMaterial);
    plane.add(ring);
    return ring;
  });
  const electron = createElectron({ radius: 0.24 });
  const trail = createTrail(electron, { color: 'cyan', duration: 0.7, width: 0.16, intensity: 1.2 });
  plane.add(electron, trail);

  // quantum: live cloud of measurements (sim coordinates have z as the axis → turn it upright)
  const sim = createOrbitalCloud({ orbital: '1s', targetCount: ORBITAL_POINTS_RANGE.default, seed: 11 });
  const cloud = new ProbabilityCloud({
    capacity: ORBITAL_POINTS_RANGE.max,
    size: 0.13,
    lifetime: 6,
    intensity: 1,
    flash: 'cyan.light',
  });
  cloud.rotation.x = -Math.PI / 2;
  toOverlay(cloud);
  const shell = new Group();
  const a0Glass = new Mesh(
    new SphereGeometry(1, 48, 32),
    K.glass({ color: 'mist', opacity: 0.02, edgeOpacity: 0.35, specular: 0.1 }),
  );
  const a0Ring = new RibbonLines({
    capacity: 130,
    color: 'mist',
    width: 0.03,
    dashRepeat: 3,
    dashStrength: 1,
    dashSpeed: 0.12,
  });
  a0Ring.setLines([
    {
      points: Array.from(
        { length: 96 },
        (_, i) => new Vector3(Math.cos((i / 96) * 6.2832), Math.sin((i / 96) * 6.2832), 0),
      ),
      closed: true,
    },
  ]);
  shell.add(a0Glass, a0Ring);
  hydrogen.add(proton, plane, cloud, shell);

  const diagram = createLevelDiagram(ctx, 3, L.photons.limit);
  diagram.surface.position.set(6.9, 0.2, 0);
  diagram.surface.scale.multiplyScalar(0.85);
  hydrogen.add(diagram.surface);

  /* ------------------------------------------------------------------------------------------ state */
  // quantum 0…1 follows the model switch; a0 (world units per a₀) eases with it and with the shell
  const state = {
    quantum: 0,
    a0: A0_BOHR,
    n: 1,
    radius: 1,
    angle: 0,
    orbital: '1s' as OrbitalId,
    samples: ORBITAL_POINTS_RANGE.default as number,
  };
  const isQuantum = (): boolean => state.quantum > 0.5;
  const orbital = (): OrbitalId => {
    const family = ui.value<string>('orbital');
    if (family === BOHR) return state.orbital; // Bohr model on screen: keep the last orbital
    const list = ORIENTED[family];
    return list ? list[Number(ui.value<string>('orient'))]! : (family as OrbitalId);
  };
  const applyOrbital = (): void => {
    state.orbital = orbital();
    sim.set({ orbital: state.orbital, targetCount: state.samples });
  };
  const setModel = (quantum: boolean, instant = false): void => {
    ctx.tweens.to(state, { quantum: quantum ? 1 : 0 }, { duration: instant ? 0 : 1.5, ease: 'power2.inOut' });
    if (instant) state.quantum = quantum ? 1 : 0;
    if (!quantum) trail.reset();
  };
  const jump = (n: number, instant = false): void => {
    const from = state.n;
    state.n = n;
    diagram.setLevel(n, instant);
    if (instant || from === n) return;
    // up = absorbs energy (arrow in the electron's colour), down = emits (photon yellow)
    diagram.transition(from, n, n > from ? 'cyan' : 'yellow');
    audio.play(n > from ? 'whooshUp' : 'whooshDown', { gain: 0.35 });
  };

  /* ------------------------------------------------------------------------------- stage & step UI */
  ctx.camera.shots({
    models: {
      position: [1.3, 2.4, 19.5],
      target: [1.3, 0, 0],
      frameAspect: 1.45,
      orbit: { azimuth: 0.6, polar: 0.35 },
    },
  });
  stage.define({
    models: {
      show: [hydrogen],
      camera: 'models',
      post: { bloomIntensity: 1.1 },
      enter(info) {
        setModel(ui.value<string>('orbital') !== BOHR, true);
        state.samples = ui.value<number>('samples');
        applyOrbital();
        jump(ui.value<number>('level'), true);
        state.radius = bohrRadiusA0(state.n);
        if (info.instant)
          state.a0 = isQuantum() ? A0_QUANTUM[orbitalQuantumNumbers(state.orbital).n - 1]! : A0_BOHR;
      },
    },
  });

  const v = new Vector3();
  const ringPoint = (n: number) => (): Vector3 =>
    plane.localToWorld(v.set(Math.cos(2.2) * n * n, Math.sin(2.2) * n * n, 0));
  const is1s = (): boolean => on() && isQuantum() && state.orbital === '1s';
  ui.define({
    models: {
      hint: L.models.hint,
      honesty: ['notToScale'],
      controls: [
        {
          type: 'slider',
          id: 'level',
          label: L.models.level,
          min: 1,
          max: 3,
          value: 1,
          stops: [1, 2, 3],
          onChange: (n) => jump(n),
        },
        {
          type: 'segmented',
          id: 'orbital',
          label: `${L.models.model}: ${L.models.bohr} | ${L.models.quantum} (${L.models.orbital})`,
          // one control for «Бор | Квантова» and the orbital tabs: the dock has no room for both at 720p
          items: [{ id: BOHR, label: L.models.bohr }, ...FAMILIES.map((id) => ({ id, label: id }))],
          value: BOHR,
          onChange: (id) => {
            audio.play('toggle');
            setModel(id !== BOHR);
            if (id !== BOHR) applyOrbital();
          },
        },
        {
          type: 'segmented',
          id: 'orient',
          label: L.models.orientation,
          items: [
            { id: '0', label: 'pₓ · d_z²' },
            { id: '1', label: 'p_y · d_xz' },
            { id: '2', label: 'p_z · d_xy' },
          ],
          value: '2',
          onChange: applyOrbital,
        },
        {
          type: 'slider',
          id: 'samples',
          label: L.models.samples,
          min: ORBITAL_POINTS_RANGE.min,
          max: ORBITAL_POINTS_RANGE.max,
          value: ORBITAL_POINTS_RANGE.default,
          scale: 'log',
          step: 2,
          onChange: (n) => {
            state.samples = n;
            sim.set({ targetCount: n });
          },
        },
      ],
      callouts: [
        { anchor: proton, text: L.models.nucleus, color: 'coral', side: 'down' },
        ...[1, 2, 3].map((n) => ({
          anchor: anchorWhen(ctx, () => on() && !isQuantum(), ringPoint(n)),
          text: `${L.models.orbit}${n}`,
          color: 'cyan' as const,
          side: 'left' as const,
        })),
        {
          anchor: anchorWhen(ctx, is1s, () => v.set(0.71 * state.a0, 0.71 * state.a0, 0)),
          text: L.models.a0,
          color: 'mist',
          side: 'right',
        },
      ],
      hotspots: [
        {
          anchor: anchorWhen(
            ctx,
            () => on() && isQuantum() && state.orbital !== '1s',
            () => (state.orbital === '2s' ? v.set(2 * state.a0, 0, 0) : v.set(0.6, -0.6, 0)),
          ),
          title: hotspotName('models', 0),
        },
        {
          anchor: anchorWhen(ctx, is1s, () => v.set(-0.71 * state.a0, 0.71 * state.a0, 0)),
          title: hotspotName('models', 1),
        },
      ],
    },
  });
  qaProbe(ctx, 'models.points', () => sim.count());
  qaProbe(ctx, 'models.orbital', () => state.orbital);
  qaProbe(ctx, 'models.n', () => state.n);

  /* -------------------------------------------------------------------------------------- per frame */
  let a0Shown = 0;
  return {
    update(dt, t) {
      const q = state.quantum;
      const shellN = orbitalQuantumNumbers(state.orbital).n;
      state.a0 = damp(state.a0, A0_BOHR + (A0_QUANTUM[shellN - 1]! - A0_BOHR) * q, 4, dt);
      plane.scale.setScalar(state.a0);
      proton.position.y = Math.sin(t * 1.4) * 0.04;

      // Bohr electron: jumps between orbits, slower on the outer ones (ω ∝ n^-1.5 for the eye; Bohr: n^-3)
      state.radius = damp(state.radius, bohrRadiusA0(state.n), 9, dt);
      state.angle += (2.6 / state.n ** 1.5) * dt;
      electron.position.set(Math.cos(state.angle) * state.radius, Math.sin(state.angle) * state.radius, 0);
      electron.scale.setScalar(Math.max((1 - q) / state.a0, 1e-3)); // "smears out" into the cloud
      electron.visible = trail.visible = q < 0.98;
      orbitMaterial.fade = 1 - q;
      for (const ring of rings) ring.visible = q < 0.99;

      // quantum cloud: one new dot per measurement, N/6 per second
      cloud.visible = q > 0.01;
      if (cloud.visible) {
        sim.step(dt);
        cloud.sync(sim.positions, sim.ages);
        cloud.fade = q;
        cloud.spread = state.a0;
        cloud.intensity = 0.8 * Math.sqrt(ORBITAL_POINTS_RANGE.default / state.samples);
      }
      a0Shown = damp(a0Shown, is1s() ? 1 : 0, 6, dt);
      shell.visible = a0Shown > 0.02;
      shell.scale.setScalar(state.a0 * Math.max(a0Shown, 1e-3));
      a0Ring.quaternion.copy(ctx.camera.camera.quaternion);
      diagram.update(dt);
    },
  };
};
