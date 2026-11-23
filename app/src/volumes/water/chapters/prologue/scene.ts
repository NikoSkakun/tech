/**
 * The prologue: the home of the volume (`@water/shared/home`) and one dive to the molecules.
 *
 * `dive` is a rail (VISUAL.md §4): the slider's position gives the camera's place between the table and the
 * layer of molecules that is mounted, very small, inside the drop on the glass — one continuous flight, the
 * distance to the drop shrinking evenly on a logarithmic scale. The molecules there are the live simulation of
 * water at room temperature; before the reader can tell them apart they are a grain in the drop.
 */
import { CircleGeometry, Group, Mesh, Vector3 } from 'three';
import { defineScene, type Shot } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { journeyInset } from '@/hud-dom/journey';
import { col, K } from '@/style';
import LIQUID from '@water/sim/fixtures/liquid.json';
import type { Placed } from '@water/sim/lattice';
import { BOX_W, liquidSample, MOLECULES } from '@water/sim/setups';
import { growSnowflake, WEATHERS, type Snowflake } from '@water/sim/snowflake';
import { createHome, ROOM_ENV } from '@water/shared/home';
import { createMolecules } from '@water/shared/molecules';
import { createSnowflakeView } from '@water/shared/snowflake-view';
import { caption } from './content';

type StepId = 'glass' | 'six' | 'dive' | 'riddle' | 'map';
/** Size of the layer of molecules inside the drop: world units per model unit. */
const MICRO = 0.0025;
/** The rail: distance from the camera to the drop at the lens, at the stop «крапля» and at the molecules. */
const RAIL = { lens: 2.3, drop: 0.42, deep: 31 * MICRO };
/** Simulated time units per second of screen time for the molecules in the drop. */
const RATE = 5;
/** Where the snowflake hangs and how wide it grows. */
const FLAKE_AT = [0.2, 4.55, 1.6] as const;
const FLAKE_SIZE = 3.3;

const HOME_SHOT: Shot = {
  position: [0.4, 4.5, 9.4],
  target: [0.35, 1.85, 0],
  fov: 30,
  fit: { center: [0.3, 1.8, 0], radius: 3.2 },
  orbit: { azimuth: 0.5, polar: 0.22, zoom: [0.8, 1.35] },
};

