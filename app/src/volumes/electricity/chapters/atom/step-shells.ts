/**
 * Step 7 `shells` — «Оболонки, валентні електрони і чому мідь проводить». Copper as shells K–L–M–N
 * (2–8–18–1) in front of a periodic-table wall: hovering a tile 1…36 rebuilds the atom in that element's
 * configuration (sim `neutralConfiguration`, `shellCounts`, `valenceElectrons`). «Група 11» lines up Cu, Ag
 * and Au with their single outer s-electron; the filling ladder drops the electrons in Madelung order.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { damp } from '@/engine/api';
import { hud } from '@/hud';
import {
  ELEMENTS,
  GROUP_11,
  configurationText,
  fillingSequence,
  neutralConfiguration,
  referenceNeutronNumber,
  shellCounts,
  valenceElectrons,
} from '@electricity/sim/atom';
import { anchorWhen, qaProbe, type StepFactory } from './chapter';
import { hotspotName } from './content';
import { L } from './labels';
import { createElementCard } from './parts/element-card';
import { createFillingLadder } from './parts/filling-ladder';
import { createPeriodicWall } from './parts/periodic-wall';
import { ShellAtom, shellRadius } from './parts/shell-atom';

/** Neutrons of the most abundant isotope for Z = 30…36 (Zn-64 … Kr-84); lighter ones use the sim's table. */
const COMMON_N: Record<number, number> = { 30: 34, 31: 38, 32: 42, 33: 42, 34: 46, 35: 44, 36: 48 };
const neutronsOf = (z: number): number =>
  z === 1 ? 0 : (COMMON_N[z] ?? Math.round(referenceNeutronNumber(z)));
const SOLO = { x: -4.5, scale: 0.62 };
const TRIO = { x: -6.7, scale: 0.32 };

