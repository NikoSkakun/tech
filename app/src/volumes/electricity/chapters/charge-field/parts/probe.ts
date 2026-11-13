/**
 * «Пробний заряд» of step 3: a tiny `coral` ball with an `amber` arrow that shows E⃗ at its place (length ∝
 * log|E|), plus up to five "pins" — copies left where the learner tapped. Positions are in metres on the table.
 */
import { Group, Mesh, SphereGeometry } from 'three';
import { createVectorArrow, type VectorArrow } from '@/fx';
import { probeField, type TableCharge } from '@electricity/sim/charge-field';
import { K, SEMANTIC } from '@/style';
import { CHARGE_Y, M } from '../layout';
import { clamp } from '../chapter';

export const MAX_PINS = 5;

/** Arrow length (scene units) for a field strength: 0,35 at 100 V/m, +0,3 per decade, at most 1,7. */
export const arrowLength = (vPerM: number): number =>
  vPerM > 0 ? clamp(0.35 + 0.3 * Math.log10(vPerM / 100), 0.2, 1.7) : 0;

interface Marker {
  group: Group;
  arrow: VectorArrow;
  x: number;
  z: number;
}

export interface FieldProbe {
  group: Group;
  /** Pick / drag target of the live probe. */
  handle: Mesh;
  x: number;
  z: number;
  /** |E| at the probe, V/m (exact field, sim `probeField`). */
  strength: number;
  pins: number;
  /** Re-evaluate the probe and every pin for these charges. */
  refresh(charges: readonly TableCharge[]): void;
  pin(): boolean;
  clear(): void;
}

export function createFieldProbe(): FieldProbe {
  const group = new Group();
  group.name = 'field-probe';
  const body = K.glow({ color: SEMANTIC.proton, whiten: 0.15, keepHue: true, intensity: 1.5 });
  const pinBody = K.toon({ color: 'white', emissive: 'amber', emissiveIntensity: 0.5 });
  const marker = (live: boolean): Marker => {
    const g = new Group();
    const ball = new Mesh(new SphereGeometry(live ? 0.15 : 0.09, 20, 14), live ? body : pinBody);
    const arrow = createVectorArrow({
      color: SEMANTIC.fieldE,
      radius: live ? 0.05 : 0.035,
      headLength: live ? 0.26 : 0.2,
      headRadius: live ? 0.12 : 0.09,
      intensity: 1.3,
    });
    g.add(ball, arrow);
    group.add(g);
    return { group: g, arrow, x: 0, z: 0 };
  };
  const live = marker(true);
  const handle = new Mesh(new SphereGeometry(0.55, 12, 8), K.flat('cyan'));
  handle.material.colorWrite = false;
  handle.material.depthWrite = false;
  live.group.add(handle);
  const pins = Array.from({ length: MAX_PINS }, () => marker(false));
  for (const p of pins) p.group.visible = false;

  const place = (m: Marker, charges: readonly TableCharge[]): number => {
    const e = probeField(charges, m.x, m.z);
    m.group.position.set(e.x * M, CHARGE_Y, e.z * M);
    const len = arrowLength(e.magnitudeVPerM);
    m.arrow.visible = len > 0;
    if (len > 0) {
      const k = len / e.magnitudeVPerM;
      m.arrow.set([0, 0, 0], [e.field.x * k, 0, e.field.z * k]);
    }
    return e.magnitudeVPerM;
  };
  const probe: FieldProbe = {
    group,
    handle,
    x: 0,
    z: 0.055,
    strength: 0,
    pins: 0,
    refresh(charges) {
      live.x = probe.x;
      live.z = probe.z;
      probe.strength = place(live, charges);
      pins.forEach((p, i) => {
        p.group.visible = i < probe.pins;
        if (i < probe.pins) place(p, charges);
      });
    },
    pin() {
      if (probe.pins >= MAX_PINS) return false;
      const p = pins[probe.pins++]!;
      p.x = probe.x;
      p.z = probe.z;
      return true;
    },
    clear() {
      probe.pins = 0;
    },
  };
  return probe;
}
