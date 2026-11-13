/**
 * Step 2 `anatomy` — «Ядро і хмара». The copper atom: a fuzzy cloud of 29 electrons around a nucleus that is
 * shown ×1000 by default. «Справжні пропорції» shrinks the nucleus to its real size (a point; a pulsing marker
 * keeps its place) and brings in a size analogy; a "test tube" on the right weighs nucleus against electrons.
 */
import { Group } from 'three';
import { audio } from '@/audio';
import { damp } from '@/engine/api';
import { createPulseRings } from '@/fx';
import { anchorWhen, type StepFactory } from './chapter';
import { hotspotName } from './content';
import { L } from './labels';
import { createCity, createStadium } from './parts/analogy';
import { createShareBar } from './parts/share-bar';

/** Electrons' share of the copper atom's mass: 29·m_e / m(Cu-63) ≈ 0,025 % (chapter document, step 2). */
const ELECTRON_MASS_SHARE = 0.00025;

export const anatomy: StepFactory = ({ ctx, ui, world }) => {
  const { stage } = ctx;
  const props = new Group();
  props.name = 'anatomy-props';
  ctx.root.add(props);

  const mass = createShareBar({ major: 'coral', minor: 'cyan', minorShare: ELECTRON_MASS_SHARE });
  mass.group.position.set(7.4, 0.2, 0);
  const stadium = createStadium();
  const city = createCity(ctx.random.fork('city'));
  for (const a of [stadium, city]) {
    a.group.position.set(-4.6, -3.5, 2.2);
    a.group.rotation.x = 0.5; // tilted toward the viewer: we look into the bowl / onto the roofs
    a.group.visible = false;
  }
  const rings = createPulseRings({ color: 'coral', size: 1.5, intensity: 1.3, amount: 2 });
  props.add(mass.group, stadium.group, city.group, rings);

  // `real` 0…1 follows the toggle; the analogies pop in once the nucleus has shrunk
  const state = { real: 0, pea: 0, ball: 0 };
  const isReal = (): boolean => stage.current === 'anatomy' && state.real > 0.5;
  const setReal = (on: boolean, instant = false): void => {
    ctx.tweens.to(
      state,
      { real: on ? 1 : 0 },
      { duration: instant ? 0 : 1.2, ease: on ? 'back.out' : 'power2.inOut' },
    );
    if (instant) state.real = on ? 1 : 0;
  };

  ctx.camera.shots({
    anatomy: {
      position: [0.6, 1.2, 18.5],
      target: [0.6, -0.4, 0],
      frameAspect: 1.3,
      orbit: { azimuth: 0.5, polar: 0.3 },
    },
  });
  stage.define({
    anatomy: {
      show: [world.cloudActor, world.nucleusActor, props],
      params: { cloudGlow: 0.42 },
      camera: 'anatomy',
      enter(info) {
        ui.set('trueScale', false); // the step always opens with the enlarged nucleus
        setReal(false, info.instant);
      },
    },
  });

  ui.define({
    anatomy: {
      controls: [
        {
          type: 'toggle',
          id: 'trueScale',
          label: L.anatomy.trueScale,
          value: false,
          onChange: (on) => {
            audio.play(on ? 'whooshDown' : 'whooshUp', { gain: 0.45 });
            setReal(on);
          },
        },
        {
          type: 'segmented',
          id: 'analogy',
          items: [
            { id: 'pea', label: L.anatomy.pea },
            { id: 'ball', label: L.anatomy.ball },
          ],
          value: 'pea',
          onChange: () => {
            if (!ui.value<boolean>('trueScale')) ui.set('trueScale', true);
            setReal(true);
          },
        },
      ],
      callouts: [
        {
          anchor: anchorWhen(
            ctx,
            () => !isReal(),
            () => world.atom.position,
          ),
          text: L.anatomy.enlarged,
          color: 'coral',
          side: 'right',
        },
        { anchor: anchorWhen(ctx, isReal, rings), text: L.anatomy.marker, color: 'coral', side: 'right' },
        { anchor: [-2.5, 2.9, 0], text: L.anatomy.cloud, color: 'cyan', side: 'left' },
        { anchor: mass.majorAnchor, text: L.anatomy.massNucleus, color: 'coral', side: 'left' },
        { anchor: mass.minorAnchor, text: L.anatomy.massElectrons, color: 'cyan', side: 'left' },
        {
          anchor: anchorWhen(ctx, () => state.pea > 0.6, stadium.marker),
          text: L.anatomy.peaCaption,
          color: 'green',
          side: 'up',
        },
        {
          anchor: anchorWhen(ctx, () => state.ball > 0.6, city.marker),
          text: L.anatomy.ballCaption,
          color: 'white',
          side: 'up',
        },
      ],
      hotspots: [
        { anchor: [0, -1.1, 0], title: hotspotName('anatomy', 0) },
        { anchor: [2.6, -2.7, 0], title: hotspotName('anatomy', 1) },
      ],
    },
  });

  return {
    update(dt, t) {
      const real = Math.min(Math.max(state.real, 0), 1);
      world.nucleusShrink = 1 - 0.999 * real; // ×1000 → ×1
      rings.intensity = 1.3 * real;
      rings.visible = real > 0.02;
      const kind = ui.value<string>('analogy');
      state.pea = damp(state.pea, real > 0.8 && kind === 'pea' ? 1 : 0, 7, dt);
      state.ball = damp(state.ball, real > 0.8 && kind === 'ball' ? 1 : 0, 7, dt);
      for (const [a, k] of [
        [stadium, state.pea],
        [city, state.ball],
      ] as const) {
        a.group.visible = k > 0.02;
        a.group.scale.setScalar(1.25 * Math.max(k, 1e-3));
        a.group.rotation.y = t * 0.18;
      }
      mass.group.rotation.y = Math.sin(t * 0.5) * 0.25;
    },
  };
};
