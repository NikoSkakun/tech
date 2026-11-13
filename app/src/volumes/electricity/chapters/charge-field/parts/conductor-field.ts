/**
 * Field lines of step 5. Ball / cage: the uniform field E₀ (left → right) bent by an uncharged conducting
 * sphere — the sim's closed form `sphereInUniformField` (lines end on the surface at right angles and there
 * are none inside); integrated with the fx `streamline` (RK4) and drawn with the fx ribbons. Tip: lines of a
 * charged drop-shaped conductor, modelled by a chain of shrinking point charges on its axis (illustrative).
 */
import { Vector3 } from 'three';
import { pointChargesField, RibbonLines, streamline, type VectorField } from '@/fx';
import { sphereInUniformField } from '@electricity/sim/charge-field';
import { SEMANTIC } from '@/style';
import { CONDUCTOR } from '../layout';
import { TIP_X } from './conductors';

const R = CONDUCTOR.radius;
const X0 = -CONDUCTOR.plates + 0.2;

export interface ConductorField {
  lines: RibbonLines;
  /** Uniform field around a conducting sphere at `centre`; `density` 0…1 = E₀ / 100 kV/m; `inside`: sphere in the field. */
  traceSphere(centre: Vector3, density: number, inside: boolean): void;
  /** Charged drop with its tip toward +X. */
  traceTip(centre: Vector3, density: number): void;
}

export function createConductorField(): ConductorField {
  const lines = new RibbonLines({
    capacity: 9000,
    color: SEMANTIC.fieldE,
    width: 0.05,
    intensity: 1.25,
    dashRepeat: 1.3,
    dashSpeed: 1.1,
    dashStrength: 0.7,
    base: 0.45,
    endFade: [0.03, 0.03],
    keepHue: true,
  });
  lines.name = 'conductor-field';
  lines.frustumCulled = false;
  const bounds = { center: new Vector3(0, CONDUCTOR.y, 0), radius: CONDUCTOR.plates + 0.3 };
  return {
    lines,
    traceSphere(c, density, inside) {
      if (density <= 0) return lines.setLines([]);
      // scene X is the sim's field axis z; the shape of the lines does not depend on the magnitude
      const field: VectorField = (p, out) => {
        if (!inside) return out.set(1, 0, 0);
        const e = sphereInUniformField(1, R, { x: p.z - c.z, y: p.y - c.y, z: p.x - c.x });
        return out.set(e.z, e.y, e.x);
      };
      const stops = inside ? [{ position: c, radius: R * 1.02 }] : [];
      const opts = { step: 0.08, maxLength: 2 * CONDUCTOR.plates + 4, bounds, stops, detectLoop: false };
      const out: { points: Vector3[] }[] = [];
      const n = 5 + Math.round(8 * density); // line density ∝ E₀
      const seeds: Vector3[] = [];
      for (let i = 0; i < n; i++)
        seeds.push(new Vector3(X0, CONDUCTOR.y, ((i + 0.5) / n - 0.5) * 2 * CONDUCTOR.halfWidth));
      // a second, sparser layer above shows that the lines also bend over the top of the ball
      const m = Math.ceil(n / 2);
      for (let i = 0; i < m; i++)
        seeds.push(new Vector3(X0, CONDUCTOR.y + 1.0, ((i + 0.5) / m - 0.5) * 1.5 * CONDUCTOR.halfWidth));
      for (const seed of seeds) {
        const line = streamline(field, seed, opts);
        out.push({ points: line.points });
        const end = line.points[line.points.length - 1]!;
        if (!inside || end.distanceTo(c) > R * 1.08) continue;
        // a line that ended on the ball leaves it at the mirrored point of the other hemisphere
        const exit = new Vector3(c.x - (end.x - c.x), end.y, end.z)
          .sub(c)
          .setLength(R * 1.04)
          .add(c);
        out.push({ points: streamline(field, exit, opts).points });
      }
      lines.setLines(out.filter((l) => l.points.length > 1));
    },
    traceTip(c, density) {
      if (density <= 0) return lines.setLines([]);
      // sphere-chain picture of a pointed conductor at one potential: charge ∝ radius of each sphere
      const chain = [
        { position: c.clone(), q: 1 },
        { position: new Vector3(c.x + 1.05, c.y, c.z), q: 0.42 },
        { position: new Vector3(c.x + 1.65, c.y, c.z), q: 0.2 },
        { position: new Vector3(c.x + TIP_X - 0.2, c.y, c.z), q: 0.12 },
      ];
      const field = pointChargesField(chain);
      const opts = { step: 0.07, maxLength: 7, bounds: { center: c, radius: 5.4 }, detectLoop: false };
      const out: { points: Vector3[] }[] = [];
      const body = 6 + Math.round(6 * density);
      for (let i = 0; i < body; i++) {
        const a = Math.PI * 0.5 + ((i + 0.5) / body) * Math.PI; // the blunt back half of the drop
        out.push({
          points: streamline(
            field,
            new Vector3(c.x + Math.cos(a) * R * 0.95, c.y, c.z + Math.sin(a) * R * 0.95),
            opts,
          ).points,
        });
      }
      // the same number of lines again from the tiny tip: there they are crowded — the field is strongest
      const tip = 5 + Math.round(6 * density);
      for (let i = 0; i < tip; i++) {
        const a = ((i + 0.5) / tip - 0.5) * Math.PI * 1.25;
        out.push({
          points: streamline(
            field,
            new Vector3(c.x + TIP_X + Math.cos(a) * 0.1, c.y, c.z + Math.sin(a) * 0.1),
            opts,
          ).points,
        });
      }
      lines.setLines(out.filter((l) => l.points.length > 1));
    },
  };
}