export const shellsStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'shells';
  const set = new Group();
  set.name = 'shells-set';
  ctx.root.add(set);

  const state = { z: 29, group: 0, pending: 0, ladder: false, announced: false };
  const pick = (z: number): void => {
    if (z > 36 || z === state.z) return;
    state.z = z;
    audio.play('tick', { pitch: 0.8 + z / 60 });
    apply();
  };
  const wall = createPeriodicWall(ctx, pick);
  wall.surface.position.set(0.4, 2.7, -1.2);
  const atom = new ShellAtom(ctx.random.fork('shell-atom'), { maxProtons: 36, maxNeutrons: 48 });
  const silver = new ShellAtom(ctx.random.fork('ag'), {
    maxProtons: 47,
    maxNeutrons: 60,
    nucleusScale: 0.17,
  });
  const gold = new ShellAtom(ctx.random.fork('au'), { maxProtons: 79, maxNeutrons: 118, nucleusScale: 0.15 });
  silver.set(47, 60, GROUP_11[1]!.shells, true);
  gold.set(79, 118, GROUP_11[2]!.shells, true);
  atom.group.position.set(SOLO.x, -3.1, 1.2);
  silver.group.position.set(-3.4, -3.2, 1.2);
  gold.group.position.set(0.1, -3.2, 1.2);
  const card = createElementCard(ctx, 0.0175);
  card.surface.position.set(5.2, -3.2, 1.2);
  const ladder = createFillingLadder(ctx);
  ladder.surface.position.set(-0.15, -3.2, 1.2);
  ladder.surface.scale.multiplyScalar(0.82);
  set.add(wall.surface, atom.group, silver.group, gold.group, card.surface, ladder.surface);

  const isGroup = (): boolean => state.group > 0.5;
  const apply = (instant = false): void => {
    const z = state.z;
    const configuration = neutralConfiguration(z);
    const shells = shellCounts(configuration);
    atom.set(z, neutronsOf(z), shells, instant);
    wall.select(z);
    const el = ELEMENTS[z - 1]!;
    const valence = valenceElectrons(z);
    if (state.pending)
      card.set({
        symbol: '11',
        title: `${L.shells.group11}: Cu · Ag · Au`,
        lines: GROUP_11.map(
          (g) => `${g.z} **${g.symbol}** ${g.nameUk} (${g.substanceUk}): \`${g.configuration}\``,
        ),
      });
    else
      card.set({
        symbol: el.symbol,
        title: el.substanceUk ? `${el.nameUk} (${el.substanceUk})` : el.nameUk,
        lines: [
          `Z = ${z}`,
          `${L.shells.config}: \`${configurationText(configuration)}\``,
          `${L.shells.shellsLabel}: ${shells.join('–')}`,
          `${valence.kind === 'group' ? L.shells.valence : L.shells.outerS}: **${valence.count}**`,
        ],
      });
    if (state.ladder) {
      ladder.play(fillingSequence(z));
      state.announced = false;
    }
  };
  const setGroup = (onNow: boolean, instant = false): void => {
    if (onNow) state.z = 29;
    wall.setGroup11(onNow);
    ctx.tweens.to(state, { group: onNow ? 1 : 0 }, { duration: instant ? 0 : 0.7, ease: 'power2.inOut' });
    state.group = instant ? (onNow ? 1 : 0) : state.group;
    state.pending = onNow ? 1 : 0;
    apply(instant);
  };

  ctx.camera.shots({
    shells: {
      position: [0.4, 0.4, 20.5],
      target: [0.4, -0.1, 0],
      frameAspect: 1.45,
      orbit: { azimuth: 0.25, polar: 0.15 },
    },
  });
  stage.define({
    shells: {
      show: [set],
      camera: 'shells',
      post: { dofAperture: 0.3 },
      enter(info) {
        state.ladder = ui.value<boolean>('filling');
        state.z = 29;
        setGroup(false, true);
        apply(info.instant);
      },
    },
  });

  const v = new Vector3();
  const valenceAnchor = (): Vector3 => atom.group.localToWorld(atom.valencePosition(v));
  ui.define({
    shells: {
      hint: L.shells.hint,
      honesty: ['simplified', 'notToScale'],
      controls: [
        {
          type: 'toggle',
          id: 'filling',
          label: L.shells.filling,
          value: false,
          onChange: (v0) => {
            state.ladder = v0;
            if (v0 && isGroup()) setGroup(false);
            apply();
          },
        },
        {
          type: 'button',
          id: 'group11',
          label: L.shells.group11,
          icon: 'layers',
          primary: true,
          onClick: () => setGroup(!state.pending),
        },
        {
          type: 'button',
          id: 'toCopper',
          label: L.shells.back,
          icon: 'resetView',
          onClick: () => {
            setGroup(false);
            pick(29);
          },
        },
      ],
      callouts: [
        {
          anchor: anchorWhen(ctx, () => on() && state.z === 29 && !isGroup(), valenceAnchor),
          text: L.shells.valenceE,
          color: 'cyan',
          side: 'up',
        },
      ],
      hotspots: [
        {
          anchor: anchorWhen(
            ctx,
            () => on() && state.z === 29,
            () => valenceAnchor().add(v.set(0, -0.5, 0)),
          ),
          title: hotspotName('shells', 0),
        },
        {
          anchor: anchorWhen(
            ctx,
            () => on() && state.z >= 11 && !isGroup(),
            () => atom.group.localToWorld(v.set(0, shellRadius(2), 0)),
          ),
          title: hotspotName('shells', 1),
        },
        { anchor: [0.4 + 7.25, 2.7 + 1.9, -1.2], title: hotspotName('shells', 2) },
      ],
    },
  });
  qaProbe(ctx, 'shells.z', () => state.z);
  qaProbe(ctx, 'shells.group', () => state.group);
  qaProbe(ctx, 'shells.tile', () => wall.surface.localToWorld(v.set((-9 + 7.5) * 52, (3.5 - 3.5) * 52, 0))); // Fe (row 3, col 7)

  return {
    update(dt, t) {
      const hovered = wall.hovered();
      if (hovered && !isGroup()) pick(hovered);
      const g = state.group;
      atom.group.position.x = damp(atom.group.position.x, SOLO.x + (TRIO.x - SOLO.x) * g, 8, dt);
      atom.group.scale.setScalar(SOLO.scale + (TRIO.scale - SOLO.scale) * g);
      atom.update(dt, t);
      for (const other of [silver, gold]) {
        other.group.visible = g > 0.02;
        other.group.scale.setScalar(TRIO.scale * Math.max(g, 1e-3));
        if (other.group.visible) other.update(dt, t);
      }
      ladder.surface.visible = state.ladder && g < 0.5;
      if (ladder.surface.visible) {
        const started = ladder.update(dt);
        if (started) audio.play('tick', { pitch: 0.7 + 0.12 * started.n + 0.05 * started.l, gain: 0.6 });
        if (started && started.n === 3 && started.l === 2 && !state.announced) {
          state.announced = true;
          hud()?.toast(L.shells.exception, { icon: 'info', duration: 5 });
        }
      }
    },
  };
};
