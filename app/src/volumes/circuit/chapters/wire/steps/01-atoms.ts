/**
 * `wire/atoms` — «Ряди атомів». The reader comes down through the lens to the rows (from the prologue: the whole
 * dive, `world.flyIn`) and touches one ball: it swells, stays lit, and from the takeaway on it carries the caption
 * «атом». The depth is the focus ring on the lens (F-lens-ring, as `prologue/dive`): the reader is in lens mode the
 * whole step — the ring rides the lens once it lies on the wire and stays as the bottom arc of its rim below; turning
 * it moves between the lens on the wire, the wire's core and the rows; a drag on empty space (or on the atoms) sways
 * the camera a little and it springs back.
 *
 * Touching is exact and forgiving: every atom of the focal plane in the frame has an invisible proxy ball of
 * 1.5 atom radii (the gap between atoms is split, never a dead zone), hovering swells the atom under the
 * pointer, and until the first touch the middle atom pulses now and then — the invitation to touch.
 */
import { Vector3 } from 'three';
import type { StepUiSpec } from '@/hud';
import { createFocusRing } from '@circuit/shared/stage/tools/focus-ring';
import { lensMode } from '@circuit/shared/world/lens-mode';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { atomProxies } from '../parts/proxies';

const INVITE_EVERY = 3.2;

export const atomsStep: StepFactory = ({ ctx, world, reached, reach }) => {
  const { copper } = world;
  const atRows = (): boolean => world.world.deep > 1.99 && world.world.deep < 2.01 && !world.world.flying;
  const here = (): boolean => ctx.stage.current === 'atoms' && atRows();
  let invite = 0;
  /** The ring IS the dive (DECISIONS §60 p, as `prologue/dive`): 0 the lens over the wire · 1 «деталь» · 2 the rows.
   *  Floors stand as marks; the last one takes the new word at the takeaway. */
  const stopName = (v: number): string =>
    [caption('atoms', 1), caption('atoms', 2), caption('atoms', reached('atoms') ? 4 : 3)][Math.round(v)] ??
    '';
  const w = world.world;
  /** Lens mode: the whole step, once the lens lies on the wire (from the prologue it lands during the fly-in). */
  const inLens = (): boolean =>
    ctx.stage.current === 'atoms' && w.goal >= 0 && w.position > -0.04 && w.value('lens') > 0.99;
  const ring = createFocusRing(ctx, {
    name: 'depth-ring',
    label: caption('atoms', 0),
    min: 0,
    max: 2,
    marks: () => [1, 2].map((value) => ({ value, label: stopName(value) })),
    value: () => Math.max(w.position, 0),
    target: () => Math.max(w.goal, 0),
    shown: inLens,
    lens: w.stand.tools.lens,
    scrub: (v) => w.scrub(v),
    travelTo: (v) => w.travelTo(v),
    valueText: stopName,
  });
  const mode = lensMode(ctx, { active: inLens, ring, sway: w.sway });

  const choose = (site: number): void => {
    // the chosen ball becomes the hero: the atom the next step opens (nothing moves on this floor)
    copper.hero = site;
    copper.lattice.selected = site;
    copper.lattice.touch(site);
    reach('atoms');
    // the ring's last mark is renamed with the new word: «ряди кульок» → «ряди атомів» (`stopName`)
  };
  const proxies = atomProxies(ctx, copper, {
    enabled: here,
    hover: (site) => copper.lattice.touch(site),
    click: choose,
    space: mode.space,
  });

  const anchor = new Vector3();
  const atomAt = (): Vector3 => copper.heroPosition(anchor);
  ctx.qa.probe('atom-hero', () => world.toWorld(copper.lattice.positionOf(0, anchor), anchor));
  ctx.qa.probe('atom-side', () => world.toWorld(copper.lattice.positionOf(proxies.side, anchor), anchor));
  ctx.qa.expose('atoms', () => ({
    selected: copper.lattice.selected,
    hero: copper.hero,
    position: w.position,
    goal: w.goal,
    lensMode: inLens(),
    ring: ring.state(),
    sway: { yaw: w.sway.yaw, held: mode.swaying },
  }));

  const atomsUi = (): StepUiSpec => ({
    reset: true,
    controls: [],
    goal: () => reached('atoms'),
    callouts: [
      {
        anchor: atomAt,
        text: caption('atoms', 5),
        side: 'up',
        visible: () => reached('atoms') && copper.lattice.selected >= 0 && atRows(),
      },
    ],
  });

  return {
    spec: {
      ...world.state('rows', 1, 'rows'),
      duration: 2,
      cameraMove: { duration: 2 },
    },
    ui: atomsUi(),
    enter(i) {
      copper.atoms = Infinity;
      copper.sim.shared = 1;
      copper.marked = -1;
      copper.look.x = copper.look.y = 0;
      copper.gate.shown = 0;
      copper.sim.gate.on = false;
      copper.atom.reset();
      copper.atom.apart = 0;
      // a deep link after the goal shows the hero chosen; a first visit starts with nothing chosen
      if (i.instant) copper.hero = 0;
      copper.lattice.selected = reached('atoms') ? copper.hero : -1;
      invite = 1.2;
    },
    update(dt) {
      if (!here() || copper.lattice.selected >= 0) return;
      invite -= dt;
      if (invite <= 0) {
        invite = INVITE_EVERY;
        copper.lattice.touch(0);
      }
    },
    always(dt) {
      mode.update();
      ring.update(dt);
    },
  };
};
