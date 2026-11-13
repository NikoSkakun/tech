/**
 * Stand 3 — charge playground: two charges with flowing field lines of E, the potential landscape under
 * them, and a probe arrow. Drag the negative charge: lines and landscape follow.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import {
  contourLines,
  createEquipotentials,
  createFieldLines,
  createOrbs,
  createPotentialSurface,
  createVectorArrow,
  pointChargesField,
  pointChargesPotential,
  seedsOnSphere,
} from '@/fx';
import { K, SEMANTIC } from '@/style';
import { content } from '../content';
import type { Exhibit } from './exhibit';
import { createLabel } from './label';

export function createFieldsExhibit(ctx: ChapterContext): Exhibit {
  const group = new Group();
  group.name = 'exhibit:fields';
  const Y = 3.1;
  const charges = [
    { position: new Vector3(-1.7, Y, 0), q: 1 },
    { position: new Vector3(1.7, Y, 0), q: -1 },
  ];
  const plus = createOrbs({ kind: 'proton', radius: 0.3 });
  const minus = createOrbs({ kind: 'electron', radius: 0.3 });
  group.add(plus, minus);

  const field = pointChargesField(charges);
  const seeds = (): Vector3[] => seedsOnSphere(charges[0]!.position, 0.34, 26);
  const lines = createFieldLines({
    field,
    seeds: seeds(),
    kind: 'E',
    width: 0.035,
    dashRepeat: 1.6,
    dashSpeed: 0.8,
    trace: {
      step: 0.06,
      maxLength: 14,
      bounds: { center: new Vector3(0, Y, 0), radius: 5.2 },
      stops: [{ position: charges[1]!.position, radius: 0.33 }],
      detectLoop: false,
    },
    capacity: 26 * 260,
  });
  group.add(lines);

  // potential landscape under the charges (the potential of the same two charges, sampled in its plane)
  const surface = createPotentialSurface({ size: 8.5, range: 1.4, height: 0.75, contours: 7, resolution: 80, opacity: 0.78 });
  surface.position.y = 1.0;
  group.add(surface);
  const projected = charges.map((c) => ({ position: new Vector3(), q: c.q }));
  const phi = pointChargesPotential(projected, 0.3);

  // probe: a small test charge circling the pair, with the field vector attached
  const probe = new Mesh(new SphereGeometry(0.07, 16, 12), K.glow({ color: 'white', intensity: 1.4 }));
  const arrow = createVectorArrow({ color: SEMANTIC.fieldE, radius: 0.03, headLength: 0.2, headRadius: 0.08 });
  group.add(probe, arrow);
  const hint = createLabel(content.labels.dragCharge, { offset: [0, 0.55, 0], color: 'cyan', size: 17, anchor: 'center' });
  group.add(hint);

  // equipotential lines of the same two charges in the vertical plane that contains them
  const levels = [-1.6, -0.9, -0.5, 0.5, 0.9, 1.6];
  const phiPlane = pointChargesPotential(charges, 0.2);
  const plane = { center: new Vector3(0, Y, 0), u: new Vector3(1, 0, 0), v: new Vector3(0, 1, 0), size: 9, resolution: 72 };
  const rings = createEquipotentials(contourLines(phiPlane, plane, levels), { color: 'pink', intensity: 0.7, capacity: 3000 });
  group.add(rings);

  const refresh = (): void => {
    plus.position.copy(charges[0]!.position);
    minus.position.copy(charges[1]!.position);
    hint.position.copy(charges[1]!.position);
    lines.refresh(field, seeds());
    projected.forEach((p, i) => p.position.set(charges[i]!.position.x, 0, charges[i]!.position.z));
    surface.sample(phi);
    rings.setLines(contourLines(phiPlane, plane, levels).map((c) => ({ points: c.points, closed: c.closed })));
  };
  refresh();

  // drag the negative charge across the vertical plane facing the camera
  const normal = new Vector3(0, 0, 1);
  const hit = new Vector3();
  const state = { glow: 0 };
  ctx.input.register(minus, {
    tooltip: content.labels.dragCharge,
    cursor: 'grab',
    hover: (over) => ctx.tweens.to(state, { glow: over ? 1 : 0 }, { duration: 0.12 }),
    drag: (e) => {
      if (!e.planePoint(normal, charges[1]!.position, hit)) return;
      charges[1]!.position.set(Math.min(Math.max(hit.x, -3.6), 3.6), Math.min(Math.max(hit.y, 1.9), 4.6), 0);
      refresh();
    },
  });

  const e = new Vector3();
  const p = new Vector3();
  return {
    group,
    enter(info) {
      // the lines grow out of the positive charge when the step is entered by navigation
      lines.reveal = 1;
      if (!info.instant) {
        lines.reveal = 0;
        info.scope.to(lines, { reveal: 1 }, { duration: 1.4, ease: 'power2.out' });
      }
    },
    update(_dt, t) {
      minus.glow = 1 + state.glow * 0.6;
      minus.intensity = 1.12 + state.glow * 0.12;
      p.set(Math.cos(t * 0.4) * 2.9, Y + Math.sin(t * 0.4) * 1.25, 0.6);
      probe.position.copy(p);
      field(p, e);
      const m = e.length();
      // log-compressed length: the arrow stays readable both near and far from the charges
      arrow.set(p, e.multiplyScalar((0.35 + 0.3 * Math.log10(1 + m * 20)) / Math.max(m, 1e-6)));
    },
  };
}
