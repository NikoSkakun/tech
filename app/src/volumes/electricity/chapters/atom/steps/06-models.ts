/**
 * Step 6 `models` — «Модель Бора проти квантової». Hydrogen twice: Bohr's electron running on the orbits
 * r_n = n²·a₀, and the quantum cloud that builds up from single "measurements" sampled from |ψ|² of the real
 * orbitals (sim §2: `createOrbitalCloud`; every dot flashes and fades in 6 s). One number — world units per
 * a₀ — scales rings, cloud, axes and the a₀ sphere together, so the two models stay comparable.
 */
import { Group, Mesh, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { damp, toOverlay } from '@/engine/api';
import { RibbonLines, createElectron, createProbabilityCloud, createProton, createTrail } from '@/fx';
import {
  ORBITAL_POINTS_RANGE,
  bohrRadiusA0,
  createOrbitalCloud,
  levelEnergyEv,
  orbitalQuantumNumbers,
  type OrbitalId,
} from '@electricity/sim/atom';
import { K } from '@/style';
import { Text3D } from '@/text';
import type { StepFactory } from '../chapter';
import { formula } from '../content';
import { L } from '../labels';
import { createLevelDiagram } from '../parts/level-diagram';
import { nodalPoint, type NodalPoint } from '../sim-bindings/nodal';

/** World units per Bohr radius: Bohr mode (orbits 1 : 4 : 9 fit the frame) and per shell in the quantum mode. */
const A0_BOHR = 0.5;
const A0_QUANTUM = [1.45, 0.5, 0.24] as const;
/**
 * Dot size and brightness per shell. The same number of measurements fills a volume ∝ n⁶, so the outer shells
 * get larger, dimmer dots: the cloud reads as a dense haze instead of scattered sparks.
 */
const DOT_SIZE = [0.13, 0.17, 0.21] as const;
const DOT_GLOW = [1, 0.8, 0.58] as const;
/** Half-length of the x / y / z axes drawn through the nucleus, world units (the same for every shell). */
const AXIS = 3.9;
const FAMILIES = ['1s', '2s', '2p', '3s', '3p', '3d'] as const;
/** Orbitals of a family by the item id of its orientation tabs. */
const ORIENTED: Record<string, Record<string, OrbitalId>> = {
  '2p': { x: '2p_x', y: '2p_y', z: '2p_z' },
  '3p': { x: '3p_x', y: '3p_y', z: '3p_z' },
  '3d': { z2: '3d_z2', xz: '3d_xz', xy: '3d_xy' },
};
const circle = (segments: number): Vector3[] =>
  Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return new Vector3(Math.cos(a), Math.sin(a), 0);
  });

