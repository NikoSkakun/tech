/**
 * `charge-field` «Модель симуляції» §3 (step `field`): charges q ∈ {−2, −1, +1, +2} nC on the table plane XZ
 * (|r| ≤ 0,18 m, ≤ 6 charges). Field lines: 8·|q| seeds per positive charge on a 6 mm circle, RK4 along E/|E| with
 * softened field (ε = 2 mm), step 1,5 mm (×0,3 near charges), stop within 6 mm of a negative charge, outside
 * 0,2 m or after 400 steps; without positive charges lines start at negatives integrating against the field.
 * Probe readout uses the exact field (probe kept ≥ 6 mm from charges). Released test charge: m·a = q·E (Verlet,
 * no friction) with a scenic q/m.
 */
import { electricField, traceStreamline, vec3, vLength, type PointCharge, type Streamline, type Vec3 } from '../core/S1-sim/field';

export const SANDBOX = {
  allowedChargesNC: [-2, -1, 1, 2] as const,
  maxCharges: 6,
  tableRadiusM: 0.18,
  boundaryRadiusM: 0.2,
  softeningM: 0.002,
  seedRadiusM: 0.006,
  stepM: 0.0015,
  nearScale: 0.3,
  /** Distance within which the step is refined ×0,3 (our choice: 15 mm). */
  nearRadiusM: 0.015,
  sinkRadiusM: 0.006,
  maxSteps: 400,
  probeMinDistanceM: 0.006,
  gridSize: 16,
} as const;

/** A sandbox charge on the table: x, z in metres, q in nC. */
export interface TableCharge {
  x: number;
  z: number;
  chargeNC: number;
}

export const toPointCharges = (charges: readonly TableCharge[]): PointCharge[] =>
  charges.map((c) => ({ position: vec3(c.x, 0, c.z), chargeC: c.chargeNC * 1e-9 }));

/** Presets «Один заряд», «Диполь» (±1 nC, 4 cm), «Два однойменні» (+1, +1, 4 cm), «Квадруполь» (±1 nC, 4 cm square). */
export const FIELD_PRESETS: Readonly<Record<'single' | 'dipole' | 'likeCharges' | 'quadrupole', readonly TableCharge[]>> = {
  single: [{ x: 0, z: 0, chargeNC: 1 }],
  dipole: [
    { x: -0.02, z: 0, chargeNC: 1 },
    { x: 0.02, z: 0, chargeNC: -1 },
  ],
  likeCharges: [
    { x: -0.02, z: 0, chargeNC: 1 },
    { x: 0.02, z: 0, chargeNC: 1 },
  ],
  quadrupole: [
    { x: -0.02, z: -0.02, chargeNC: 1 },
    { x: 0.02, z: -0.02, chargeNC: -1 },
    { x: 0.02, z: 0.02, chargeNC: 1 },
    { x: -0.02, z: 0.02, chargeNC: -1 },
  ],
};

/** Exact field at a table point (probe), V/m; position pushed out to ≥ 6 mm from every charge. */
export function probeField(charges: readonly TableCharge[], x: number, z: number): { field: Vec3; magnitudeVPerM: number; x: number; z: number } {
  let px = x;
  let pz = z;
  for (const c of charges) {
    const dx = px - c.x;
    const dz = pz - c.z;
    const d = Math.hypot(dx, dz);
    if (d < SANDBOX.probeMinDistanceM) {
      const s = SANDBOX.probeMinDistanceM / (d || 1);
      px = c.x + (d ? dx * s : SANDBOX.probeMinDistanceM);
      pz = c.z + (d ? dz * s : 0);
    }
  }
  const e = electricField(toPointCharges(charges), vec3(px, 0, pz));
  return { field: e, magnitudeVPerM: vLength(e), x: px, z: pz };
}

/** All field lines for the current arrangement. */
export function traceFieldLines(charges: readonly TableCharge[]): Streamline[] {
  const pcs = toPointCharges(charges);
  const field = (p: Vec3): Vec3 => electricField(pcs, p, SANDBOX.softeningM);
  const positives = charges.filter((c) => c.chargeNC > 0);
  const sources = positives.length > 0 ? positives : charges.filter((c) => c.chargeNC < 0);
  const direction: 1 | -1 = positives.length > 0 ? 1 : -1;
  const sinks = charges.filter((c) => (direction === 1 ? c.chargeNC < 0 : c.chargeNC > 0));
  const near = (p: Vec3): number => Math.min(...charges.map((c) => Math.hypot(p.x - c.x, p.z - c.z)));
  const lines: Streamline[] = [];
  for (const s of sources) {
    const n = 8 * Math.abs(s.chargeNC);
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * (k + 0.5)) / n;
      const seed = vec3(s.x + SANDBOX.seedRadiusM * Math.cos(a), 0, s.z + SANDBOX.seedRadiusM * Math.sin(a));
      lines.push(
        traceStreamline(field, seed, {
          stepM: SANDBOX.stepM,
          maxSteps: SANDBOX.maxSteps,
          direction,
          stepScale: (p) => (near(p) < SANDBOX.nearRadiusM ? SANDBOX.nearScale : 1),
          stop: (p) => {
            if (sinks.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < SANDBOX.sinkRadiusM)) return 'sink';
            return Math.hypot(p.x, p.z) > SANDBOX.boundaryRadiusM ? 'boundary' : null;
          },
        }),
      );
    }
  }
  return lines;
}

/** «Вектори сітки»: 16×16 grid over the table square (cell centres), exact field per cell. */
export function fieldGrid(charges: readonly TableCharge[], size: number = SANDBOX.gridSize, halfExtentM: number = SANDBOX.tableRadiusM): { x: number; z: number; field: Vec3 }[] {
  const pcs = toPointCharges(charges);
  const out: { x: number; z: number; field: Vec3 }[] = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = -halfExtentM + ((i + 0.5) * 2 * halfExtentM) / size;
      const z = -halfExtentM + ((j + 0.5) * 2 * halfExtentM) / size;
      out.push({ x, z, field: electricField(pcs, vec3(x, 0, z), SANDBOX.softeningM) });
    }
  }
  return out;
}

/** Keeps a dragged charge on the table (|r| ≤ 0,18 m). */
export function clampToTable(x: number, z: number): { x: number; z: number } {
  const r = Math.hypot(x, z);
  if (r <= SANDBOX.tableRadiusM) return { x, z };
  const s = SANDBOX.tableRadiusM / r;
  return { x: x * s, z: z * s };
}