/** Goals reached in this session (module state survives a rebuild of the scene). */
const REACHED = new Set<StepId>();

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export default defineScene((ctx) => {
  const { root, stage, camera } = ctx;
  ctx.env.base(ROOM_ENV);
  ctx.env.setScale(3.6);
  ctx.env.setShadow({ extent: 6, center: [0.8, 1, 0], softness: 4 });
  ctx.post.base({ dofAperture: 1.4, dofRange: 2.6, dofMaxBlur: 9 });
  const home = createHome(ctx);
  root.add(home.group);

  // the molecules inside the drop: the layer faces outward from the glass, centred on the drop
  const micro = new Group();
  micro.position.copy(home.dropAt);
  micro.lookAt(home.dropAt.clone().add(home.dropOut));
  micro.scale.setScalar(MICRO);
  const molecules = createMolecules(MOLECULES);
  molecules.group.position.set(-BOX_W / 2, -5.2, 0);
  // behind the layer: the dark of the deep, so that blue molecules are not lost against the blue of the drop
  const veilMat = K.glow({ color: col('bg.indigo').lerp(col('bg.violet'), 0.3), intensity: 0.55, whiten: 0, falloff: 0, opacity: 0.99 });
  const veil = new Mesh(new CircleGeometry(260, 48), veilMat);
  veil.position.z = -4;
  veil.renderOrder = 20; // after the glass, the water and the drop, which lie behind it
  micro.add(veil, molecules.group);
  micro.visible = false;
  root.add(micro);
  const water = liquidSample(LIQUID as unknown as Placed[], 20);

  const flakeView = createSnowflakeView(FLAKE_SIZE);
  flakeView.group.position.set(...FLAKE_AT);
  flakeView.group.rotation.x = -0.18;
  root.add(flakeView.group);
  const flakes: (Snowflake | undefined)[] = [];
  let weather = 0;
  const grown = new Set<number>();
  const flake = (i: number): Snowflake => (flakes[i] ??= growSnowflake(WEATHERS[i]!));
  flakeView.set(flake(0));

  const candle = stage.actor(home.candle, { appear: 'pop' });
  const lens = stage.actor(home.lens, { appear: 'pop' });
  const snow = stage.actor(flakeView.group, { appear: 'pop' });
  camera.shots({
    home: HOME_SHOT,
    six: {
      position: [0.3, 5.3, 9.6],
      target: [FLAKE_AT[0], FLAKE_AT[1] - 0.25, FLAKE_AT[2]],
      fov: 30,
      fit: { center: [...FLAKE_AT], radius: 2.2 },
      orbit: { azimuth: 0.4, polar: 0.2, zoom: [0.8, 1.3] },
    },
    riddle: {
      position: [1.9, 4.3, 11.6],
      target: [1.55, 1.45, 0.2],
      fov: 30,
      fit: { center: [1.5, 1.5, 0.2], radius: 3.4 },
      orbit: { azimuth: 0.5, polar: 0.22, zoom: [0.8, 1.35] },
    },
  });

  // the dive rail: 0 the table · 0.3 at the lens · 0.5 the drop fills the frame · 1 the molecules
  const homeAt = new Vector3(...HOME_SHOT.position);
  const homeTarget = new Vector3(...HOME_SHOT.target);
  const lensAt = home.dropAt.clone().addScaledVector(home.dropOut, RAIL.lens).add(new Vector3(0, 0.18, 0));
  const at = new Vector3();
  const look = new Vector3();
  const railShot = (s: number): Shot => {
    if (s <= 0.3) {
      const u = smooth(s / 0.3);
      at.lerpVectors(homeAt, lensAt, u);
      look.lerpVectors(homeTarget, home.dropAt, u);
    } else {
      // the distance shrinks evenly on a logarithmic scale; the small lift of the lens shot settles to level
      const u = s < 0.5 ? ((s - 0.3) / 0.2) * 0.42 : 0.42 + ((s - 0.5) / 0.5) * 0.58;
      const far = RAIL.lens, near = RAIL.deep;
      const mid = Math.log(RAIL.drop / far) / Math.log(near / far); // share of the log-range at «крапля»
      const v = s < 0.5 ? (u / 0.42) * mid : mid + ((u - 0.42) / 0.58) * (1 - mid);
      const d = far * Math.pow(near / far, v);
      at.copy(home.dropAt).addScaledVector(home.dropOut, d).add(new Vector3(0, 0.18 * (d / far), 0));
      look.copy(home.dropAt);
    }
    return { position: [at.x, at.y, at.z], target: [look.x, look.y, look.z], fov: 30, orbit: { enabled: false }, drift: 0 };
  };

  const pad = { target: 0.5, shown: 0.5, drag: false, told: NaN, low: false, high: false };
  const growth = { target: 0, shown: 0, drag: false, told: NaN };
  const depth = { target: 0, shown: 0, drag: false, told: NaN };
  /** Seconds since the step `dive` was entered: the rail takes the camera once the entry move is over. */
  let diveFor = 0;
  const opened = new Set<string>();
  const journey = ctx.nav.volume?.journey;
  const layers = new Map((journey?.groups ?? []).map((g) => [g.id, g.layer]));
  const questions = (journey?.planned ?? []).filter((j) => layers.get(j.group) === 'path').map((j) => j.id);
  const cubeAt = new Vector3();
  const waxAt = new Vector3();

  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const scrubbed = (id: string, step: StepId, s: { target: number; drag: boolean }, value: number) => ({
    type: 'slider' as const,
    id,
    label: caption(step, 0),
    min: 0,
    max: 1,
    value,
    format: () => '',
    marks: [0, 0.5, 1].map((v, k) => ({ value: v, label: caption(step, 1 + k) })),
    onChange: (v: number) => (s.target = v),
    onInput: (_v: number, how: 'drag' | 'jump' | 'step') => (s.drag = how === 'drag'),
  });
  stage.define({
    glass: { camera: 'home' },
    six: { camera: 'six', show: [snow] },
    dive: { camera: 'home', show: [lens], post: { aoIntensity: 0, dofAperture: 0.4 } },
    riddle: { camera: 'riddle', show: [candle] },
    map: { camera: 'riddle', show: [candle] },
  });
  ui.define({
    glass: { controls: [scrubbed('pad', 'glass', pad, 0.5)], reset: true, goal: () => REACHED.has('glass') },
    six: {
      controls: [
        {
          type: 'slider',
          id: 'growth',
          label: caption('six', 0),
          min: 0,
          max: 1,
          value: 0,
          format: () => '',
          marks: [
            { value: 0, label: caption('six', 1) },
            { value: 1, label: caption('six', 2) },
          ],
          onChange: (v: number) => (growth.target = v),
          onInput: (_v: number, how: 'drag' | 'jump' | 'step') => (growth.drag = how === 'drag'),
        },
        {
          type: 'button',
          id: 'another',
          label: caption('six', 3),
          onClick: () => {
            weather = (weather + 1) % WEATHERS.length;
            flakeView.set(flake(weather));
            growth.target = growth.shown = 0;
            ui.set('growth', 0);
          },
        },
      ],
      reset: true,
      goal: () => REACHED.has('six'),
    },
    dive: { controls: [scrubbed('depth', 'dive', depth, 0)], reset: true, goal: () => REACHED.has('dive') },
    riddle: {
      controls: [
        { type: 'button', id: 'wax', label: caption('riddle', 0), primary: true, onClick: () => home.dropWax() },
        { type: 'button', id: 'dunk', label: caption('riddle', 1), onClick: () => home.dunk() },
      ],
      callouts: [
        { anchor: () => home.wax.getWorldPosition(waxAt), text: caption('riddle', 2), side: 'right', visible: () => stage.current === 'riddle' && home.waxSunk },
        { anchor: () => home.cube.getWorldPosition(cubeAt), text: caption('riddle', 3), side: 'left', visible: () => stage.current === 'riddle' && home.dunked },
      ],
      goal: () => REACHED.has('riddle'),
    },
    map: {
      board: {
        title: ctx.manifest.steps[4]?.title ?? '',
        size: 'fill',
        children: [journeyInset(ctx, { id: 'map-journey', onOpen: (id) => void (questions.includes(id) && opened.add(id)) })],
      },
      goal: () => opened.size >= questions.length,
    },
  });
  ctx.qa.probe('cube', home.cube);
  ctx.qa.expose('prologue', () => ({
    step: stage.current,
    pad: Math.round(pad.shown * 100) / 100,
    celsius: Math.round(home.celsius),
    growth: Math.round(growth.shown * 100) / 100,
    weather,
    depth: Math.round(depth.shown * 1000) / 1000,
    dunked: home.dunked,
    waxSunk: home.waxSunk,
    opened: opened.size,
    reached: [...REACHED],
  }));

  const follow = (s: { target: number; shown: number; drag: boolean; told: number }, id: string, dt: number, tau = 0.25): void => {
    s.shown = s.drag ? s.target : s.shown + (s.target - s.shown) * (1 - Math.exp(-dt / tau));
    if (!(Math.abs(s.shown - s.told) < 0.002)) ui.patch(id, { current: (s.told = s.shown) });
  };

  return {
    enterStep(id, info) {
      const step = id as StepId;
      pad.target = pad.shown = 0.5;
      growth.target = growth.shown = 0;
      depth.target = depth.shown = 0;
      pad.drag = growth.drag = depth.drag = false;
      pad.told = growth.told = depth.told = NaN;
      diveFor = info.instant ? 10 : 0;
      if (step === 'six') flakeView.show(0);
    },
    update(dt, t) {
      const id = stage.current as StepId;
      if (id === 'glass') {
        follow(pad, 'pad', dt, 0.35);
        if (pad.shown <= 0.12) pad.low = true;
        if (pad.shown >= 0.88) pad.high = true;
        if (pad.low && pad.high) REACHED.add('glass');
      } else pad.shown += (0.5 - pad.shown) * Math.min(1, dt * 3);
      home.pad = pad.shown;
      if (id === 'six') {
        follow(growth, 'growth', dt);
        flakeView.show(growth.shown);
        flakeView.group.rotation.z = 0.12 * Math.sin(t * 0.35);
        flakeView.group.position.y = FLAKE_AT[1] + 0.06 * Math.sin(t * 0.9);
        if (growth.shown >= 0.95) grown.add(weather);
        if (grown.size >= 2) REACHED.add('six');
      }
      if (id === 'dive') {
        diveFor += dt;
        follow(depth, 'depth', dt, 0.35);
        // the rail owns the camera once the move into the step is over, or as soon as the slider moves
        if (diveFor > 2 || depth.shown > 0.002) camera.go(railShot(depth.shown), { instant: true });
        if (depth.shown >= 0.97) REACHED.add('dive');
      } else depth.shown = 0;
      // the molecules live only while the camera is near enough to see their grain
      const deep = id === 'dive' && depth.shown > 0.45;
      micro.visible = deep;
      veilMat.uniforms.opacity!.value = smooth((depth.shown - 0.52) / 0.26);
      if (deep) {
        if (dt > 0) water.step(Math.max(1, Math.min(30, Math.round((RATE * dt) / water.dt))));
        molecules.sync(water, dt);
      }
      home.dew = 1;
      if (id === 'riddle' && home.dunked && home.waxSunk) REACHED.add('riddle');
      home.update(dt, t);
    },
  };
});