export const modelsStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const hydrogen = new Group();
  hydrogen.name = 'hydrogen-models';
  // the atom sits left of centre: the level diagram stands on its right
  const ATOM_X = -1.5;
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

  // quantum: live cloud of measurements. The sim's z axis (the orbital's axis) is turned upright:
  // sim (x, y, z) → world (x, z, −y), so the picture plane is the sim's x–z plane.
  const sim = createOrbitalCloud({ orbital: '1s', targetCount: ORBITAL_POINTS_RANGE.default, seed: 11 });
  const cloud = createProbabilityCloud({
    capacity: ctx.quality.count(ORBITAL_POINTS_RANGE.max, ORBITAL_POINTS_RANGE.default),
    size: DOT_SIZE[0],
    lifetime: 6,
    intensity: 1,
    flash: 'cyan',
  });
  cloud.rotation.x = -Math.PI / 2;
  toOverlay(cloud);

  // dashed circles that always face the camera: the a₀ sphere of 1s and the nodal sphere of 2s / 3s
  const dashed = (): RibbonLines => {
    const line = new RibbonLines({
      capacity: 130,
      color: 'mist',
      width: 0.03,
      dashRepeat: 3,
      dashStrength: 1,
      dashSpeed: 0.12,
    });
    line.setLines([{ points: circle(96), closed: true }]);
    return line;
  };
  const shell = new Group();
  const a0Glass = new Mesh(
    new SphereGeometry(1, 48, 32),
    K.glass({ color: 'mist', opacity: 0.02, edgeOpacity: 0.35, specular: 0.1 }),
  );
  const a0Ring = dashed();
  shell.add(a0Glass, a0Ring);
  const nodeRing = dashed();
  // x / y / z axes of the orbitals (unit length; scaled to the shell): they make «уздовж x / y / z» readable
  const axes = new Group();
  const axisLines = new RibbonLines({
    capacity: 12,
    color: 'mist',
    width: 0.03,
    dashStrength: 0,
    intensity: 0.7,
    blend: 'normal',
  });
  const AXES = [
    { name: 'x', dir: new Vector3(1, 0, 0) },
    { name: 'y', dir: new Vector3(0, 0, -1) }, // the sim's y axis points away from the viewer
    { name: 'z', dir: new Vector3(0, 1, 0) },
  ];
  axisLines.setLines(
    AXES.map(({ dir }) => ({
      points: [dir.clone().multiplyScalar(-AXIS), dir.clone().multiplyScalar(AXIS)],
    })),
  );
  const axisLabels = AXES.map(({ name, dir }) => {
    const label = new Text3D(name, {
      font: 'mono',
      size: 0.42,
      color: 'mist',
      anchorX: 'center',
      anchorY: 'middle',
      billboard: true,
    });
    label.position.copy(dir).multiplyScalar(AXIS + 0.4);
    toOverlay(label);
    return label;
  });
  axes.add(axisLines);
  const atom = new Group();
  atom.position.x = ATOM_X;
  atom.add(proton, plane, cloud, shell, nodeRing, axes, ...axisLabels);
  hydrogen.add(atom);

  const diagram = createLevelDiagram(ctx, {
    name: 'models-levels',
    levels: 3,
    limitText: L.photons.limit,
    top: [6.75, 4.4, 0],
    unit: 0.0226,
  });
  hydrogen.add(diagram.console.surface);

  /* ------------------------------------------------------------------------------------------ state */
  // quantum 0…1 follows the model switch; a0 (world units per a₀) eases with it and with the shell
  const state = {
    quantum: 0,
    a0: A0_BOHR,
    n: 1,
    radius: 1,
    angle: 0,
    orbital: '1s' as OrbitalId,
    node: null as NodalPoint | null,
    samples: ORBITAL_POINTS_RANGE.default as number,
  };
  const wantsQuantum = (): boolean => ui.value<string>('model') === 'quantum';
  const family = (): string => ui.value<string>('orbital');
  const orbital = (): OrbitalId => {
    const oriented = ORIENTED[family()];
    if (!oriented) return family() as OrbitalId;
    return oriented[ui.value<string>(family() === '3d' ? 'orientD' : 'orientP')]!;
  };
  const applyOrbital = (): void => {
    state.orbital = orbital();
    state.node = nodalPoint(state.orbital);
    sim.set({ orbital: state.orbital, targetCount: state.samples });
  };
  const setModel = (quantum: boolean, instant = false): void => {
    if (instant) state.quantum = quantum ? 1 : 0;
    else stage.scope.to(state, { quantum: quantum ? 1 : 0 }, { duration: 1.5, ease: 'power2.inOut' });
    if (!quantum) trail.reset();
  };
  /** Level shown on the diagram: the Bohr orbit, or the shell of the orbital on screen. */
  const jump = (n: number, instant = false): void => {
    const from = state.n;
    state.n = n;
    diagram.setLevel(n, instant);
    if (instant || from === n) return;
    // up = absorbs energy (arrow in the electron's colour), down = emits (photon yellow)
    diagram.transition(from, n, n > from ? 'cyan' : 'yellow');
    audio.play(n > from ? 'whooshUp' : 'whooshDown', { gain: 0.35 });
  };
  const sync = (instant = false): void => {
    applyOrbital();
    jump(wantsQuantum() ? orbitalQuantumNumbers(state.orbital).n : ui.value<number>('level'), instant);
  };

  /* ------------------------------------------------------------------------------- stage & step UI */
  stage.define({
    models: {
      show: [hydrogen],
      camera: 'models',
      post: { bloomIntensity: 1.1 },
      enter(info) {
        setModel(wantsQuantum(), true);
        state.samples = ui.value<number>('samples');
        sync(true);
        state.radius = bohrRadiusA0(state.n);
        if (info.instant)
          state.a0 = wantsQuantum() ? A0_QUANTUM[orbitalQuantumNumbers(state.orbital).n - 1]! : A0_BOHR;
      },
    },
  });

  const v = new Vector3();
  const ringPoint = (n: number) => (): Vector3 =>
    plane.localToWorld(v.set(Math.cos(2.2) * n * n, Math.sin(2.2) * n * n, 0));
  const isQuantum = (): boolean => state.quantum > 0.5;
  const is1s = (): boolean => isQuantum() && state.orbital === '1s';
  const pick = (): void => {
    audio.play('toggle');
    sync();
  };
  ui.define({
    models: {
      hint: L.models.hint,
      honesty: ['notToScale'],
      controls: [
        {
          type: 'segmented',
          id: 'model',
          label: L.models.model,
          items: [
            { id: 'bohr', label: L.models.bohr },
            { id: 'quantum', label: L.models.quantum },
          ],
          value: 'bohr',
          onChange: (id) => {
            audio.play('toggle');
            setModel(id === 'quantum');
            sync();
          },
        },
        {
          type: 'slider',
          id: 'level',
          label: L.models.level,
          min: 1,
          max: 3,
          value: 1,
          stops: [1, 2, 3],
          visible: () => !wantsQuantum(),
          onChange: (n) => jump(n),
        },
        {
          type: 'segmented',
          id: 'orbital',
          label: L.models.orbital,
          items: FAMILIES.map((id) => ({ id, label: id })),
          value: '1s',
          visible: wantsQuantum,
          onChange: pick,
        },
        {
          type: 'segmented',
          id: 'orientP',
          label: L.models.orientP,
          items: (['x', 'y', 'z'] as const).map((id) => ({ id, label: L.models.along[id] })),
          value: 'z',
          visible: () => wantsQuantum() && (family() === '2p' || family() === '3p'),
          onChange: pick,
        },
        {
          type: 'segmented',
          id: 'orientD',
          label: L.models.orientD,
          items: (['z2', 'xz', 'xy'] as const).map((id) => ({ id, label: L.models.clover[id] })),
          value: 'xy',
          visible: () => wantsQuantum() && family() === '3d',
          onChange: pick,
        },
        {
          type: 'slider',
          id: 'samples',
          label: L.models.samples,
          min: ORBITAL_POINTS_RANGE.min,
          max: cloud.capacity,
          value: Math.min(ORBITAL_POINTS_RANGE.default, cloud.capacity),
          scale: 'log',
          step: 2,
          visible: wantsQuantum,
          onChange: (n) => {
            state.samples = n;
            sim.set({ targetCount: n });
          },
        },
        {
          type: 'readout',
          id: 'energy',
          label: L.models.energy,
          unit: 'eV',
          digits: 2,
          get: () => levelEnergyEv(state.n),
        },
        {
          type: 'readout',
          id: 'radius',
          label: L.models.radius,
          text: () => `${bohrRadiusA0(state.n)} a₀`,
          visible: () => !wantsQuantum(),
        },
      ],
      callouts: [
        { anchor: proton, text: L.models.nucleus, color: 'coral', side: 'down' },
        ...[1, 2, 3].map((n) => ({
          anchor: ringPoint(n),
          text: `${L.models.orbit}${n}`,
          color: 'cyan' as const,
          side: 'left' as const,
          visible: () => !isQuantum(),
        })),
        {
          anchor: () => v.set(ATOM_X + 0.71 * state.a0, 0.71 * state.a0, 0),
          text: formula('models', 2), // a₀ = 52,9 pm
          color: 'mist',
          side: 'right',
          visible: is1s,
        },
      ],
      hotspots: [
        {
          // exactly on a nodal surface of the orbital on screen (sim-bindings/nodal.ts)
          anchor: () =>
            state.node
              ? v.set(ATOM_X + state.node.x * state.a0, state.node.up * state.a0, 0)
              : v.set(ATOM_X, 0, 0),
          content: 'nodal-surface',
          visible: () => isQuantum() && state.node !== null,
        },
        {
          anchor: () => v.set(ATOM_X - 0.71 * state.a0, 0.71 * state.a0, 0),
          content: 'bohr-radius-sphere',
          visible: is1s,
        },
      ],
    },
  });
  ctx.qa.expose('models', () => ({
    points: sim.count(),
    orbital: state.orbital,
    n: state.n,
    quantum: state.quantum,
    node: state.node,
  }));

  /* -------------------------------------------------------------------------------------- per frame */
  let a0Shown = 0;
  let nodeShown = 0;
  let axesShown = 0;
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
        cloud.dotSize = damp(cloud.dotSize, DOT_SIZE[shellN - 1]!, 5, dt);
        cloud.intensity =
          0.8 * DOT_GLOW[shellN - 1]! * Math.sqrt(ORBITAL_POINTS_RANGE.default / state.samples);
      }
      const facing = ctx.camera.camera.quaternion;
      a0Shown = damp(a0Shown, is1s() ? 1 : 0, 6, dt);
      shell.visible = a0Shown > 0.02;
      shell.scale.setScalar(state.a0 * Math.max(a0Shown, 1e-3));
      a0Ring.quaternion.copy(facing);
      // nodal sphere of the s orbitals: a dashed circle at the node's radius
      const sphere = isQuantum() && state.node?.kind === 'sphere' ? state.node.radius! : 0;
      nodeShown = damp(nodeShown, sphere > 0 ? 1 : 0, 6, dt);
      nodeRing.visible = nodeShown > 0.02;
      if (sphere > 0) nodeRing.scale.setScalar(sphere * state.a0);
      nodeRing.quaternion.copy(facing);
      nodeRing.intensity = 0.9 * nodeShown;
      // axes: only where the orbital has a direction (p, d)
      const directed = isQuantum() && orbitalQuantumNumbers(state.orbital).l > 0;
      axesShown = damp(axesShown, directed ? 1 : 0, 6, dt);
      axes.visible = axesShown > 0.02;
      axisLines.intensity = 0.7 * axesShown;
      for (const label of axisLabels) {
        label.visible = axes.visible;
        label.opacity = axesShown;
      }
      diagram.update(dt);
    },
  };
};
