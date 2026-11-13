/**
 * The Sun-path dome of step 8: the Sun's arcs over Kyiv on 21 June (`yellow`), 20 March (`amber`) and
 * 21 December (`orange`) drawn on a dome around the house, the Sun travelling along the chosen one, and the
 * beam from it to the test module. Directions come from `sunArc` of the simulation (azimuth from south, +
 * west; here south = +Z, west = −X). Units: house metres.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { RibbonLines, createBeam, createHalo } from '@/fx';
import { sunArc, type ArcSample, type SeasonDay } from '@electricity/sim/lab-pv';
import { K, type ColorToken } from '@/style';

export const DAYS: readonly SeasonDay[] = ['june21', 'march20', 'december21'];
const COLORS: Record<SeasonDay, ColorToken> = { june21: 'yellow', march20: 'amber', december21: 'orange' };
const DEG = Math.PI / 180;

/** Unit vector toward the Sun for an elevation and an azimuth (from south, + west), degrees. */
export function sunDirection(elevationDeg: number, azimuthDeg: number, out = new Vector3()): Vector3 {
  const h = elevationDeg * DEG;
  const a = azimuthDeg * DEG;
  return out.set(-Math.sin(a) * Math.cos(h), Math.sin(h), Math.cos(a) * Math.cos(h));
}

export interface SunDome {
  group: Group;
  sun: Mesh;
  /** Highest point of the June arc (hotspot anchor). */
  top: Vector3;
  /**
   * Show the Sun at day fraction `u` ∈ [0, 1) (sunrise → sunset) of `day`, for a module with the given tilt and
   * azimuth at `target`; returns the arc sample used (incidence angle, beam irradiance on the module).
   */
  set(day: SeasonDay, u: number, tiltDeg: number, azimuthDeg: number, target: Vector3): ArcSample;
}

export function createSunDome(centre: Vector3, radius: number): SunDome {
  const group = new Group();
  group.name = 'sun-dome';
  const at = (s: ArcSample, out = new Vector3()): Vector3 => sunDirection(s.elevationDeg, s.azimuthDeg, out).multiplyScalar(radius).add(centre);
  const lines = {} as Record<SeasonDay, RibbonLines>;
  let top = new Vector3();
  for (const day of DAYS) {
    const pts = sunArc(day, 0, 0, 97).map((s) => at(s));
    // painted (alpha-blended) lines: additive light would wash out to white against the day sky
    const line = new RibbonLines({ capacity: 128, color: COLORS[day], width: 0.2, intensity: 1.1, dashStrength: 0.35, dashRepeat: 0.5, dashSpeed: 0.3, blend: 'normal' });
    line.setLines([{ points: pts }]);
    lines[day] = line;
    group.add(line);
    if (day === 'june21') top = pts.reduce((best, p) => (p.y > best.y ? p : best), pts[0]!).clone();
  }
  const sun = new Mesh(new SphereGeometry(0.75, 32, 22), K.glow({ color: 'yellow', intensity: 2, whiten: 0.6 }));
  const halo = createHalo({ color: 'yellow', size: 5, intensity: 0.8, amount: 0.25 });
  sun.add(halo);
  const beam = createBeam({ from: [0, 10, 0], to: [0, 0, 0], color: 'yellow', width: 0.14, intensity: 1.2, ripple: 0.25 });
  group.add(sun, beam);
  let cached: { key: string; arc: ArcSample[] } = { key: '', arc: [] };

  return {
    group,
    sun,
    top,
    set(day, u, tiltDeg, azimuthDeg, target) {
      const key = `${day}|${tiltDeg}|${azimuthDeg}`;
      if (key !== cached.key) cached = { key, arc: sunArc(day, tiltDeg, azimuthDeg, 97) };
      const arc = cached.arc;
      const f = Math.min(arc.length - 1.001, Math.max(0, u * (arc.length - 1)));
      const i = Math.floor(f);
      const a = arc[i]!;
      const b = arc[i + 1] ?? a;
      const k = f - i;
      const s: ArcSample = {
        solarHour: a.solarHour + (b.solarHour - a.solarHour) * k,
        elevationDeg: a.elevationDeg + (b.elevationDeg - a.elevationDeg) * k,
        azimuthDeg: a.azimuthDeg + (b.azimuthDeg - a.azimuthDeg) * k,
        incidenceDeg: a.incidenceDeg + (b.incidenceDeg - a.incidenceDeg) * k,
        beamPoaWm2: a.beamPoaWm2 + (b.beamPoaWm2 - a.beamPoaWm2) * k,
      };
      at(s, sun.position);
      for (const d of DAYS) lines[d].intensity = d === day ? 1.5 : 0.45;
      beam.from.copy(sun.position);
      beam.to.copy(target);
      // the beam is as bright as the light the module actually catches (cos θ); a faint line when it shines on its back
      beam.intensity = 0.25 + 1.3 * Math.min(1, s.beamPoaWm2 / 900);
      return s;
    },
  };
}
