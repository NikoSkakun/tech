/**
 * Step 1 `what-is-battery` — a galvanic cell on the podium, the ladder of standard potentials beside it and
 * the museum of battery history behind. Model: `galvanicPair` (§M1).
 *
 * Three ways to put a metal into the beaker: drag its puck from the ladder (the scripted gesture), tap the
 * rung, or tap its chip in the dock (the HUD route for small touch screens, DECISIONS §57).
 */
import { Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '@/audio';
import { galvanicPair, type Electrode } from '@electricity/sim/lab-battery';
import { K, col } from '@/style';
import { Chip, Label, TEXT_COLOR, UI, col as column, row } from '@/ui3d';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { note } from '../notes';
import { createDaniellCell } from '../parts/daniell';
import { createLadder } from '../parts/ladder';
import { LADDER, METAL_LOOK, reactive } from '../parts/metals';
import { createMuseum } from '../parts/museum';
import { frame } from '../shots';
import { group, mesh } from '../world';

const ID = 'what-is-battery';
/** A dragged puck lands in the beaker when it is released this close to it on screen (share of the height). */
const DROP_RADIUS = 0.34;

export const whatIsBattery: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const cell = createDaniellCell(ctx, mats);
  cell.group.position.set(0.55, 0, 0.75);
  const museum = createMuseum();
  museum.group.position.set(2.55, 0, -1.9);

  // the two metals in the beaker; a newly picked metal replaces the one chosen longer ago
  const chosen: Electrode[] = ['Zn', 'Cu'];
  let emfV = 0;
  let water = false;
  const apply = (instant = false): void => {
    const pair = galvanicPair(chosen[0]!, chosen[1]!);
    emfV = pair.emfV;
    water = pair.reactsWithWater;
    cell.set(
      {
        anode: { ...METAL_LOOK[pair.anode], reactive: reactive(pair.anode) },
        cathode: { ...METAL_LOOK[pair.cathode], reactive: reactive(pair.cathode) },
        emfV,
      },
      instant,
    );
    ladder.setPair(pair.anode, pair.cathode, emfV);
    for (const [metal, chip] of chips) chip.color = chosen.includes(metal) ? 'lime' : 'mist';
  };
  const pick = (metal: Electrode): void => {
    if (chosen.includes(metal)) return;
    chosen.shift();
    chosen.push(metal);
    audio.play('tick', { pitch: 1.1 });
    apply();
  };

  // The ladder again as twelve chips in the dock (two rows, the chosen pair lime): a segmented control shows
  // one choice, the beaker holds two.
  const chips = new Map<Electrode, Chip>(
    LADDER.map((metal) => {
      const chip = new Chip({ text: metal, kind: 'plain', onClick: () => pick(metal) });
      chip.name = `ctl-metal1:${metal}`;
      chip.minHit = 44;
      return [metal, chip];
    }),
  );
  const ladderChips = column({
    gap: 6,
    width: 'fill',
    children: [
      new Label(L.ladder, { size: UI.text.small, color: TEXT_COLOR.dim }),
      row({ wrap: true, gap: 6, width: 'fill', children: [...chips.values()] }),
    ],
  });

  /* -------------------------------------------------------------- drag a puck from the ladder */
  const ghostMat = K.toon({ color: 'white', gloss: 0.5, emissive: 'cyan', emissiveIntensity: 0.35 });
  const ghost = mesh(new RoundedBoxGeometry(0.56, 0.2, 0.2, 4, 0.07), ghostMat);
  ghost.visible = false;
  const from = new Vector3();
  const normal = new Vector3();
  const p = new Vector3();
  const q = new Vector3();
  /** Screen distance between the ghost and the middle of the beaker, in viewport heights. */
  const toBeaker = (): number => {
    const cam = ctx.camera.camera;
    ghost.getWorldPosition(p).project(cam);
    cell.beaker.getWorldPosition(q).project(cam);
    return Math.hypot(((p.x - q.x) * cam.aspect) / 2, (p.y - q.y) / 2);
  };
  const ladder = createLadder(ctx, mats, L.ladder, {
    pick,
    drag(metal, phase, e) {
      if (phase === 'start') {
        ghostMat.color.copy(col(METAL_LOOK[metal].rod));
        ladder.rung(metal).getWorldPosition(from);
        ghost.visible = true;
      }
      // the puck follows the pointer in the camera-facing plane through its rung
      const at = e.planePoint(ctx.camera.camera.getWorldDirection(normal), from, p);
      if (at) ghost.position.copy(set.worldToLocal(at));
      const near = toBeaker() < DROP_RADIUS;
      ghostMat.emissiveIntensity = near ? 1.1 : 0.35;
      if (phase !== 'end') return;
      ghost.visible = false;
      if (near) pick(metal);
    },
  });
  ladder.group.position.set(-3.8, 0, -0.2);
  ladder.group.rotation.y = 0.3;
  const set = group(`set:${ID}`, 0, 0, 0, [cell.group, ladder.group, museum.group, ghost]);
  lab.stageRoot.add(set);
  // rungs are probed at their origin (the puck): their bounds include the label and the touch target
  for (const metal of LADDER) ctx.qa.probe(`rung:${metal}`, ladder.rung(metal), { origin: true });
  ctx.qa.probe('beaker', cell.beaker);

  const charging = (): boolean => ui.value<string>('mode1') === 'charge';
  ui.onChange('mode1', () => (cell.charging = charging()));

  return {
    id: ID,
    shots: {
      [ID]: frame([-0.15, 2.3, 0.2], 9.0, 5.3, {
        azimuth: 0.27,
        elevation: 0.2,
        orbit: { azimuth: 0.9, polar: 0.3 },
      }),
    },
    stage: {
      show: [museum.group, ladder.group, cell.group],
      enter: (info) => {
        ghost.visible = false;
        cell.charging = charging();
        apply(info.instant);
      },
    },
    ui: {
      hint: L.hint1,
      honesty: ['simplified', 'notToScale'],
      controls: [
        {
          type: 'segmented',
          id: 'mode1',
          items: [
            { id: 'discharge', label: L.discharge },
            { id: 'charge', label: L.charge },
          ],
          value: 'discharge',
        },
        { type: 'custom', id: 'metal1', node: ladderChips },
        { type: 'readout', id: 'emf1', label: L.emf, unit: 'V', digits: 2, get: () => emfV },
        note('ideal1', L.idealised, 'honesty'),
        note('water1', L.reactsWithWater, 'alarm', () => water),
        note('oneWay1', L.notRechargeable, 'info', charging),
      ],
      callouts: [
        // the pole names hang on the terminals above the rim, outside the glass
        { anchor: cell.minusKnob, text: L.anode, color: 'blue', side: 'left' },
        { anchor: cell.plusKnob, text: L.cathode, color: 'coral', side: 'right' },
        { anchor: cell.lamp, text: L.electronsWire, color: 'cyan', side: 'up' },
        { anchor: museum.anchor('nimh'), text: L.niMh, side: 'down' },
        { anchor: museum.anchor('liion'), text: L.liIon1991, side: 'up' },
      ],
      hotspots: [
        { anchor: museum.anchor('volta'), content: 'volta-pile' },
        { anchor: museum.anchor('lead'), content: 'lead-acid' },
      ],
    },
    probe: () => ({ emfV, pair: chosen.join('-'), charging: cell.charging, water, dragging: ghost.visible }),
    update: (dt, t) => cell.update(dt, t),
  };
};
