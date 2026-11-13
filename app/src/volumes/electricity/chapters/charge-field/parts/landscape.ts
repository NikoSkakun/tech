/**
 * `PotentialSurface` of step 4: the table top as a landscape whose height is the potential (sim §4:
 * h = H·tanh(φ/φ_s), `landscapeHeight`) in the voltage ramp `blue` → `pink` → `coral`, with equipotential lines
 * every ΔU volts. Surface and iso-lines are the fx effects; this module only feeds them:
 *  - the fx sheet saturates its input as g(a) = 1,55·a/(1 + 0,55·|a|), so it is given a = g⁻¹(u) with
 *    u = sign·tanh(φ/φ_s) — the drawn height is then exactly the model's;
 *  - iso-lines are marching-squares contours of the same softened potential at true multiples of ΔU, lifted
 *    onto the sheet (the sheet's own engraved contours follow the warped value and are switched off).
 * `sign` −1 shows W = q·φ for a negative ball: heights flip, colours keep meaning the potential.
 */
import { Group, Vector3, type Vector4 } from 'three';
import {
  contourLines,
  createEquipotentials,
  createPotentialSurface,
  type PotentialSurface,
  type RibbonLines,
} from '@/fx';
import {
  landscapeHeight,
  landscapePotential,
  POTENTIAL,
  type TableCharge,
} from '@electricity/sim/charge-field';
import { col } from '@/style';
import { LANDSCAPE, M, TABLE } from '../layout';

/** Iso-lines are drawn for |φ| up to this (closer to a charge they would merge into a blot). */
const MAX_LEVEL_V = 1000;
const MAX_LEVELS = 24; // per sign
const H = POTENTIAL.heightScaleM * M;

export interface Landscape {
  group: Group;
  surface: PotentialSurface;
  isolines: RibbonLines;
  /** +1: potential relief (positive ball) … −1: energy relief of a negative ball. */
  sign: number;
  /** ΔU between iso-lines, V. */
  stepV: number;
  /** Scene height of the sheet above the table point (x, z) in metres. */
  heightAt(xM: number, zM: number): number;
  refresh(charges: readonly TableCharge[]): void;
}

export function createLandscape(): Landscape {
  const group = new Group();
  group.name = 'landscape';
  const surface = createPotentialSurface({
    size: LANDSCAPE.size,
    resolution: 96,
    range: 1,
    height: H,
    contours: 1e-4,
    opacity: 0.66,
  });
  surface.position.y = LANDSCAPE.y;
  const isolines = createEquipotentials([], {
    capacity: 14000,
    color: 'white',
    width: 0.022,
    intensity: 0.85,
    endFade: [0, 0],
  });
  isolines.frustumCulled = false;
  // transparent objects centred on the same point: fix the order (sheet, iso-lines, then the field lines)
  surface.renderOrder = 1;
  isolines.renderOrder = 2;
  group.add(surface, isolines);
  (surface.material.uniforms.uLook!.value as Vector4).x = 1e-4;
  const [low, , high] = surface.ramp;
  const blue = col('blue');
  const coral = col('coral');

  let charges: readonly TableCharge[] = [];
  const land: Landscape = {
    group,
    surface,
    isolines,
    sign: 1,
    stepV: POTENTIAL.defaultIsolineStepV,
    heightAt: (x, z) => LANDSCAPE.y + land.sign * landscapeHeight(charges, x, z, 1) * M,
    refresh(next) {
      charges = next;
      const s = land.sign;
      // the fx ramp runs along the drawn height; swapped with `sign`, so that blue always means low potential
      low.copy(blue).lerp(coral, (1 - s) / 2);
      high.copy(coral).lerp(blue, (1 - s) / 2);
      surface.sample((p) => {
        const u = (s * landscapeHeight(charges, p.x / M, p.z / M, 1)) / POTENTIAL.heightScaleM;
        return u / (1.55 - 0.55 * Math.abs(u));
      });
      const levels: number[] = [0];
      for (let k = 1; k <= MAX_LEVELS && k * land.stepV <= MAX_LEVEL_V; k++)
        levels.push(k * land.stepV, -k * land.stepV);
      const contours = contourLines(
        (p) => landscapePotential(charges, p.x / M, p.z / M),
        { center: new Vector3(), size: LANDSCAPE.size, resolution: 72 },
        levels,
      );
      // clip to the round table and lay the lines on the sheet
      const out: { points: Vector3[]; closed: boolean }[] = [];
      const rim = TABLE.radius * 0.88;
      for (const c of contours) {
        let run: Vector3[] = [];
        let cut = false;
        for (const p of c.points) {
          if (Math.hypot(p.x, p.z) > rim) {
            if (run.length > 1) out.push({ points: run, closed: false });
            run = [];
            cut = true;
            continue;
          }
          run.push(p.setY(land.heightAt(p.x / M, p.z / M) + 0.025));
        }
        if (run.length > 1) out.push({ points: run, closed: c.closed && !cut });
      }
      isolines.setLines(out);
    },
  };
  return land;
}
