/**
 * Step 7 `shells` — «Оболонки, валентні електрони і чому мідь проводить». Copper as shells K–L–M–N
 * (2–8–18–1) in front of a periodic-table wall: hovering a tile 1…36 rebuilds the atom in that element's
 * configuration (sim `neutralConfiguration`, `shellCounts`, `valenceElectrons`). «Група 11» lines up Cu, Ag
 * and Au with their single outer s-electron; the filling ladder drops the electrons in Madelung order.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { damp, toOverlay } from '@/engine/api';
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
import { Text3D } from '@/text';
import type { StepFactory } from '../chapter';
import { L } from '../labels';
import { createFillingLadder } from '../parts/filling-ladder';
import { createPeriodicWall } from '../parts/periodic-wall';
import { ShellAtom, shellRadius } from '../parts/shell-atom';

/** Neutrons of the most abundant isotope for Z = 30…36 (Zn-64 … Kr-84); lighter ones use the sim's table. */
const COMMON_N: Record<number, number> = { 30: 34, 31: 38, 32: 42, 33: 42, 34: 46, 35: 44, 36: 48 };
const neutronsOf = (z: number): number =>
  z === 1 ? 0 : (COMMON_N[z] ?? Math.round(referenceNeutronNumber(z)));
/** The scene sits right of the scale ruler: the wall above, the atom (or the group-11 trio) below. */
const WALL = { x: 1.25, y: 2.75, z: -1.2 };
const SOLO = { x: -0.9, xLadder: -3.9, scale: 0.66 };
const TRIO = { x: -5.0, scale: 0.36, pitch: 5.1 };
const ATOM_Y = -3.2;
/** World units per px-eq of the ladder console: its captions stay ≥ 16 px at 720p without growing. */
const CONSOLE_UNIT = 0.022;

