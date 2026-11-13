/**
 * Step 1: the «драбина потенціалів» — twelve metals on a vertical rail, ordered by standard electrode
 * potential (Li at the bottom, Au on top). Rungs are evenly spaced (the three alkali metals would overlap on a
 * true voltage scale) and each carries its E° as text. Clicking a rung — or dragging its puck to the beaker —
 * puts that metal into the cell; a glowing bracket links the chosen pair and shows the EMF.
 */
import { BoxGeometry, CylinderGeometry, type Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ChapterContext, DragInfo } from '@/engine/api';
import { fmtUnit } from '@/content';
import { STANDARD_POTENTIALS_V, type Electrode } from '@electricity/sim/lab-battery';
import { K, MOTION, SEMANTIC } from '@/style';
import type { Text3D } from '@/text';
import type { Mats } from '../world';
import { group, mesh, tag } from '../world';
import { LADDER, METAL_LOOK } from './metals';

export interface Ladder {
  group: Group;
  rung(metal: Electrode): Group;
  /** Highlight the pair and move the EMF bracket. */
  setPair(anode: Electrode, cathode: Electrode, emfV: number): void;
}

const STEP_Y = 0.3;
const BASE_Y = 0.42;

export interface LadderHandlers {
  /** A rung was clicked / tapped. */
  pick(metal: Electrode): void;
  /** A puck is being dragged away from its rung (the step shows a ghost puck and decides where it lands). */
  drag?(metal: Electrode, phase: 'start' | 'move' | 'end', e: DragInfo): void;
}

export function createLadder(ctx: ChapterContext, mats: Mats, title: string, on: LadderHandlers): Ladder {
  const g = group('ladder');
  const height = BASE_Y + STEP_Y * (LADDER.length - 1) + 0.35;
  const postGeometry = new CylinderGeometry(0.035, 0.035, height, 12);
  g.add(
    mesh(postGeometry, mats.dark, -0.22, height / 2, 0),
    mesh(postGeometry, mats.dark, 0.22, height / 2, 0),
  );
  g.add(mesh(new RoundedBoxGeometry(0.9, 0.1, 0.5, 3, 0.04), mats.plinth, 0, 0.05, 0));
  const header = tag(title, 19, 'lime');
  header.position.set(0.3, 0.06, 0.62);
  g.add(header);

  const puck = new RoundedBoxGeometry(0.56, 0.2, 0.2, 4, 0.07);
  // invisible touch target over the puck and its label: as tall as the rung spacing allows (DECISIONS §57 b)
  const hitGeometry = new BoxGeometry(1.95, STEP_Y * 0.96, 0.34);
  const hitMaterial = new MeshBasicMaterial({ visible: false });
  const rungs = new Map<Electrode, { g: Group; state: { hover: number; on: number }; text: Text3D }>();
  LADDER.forEach((metal, i) => {
    const rg = group(`rung:${metal}`, 0, BASE_Y + i * STEP_Y, 0);
    const mat = K.toon({ color: METAL_LOOK[metal].rod, gloss: 0.5, emissive: 'cyan', emissiveIntensity: 0 });
    const body = mesh(puck, mat);
    const text = tag(
      `${metal}  ${fmtUnit(STANDARD_POTENTIALS_V[metal], 'V', { digits: 2 })}`,
      17,
      'white',
      'mono',
    );
    text.position.set(0.95, 0, 0);
    const hit = new Mesh(hitGeometry, hitMaterial);
    hit.position.x = 0.62;
    rg.add(body, text, hit);
    g.add(rg);
    const state = { hover: 0, on: 0 };
    rungs.set(metal, { g: rg, state, text });
    const sync = (): void => {
      // hover = cyan affordance glow, chosen = the rung slides out toward the viewer and grows
      mat.emissiveIntensity = 0.5 * state.hover;
      body.scale.setScalar(1 + 0.12 * state.hover + 0.2 * state.on);
      body.position.z = 0.16 * state.on;
    };
    ctx.input.register(rg, {
      cursor: 'grab',
      hover: (over) =>
        ctx.tweens.to(state, { hover: over ? 1 : 0 }, { duration: MOTION.hover.duration, onUpdate: sync }),
      click: () => on.pick(metal),
      dragStart: (e) => on.drag?.(metal, 'start', e),
      drag: (e) => on.drag?.(metal, 'move', e),
      dragEnd: (e) => on.drag?.(metal, 'end', e),
    });
    (rg.userData as { sync: () => void }).sync = sync;
  });

  // bracket between the chosen rungs: − (blue) end on the anode, + (coral) end on the cathode, EMF in the middle
  const bracket = group('bracket', -0.62, 0, 0);
  const barMat = K.glow({ color: 'lime', intensity: 1.5, keepHue: true, whiten: 0, falloff: 0 });
  const bar = new Mesh(new CylinderGeometry(0.03, 0.03, 1, 10), barMat);
  const endGeometry = new SphereGeometry(0.085, 16, 12);
  const minus = new Mesh(
    endGeometry,
    K.glow({ color: SEMANTIC.dcMinus, intensity: 1.6, keepHue: true, whiten: 0 }),
  );
  const plus = new Mesh(
    endGeometry,
    K.glow({ color: SEMANTIC.dcPlus, intensity: 1.6, keepHue: true, whiten: 0 }),
  );
  const emf = tag('', 24, 'lime');
  emf.position.set(-0.62, 0, 0);
  bracket.add(bar, minus, plus, emf);
  g.add(bracket);
  const span = { lo: BASE_Y, hi: BASE_Y + STEP_Y };
  const place = (): void => {
    bar.position.y = (span.lo + span.hi) / 2;
    bar.scale.y = Math.max(span.hi - span.lo, 0.01);
    minus.position.y = span.lo;
    plus.position.y = span.hi;
    emf.position.y = (span.lo + span.hi) / 2;
  };
  place();

  return {
    group: g,
    rung: (metal) => rungs.get(metal)!.g,
    setPair(anode, cathode, emfV) {
      for (const [metal, r] of rungs) {
        const on = metal === anode || metal === cathode ? 1 : 0;
        r.text.color = on ? 'white' : 'mist';
        r.text.opacity = on ? 1 : 0.7;
        ctx.tweens.to(
          r.state,
          { on },
          { duration: 0.3, ease: 'back.out', onUpdate: (r.g.userData as { sync: () => void }).sync },
        );
      }
      const y = (m: Electrode): number => BASE_Y + LADDER.indexOf(m) * STEP_Y;
      ctx.tweens.to(
        span,
        { lo: y(anode), hi: y(cathode) },
        { duration: 0.45, ease: 'power2.out', onUpdate: place },
      );
      emf.text = `ℰ = ${fmtUnit(emfV, 'V', { digits: 2 })}`;
    },
  };
}