export const shellsStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
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
  wall.surface.position.set(WALL.x, WALL.y, WALL.z);
  const atom = new ShellAtom(ctx.random.fork('shell-atom'), { maxProtons: 36, maxNeutrons: 48 });
  const silver = new ShellAtom(ctx.random.fork('ag'), {
    maxProtons: 47,
    maxNeutrons: 60,
    nucleusScale: 0.17,
  });
  const gold = new ShellAtom(ctx.random.fork('au'), { maxProtons: 79, maxNeutrons: 118, nucleusScale: 0.15 });
  silver.set(47, 60, GROUP_11[1]!.shells, true);
  gold.set(79, 118, GROUP_11[2]!.shells, true);
  atom.group.position.set(SOLO.x, ATOM_Y, 1.2);
  silver.group.position.set(TRIO.x + TRIO.pitch, ATOM_Y, 1.2);
  gold.group.position.set(TRIO.x + 2 * TRIO.pitch, ATOM_Y, 1.2);
  const ladder = createFillingLadder(ctx, { top: [5.4, 0.15, 1.2], unit: CONSOLE_UNIT });
  // name plates in the scene: the symbol of the atom on stage (details are read in the dock's table)
  const plate = (size: number): Text3D => {
    const text = new Text3D('', {
      font: 'display',
      size,
      color: 'white',
      anchorX: 'center',
      anchorY: 'middle',
      billboard: true,
    });
    toOverlay(text);
    return text;
  };
  const symbol = plate(1.25);
  const name = plate(0.46);
  name.color = 'mist';
  const trioSymbols = GROUP_11.map((g) => {
    const text = plate(0.8);
    text.text = g.symbol;
    return text;
  });
  set.add(
    wall.surface,
    atom.group,
    silver.group,
    gold.group,
    ladder.console.surface,
    symbol,
    name,
    ...trioSymbols,
  );

  const isGroup = (): boolean => state.group > 0.5;
  /** «Купрум (мідь)»: the element's name with the name of the simple substance, as the document lists them. */
  const title = (z: number): string => {
    const el = ELEMENTS[z - 1]!;
    return el.substanceUk ? `${el.nameUk} (${el.substanceUk})` : el.nameUk;
  };
  /** The element card of the document, as rows of the dock's table (read in the HUD, DECISIONS §57 a). */
  const elementRows = (): string[][] => {
    const z = state.z;
    const configuration = neutralConfiguration(z);
    const valence = valenceElectrons(z);
    return [
      [L.shells.element, `${ELEMENTS[z - 1]!.symbol} · ${title(z)}`],
      ['Z', String(z)],
      [L.shells.config, configurationText(configuration)],
      [L.shells.shellsLabel, shellCounts(configuration).join('–')],
      [valence.kind === 'group' ? L.shells.valence : L.shells.outerS, String(valence.count)],
    ];
  };
  const groupRows = GROUP_11.map((g) => [
    `${g.z} ${g.symbol}`,
    `${g.nameUk} (${g.substanceUk})`,
    g.configuration,
  ]);
  const apply = (instant = false): void => {
    const z = state.z;
    const configuration = neutralConfiguration(z);
    const shells = shellCounts(configuration);
    atom.set(z, neutronsOf(z), shells, instant);
    wall.select(z);
    const el = ELEMENTS[z - 1]!;
    symbol.text = el.symbol;
    name.text = title(z);
    if (state.ladder) {
      ladder.play(fillingSequence(z));
      state.announced = false;
    }
  };
  const setGroup = (onNow: boolean, instant = false): void => {
    if (onNow) state.z = 29;
    wall.setGroup11(onNow);
    if (instant) state.group = onNow ? 1 : 0;
    else stage.scope.to(state, { group: onNow ? 1 : 0 }, { duration: 0.7, ease: 'power2.inOut' });
    state.pending = onNow ? 1 : 0;
    apply(instant);
  };

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
          type: 'table',
          id: 'element',
          rows: elementRows,
          visible: () => !state.pending,
        },
        {
          type: 'table',
          id: 'group11rows',
          head: [L.shells.group11, L.shells.element, L.shells.config],
          rows: groupRows,
          visible: () => state.pending > 0,
        },
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
          anchor: valenceAnchor,
          visible: () => state.z === 29 && !isGroup(),
          text: L.shells.valenceE,
          color: 'cyan',
          side: 'up',
        },
      ],
      hotspots: [
        {
          anchor: () => valenceAnchor().add(v.set(0, -0.5, 0)),
          content: '4s-electron',
          visible: () => state.z === 29,
        },
        {
          anchor: () => atom.group.localToWorld(v.set(0, shellRadius(2), 0)),
          content: 'shell-m',
          visible: () => state.z >= 11 && !isGroup(),
        },
        { anchor: [WALL.x + 7.25, WALL.y + 1.9, WALL.z], content: 'noble-gases-column' },
      ],
    },
  });
  ctx.qa.probe('shells.tile', () => wall.surface.localToWorld(v.set((-9 + 7.5) * 52, (3.5 - 3.5) * 52, 0))); // Fe (row 3, col 7)
  ctx.qa.expose('shells', () => ({ z: state.z, group: state.group, ladder: state.ladder }));

  return {
    update(dt, t) {
      const hovered = wall.hovered();
      if (hovered && !isGroup()) pick(hovered);
      const g = state.group;
      // alone the atom stands near the middle with its name plate; the ladder (right) pushes it aside
      const soloX = state.ladder ? SOLO.xLadder : SOLO.x;
      atom.group.position.x = damp(atom.group.position.x, soloX + (TRIO.x - soloX) * g, 8, dt);
      atom.group.scale.setScalar(SOLO.scale + (TRIO.scale - SOLO.scale) * g);
      // name plates: symbol and name right of the solo atom; one symbol under each atom of the trio
      const solo = state.ladder ? 0 : 1 - Math.min(g * 2, 1);
      symbol.visible = name.visible = solo > 0.02;
      symbol.opacity = name.opacity = solo;
      symbol.position.set(atom.group.position.x + 4.1, ATOM_Y + 0.55, 1.2);
      name.position.set(atom.group.position.x + 4.1, ATOM_Y - 0.6, 1.2);
      trioSymbols.forEach((text, i) => {
        text.visible = g > 0.5;
        text.opacity = Math.max(g * 2 - 1, 0);
        text.position.set(TRIO.x + i * TRIO.pitch + 1.9, ATOM_Y + 1.45, 1.2);
      });
      atom.update(dt, t);
      for (const other of [silver, gold]) {
        other.group.visible = g > 0.02;
        other.group.scale.setScalar(TRIO.scale * Math.max(g, 1e-3));
        if (other.group.visible) other.update(dt, t);
      }
      ladder.console.surface.visible = state.ladder && g < 0.5;
      if (ladder.console.surface.visible) {
        const started = ladder.update(dt);
        if (started) audio.play('tick', { pitch: 0.7 + 0.12 * started.n + 0.05 * started.l, gain: 0.6 });
        if (started && started.n === 3 && started.l === 2 && !state.announced) {
          state.announced = true;
          ui.toast(L.shells.exception, { icon: 'info', duration: 5 });
        }
      }
    },
  };
};
